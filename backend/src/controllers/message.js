"use strict";
// backend/src/controllers/message.ts
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.keyExchange = exports.markMessagesAsRead = exports.getMessages = exports.sendMessage = void 0;
var prisma_1 = require("../utils/prisma");
var errors_1 = require("../utils/errors");
var redis_1 = require("../utils/redis");
var socketEmitter_1 = require("../utils/socketEmitter");
var client_1 = require("@prisma/client");
// --- Anti-Spam Rate Limiter (Server-side per-match, Redis-backed conceptual) ---
var MESSAGE_RATE_LIMIT_KEY = function (matchId, userId) { return "msg:rate:".concat(matchId, ":").concat(userId); };
var MESSAGE_LIMIT = 5; // Max 5 messages
var MESSAGE_WINDOW_SECONDS = 10; // per 10 seconds
/**
 * @description Checks and increments the message counter for a user in a match.
 * @throws {RateLimitError} if the limit is exceeded.
 */
var checkMessageRateLimit = function (matchId, userId) { return __awaiter(void 0, void 0, void 0, function () {
    var key, count;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                key = MESSAGE_RATE_LIMIT_KEY(matchId, userId);
                return [4 /*yield*/, redis_1.redis.incr(key)];
            case 1:
                count = _a.sent();
                if (!(count === 1)) return [3 /*break*/, 3];
                return [4 /*yield*/, redis_1.redis.expire(key, MESSAGE_WINDOW_SECONDS)];
            case 2:
                _a.sent();
                _a.label = 3;
            case 3:
                if (count > MESSAGE_LIMIT) {
                    throw new errors_1.RateLimitError('You are sending messages too quickly in this match.', 'MESSAGE_RATE_LIMIT');
                }
                return [2 /*return*/];
        }
    });
}); };
// --- Helpers ---
var toMessageDto = function (message) { return ({
    id: message.id,
    matchId: message.matchId,
    senderId: message.senderId,
    text: message.text || '', // NOTE: This text is assumed E2E encrypted, server only stores/forwards
    attachments: message.attachments,
    messageStatus: message.messageStatus,
    createdAt: message.createdAt,
}); };
/**
 * POST /api/message/:matchId/send - Send a new message (E2E)
 */
var sendMessage = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var senderId, matchId, _a, text, _b, attachments, nlpIntent, match, message, messagePayload, recipientId, pushBody, error_1;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 4, , 5]);
                senderId = req.user.id;
                matchId = req.params.matchId;
                _a = req.validatedBody, text = _a.text, _b = _a.attachments, attachments = _b === void 0 ? [] : _b, nlpIntent = _a.nlpIntent;
                // 1. Check Rate Limit
                return [4 /*yield*/, checkMessageRateLimit(matchId, senderId)];
            case 1:
                // 1. Check Rate Limit
                _c.sent();
                return [4 /*yield*/, prisma_1.prisma.match.findUnique({
                        where: { id: matchId },
                        select: { id: true, userId1: true, userId2: true },
                    })];
            case 2:
                match = _c.sent();
                if (!match || (match.userId1 !== senderId && match.userId2 !== senderId)) {
                    throw new errors_1.AuthError('User is not authorized to send messages in this match.', 'MATCH_AUTH_FAIL');
                }
                return [4 /*yield*/, prisma_1.prisma.message.create({
                        data: {
                            matchId: match.id,
                            senderId: senderId,
                            text: text || '', // Encrypted text payload
                            attachments: attachments,
                            messageStatus: client_1.MessageStatus.SENT,
                            nlpIntent: nlpIntent, // AI analysis tag
                        },
                    })];
            case 3:
                message = _c.sent();
                messagePayload = toMessageDto(message);
                socketEmitter_1.io.to("match:".concat(matchId)).emit('message:new', messagePayload);
                recipientId = match.userId1 === senderId ? match.userId2 : match.userId1;
                pushBody = nlpIntent ? "New message (".concat(nlpIntent, ")") : 'New message received!';
                // sendPushToUser(recipientId, { title: match.firstName, body: pushBody });
                res.status(201).json(messagePayload);
                return [3 /*break*/, 5];
            case 4:
                error_1 = _c.sent();
                next(error_1);
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.sendMessage = sendMessage;
/**
 * GET /api/message/:matchId - Retrieve paginated messages
 */
var getMessages = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, matchId, limit, cursor, match, messages, messagesDto, nextCursor, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                userId = req.user.id;
                matchId = req.params.matchId;
                limit = req.validatedBody.limit;
                cursor = req.validatedBody.cursor;
                return [4 /*yield*/, prisma_1.prisma.match.findUnique({
                        where: { id: matchId },
                        select: { id: true, userId1: true, userId2: true },
                    })];
            case 1:
                match = _a.sent();
                if (!match || (match.userId1 !== userId && match.userId2 !== userId)) {
                    throw new errors_1.AuthError('User is not authorized to view messages in this match.', 'MATCH_AUTH_FAIL');
                }
                return [4 /*yield*/, prisma_1.prisma.message.findMany(__assign({ where: { matchId: matchId }, orderBy: { createdAt: 'desc' }, take: limit }, (cursor && { cursor: { id: cursor }, skip: 1 })))];
            case 2:
                messages = _a.sent();
                messagesDto = messages.map(toMessageDto).reverse();
                // 2. Mark retrieved messages as delivered (Server-side delivery ACK)
                return [4 /*yield*/, prisma_1.prisma.message.updateMany({
                        where: {
                            matchId: matchId,
                            senderId: { not: userId },
                            messageStatus: client_1.MessageStatus.SENT, // Only update SENT to DELIVERED
                        },
                        data: { messageStatus: client_1.MessageStatus.DELIVERED },
                    })];
            case 3:
                // 2. Mark retrieved messages as delivered (Server-side delivery ACK)
                _a.sent();
                nextCursor = messages.length === limit ? messages[messages.length - 1].id : null;
                res.status(200).json({ messages: messagesDto, nextCursor: nextCursor });
                return [3 /*break*/, 5];
            case 4:
                error_2 = _a.sent();
                next(error_2);
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.getMessages = getMessages;
/**
 * POST /api/message/:matchId/read - Mark all unread messages as read
 */
var markMessagesAsRead = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var readerId, matchId, result, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                readerId = req.user.id;
                matchId = req.params.matchId;
                return [4 /*yield*/, prisma_1.prisma.message.updateMany({
                        where: {
                            matchId: matchId,
                            senderId: { not: readerId },
                            messageStatus: { in: [client_1.MessageStatus.SENT, client_1.MessageStatus.DELIVERED] },
                        },
                        data: { messageStatus: client_1.MessageStatus.READ },
                    })];
            case 1:
                result = _a.sent();
                if (result.count > 0) {
                    // Emit 'message:read' to the match room
                    socketEmitter_1.io.to("match:".concat(matchId)).emit('message:read', {
                        matchId: matchId,
                        readerId: readerId,
                        readAt: new Date().toISOString(),
                        count: result.count,
                    });
                }
                res.status(200).json({ message: "".concat(result.count, " messages marked as read.") });
                return [3 /*break*/, 3];
            case 2:
                error_3 = _a.sent();
                next(error_3);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.markMessagesAsRead = markMessagesAsRead;
/**
 * POST /api/message/:matchId/key-exchange (Advanced: E2E Key Exchange)
 */
var keyExchange = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var senderId, matchId, publicKey, key, match, recipientId, error_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                senderId = req.user.id;
                matchId = req.params.matchId;
                publicKey = req.validatedBody.publicKey;
                key = "match:e2e:key:".concat(matchId, ":").concat(senderId);
                return [4 /*yield*/, redis_1.redis.set(key, publicKey, 'EX', 60 * 60 * 24 * 30)];
            case 1:
                _a.sent(); // Key expires after 30 days
                return [4 /*yield*/, prisma_1.prisma.match.findUnique({ where: { id: matchId }, select: { userId1: true, userId2: true } })];
            case 2:
                match = _a.sent();
                recipientId = match.userId1 === senderId ? match.userId2 : match.userId1;
                socketEmitter_1.io.to("user:".concat(recipientId)).emit('e2e:key:update', {
                    matchId: matchId,
                    senderId: senderId,
                    publicKey: publicKey,
                });
                res.status(200).json({ message: 'Public key stored and recipient notified.' });
                return [3 /*break*/, 4];
            case 3:
                error_4 = _a.sent();
                next(error_4);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.keyExchange = keyExchange;
