// backend/src/controllers/profile.ts

import { Request, Response, NextFunction } from 'express';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as geofire from 'geofire-common';
import { PhotoModerationStatus } from '@prisma/client';

import { prisma } from '../utils/prisma';
import { NotFoundError, AppError, AuthError } from '../utils/errors';
import { Dtos, ProfileUpdateDto, UserPublic } from '../types/shared';

// --- AWS S3 Setup ---
const S3_BUCKET = process.env.S3_BUCKET || 'dating-app-photos';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const PHOTO_EXPIRY_SECONDS = 60 * 5;
const GEOHASH_PRECISION = 9;

const s3Client = new S3Client({ region: AWS_REGION });

// --- BullMQ/Job Stub (Externalized to worker.ts) ---
import { ModerationQueue } from '../jobs/worker';

// --- Helpers ---
const toUserPublic = (user: any): UserPublic => {
    // Advanced: Calculate age precisely
    const ageDiffMs = Date.now() - user.dateOfBirth.getTime();
    const age = Math.floor(ageDiffMs / (1000 * 60 * 60 * 24 * 365.25));

    return {
        id: user.id,
        firstName: user.firstName,
        age: age,
        gender: user.gender,
        geoHash: user.geoHash,
        isIdentityVerified: user.isIdentityVerified,
        isPremium: user.profile?.isPremium || false,
        photos: user.photos.map((p: any) => ({
            id: p.id,
            url: `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/photos/${p.s3Key}`,
            isPrimary: p.isPrimary,
            status: p.status,
            aiTags: p.aiTags,
        })),
        topInterests: user.profile?.interests.slice(0, 3) || [],
        scoreVector: [user.profile?.recommendationScore || 0, user.profile?.nlpVector[0] || 0], // Example vectors
        reason: 'Profile data loaded.',
    };
};

/**
 * GET /api/profile/me - Retrieve current user's profile
 */
export const getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                profile: true,
                photos: { orderBy: { createdAt: 'asc' } },
            },
        });

        if (!user) { throw new NotFoundError('User not found.', 'USER_NOT_FOUND'); }

        res.status(200).json(toUserPublic(user));
    } catch (error) { next(error); }
};

/**
 * GET /api/profile/:id - Retrieve another user's public profile
 */
export const getPublicProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const viewerId = req.user!.id;
        const targetUserId = req.params.id;

        // 1. Enforce Verification (handled by middleware, but check here too)
        if (!req.user?.isIdentityVerified) {
            throw new AuthError('Identity verification required to view other profiles.', 'VERIFICATION_REQUIRED');
        }

        // 2. Check Match Status (Only allow viewing if matched or verified)
        const match = await prisma.match.findUnique({
            where: { userId1_userId2: { userId1: viewerId < targetUserId ? viewerId : targetUserId, userId2: viewerId < targetUserId ? targetUserId : viewerId } },
            select: { status: true },
        });

        if (match?.status === 'BLOCKED') {
            throw new AuthError('Profile viewing unauthorized.', 'PROFILE_BLOCKED');
        }

        const user = await prisma.user.findUnique({
            where: { id: targetUserId },
            include: {
                profile: true,
                photos: {
                    where: { status: PhotoModerationStatus.APPROVED }, // Only approved photos
                    orderBy: { isPrimary: 'desc', createdAt: 'asc' },
                }
            },
        });

        if (!user || user.isBanned) { throw new NotFoundError('Profile not found.', 'PROFILE_NOT_FOUND'); }

        // Advanced: Inject Contextual Compatibility Score (if pre-computed)
        // const matchScore = await getPrecomputedScore(viewerId, targetUserId);

        res.status(200).json(toUserPublic(user));
    } catch (error) { next(error); }
};

/**
 * PUT /api/profile/me - Update profile fields (includes GeoHash update)
 */
export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        const validatedBody = req.validatedBody as ProfileUpdateDto;

        const { latitude, longitude, interests, bio, preferences } = validatedBody;

        const updateData: any = {};
        const updateProfileData: any = {};

        if (latitude !== undefined && longitude !== undefined) {
            updateData.latitude = latitude;
            updateData.longitude = longitude;
            // Advanced: Auto-generate GeoHash for proximity queries (using 6 char precision for 600m accuracy)
            updateData.geoHash = geofire.geohashForLocation([latitude, longitude], 6);
            // Advanced: Update lastActive to signal user movement/activity
            updateData.lastActive = new Date();
        }

        if (interests) updateProfileData.interests = interests;
        if (bio !== undefined) updateProfileData.bio = bio;
        if (preferences) updateProfileData.preferences = preferences;
        // traitVector/nlpVector are updated by background jobs

        const [user] = await prisma.$transaction([
            prisma.user.update({
                where: { id: userId },
                data: updateData,
            }),
            Object.keys(updateProfileData).length > 0
                ? prisma.profile.update({
                    where: { userId },
                    data: updateProfileData,
                })
                : prisma.profile.findUnique({ where: { userId } }),
        ]);

        const fullUser = await prisma.user.findUnique({
             where: { id: userId },
             include: { profile: true, photos: { orderBy: { createdAt: 'asc' } } },
        });

        res.status(200).json(toUserPublic(fullUser));
    } catch (error) { next(error); }
};

/**
 * POST /api/profile/me/photos - Request a presigned URL
 */
export const requestPhotoUploadUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        const fileExtension = req.body.fileExtension || 'jpg';
        const s3Key = `${userId}/${Date.now()}.${fileExtension}`;

        // 1. Check max photo limit (e.g., 6)
        const photoCount = await prisma.photo.count({ where: { userId } });
        if (photoCount >= 6) {
             throw new AppError('Maximum photo limit reached (6).', 400, 'PHOTO_LIMIT_EXCEEDED');
        }

        // 2. Create temporary Photo record
        const tempPhoto = await prisma.photo.create({
            data: {
                userId,
                s3Key: s3Key,
                status: PhotoModerationStatus.PENDING,
                isPrimary: false,
                aiTags: [],
            },
        });

        // 3. Generate the presigned URL
        const command = new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: `photos/${s3Key}`,
            ContentType: `image/${fileExtension === 'png' ? 'png' : 'jpeg'}`,
        });
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: PHOTO_EXPIRY_SECONDS });

        res.status(200).json({ photoId: tempPhoto.id, s3Key: s3Key, presignedUrl: presignedUrl });
    } catch (error) { next(error); }
};

/**
 * PATCH /api/profile/me/photos/:photoId/upload-complete - Finalize photo upload
 */
export const handlePhotoUploadComplete = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        const photoId = req.params.photoId;

        const photo = await prisma.photo.findUnique({ where: { id: photoId } });
        if (!photo || photo.userId !== userId) { throw new AuthError('Photo not found or unauthorized.', 'PHOTO_UNAUTHORIZED'); }

        // 1. Update photo URL
        const updatedPhoto = await prisma.photo.update({
            where: { id: photoId },
            data: { url: `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/photos/${photo.s3Key}` },
        });

        // 2. Enqueue AI analysis (for tags and moderation flagging)
        await ModerationQueue.add('photo:ai-analysis', {
            photoId: updatedPhoto.id,
            s3Key: updatedPhoto.s3Key,
        });

        res.status(200).json({ message: 'Photo upload finalized. Awaiting AI analysis and moderation.', photo: updatedPhoto });
    } catch (error) { next(error); }
};

/**
 * DELETE /api/profile/me/photos/:id - Delete photo
 */
export const deletePhoto = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        const photoId = req.params.id;

        const photo = await prisma.photo.findUnique({ where: { id: photoId } });
        if (!photo || photo.userId !== userId) { throw new AuthError('Photo not found or unauthorized.', 'PHOTO_UNAUTHORIZED'); }

        // 1. Delete record from DB
        await prisma.photo.delete({ where: { id: photoId } });

        // 2. Schedule S3 file deletion (async job)
        ModerationQueue.add('s3:delete-object', { s3Key: `photos/${photo.s3Key}` });

        res.status(204).send();
    } catch (error) { next(error); }
};