"use strict";
// backend/src/app.ts
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var helmet_1 = require("helmet");
var cors_1 = require("cors");
var compression_1 = require("compression");
var morgan_1 = require("morgan");
var express_rate_limit_1 = require("express-rate-limit");
var errors_1 = require("./utils/errors");
var error_1 = require("./middleware/error");
var auth_1 = require("./middleware/auth"); // Import requireVerified
var admin_1 = require("./middleware/admin"); // New admin middleware
// --- Configuration ---
var isDev = process.env.NODE_ENV !== 'production';
var bodyLimit = '10mb';
// Stricter CORS: Allow specific origins and limit to API version header
var corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : isDev ? ['http://localhost:4000', 'http://localhost:8081'] : [];
// Rate limiting for auth endpoints (higher security risk)
var authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Strict limit: 20 requests per IP per 15 min for login/register
    message: new errors_1.AppError('Too many login/registration attempts. Try again later.', 429, 'RATE_LIMIT_AUTH'),
    standardHeaders: true,
    legacyHeaders: false,
});
// General rate limiter for authenticated API endpoints
var apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 300, // 300 requests per minute
    message: new errors_1.AppError('Too many requests. Slow down.', 429, 'RATE_LIMIT_API'),
    standardHeaders: true,
    legacyHeaders: false,
});
// --- Express App Initialization ---
var app = (0, express_1.default)();
// --- Security Middleware ---
app.use((0, helmet_1.default)({
    contentSecurityPolicy: isDev ? false : undefined, // Disable CSP in dev for swagger/docs
}));
app.use((0, cors_1.default)({
    origin: corsOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Fingerprint', 'X-Api-Version'], // Enforce Fingerprint header
}));
app.use((0, compression_1.default)());
// --- Logging Middleware ---
if (isDev) {
    app.use((0, morgan_1.default)('dev'));
}
// --- Body Parsing & Raw Body for Webhooks ---
app.use(express_1.default.json({ limit: bodyLimit }));
app.use(express_1.default.urlencoded({ extended: true, limit: bodyLimit }));
// --- Health Check & Metadata ---
app.get('/health', function (req, res) {
    res.status(200).json({ ok: true, version: process.env.npm_package_version || '1.0.0' });
});
// --- Route Mountpoints ---
// 1. Auth routes (Strictest rate limit)
app.use('/api/auth', authLimiter, require('./routes/auth').default);
// 2. Authenticated API routes (General rate limit + Auth/Verification check)
// Auth middleware runs on all paths below this point
app.use('/api/*', auth_1.default, apiLimiter);
// Require identity verification for swiping/messaging for safety
app.use('/api/match', auth_1.requireVerified, require('./routes/match').default);
app.use('/api/message', auth_1.requireVerified, require('./routes/message').default);
// Profile and Payments are typically fine without immediate verification
app.use('/api/profile', require('./routes/profile').default);
app.use('/api/payments', require('./routes/payments').default);
app.use('/api/report', require('./routes/report').default);
// Admin routes (Must have admin flag set)
app.use('/api/admin', admin_1.requireAdmin, require('./routes/admin').default);
// --- Centralized Error Handling Middleware ---
app.use(error_1.errorMiddleware);
exports.default = app;
