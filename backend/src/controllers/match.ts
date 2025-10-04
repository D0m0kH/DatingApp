// backend/src/controllers/match.ts

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AppError, AuthError, NotFoundError } from '../utils/errors';
import { MatchStatus, PhotoModerationStatus } from '@prisma/client';
import { redis } from '../utils/redis';
import { getRecommendationsForUser, computeMultiCompatibilityScore } from '../services/recommendation';
import { sendPushToUser } from '../services/notifications';
import { Match } from '../types/shared';
import { io as socketEmitter } from '../utils/socketEmitter';

// --- Advanced Helpers ---

/**
 * @description Generates a standardized, unique key for a match between two users.
 */
const getMatchUniqueConstraint = (userId1: string, userId2: string) => {
    // Ensures consistency regardless of which user is 'liker' and which is 'liked'
    return userId1 < userId2
        ? { userId1: userId1, userId2: userId2 }
        : { userId1: userId2, userId2: userId1 };
};


/**
 * POST /api/match/like/:toUserId - Send a like
 */
export const likeUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const likerId = req.user!.id;
        const { toUserId } = req.params;
        const { isSuperLike = false, contextualId } = req.validatedBody; // Contextual ID for 'met at event X'

        if (likerId === toUserId) {
            throw new AppError('Cannot like yourself.', 400, 'SELF_LIKE_FORBIDDEN');
        }

        // 1. Check if Blocked/Reported
        const isBlocked = await prisma.report.count({ where: { reporterId: likerId, reportedId: toUserId, autoBlocked: true } });
        if (isBlocked) {
             throw new AppError('Cannot interact with a blocked user.', 403, 'USER_BLOCKED');
        }

        // 2. Create the new Like record
        // Upsert is safer to handle cases where a dislike might be replaced by a like
        const newLike = await prisma.like.upsert({
            where: { likerId_likedId: { likerId, likedId: toUserId } },
            update: { isSuperLike, isDislike: false, isMatch: false },
            create: { likerId, likedId: toUserId, isSuperLike },
        });

        // 3. Check for reciprocal like (The Match moment)
        const reciprocalLike = await prisma.like.findUnique({
            where: { likerId_likedId: { likerId: toUserId, likedId: likerId } },
        });

        let matchFound = false;
        if (reciprocalLike) {
            matchFound = true;
            console.log(`🎉 Mutual Match Found between ${likerId} and ${toUserId}!`);

            // Compute Multi-Compatibility Score (Advanced)
            const scores = await computeMultiCompatibilityScore(likerId, toUserId);

            // Create Match Record
            const matchData = getMatchUniqueConstraint(likerId, toUserId);
            const newMatch = await prisma.match.create({
                data: {
                    ...matchData,
                    status: 'MATCHED',
                    coreCompatibility: scores.core,
                    chatStyleScore: scores.chat,
                    settings: contextualId ? { contextualId } : {}, // Store contextual info
                },
                include: { user1: { select: { firstName: true } }, user2: { select: { firstName: true } } }
            });

            // Update both Like records
            await prisma.like.update({ where: { id: newLike.id }, data: { isMatch: true } });
            await prisma.like.update({ where: { id: reciprocalLike.id }, data: { isMatch: true } });

            // 4. Emit notifications (Socket.IO + Push)
            const otherUserId = toUserId;
            const currentUserName = req.user!.email;

            socketEmitter.to(`user:${likerId}`).emit('matchFound', { matchId: newMatch.id, otherUserName: newMatch.user2.firstName, coreScore: newMatch.coreCompatibility });
            socketEmitter.to(`user:${otherUserId}`).emit('matchFound', { matchId: newMatch.id, otherUserName: newMatch.user1.firstName, coreScore: newMatch.coreCompatibility });

            sendPushToUser(otherUserId, { title: 'New Match!', body: `${currentUserName} liked you back!` });
        }

        // 5. Advanced: Immediately re-score the feed for the current user (low priority job)
        // MatchScoringQueue.add('rescore-user', { userId: likerId }, { delay: 1000, priority: 8 });

        res.status(200).json({ message: matchFound ? 'Mutual match created!' : 'Like sent.', matchFound });
    } catch (error) { next(error); }
};

/**
 * POST /api/match/dislike/:toUserId - Send a dislike
 */
export const dislikeUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const likerId = req.user!.id;
        const { toUserId } = req.params;

        // 1. Create or update as a dislike signal
        await prisma.like.upsert({
            where: { likerId_likedId: { likerId, likedId: toUserId } },
            update: { isDislike: true, isMatch: false, isSuperLike: false },
            create: { likerId, likedId: toUserId, isDislike: true },
        });

        // 2. Advanced: Store short-term exclusion in Redis (e.g., 3 days)
        await redis.set(`dislike:${likerId}:${toUserId}`, 'true', 'EX', 60 * 60 * 24 * 3);

        res.status(200).json({ message: 'Dislike recorded. Candidate excluded from feed.' });
    } catch (error) { next(error); }
};

/**
 * POST /api/match/undo - Undo the last swipe (Premium Feature Gate)
 */
export const undoLastSwipe = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        const { lastSwipedId } = req.validatedBody;

        // 1. Premium Feature Gate Check
        if (!req.user?.isPremium) {
            throw new AppError('Undo is a premium feature.', 402, 'PREMIUM_REQUIRED');
        }

        // 2. Find the last action (Like/Dislike) involving the swiped user
        const lastAction = await prisma.like.findUnique({
            where: { likerId_likedId: { likerId: userId, likedId: lastSwipedId } },
            include: { liked: { select: { id: true, firstName: true } } },
        });

        if (!lastAction) {
            throw new NotFoundError('No recent swipe found to undo.', 'NO_SWIPE_TO_UNDO');
        }

        // 3. Rollback Logic
        await prisma.$transaction(async (tx) => {
            // A. Delete the Like/Dislike record
            await tx.like.delete({ where: { id: lastAction.id } });

            // B. If it resulted in a Match, downgrade or delete the match
            if (lastAction.isMatch) {
                // Find and delete the Match record
                const matchConstraint = getMatchUniqueConstraint(userId, lastSwipedId);
                await tx.match.deleteMany({ where: matchConstraint });
                
                // Find and downgrade the reciprocal like (optional, depends on whether undo affects the other user's match status)
                // For simplicity, we just delete the match, relying on a future like to re-create it.
            }

            // C. Remove exclusion from Redis
            await redis.del(`dislike:${userId}:${lastSwipedId}`);
        });

        res.status(200).json({ message: `Successfully undid action against ${lastAction.liked.firstName}.` });
    } catch (error) { next(error); }
};

/**
 * GET /api/match/matches - List all active matches
 */
export const getMatches = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        const limit = req.validatedBody.limit || 20;

        // Find matches ordered by last message creation time
        const matches = await prisma.match.findMany({
            where: {
                OR: [{ userId1: userId }, { userId2: userId }],
                status: { in: ['MATCHED', 'CONVERSING'] as MatchStatus[] },
            },
            take: limit,
            orderBy: { updatedAt: 'desc' }, // Order by match activity/message
            include: {
                messages: {
                    take: 1, // Only need the last message
                    orderBy: { createdAt: 'desc' },
                    select: { senderId: true, text: true, messageStatus: true, createdAt: true }
                },
                user1: { include: { photos: { where: { status: PhotoModerationStatus.APPROVED } } } },
                user2: { include: { photos: { where: { status: PhotoModerationStatus.APPROVED } } } },
            },
        });

        const matchDtos = matches.map(match => {
            const otherUser = match.user1.id === userId ? match.user2 : match.user1;
            const lastMessage = match.messages[0];

            // Advanced: Query unread count efficiently (or pre-computed in a job)
            const unreadCount = 0; // STUB: Assume this query is done in a simpler way:
            // const unreadCount = await prisma.message.count({ where: { matchId: match.id, senderId: otherUser.id, messageStatus: { not: 'READ' } } });

            return {
                id: match.id,
                status: match.status,
                coreCompatibility: match.coreCompatibility,
                lastMessage: lastMessage?.text || null,
                unreadCount: unreadCount,
                otherUser: {
                    id: otherUser.id,
                    firstName: otherUser.firstName,
                    primaryPhotoUrl: otherUser.photos.find((p: any) => p.isPrimary)?.url || null,
                    // Advanced: E2E Key Status for Chat UI (Conceptual: check key exchange status)
                    isE2EKeyExchanged: true,
                }
            } as Match;
        });

        res.status(200).json(matchDtos);
    } catch (error) { next(error); }
};

/**
 * GET /api/match/recommendations - Get list of recommended profiles
 */
export const getRecommendations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        const { page, limit, filters: rawFilters, currentGeoHash } = req.validatedBody;

        const filters = rawFilters ? JSON.parse(rawFilters) : {};
        
        // Advanced: Include current GeoHash for contextual matching
        const options = {
            page,
            limit,
            filters,
            currentGeoHash: currentGeoHash,
            includeBoosts: req.user!.isPremium // Premium users get preference
        };

        const recommendations = await getRecommendationsForUser(userId, options);

        res.status(200).json(recommendations);
    } catch (error) { next(error); }
};