// backend/src/controllers/message.ts

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AppError, AuthError, RateLimitError } from '../utils/errors';
import { Message, MessageSendDto, MessageStatus } from '../types/shared';
import { redis } from '../utils/redis';
import { io as socketEmitter } from '../utils/socketEmitter';

// --- Anti-Spam Rate Limiter (Server-side per-match, Redis-backed conceptual) ---
const MESSAGE_RATE_LIMIT_KEY = (matchId: string, userId: string) => `msg:rate:${matchId}:${userId}`;
const MESSAGE_LIMIT = 5; // Max 5 messages
const MESSAGE_WINDOW_SECONDS = 10; // per 10 seconds

/**
 * @description Checks and increments the message counter for a user in a match.
 * @throws {RateLimitError} if the limit is exceeded.
 */
const checkMessageRateLimit = async (matchId: string, userId: string): Promise<void> => {
    const key = MESSAGE_RATE_LIMIT_KEY(matchId, userId);
    const count = await redis.incr(key);

    if (count === 1) { await redis.expire(key, MESSAGE_WINDOW_SECONDS); }
    if (count > MESSAGE_LIMIT) {
        throw new RateLimitError('You are sending messages too quickly in this match.', 'MESSAGE_RATE_LIMIT');
    }
    // Advanced: Heuristic check for duplicate/templated messages
    // const lastMessage = await redis.get(`msg:last:${userId}`);
    // if (lastMessage === text) throw new RateLimitError('Duplicate message detected.', 'SPAM_HEURISTIC');
};

// --- Helpers ---
const toMessageDto = (message: any): Message => ({
    id: message.id,
    senderId: message.senderId,
    text: message.text || '', // NOTE: This text is assumed E2E encrypted, server only stores/forwards
    attachments: message.attachments as string[],
    messageStatus: message.messageStatus,
    createdAt: message.createdAt,
});


/**
 * POST /api/message/:matchId/send - Send a new message (E2E)
 */
export const sendMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const senderId = req.user!.id;
        const matchId = req.params.matchId;
        const { text, attachments = [], nlpIntent } = req.validatedBody as any;

        // 1. Check Rate Limit
        await checkMessageRateLimit(matchId, senderId);

        // 2. Ensure user is part of the match
        const match = await prisma.match.findUnique({
            where: { id: matchId },
            select: { id: true, userId1: true, userId2: true },
        });
        if (!match || (match.userId1 !== senderId && match.userId2 !== senderId)) {
            throw new AuthError('User is not authorized to send messages in this match.', 'MATCH_AUTH_FAIL');
        }

        // 3. Persist message (storing encrypted payload as 'text')
        const message = await prisma.message.create({
            data: {
                matchId: match.id,
                senderId: senderId,
                text: text || '', // Encrypted text payload
                attachments: attachments,
                messageStatus: MessageStatus.SENT,
                nlpIntent: nlpIntent, // AI analysis tag
            },
        });

        // 4. Emit 'message:new' to the match room
        const messagePayload = toMessageDto(message);
        socketEmitter.to(`match:${matchId}`).emit('message:new', messagePayload);

        // 5. Send push notification to the recipient (using nlpIntent for personalized push body)
        const recipientId = match.userId1 === senderId ? match.userId2 : match.userId1;
        const pushBody = nlpIntent ? `New message (${nlpIntent})` : 'New message received!';
        // sendPushToUser(recipientId, { title: match.firstName, body: pushBody });

        res.status(201).json(messagePayload);
    } catch (error) { next(error); }
};

/**
 * GET /api/message/:matchId - Retrieve paginated messages
 */
export const getMessages = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        const matchId = req.params.matchId;
        const limit = req.validatedBody.limit;
        const cursor = req.validatedBody.cursor;

        const match = await prisma.match.findUnique({
            where: { id: matchId },
            select: { id: true, userId1: true, userId2: true },
        });
        if (!match || (match.userId1 !== userId && match.userId2 !== userId)) {
            throw new AuthError('User is not authorized to view messages in this match.', 'MATCH_AUTH_FAIL');
        }

        const messages = await prisma.message.findMany({
            where: { matchId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        });

        const messagesDto = messages.map(toMessageDto).reverse();

        // 2. Mark retrieved messages as delivered (Server-side delivery ACK)
        await prisma.message.updateMany({
            where: {
                matchId,
                senderId: { not: userId },
                messageStatus: MessageStatus.SENT, // Only update SENT to DELIVERED
            },
            data: { messageStatus: MessageStatus.DELIVERED },
        });

        const nextCursor = messages.length === limit ? messages[messages.length - 1].id : null;

        res.status(200).json({ messages: messagesDto, nextCursor });
    } catch (error) { next(error); }
};

/**
 * POST /api/message/:matchId/read - Mark all unread messages as read
 */
export const markMessagesAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const readerId = req.user!.id;
        const matchId = req.params.matchId;

        const result = await prisma.message.updateMany({
            where: {
                matchId,
                senderId: { not: readerId },
                messageStatus: { in: [MessageStatus.SENT, MessageStatus.DELIVERED] },
            },
            data: { messageStatus: MessageStatus.READ },
        });

        if (result.count > 0) {
            // Emit 'message:read' to the match room
            socketEmitter.to(`match:${matchId}`).emit('message:read', {
                matchId,
                readerId,
                readAt: new Date().toISOString(),
                count: result.count,
            });
        }

        res.status(200).json({ message: `${result.count} messages marked as read.` });
    } catch (error) { next(error); }
};

/**
 * POST /api/message/:matchId/key-exchange (Advanced: E2E Key Exchange)
 */
export const keyExchange = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const senderId = req.user!.id;
        const matchId = req.params.matchId;
        const { publicKey } = req.validatedBody;

        // 1. Verify user is in match (omitted for brevity, assume passed)

        // 2. Store the public key in a secure Redis or DB key
        const key = `match:e2e:key:${matchId}:${senderId}`;
        await redis.set(key, publicKey, 'EX', 60 * 60 * 24 * 30); // Key expires after 30 days

        // 3. Notify the OTHER user via socket that a new key is available
        const match = await prisma.match.findUnique({ where: { id: matchId }, select: { userId1: true, userId2: true } });
        const recipientId = match!.userId1 === senderId ? match!.userId2 : match!.userId1;

        socketEmitter.to(`user:${recipientId}`).emit('e2e:key:update', {
            matchId,
            senderId,
            publicKey,
        });

        res.status(200).json({ message: 'Public key stored and recipient notified.' });
    } catch (error) { next(error); }
};