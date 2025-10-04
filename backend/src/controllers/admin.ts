// backend/src/controllers/admin.ts

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { NotFoundError, AppError } from '../utils/errors';
import { PhotoModerationStatus } from '../types/shared';

// --- Admin Audit Logging Helper ---

const createAuditLog = async (adminId: string, action: string, targetUserId: string | null, details: any, req: Request) => {
    await prisma.adminAudit.create({
        data: {
            adminId,
            action,
            targetUserId,
            details: details as any,
            ipAddress: req.ip,
        },
    });
};

/**
 * GET /api/admin/users - Paginated list of users
 */
export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { page, limit, search, status } = req.validatedBody;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
            ];
        }
        // Advanced Status Filter
        if (status === 'BANNED') where.isBanned = true;
        if (status === 'VERIFIED') where.isIdentityVerified = true;
        if (status === 'UNVERIFIED') where.isIdentityVerified = false;


        const [users, total] = await prisma.$transaction([
            prisma.user.findMany({
                where,
                take: limit,
                skip: skip,
                select: {
                    id: true, email: true, firstName: true, isBanned: true, isAdmin: true,
                    isIdentityVerified: true, createdAt: true, lastActive: true,
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.user.count({ where }),
        ]);

        res.status(200).json({ users, total, page, limit });
    } catch (error) { next(error); }
};

/**
 * PATCH /api/admin/users/:id/ban - Ban/unban user
 */
export const banUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const adminId = req.user!.id;
        const targetUserId = req.params.id;
        const { isBanned, reason } = req.validatedBody;

        const user = await prisma.user.findUnique({ where: { id: targetUserId } });
        if (!user) { throw new NotFoundError('Target user not found.', 'USER_NOT_FOUND_ADMIN'); }
        if (user.isAdmin && isBanned) { throw new AppError('Cannot ban another admin user.', 403, 'ADMIN_BAN_FORBIDDEN'); }

        const updatedUser = await prisma.user.update({
            where: { id: targetUserId },
            data: { isBanned: isBanned },
            select: { id: true, email: true, isBanned: true }
        });

        // Audit Log
        const action = isBanned ? 'BAN_USER' : 'UNBAN_USER';
        await createAuditLog(adminId, action, targetUserId, { reason, source: 'Manual Admin' }, req);

        // Advanced: Revoke all refresh tokens for a banned user
        if (isBanned) {
            await prisma.refreshToken.deleteMany({ where: { userId: targetUserId } });
            // Send email notification of ban (stub)
            // sendEmail(targetUserId, { subject: 'Account Banned', body: reason });
        }

        res.status(200).json({ message: `User ${updatedUser.email} ${isBanned ? 'banned' : 'unbanned'}.`, user: updatedUser });
    } catch (error) { next(error); }
};

/**
 * PATCH /api/admin/photos/:id/review - Review/Moderate photo
 */
export const reviewPhoto = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const adminId = req.user!.id;
        const photoId = req.params.id;
        const { status, manualTags = [] } = req.validatedBody;

        const photo = await prisma.photo.findUnique({ where: { id: photoId } });
        if (!photo) { throw new NotFoundError('Photo not found.', 'PHOTO_NOT_FOUND_ADMIN'); }

        const updatedPhoto = await prisma.photo.update({
            where: { id: photoId },
            data: {
                status: status,
                // Advanced: Merge/Override AI tags with manual admin tags
                aiTags: status === PhotoModerationStatus.APPROVED
                    ? Array.from(new Set([...(photo.aiTags || []), ...manualTags]))
                    : (photo.aiTags || []),
            },
        });

        // Audit Log
        await createAuditLog(adminId, `PHOTO_REVIEW_${status}`, updatedPhoto.userId, { photoId, manualTags }, req);

        res.status(200).json({ message: `Photo status updated to ${status}.`, photo: updatedPhoto });
    } catch (error) { next(error); }
};

/**
 * GET /api/admin/reports - View reports
 */
export const getReports = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { status, page, limit, priority } = req.validatedBody;
        const skip = (page - 1) * limit;

        const where: any = { status };
        // Advanced: Filter reports by priority (simulated)
        if (priority === 'HIGH') where.category = { in: ['HARASSMENT', 'FRAUD'] };

        const [reports, total] = await prisma.$transaction([
            prisma.report.findMany({
                where,
                take: limit,
                skip: skip,
                include: { reporter: { select: { email: true, firstName: true } }, reported: { select: { email: true, firstName: true } } },
                orderBy: [{ category: 'desc' }, { createdAt: 'asc' }] // Priority sort: Category then time
            }),
            prisma.report.count({ where }),
        ]);

        res.status(200).json({ reports, total, page, limit });
    } catch (error) { next(error); }
};