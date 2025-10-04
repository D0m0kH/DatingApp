"use strict";
// backend/src/routes/profile.ts
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var auth_1 = require("../middleware/auth"); // Import requireVerified
var validate_1 = require("../middleware/validate");
var shared_1 = require("../types/shared");
var profileController = require("../controllers/profile");
var zod_1 = require("zod");
var router = (0, express_1.Router)();
// --- Auth Middleware applied to all routes in this router ---
router.use(auth_1.requireAuth);
/**
 * GET /api/profile/me
 * Retrieves the current user's profile with all photos (including pending).
 */
router.get('/me', profileController.getMe);
/**
 * PUT /api/profile/me
 * Updates the current user's profile and location (auto-generates GeoHash).
 */
router.put('/me', (0, validate_1.validateBody)(shared_1.ProfileUpdateDtoSchema), profileController.updateProfile);
/**
 * POST /api/profile/me/photos
 * Requests a presigned URL for uploading a new photo.
 */
router.post('/me/photos', profileController.requestPhotoUploadUrl);
/**
 * PATCH /api/profile/me/photos/:photoId/upload-complete
 * Finalizes photo upload, runs AI analysis, and enqueues moderation.
 */
router.patch('/me/photos/:photoId/upload-complete', (0, validate_1.validateParams)(zod_1.z.object({ photoId: zod_1.z.string() })), profileController.handlePhotoUploadComplete);
/**
 * DELETE /api/profile/me/photos/:id
 * Deletes a photo record and schedules S3 file deletion.
 */
router.delete('/me/photos/:id', (0, validate_1.validateParams)(zod_1.z.object({ id: zod_1.z.string() })), profileController.deletePhoto);
/**
 * POST /api/profile/me/verify-identity (ZKP-related)
 * Advanced: Endpoint to initiate ZKP verification flow (if the client has the proof ready).
 */
router.post('/me/verify-identity', require('./controllers/auth').verifyIdentity); // Re-use the controller logic
/**
 * GET /api/profile/:id
 * Retrieves another user's public profile (only if verified or matched).
 */
router.get('/:id', auth_1.requireVerified, // Only Verified users can view other profiles
(0, validate_1.validateParams)(zod_1.z.object({ id: zod_1.z.string() })), profileController.getPublicProfile);
exports.default = router;
