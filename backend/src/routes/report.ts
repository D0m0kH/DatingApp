// backend/src/routes/report.ts

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import * as reportController from '../controllers/report';
import { z } from 'zod';
import { ReportCategory } from '../types/shared';

const router = Router();

router.use(requireAuth);

const ReportCreateSchema = z.object({
    reportedUserId: z.string().min(1),
    category: z.nativeEnum(ReportCategory, {
        message: `Category must be one of: ${Object.keys(ReportCategory).join(', ')}`
    }),
    details: z.string().min(10).max(1000),
    attachments: z.array(z.string()).optional(),
});

/**
 * POST /api/report
 * Submit a new abuse report.
 */
router.post(
  '/',
  validateBody(ReportCreateSchema),
  reportController.createReport
);

/**
 * GET /api/report/my
 * Retrieve the current user's history of reports sent.
 */
router.get(
  '/my',
  reportController.getMyReports
);

export default router;