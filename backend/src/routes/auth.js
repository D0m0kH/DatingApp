"use strict";
// backend/src/routes/auth.ts
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var express_rate_limit_1 = require("express-rate-limit");
var shared_1 = require("../types/shared");
var validate_1 = require("../middleware/validate");
var errors_1 = require("../utils/errors");
var authController = require("../controllers/auth");
var auth_1 = require("../middleware/auth");
var zod_1 = require("zod");
var router = (0, express_1.Router)();
// A stricter limit for registration to prevent bot abuse
var registerLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts per IP per hour
    message: new errors_1.AppError('Too many registration attempts from this IP, try again in an hour.', 429, 'RATE_LIMIT_REGISTER'),
    standardHeaders: true,
    legacyHeaders: false,
});
// A stricter limit for login to prevent brute force
var loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per IP per 15 min
    message: new errors_1.AppError('Too many login attempts. Try again later.', 429, 'RATE_LIMIT_LOGIN'),
    standardHeaders: true,
    legacyHeaders: false,
});
/**
 * POST /api/auth/register
 * Register a new user with Device Fingerprint and return FASE tokens.
 */
router.post('/register', registerLimiter, (0, validate_1.validateBody)(shared_1.RegisterDtoSchema), authController.register);
/**
 * POST /api/auth/login
 * Log in an existing user with Device Fingerprint and return FASE tokens.
 */
router.post('/login', loginLimiter, (0, validate_1.validateBody)(shared_1.LoginDtoSchema), authController.login);
/**
 * POST /api/auth/refresh
 * Refresh access token using FASE (requires refresh token and fingerprint ID).
 */
router.post('/refresh', (0, validate_1.validateBody)(zod_1.z.object({ refreshToken: zod_1.z.string(), fingerprintId: zod_1.z.string() })), authController.refresh);
/**
 * POST /api/auth/logout
 * Revoke a specific refresh token (session). Requires auth.
 */
router.post('/logout', auth_1.requireAuth, authController.logout);
/**
 * POST /api/auth/verify-identity (Advanced: ZKP/Biometric Placeholder)
 * Submit Zero-Knowledge Proof (ZKP) for identity/age verification.
 */
router.post('/verify-identity', auth_1.requireAuth, (0, validate_1.validateBody)(shared_1.ZKPVerifyDtoSchema), authController.verifyIdentity);
/**
 * GET /api/auth/verify-email?token=<token>
 * Verify user's email address.
 */
router.get('/verify-email', authController.verifyEmail);
exports.default = router;
