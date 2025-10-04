"use strict";
// backend/src/controllers/match.ts
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
exports.getRecommendations = exports.getMatches = exports.undoLastSwipe = exports.dislikeUser = exports.likeUser = void 0;
var prisma_1 = require("../utils/prisma");
var errors_1 = require("../utils/errors");
var client_1 = require("@prisma/client");
var redis_1 = require("../utils/redis");
var recommendation_1 = require("../services/recommendation");
var notifications_1 = require("../services/notifications");
var socketEmitter_1 = require("../utils/socketEmitter");
// --- Advanced Helpers ---
/**
 * @description Generates a standardized, unique key for a match between two users.
 */
var getMatchUniqueConstraint = function (userId1, userId2) {
    // Ensures consistency regardless of which user is 'liker' and which is 'liked'
    return userId1 < userId2
        ? { userId1: userId1, userId2: userId2 }
        : { userId1: userId2, userId2: userId1 };
};
/**
 * POST /api/match/like/:toUserId - Send a like
 */
var likeUser = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var likerId, toUserId, _a, _b, isSuperLike, contextualId, isBlocked, newLike, reciprocalLike, matchFound, scores, matchData, newMatch, otherUserId, currentUserName, error_1;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 9, , 10]);
                likerId = req.user.id;
                toUserId = req.params.toUserId;
                _a = req.validatedBody, _b = _a.isSuperLike, isSuperLike = _b === void 0 ? false : _b, contextualId = _a.contextualId;
                if (likerId === toUserId) {
                    throw new errors_1.AppError('Cannot like yourself.', 400, 'SELF_LIKE_FORBIDDEN');
                }
                return [4 /*yield*/, prisma_1.prisma.report.count({ where: { reporterId: likerId, reportedId: toUserId, autoBlocked: true } })];
            case 1:
                isBlocked = _c.sent();
                if (isBlocked) {
                    throw new errors_1.AppError('Cannot interact with a blocked user.', 403, 'USER_BLOCKED');
                }
                return [4 /*yield*/, prisma_1.prisma.like.upsert({
                        where: { likerId_likedId: { likerId: likerId, likedId: toUserId } },
                        update: { isSuperLike: isSuperLike, isDislike: false, isMatch: false },
                        create: { likerId: likerId, likedId: toUserId, isSuperLike: isSuperLike },
                    })];
            case 2:
                newLike = _c.sent();
                return [4 /*yield*/, prisma_1.prisma.like.findUnique({
                        where: { likerId_likedId: { likerId: toUserId, likedId: likerId } },
                    })];
            case 3:
                reciprocalLike = _c.sent();
                matchFound = false;
                if (!reciprocalLike) return [3 /*break*/, 8];
                matchFound = true;
                console.log("\uD83C\uDF89 Mutual Match Found between ".concat(likerId, " and ").concat(toUserId, "!"));
                return [4 /*yield*/, (0, recommendation_1.computeMultiCompatibilityScore)(likerId, toUserId)];
            case 4:
                scores = _c.sent();
                matchData = getMatchUniqueConstraint(likerId, toUserId);
                return [4 /*yield*/, prisma_1.prisma.match.create({
                        data: __assign(__assign({}, matchData), { status: 'MATCHED', coreCompatibility: scores.core, chatStyleScore: scores.chat, settings: contextualId ? { contextualId: contextualId } : {} }),
                        include: { user1: { select: { firstName: true } }, user2: { select: { firstName: true } } }
                    })];
            case 5:
                newMatch = _c.sent();
                // Update both Like records
                return [4 /*yield*/, prisma_1.prisma.like.update({ where: { id: newLike.id }, data: { isMatch: true } })];
            case 6:
                // Update both Like records
                _c.sent();
                return [4 /*yield*/, prisma_1.prisma.like.update({ where: { id: reciprocalLike.id }, data: { isMatch: true } })];
            case 7:
                _c.sent();
                otherUserId = toUserId;
                currentUserName = req.user.email;
                socketEmitter_1.io.to("user:".concat(likerId)).emit('matchFound', { matchId: newMatch.id, otherUserName: newMatch.user2.firstName, coreScore: newMatch.coreCompatibility });
                socketEmitter_1.io.to("user:".concat(otherUserId)).emit('matchFound', { matchId: newMatch.id, otherUserName: newMatch.user1.firstName, coreScore: newMatch.coreCompatibility });
                (0, notifications_1.sendPushToUser)(otherUserId, { title: 'New Match!', body: "".concat(currentUserName, " liked you back!") });
                _c.label = 8;
            case 8:
                // 5. Advanced: Immediately re-score the feed for the current user (low priority job)
                // MatchScoringQueue.add('rescore-user', { userId: likerId }, { delay: 1000, priority: 8 });
                res.status(200).json({ message: matchFound ? 'Mutual match created!' : 'Like sent.', matchFound: matchFound });
                return [3 /*break*/, 10];
            case 9:
                error_1 = _c.sent();
                next(error_1);
                return [3 /*break*/, 10];
            case 10: return [2 /*return*/];
        }
    });
}); };
exports.likeUser = likeUser;
/**
 * POST /api/match/dislike/:toUserId - Send a dislike
 */
var dislikeUser = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var likerId, toUserId, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                likerId = req.user.id;
                toUserId = req.params.toUserId;
                // 1. Create or update as a dislike signal
                return [4 /*yield*/, prisma_1.prisma.like.upsert({
                        where: { likerId_likedId: { likerId: likerId, likedId: toUserId } },
                        update: { isDislike: true, isMatch: false, isSuperLike: false },
                        create: { likerId: likerId, likedId: toUserId, isDislike: true },
                    })];
            case 1:
                // 1. Create or update as a dislike signal
                _a.sent();
                // 2. Advanced: Store short-term exclusion in Redis (e.g., 3 days)
                return [4 /*yield*/, redis_1.redis.set("dislike:".concat(likerId, ":").concat(toUserId), 'true', 'EX', 60 * 60 * 24 * 3)];
            case 2:
                // 2. Advanced: Store short-term exclusion in Redis (e.g., 3 days)
                _a.sent();
                res.status(200).json({ message: 'Dislike recorded. Candidate excluded from feed.' });
                return [3 /*break*/, 4];
            case 3:
                error_2 = _a.sent();
                next(error_2);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.dislikeUser = dislikeUser;
/**
 * POST /api/match/undo - Undo the last swipe (Premium Feature Gate)
 */
var undoLastSwipe = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var userId_1, lastSwipedId_1, lastAction_1, error_3;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                userId_1 = req.user.id;
                lastSwipedId_1 = req.validatedBody.lastSwipedId;
                // 1. Premium Feature Gate Check
                if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isPremium)) {
                    throw new errors_1.AppError('Undo is a premium feature.', 402, 'PREMIUM_REQUIRED');
                }
                return [4 /*yield*/, prisma_1.prisma.like.findUnique({
                        where: { likerId_likedId: { likerId: userId_1, likedId: lastSwipedId_1 } },
                        include: { liked: { select: { id: true, firstName: true } } },
                    })];
            case 1:
                lastAction_1 = _b.sent();
                if (!lastAction_1) {
                    throw new errors_1.NotFoundError('No recent swipe found to undo.', 'NO_SWIPE_TO_UNDO');
                }
                // 3. Rollback Logic
                return [4 /*yield*/, prisma_1.prisma.$transaction(function (tx) { return __awaiter(void 0, void 0, void 0, function () {
                        var matchConstraint;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: 
                                // A. Delete the Like/Dislike record
                                return [4 /*yield*/, tx.like.delete({ where: { id: lastAction_1.id } })];
                                case 1:
                                    // A. Delete the Like/Dislike record
                                    _a.sent();
                                    if (!lastAction_1.isMatch) return [3 /*break*/, 3];
                                    matchConstraint = getMatchUniqueConstraint(userId_1, lastSwipedId_1);
                                    return [4 /*yield*/, tx.match.deleteMany({ where: matchConstraint })];
                                case 2:
                                    _a.sent();
                                    _a.label = 3;
                                case 3: 
                                // C. Remove exclusion from Redis
                                return [4 /*yield*/, redis_1.redis.del("dislike:".concat(userId_1, ":").concat(lastSwipedId_1))];
                                case 4:
                                    // C. Remove exclusion from Redis
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 2:
                // 3. Rollback Logic
                _b.sent();
                res.status(200).json({ message: "Successfully undid action against ".concat(lastAction_1.liked.firstName, ".") });
                return [3 /*break*/, 4];
            case 3:
                error_3 = _b.sent();
                next(error_3);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.undoLastSwipe = undoLastSwipe;
/**
 * GET /api/match/matches - List all active matches
 */
var getMatches = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var userId_2, limit, matches, matchDtos, error_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                userId_2 = req.user.id;
                limit = req.validatedBody.limit || 20;
                return [4 /*yield*/, prisma_1.prisma.match.findMany({
                        where: {
                            OR: [{ userId1: userId_2 }, { userId2: userId_2 }],
                            status: { in: ['MATCHED', 'CONVERSING'] },
                        },
                        take: limit,
                        orderBy: { updatedAt: 'desc' }, // Order by match activity/message
                        include: {
                            messages: {
                                take: 1, // Only need the last message
                                orderBy: { createdAt: 'desc' },
                                select: { senderId: true, text: true, messageStatus: true, createdAt: true }
                            },
                            user1: { include: { photos: { where: { status: client_1.PhotoModerationStatus.APPROVED } } } },
                            user2: { include: { photos: { where: { status: client_1.PhotoModerationStatus.APPROVED } } } },
                        },
                    })];
            case 1:
                matches = _a.sent();
                matchDtos = matches.map(function (match) {
                    var _a;
                    var otherUser = match.user1.id === userId_2 ? match.user2 : match.user1;
                    var lastMessage = match.messages[0];
                    // Advanced: Query unread count efficiently (or pre-computed in a job)
                    var unreadCount = 0; // STUB: Assume this query is done in a simpler way:
                    // const unreadCount = await prisma.message.count({ where: { matchId: match.id, senderId: otherUser.id, messageStatus: { not: 'READ' } } });
                    return {
                        id: match.id,
                        status: match.status,
                        coreCompatibility: match.coreCompatibility,
                        lastMessage: (lastMessage === null || lastMessage === void 0 ? void 0 : lastMessage.text) || null,
                        unreadCount: unreadCount,
                        otherUser: {
                            id: otherUser.id,
                            firstName: otherUser.firstName,
                            primaryPhotoUrl: ((_a = otherUser.photos.find(function (p) { return p.isPrimary; })) === null || _a === void 0 ? void 0 : _a.url) || null,
                            // Advanced: E2E Key Status for Chat UI (Conceptual: check key exchange status)
                            isE2EKeyExchanged: true,
                        }
                    };
                });
                res.status(200).json(matchDtos);
                return [3 /*break*/, 3];
            case 2:
                error_4 = _a.sent();
                next(error_4);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getMatches = getMatches;
/**
 * GET /api/match/recommendations - Get list of recommended profiles
 */
var getRecommendations = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, _a, page, limit, rawFilters, currentGeoHash, filters, options, recommendations, error_5;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                userId = req.user.id;
                _a = req.validatedBody, page = _a.page, limit = _a.limit, rawFilters = _a.filters, currentGeoHash = _a.currentGeoHash;
                filters = rawFilters ? JSON.parse(rawFilters) : {};
                options = {
                    page: page,
                    limit: limit,
                    filters: filters,
                    currentGeoHash: currentGeoHash,
                    includeBoosts: req.user.isPremium // Premium users get preference
                };
                return [4 /*yield*/, (0, recommendation_1.getRecommendationsForUser)(userId, options)];
            case 1:
                recommendations = _b.sent();
                res.status(200).json(recommendations);
                return [3 /*break*/, 3];
            case 2:
                error_5 = _b.sent();
                next(error_5);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getRecommendations = getRecommendations;
