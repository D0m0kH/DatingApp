"use strict";
// backend/src/routes/message.ts
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var auth_1 = require("../middleware/auth");
var validate_1 = require("../middleware/validate");
var shared_1 = require("../types/shared");
var messageController = require("../controllers/message");
var zod_1 = require("zod");
var router = (0, express_1.Router)();
// --- Auth & Verification Middleware applied to all routes ---
router.use(auth_1.requireAuth, auth_1.requireVerified); // Messaging requires verification
/**
 * POST /api/message/:matchId/send
 * Send a new message (assumed to be pre-encrypted).
 */
router.post('/:matchId/send', (0, validate_1.validateParams)(zod_1.z.object({ matchId: zod_1.z.string() })), (0, validate_1.validateBody)(shared_1.MessageSendDtoSchema), messageController.sendMessage);
/**
 * GET /api/message/:matchId
 * Retrieve paginated message history.
 */
router.get('/:matchId', (0, validate_1.validateParams)(zod_1.z.object({ matchId: zod_1.z.string() })), (0, validate_1.validateQuery)(zod_1.z.object({
    cursor: zod_1.z.string().optional(),
    limit: zod_1.z.preprocess(function (val) { return Number(val); }, zod_1.z.number().min(1).max(100).default(50)).optional(),
})), messageController.getMessages);
/**
 * POST /api/message/:matchId/read
 * Mark all unread messages as read.
 */
router.post('/:matchId/read', (0, validate_1.validateParams)(zod_1.z.object({ matchId: zod_1.z.string() })), messageController.markMessagesAsRead);
/**
 * POST /api/message/:matchId/key-exchange
 * Advanced: Endpoint for exchanging E2E session keys (public keys).
 */
router.post('/:matchId/key-exchange', (0, validate_1.validateParams)(zod_1.z.object({ matchId: zod_1.z.string() })), (0, validate_1.validateBody)(zod_1.z.object({ publicKey: zod_1.z.string().min(1) })), messageController.keyExchange);
exports.default = router;
