// backend/src/routes/match.ts

import { Router } from 'express';
import { requireAuth, requireVerified } from '../middleware/auth';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import * as matchController from '../controllers/match';
import { z } from 'zod';

const router = Router();

// --- Auth Middleware applied to all routes in this router ---
router.use(requireAuth);

/**
 * POST /api/match/like/:toUserId
 * Send a like to another user. Requires Identity Verification.
 */
router.post(
  '/like/:toUserId',
  requireVerified, // Only verified users can send likes
  validateParams(z.object({ toUserId: z.string() })),
  validateBody(z.object({ isSuperLike: z.boolean().optional(), contextualId: z.string().optional() })), // Contextual ID for event/location match
  matchController.likeUser
);

/**
 * POST /api/match/dislike/:toUserId
 * Send a dislike/pass to another user. Requires Identity Verification.
 */
router.post(
  '/dislike/:toUserId',
  requireVerified,
  validateParams(z.object({ toUserId: z.string() })),
  matchController.dislikeUser
);

/**
 * POST /api/match/undo (Premium Feature Gate)
 * Premium: Reverts the last swipe (undoes like/dislike).
 */
router.post(
  '/undo',
  validateBody(z.object({ lastSwipedId: z.string() })),
  matchController.undoLastSwipe
);

/**
 * GET /api/match/matches
 * List all active matches with last message preview and E2E key status.
 */
router.get(
  '/matches',
  validateQuery(z.object({
    cursor: z.string().optional(),
    limit: z.preprocess(val => Number(val), z.number().min(1).max(50).default(20)).optional(),
  })),
  matchController.getMatches
);

/**
 * GET /api/match/recommendations?page=&limit=&filters
 * List of hyper-personalized recommendations based on score and geo-context.
 */
router.get(
  '/recommendations',
  validateQuery(z.object({
    page: z.preprocess(val => Number(val), z.number().min(1).default(1)).optional(),
    limit: z.preprocess(val => Number(val), z.number().min(1).max(50).default(20)).optional(),
    filters: z.string().optional(), // Rich filters (JSON encoded)
    // Advanced: Contextual Geo-fencing support
    currentGeoHash: z.string().min(1).optional(), 
  })),
  matchController.getRecommendations
);

export default router;