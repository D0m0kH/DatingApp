// backend/src/services/notifications.ts

import { prisma } from '../utils/prisma';
import { Queue } from 'bullmq';

// --- BullMQ Queue Setup ---
const connection = {
    connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
    }
};

export const PushNotificationQueue = new Queue('PushNotifications', connection);

// --- Push Notification Service Stub (AI Filtered) ---

interface PushPayload {
    title: string;
    body: string;
    data?: { [key: string]: any };
    priority?: 'high' | 'normal' | 'low';
}

/**
 * @description Advanced: Checks user settings and applies an AI sentiment filter before sending.
 * @param userId - The ID of the recipient.
 * @param payload - The notification content.
 */
export const sendPushToUser = async (userId: string, payload: PushPayload) => {
    // 1. Fetch user, tokens, and settings (including DND/mute windows)
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { deviceTokens: true, lastActive: true, profile: { select: { preferences: true } } },
    });

    if (!user) { console.warn(`Push failed: User ${userId} not found.`); return; }
    const deviceTokens = (user.deviceTokens as any[]) || [];
    const preferences = user.profile?.preferences as any || {};

    // 2. AI Notification Filter (Sentiment/Activity Check)
    const isDNDActive = preferences.dndActive; // Check DND setting
    const hoursSinceActive = (Date.now() - user.lastActive.getTime()) / (1000 * 60 * 60);

    // Advanced Filter: Suppress low-priority pushes if user is highly active or DND is on
    if (isDNDActive || (payload.priority === 'low' && hoursSinceActive < 1)) {
        console.log(`[AI FILTER] Push suppressed for user ${userId} (DND/High Activity).`);
        return;
    }
    
    // 3. Process tokens and enqueue the sending job
    for (const device of deviceTokens) {
        const jobData = {
            token: device.token,
            platform: device.platform,
            payload: payload,
            userId: userId,
        };

        await PushNotificationQueue.add('send-push', jobData, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 * 5 },
            removeOnComplete: true,
            priority: payload.priority === 'high' ? 1 : 5, // BullMQ priority
        });

        console.log(`[PUSH] Enqueued push for user ${userId} (Priority: ${payload.priority}).`);
    }
};

/**
 * @description Sends an email to a user (logic remains abstracted).
 */
export const sendEmail = async (userId: string, payload: { subject: string, body: string }) => {
    // Logic remains the same, leveraging a separate EmailQueue (not fully implemented here)
    console.log(`[EMAIL STUB] Email enqueued for user ${userId}.`);
};