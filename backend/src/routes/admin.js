"use strict";
// backend/src/routes/admin.ts
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var auth_1 = require("../middleware/auth");
var admin_1 = require("../middleware/admin");
var adminController = require("../controllers/admin");
var validate_1 = require("../middleware/validate");
var zod_1 = require("zod");
var client_1 = require("@prisma/client");
var router = (0, express_1.Router)();
// --- Auth & Admin Middleware applied to all routes in this router ---
router.use(auth_1.requireAuth, admin_1.requireAdmin);
/**
 * GET /api/admin/users
 * Paginated list of users with advanced search filters (e.g., isVerified, hasUnreviewedPhotos).
 */
router.get('/users', (0, validate_1.validateQuery)(zod_1.z.object({
    page: zod_1.z.preprocess(function (val) { return Number(val); }, zod_1.z.number().min(1).default(1)).optional(),
    limit: zod_1.z.preprocess(function (val) { return Number(val); }, zod_1.z.number().min(1).max(50).default(20)).optional(),
    search: zod_1.z.string().optional(),
    status: zod_1.z.enum(['BANNED', 'VERIFIED', 'UNVERIFIED', 'ALL']).optional().default('ALL'),
})), adminController.getUsers);
/**
 * PATCH /api/admin/users/:id/ban
 * Ban/unban a user. Requires a reason.
 */
router.patch('/users/:id/ban', (0, validate_1.validateParams)(zod_1.z.object({ id: zod_1.z.string() })), (0, validate_1.validateBody)(zod_1.z.object({
    isBanned: zod_1.z.boolean(),
    reason: zod_1.z.string().min(5, 'A reason is required for moderation actions.')
})), adminController.banUser);
/**
 * PATCH /api/admin/photos/:id/review
 * Approve, Reject, or Flag a photo, including overriding AI tags.
 */
router.patch('/photos/:id/review', (0, validate_1.validateParams)(zod_1.z.object({ id: zod_1.z.string() })), (0, validate_1.validateBody)(zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.PhotoModerationStatus),
    // Advanced: Admin can override/add AI tags manually
    manualTags: zod_1.z.array(zod_1.z.string()).optional(),
})), adminController.reviewPhoto);
/**
 * GET /api/admin/reports
 * View paginated list of reports, with priority sorting.
 */
router.get('/reports', (0, validate_1.validateQuery)(zod_1.z.object({
    status: zod_1.z.enum(['PENDING', 'REVIEWED', 'ACTION_TAKEN']).optional().default('PENDING'),
    page: zod_1.z.preprocess(function (val) { return Number(val); }, zod_1.z.number().min(1).default(1)).optional(),
    limit: zod_1.z.preprocess(function (val) { return Number(val); }, zod_1.z.number().min(1).max(50).default(20)).optional(),
    priority: zod_1.z.enum(['HIGH', 'LOW']).optional(),
})), adminController.getReports);
exports.default = router;
