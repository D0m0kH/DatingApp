// backend/src/routes/message.ts

import { Router } from 'express';
import { requireAuth, requireVerified } from '../middleware/auth';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import { MessageSendDtoSchema } from '../types/shared';
import * as messageController from '../controllers/message';
import { z } from 'zod';

const router = Router();

// --- Auth & Verification Middleware applied to all routes ---
router.use(requireAuth, requireVerified); // Messaging requires verification

/**
 * POST /api/message/:matchId/send
 * Send a new message (assumed to be pre-encrypted).
 */
router.post(
  '/:matchId/send',
  validateParams(z.object({ matchId: z.string() })),
  validateBody(MessageSendDtoSchema),
  messageController.sendMessage
);

/**
 * GET /api/message/:matchId
 * Retrieve paginated message history.
 */
router.get(
  '/:matchId',
  validateParams(z.object({ matchId: z.string() })),
  validateQuery(z.object({
    cursor: z.string().optional(),
    limit: z.preprocess(val => Number(val), z.number().min(1).max(100).default(50)).optional(),
  })),
  messageController.getMessages
);

/**
 * POST /api/message/:matchId/read
 * Mark all unread messages as read.
 */
router.post(
  '/:matchId/read',
  validateParams(z.object({ matchId: z.string() })),
  messageController.markMessagesAsRead
);

/**
 * POST /api/message/:matchId/key-exchange
 * Advanced: Endpoint for exchanging E2E session keys (public keys).
 */
router.post(
    '/:matchId/key-exchange',
    validateParams(z.object({ matchId: z.string() })),
    validateBody(z.object({ publicKey: z.string().min(1) })),
    messageController.keyExchange
);

export default router;