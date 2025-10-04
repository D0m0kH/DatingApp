// backend/src/routes/admin.ts

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import * as adminController from '../controllers/admin';
import { validateParams, validateQuery, validateBody } from '../middleware/validate';
import { z } from 'zod';
import { PhotoModerationStatus } from '@prisma/client';

const router = Router();

// --- Auth & Admin Middleware applied to all routes in this router ---
router.use(requireAuth, requireAdmin);

/**
 * GET /api/admin/users
 * Paginated list of users with advanced search filters (e.g., isVerified, hasUnreviewedPhotos).
 */
router.get(
  '/users',
  validateQuery(z.object({
    page: z.preprocess(val => Number(val), z.number().min(1).default(1)).optional(),
    limit: z.preprocess(val => Number(val), z.number().min(1).max(50).default(20)).optional(),
    search: z.string().optional(),
    status: z.enum(['BANNED', 'VERIFIED', 'UNVERIFIED', 'ALL']).optional().default('ALL'),
  })),
  adminController.getUsers
);

/**
 * PATCH /api/admin/users/:id/ban
 * Ban/unban a user. Requires a reason.
 */
router.patch(
  '/users/:id/ban',
  validateParams(z.object({ id: z.string() })),
  validateBody(z.object({ 
    isBanned: z.boolean(),
    reason: z.string().min(5, 'A reason is required for moderation actions.')
  })),
  adminController.banUser
);

/**
 * PATCH /api/admin/photos/:id/review
 * Approve, Reject, or Flag a photo, including overriding AI tags.
 */
router.patch(
  '/photos/:id/review',
  validateParams(z.object({ id: z.string() })),
  validateBody(z.object({
    status: z.nativeEnum(PhotoModerationStatus),
    // Advanced: Admin can override/add AI tags manually
    manualTags: z.array(z.string()).optional(),
  })),
  adminController.reviewPhoto
);

/**
 * GET /api/admin/reports
 * View paginated list of reports, with priority sorting.
 */
router.get(
  '/reports',
  validateQuery(z.object({
    status: z.enum(['PENDING', 'REVIEWED', 'ACTION_TAKEN']).optional().default('PENDING'),
    page: z.preprocess(val => Number(val), z.number().min(1).default(1)).optional(),
    limit: z.preprocess(val => Number(val), z.number().min(1).max(50).default(20)).optional(),
    priority: z.enum(['HIGH', 'LOW']).optional(),
  })),
  adminController.getReports
);

export default router;