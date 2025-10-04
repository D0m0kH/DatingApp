// backend/src/routes/profile.ts

import { Router } from 'express';
import { requireAuth, requireVerified } from '../middleware/auth'; // Import requireVerified
import { validateBody, validateParams } from '../middleware/validate';
import { ProfileUpdateDtoSchema } from '../types/shared';
import * as profileController from '../controllers/profile';
import { z } from 'zod';

const router = Router();

// --- Auth Middleware applied to all routes in this router ---
router.use(requireAuth);

/**
 * GET /api/profile/me
 * Retrieves the current user's profile with all photos (including pending).
 */
router.get('/me', profileController.getMe);

/**
 * PUT /api/profile/me
 * Updates the current user's profile and location (auto-generates GeoHash).
 */
router.put(
  '/me',
  validateBody(ProfileUpdateDtoSchema),
  profileController.updateProfile
);

/**
 * POST /api/profile/me/photos
 * Requests a presigned URL for uploading a new photo.
 */
router.post('/me/photos', profileController.requestPhotoUploadUrl);

/**
 * PATCH /api/profile/me/photos/:photoId/upload-complete
 * Finalizes photo upload, runs AI analysis, and enqueues moderation.
 */
router.patch(
  '/me/photos/:photoId/upload-complete',
  validateParams(z.object({ photoId: z.string() })),
  profileController.handlePhotoUploadComplete
);

/**
 * DELETE /api/profile/me/photos/:id
 * Deletes a photo record and schedules S3 file deletion.
 */
router.delete(
  '/me/photos/:id',
  validateParams(z.object({ id: z.string() })),
  profileController.deletePhoto
);

/**
 * POST /api/profile/me/verify-identity (ZKP-related)
 * Advanced: Endpoint to initiate ZKP verification flow (if the client has the proof ready).
 */
router.post('/me/verify-identity', require('./controllers/auth').verifyIdentity); // Re-use the controller logic

/**
 * GET /api/profile/:id
 * Retrieves another user's public profile (only if verified or matched).
 */
router.get(
    '/:id',
    requireVerified, // Only Verified users can view other profiles
    validateParams(z.object({ id: z.string() })),
    profileController.getPublicProfile
)

export default router;