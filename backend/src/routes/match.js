"use strict";
// backend/src/routes/match.ts
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var auth_1 = require("../middleware/auth");
var validate_1 = require("../middleware/validate");
var matchController = require("../controllers/match");
var zod_1 = require("zod");
var router = (0, express_1.Router)();
// --- Auth Middleware applied to all routes in this router ---
router.use(auth_1.requireAuth);
/**
 * POST /api/match/like/:toUserId
 * Send a like to another user. Requires Identity Verification.
 */
router.post('/like/:toUserId', auth_1.requireVerified, // Only verified users can send likes
(0, validate_1.validateParams)(zod_1.z.object({ toUserId: zod_1.z.string() })), (0, validate_1.validateBody)(zod_1.z.object({ isSuperLike: zod_1.z.boolean().optional(), contextualId: zod_1.z.string().optional() })), // Contextual ID for event/location match
matchController.likeUser);
/**
 * POST /api/match/dislike/:toUserId
 * Send a dislike/pass to another user. Requires Identity Verification.
 */
router.post('/dislike/:toUserId', auth_1.requireVerified, (0, validate_1.validateParams)(zod_1.z.object({ toUserId: zod_1.z.string() })), matchController.dislikeUser);
/**
 * POST /api/match/undo (Premium Feature Gate)
 * Premium: Reverts the last swipe (undoes like/dislike).
 */
router.post('/undo', (0, validate_1.validateBody)(zod_1.z.object({ lastSwipedId: zod_1.z.string() })), matchController.undoLastSwipe);
/**
 * GET /api/match/matches
 * List all active matches with last message preview and E2E key status.
 */
router.get('/matches', (0, validate_1.validateQuery)(zod_1.z.object({
    cursor: zod_1.z.string().optional(),
    limit: zod_1.z.preprocess(function (val) { return Number(val); }, zod_1.z.number().min(1).max(50).default(20)).optional(),
})), matchController.getMatches);
/**
 * GET /api/match/recommendations?page=&limit=&filters
 * List of hyper-personalized recommendations based on score and geo-context.
 */
router.get('/recommendations', (0, validate_1.validateQuery)(zod_1.z.object({
    page: zod_1.z.preprocess(function (val) { return Number(val); }, zod_1.z.number().min(1).default(1)).optional(),
    limit: zod_1.z.preprocess(function (val) { return Number(val); }, zod_1.z.number().min(1).max(50).default(20)).optional(),
    filters: zod_1.z.string().optional(), // Rich filters (JSON encoded)
    // Advanced: Contextual Geo-fencing support
    currentGeoHash: zod_1.z.string().min(1).optional(),
})), matchController.getRecommendations);
exports.default = router;
