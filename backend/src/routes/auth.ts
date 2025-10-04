// backend/src/routes/auth.ts

import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { RegisterDtoSchema, LoginDtoSchema, ZKPVerifyDtoSchema } from '../types/shared';
import { validateBody } from '../middleware/validate';
import { AppError } from '../utils/errors';
import * as authController from '../controllers/auth';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// A stricter limit for registration to prevent bot abuse
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per IP per hour
  message: new AppError('Too many registration attempts from this IP, try again in an hour.', 429, 'RATE_LIMIT_REGISTER'),
  standardHeaders: true,
  legacyHeaders: false,
});

// A stricter limit for login to prevent brute force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP per 15 min
  message: new AppError('Too many login attempts. Try again later.', 429, 'RATE_LIMIT_LOGIN'),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/auth/register
 * Register a new user with Device Fingerprint and return FASE tokens.
 */
router.post('/register', registerLimiter, validateBody(RegisterDtoSchema), authController.register);

/**
 * POST /api/auth/login
 * Log in an existing user with Device Fingerprint and return FASE tokens.
 */
router.post('/login', loginLimiter, validateBody(LoginDtoSchema), authController.login);

/**
 * POST /api/auth/refresh
 * Refresh access token using FASE (requires refresh token and fingerprint ID).
 */
router.post(
    '/refresh',
    validateBody(z.object({ refreshToken: z.string(), fingerprintId: z.string() })),
    authController.refresh
);

/**
 * POST /api/auth/logout
 * Revoke a specific refresh token (session). Requires auth.
 */
router.post('/logout', requireAuth, authController.logout);

/**
 * POST /api/auth/verify-identity (Advanced: ZKP/Biometric Placeholder)
 * Submit Zero-Knowledge Proof (ZKP) for identity/age verification.
 */
router.post('/verify-identity', requireAuth, validateBody(ZKPVerifyDtoSchema), authController.verifyIdentity);

/**
 * GET /api/auth/verify-email?token=<token>
 * Verify user's email address.
 */
router.get('/verify-email', authController.verifyEmail);

export default router;