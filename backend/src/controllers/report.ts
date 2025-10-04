// backend/src/controllers/report.ts

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AppError, AuthError } from '../utils/errors';
import { ReportCategory } from '@prisma/client';
import { Queue } from 'bullmq';

// --- BullMQ Queue for Moderation ---
const connection = {
    connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
    }
};
export const ModerationQueue = new Queue('Moderation', connection);

// --- High Priority Escalation Rules (Advanced) ---

const HIGH_PRIORITY_CATEGORIES = [ReportCategory.HARASSMENT, ReportCategory.FRAUD];
const AUTO_BLOCK_CATEGORIES = [ReportCategory.HARASSMENT, ReportCategory.FRAUD];
const SHADOW_BAN_THRESHOLD = 5; // Advanced: 5 reports in 24 hours trigger a temporary shadow ban

/**
 * POST /api/report - Submit a new abuse report
 */
export const createReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const reporterId = req.user!.id;
        const { reportedUserId, category, details, attachments = [] } = req.validatedBody;

        if (reporterId === reportedUserId) { throw new AppError('Cannot report yourself.', 400, 'SELF_REPORT_FORBIDDEN'); }

        // 1. Store report in DB
        const shouldAutoBlock = AUTO_BLOCK_CATEGORIES.includes(category);
        const report = await prisma.report.create({
            data: { reporterId, reportedId: reportedUserId, category, details, attachments, autoBlocked: shouldAutoBlock, status: 'PENDING' },
        });

        // 2. Auto-block (Dislike) the reported user for the reporter
        if (shouldAutoBlock) {
            await prisma.like.upsert({
                where: { likerId_likedId: { likerId: reporterId, likedId: reportedUserId } },
                update: { isDislike: true },
                create: { likerId: reporterId, likedId: reportedUserId, isDislike: true },
            });
        }

        // 3. Check for Viral Abuse (Advanced: Shadow Ban Heuristic)
        const recentReportsCount = await prisma.report.count({
            where: {
                reportedId: reportedUserId,
                createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
            }
        });

        if (recentReportsCount >= SHADOW_BAN_THRESHOLD) {
            // Apply temporary shadow ban: prevent user from appearing in recommendations
            await redis.set(`user:shadowban:${reportedUserId}`, 'true', 'EX', 60 * 60 * 4); // 4-hour ban
            console.warn(`[SHADOW BAN] User ${reportedUserId} hit ${SHADOW_BAN_THRESHOLD} reports in 24h. Applied temporary shadow ban.`);
            const isHighPriority = true; // Force high priority for human review
        }
        
        // 4. Enqueue for human review
        const isHighPriority = HIGH_PRIORITY_CATEGORIES.includes(category);
        await ModerationQueue.add('review-report', { reportId: report.id }, { priority: isHighPriority ? 1 : 5 });

        res.status(201).json({
            message: 'Report submitted successfully. We will review it shortly.',
            reportId: report.id,
            autoBlocked: shouldAutoBlock,
        });
    } catch (error) { next(error); }
};

/**
 * GET /api/report/my - Retrieve user's own report history
 */
export const getMyReports = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const reporterId = req.user!.id;
        const reports = await prisma.report.findMany({
            where: { reporterId },
            orderBy: { createdAt: 'desc' },
            select: { id: true, category: true, status: true, reported: { select: { firstName: true, email: true } } }
        });

        res.status(200).json(reports);
    } catch (error) { next(error); }
};