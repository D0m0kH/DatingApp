"use strict";
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
exports.initSocket = initSocket;
exports.closeSocket = closeSocket;
exports.emitToUser = emitToUser;
exports.emitToMatch = emitToMatch;
var socket_io_1 = require("socket.io");
var jwt_1 = require("./utils/jwt");
var prisma_1 = require("./lib/prisma");
var lib_1 = require("./lib");
// ============================================================================
// Configuration
// ============================================================================
var CORS_ORIGINS = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(function (origin) { return origin.trim(); })
    : ['http://localhost:3000', 'http://localhost:5173'];
var PRESENCE_EXPIRY = 300; // 5 minutes in seconds
var MESSAGE_RATE_LIMIT = 5; // Max messages per second per socket
var MESSAGE_RATE_WINDOW = 1000; // 1 second in milliseconds
// ============================================================================
// Rate Limiting
// ============================================================================
/**
 * Simple in-memory rate limiter for messages
 */
var RateLimiter = /** @class */ (function () {
    function RateLimiter() {
        this.requests = new Map();
    }
    /**
     * Check if a request should be allowed
     * @param key - Identifier (e.g., socket ID)
     * @param limit - Maximum requests allowed
     * @param window - Time window in milliseconds
     * @returns true if allowed, false if rate limit exceeded
     */
    RateLimiter.prototype.check = function (key, limit, window) {
        var now = Date.now();
        var requests = this.requests.get(key) || [];
        // Remove old requests outside the window
        var validRequests = requests.filter(function (time) { return now - time < window; });
        if (validRequests.length >= limit) {
            return false;
        }
        // Add current request
        validRequests.push(now);
        this.requests.set(key, validRequests);
        return true;
    };
    /**
     * Clear rate limit data for a key
     */
    RateLimiter.prototype.clear = function (key) {
        this.requests.delete(key);
    };
    return RateLimiter;
}());
var messageRateLimiter = new RateLimiter();
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Verify if a user is part of a match
 */
function verifyMatchMembership(userId, matchId) {
    return __awaiter(this, void 0, void 0, function () {
        var matchRecord, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, prisma_1.default.match.findFirst({
                            where: {
                                id: matchId,
                                OR: [{ userId1: userId }, { userId2: userId }],
                                status: 'MATCHED',
                            },
                        })];
                case 1:
                    matchRecord = _a.sent();
                    return [2 /*return*/, !!matchRecord];
                case 2:
                    error_1 = _a.sent();
                    console.error('Error verifying match membership:', error_1);
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get all match IDs for a user
 */
function getUserMatches(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var matches, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, prisma_1.default.match.findMany({
                            where: {
                                OR: [{ userId1: userId }, { userId2: userId }],
                                status: 'MATCHED',
                            },
                            select: { id: true },
                        })];
                case 1:
                    matches = _a.sent();
                    return [2 /*return*/, matches.map(function (m) { return m.id; })];
                case 2:
                    error_2 = _a.sent();
                    console.error('Error fetching user matches:', error_2);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Set user presence in Redis
 */
function setPresence(userId, status) {
    return __awaiter(this, void 0, void 0, function () {
        var key, data, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    key = "presence:".concat(userId);
                    data = JSON.stringify({
                        status: status,
                        lastSeen: new Date().toISOString(),
                    });
                    return [4 /*yield*/, lib_1.default.setex(key, PRESENCE_EXPIRY, data)];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_3 = _a.sent();
                    console.error('Error setting presence:', error_3);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get user presence from Redis
 */
function getPresence(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var key, data, parsed, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    key = "presence:".concat(userId);
                    return [4 /*yield*/, lib_1.default.get(key)];
                case 1:
                    data = _a.sent();
                    if (!data) {
                        return [2 /*return*/, {
                                userId: userId,
                                status: 'offline',
                                lastSeen: new Date().toISOString(),
                            }];
                    }
                    parsed = JSON.parse(data);
                    return [2 /*return*/, __assign({ userId: userId }, parsed)];
                case 2:
                    error_4 = _a.sent();
                    console.error('Error getting presence:', error_4);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Broadcast presence to user's matches
 */
function broadcastPresence(io, userId, matchIds) {
    return __awaiter(this, void 0, void 0, function () {
        var presence_1, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getPresence(userId)];
                case 1:
                    presence_1 = _a.sent();
                    if (!presence_1)
                        return [2 /*return*/];
                    // Emit to all match rooms
                    matchIds.forEach(function (matchId) {
                        io.to("match:".concat(matchId)).emit('presence:update', presence_1);
                    });
                    return [3 /*break*/, 3];
                case 2:
                    error_5 = _a.sent();
                    console.error('Error broadcasting presence:', error_5);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// ============================================================================
// Socket.IO Server Initialization
// ============================================================================
/**
 * Initializes Socket.IO server with the HTTP server
 * @param httpServer - HTTP server instance
 * @returns Socket.IO server instance
 */
function initSocket(httpServer) {
    var _this = this;
    var io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: CORS_ORIGINS,
            methods: ['GET', 'POST'],
            credentials: true,
        },
        pingTimeout: 60000,
        pingInterval: 25000,
    });
    // ============================================================================
    // Authentication Middleware
    // ============================================================================
    io.use(function (socket, next) { return __awaiter(_this, void 0, void 0, function () {
        var token, decoded, error_6;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    token = socket.handshake.auth.token ||
                        ((_a = socket.handshake.headers.authorization) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', ''));
                    if (!token) {
                        return [2 /*return*/, next(new Error('Authentication token required'))];
                    }
                    return [4 /*yield*/, (0, jwt_1.verifyToken)(token)];
                case 1:
                    decoded = _b.sent();
                    if (!decoded || !decoded.id) {
                        return [2 /*return*/, next(new Error('Invalid authentication token'))];
                    }
                    // Attach user info to socket
                    socket.userId = decoded.id;
                    socket.userEmail = decoded.email;
                    next();
                    return [3 /*break*/, 3];
                case 2:
                    error_6 = _b.sent();
                    console.error('Socket authentication error:', error_6);
                    next(new Error('Authentication failed'));
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    // ============================================================================
    // Connection Handler
    // ============================================================================
    io.on('connection', function (socket) { return __awaiter(_this, void 0, void 0, function () {
        var authSocket, userId, matchIds, error_7;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    authSocket = socket;
                    userId = authSocket.userId;
                    console.log("\u2713 Socket connected: ".concat(socket.id, " (User: ").concat(userId, ")"));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    // Join user's personal room
                    socket.join("user:".concat(userId));
                    console.log("  \u2514\u2500 Joined room: user:".concat(userId));
                    return [4 /*yield*/, getUserMatches(userId)];
                case 2:
                    matchIds = _a.sent();
                    matchIds.forEach(function (matchId) {
                        socket.join("match:".concat(matchId));
                        console.log("  \u2514\u2500 Joined room: match:".concat(matchId));
                    });
                    // Set user as online in Redis
                    return [4 /*yield*/, setPresence(userId, 'online')];
                case 3:
                    // Set user as online in Redis
                    _a.sent();
                    // Broadcast online status to matches
                    return [4 /*yield*/, broadcastPresence(io, userId, matchIds)];
                case 4:
                    // Broadcast online status to matches
                    _a.sent();
                    return [3 /*break*/, 6];
                case 5:
                    error_7 = _a.sent();
                    console.error('Error during socket connection setup:', error_7);
                    return [3 /*break*/, 6];
                case 6:
                    // ============================================================================
                    // Event: message:send
                    // ============================================================================
                    socket.on('message:send', function (payload, callback) { return __awaiter(_this, void 0, void 0, function () {
                        var matchId, content, _a, contentType, isMember, newMessage, messagePayload, error_8;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 4]);
                                    // Rate limiting
                                    if (!messageRateLimiter.check(socket.id, MESSAGE_RATE_LIMIT, MESSAGE_RATE_WINDOW)) {
                                        return [2 /*return*/, callback === null || callback === void 0 ? void 0 : callback({
                                                success: false,
                                                error: 'Rate limit exceeded. Please slow down.',
                                            })];
                                    }
                                    matchId = payload.matchId, content = payload.content, _a = payload.contentType, contentType = _a === void 0 ? 'text' : _a;
                                    // Validate payload
                                    if (!matchId || !content || content.trim().length === 0) {
                                        return [2 /*return*/, callback === null || callback === void 0 ? void 0 : callback({
                                                success: false,
                                                error: 'Invalid message payload',
                                            })];
                                    }
                                    if (content.length > 5000) {
                                        return [2 /*return*/, callback === null || callback === void 0 ? void 0 : callback({
                                                success: false,
                                                error: 'Message too long (max 5000 characters)',
                                            })];
                                    }
                                    return [4 /*yield*/, verifyMatchMembership(userId, matchId)];
                                case 1:
                                    isMember = _b.sent();
                                    if (!isMember) {
                                        return [2 /*return*/, callback === null || callback === void 0 ? void 0 : callback({
                                                success: false,
                                                error: 'Unauthorized: You are not part of this match',
                                            })];
                                    }
                                    return [4 /*yield*/, prisma_1.default.message.create({
                                            data: {
                                                matchId: matchId,
                                                senderId: userId,
                                                content: content.trim(),
                                                contentType: contentType,
                                                read: false,
                                            },
                                        })];
                                case 2:
                                    newMessage = _b.sent();
                                    messagePayload = {
                                        id: newMessage.id,
                                        matchId: newMessage.matchId,
                                        senderId: newMessage.senderId,
                                        content: newMessage.content,
                                        contentType: newMessage.contentType,
                                        createdAt: newMessage.createdAt.toISOString(),
                                        read: newMessage.read,
                                    };
                                    // Emit to match room (including sender)
                                    io.to("match:".concat(matchId)).emit('message:new', messagePayload);
                                    // Send success callback
                                    callback === null || callback === void 0 ? void 0 : callback({
                                        success: true,
                                        message: messagePayload,
                                    });
                                    console.log("  \u2514\u2500 Message sent: ".concat(newMessage.id, " in match ").concat(matchId));
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_8 = _b.sent();
                                    console.error('Error sending message:', error_8);
                                    callback === null || callback === void 0 ? void 0 : callback({
                                        success: false,
                                        error: 'Failed to send message',
                                    });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ============================================================================
                    // Event: typing:start
                    // ============================================================================
                    socket.on('typing:start', function (payload) { return __awaiter(_this, void 0, void 0, function () {
                        var matchId, isMember, error_9;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    matchId = payload.matchId;
                                    if (!matchId)
                                        return [2 /*return*/];
                                    return [4 /*yield*/, verifyMatchMembership(userId, matchId)];
                                case 1:
                                    isMember = _a.sent();
                                    if (!isMember)
                                        return [2 /*return*/];
                                    // Broadcast to match room (excluding sender)
                                    socket.to("match:".concat(matchId)).emit('typing:start', {
                                        userId: userId,
                                        matchId: matchId,
                                    });
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_9 = _a.sent();
                                    console.error('Error handling typing:start:', error_9);
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ============================================================================
                    // Event: typing:stop
                    // ============================================================================
                    socket.on('typing:stop', function (payload) { return __awaiter(_this, void 0, void 0, function () {
                        var matchId, isMember, error_10;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    matchId = payload.matchId;
                                    if (!matchId)
                                        return [2 /*return*/];
                                    return [4 /*yield*/, verifyMatchMembership(userId, matchId)];
                                case 1:
                                    isMember = _a.sent();
                                    if (!isMember)
                                        return [2 /*return*/];
                                    // Broadcast to match room (excluding sender)
                                    socket.to("match:".concat(matchId)).emit('typing:stop', {
                                        userId: userId,
                                        matchId: matchId,
                                    });
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_10 = _a.sent();
                                    console.error('Error handling typing:stop:', error_10);
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ============================================================================
                    // Event: presence:set
                    // ============================================================================
                    socket.on('presence:set', function (payload) { return __awaiter(_this, void 0, void 0, function () {
                        var status_1, matchIds, error_11;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 4, , 5]);
                                    status_1 = payload.status;
                                    if (!['online', 'offline', 'away'].includes(status_1)) {
                                        return [2 /*return*/];
                                    }
                                    // Update presence in Redis
                                    return [4 /*yield*/, setPresence(userId, status_1)];
                                case 1:
                                    // Update presence in Redis
                                    _a.sent();
                                    return [4 /*yield*/, getUserMatches(userId)];
                                case 2:
                                    matchIds = _a.sent();
                                    return [4 /*yield*/, broadcastPresence(io, userId, matchIds)];
                                case 3:
                                    _a.sent();
                                    console.log("  \u2514\u2500 Presence updated: ".concat(userId, " is ").concat(status_1));
                                    return [3 /*break*/, 5];
                                case 4:
                                    error_11 = _a.sent();
                                    console.error('Error handling presence:set:', error_11);
                                    return [3 /*break*/, 5];
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ============================================================================
                    // Event: match:accept (Future feature)
                    // ============================================================================
                    socket.on('match:accept', function (payload, callback) { return __awaiter(_this, void 0, void 0, function () {
                        var matchId, isMember, error_12;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    matchId = payload.matchId;
                                    if (!matchId) {
                                        return [2 /*return*/, callback === null || callback === void 0 ? void 0 : callback({
                                                success: false,
                                                error: 'Match ID required',
                                            })];
                                    }
                                    return [4 /*yield*/, verifyMatchMembership(userId, matchId)];
                                case 1:
                                    isMember = _a.sent();
                                    if (!isMember) {
                                        return [2 /*return*/, callback === null || callback === void 0 ? void 0 : callback({
                                                success: false,
                                                error: 'Unauthorized: You are not part of this match',
                                            })];
                                    }
                                    // TODO: Implement match acceptance logic
                                    // For now, just acknowledge
                                    callback === null || callback === void 0 ? void 0 : callback({
                                        success: true,
                                        message: 'Match acceptance feature coming soon',
                                    });
                                    console.log("  \u2514\u2500 Match accepted: ".concat(matchId, " by ").concat(userId));
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_12 = _a.sent();
                                    console.error('Error handling match:accept:', error_12);
                                    callback === null || callback === void 0 ? void 0 : callback({
                                        success: false,
                                        error: 'Failed to accept match',
                                    });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ============================================================================
                    // Event: match:decline (Future feature)
                    // ============================================================================
                    socket.on('match:decline', function (payload, callback) { return __awaiter(_this, void 0, void 0, function () {
                        var matchId, isMember, error_13;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    matchId = payload.matchId;
                                    if (!matchId) {
                                        return [2 /*return*/, callback === null || callback === void 0 ? void 0 : callback({
                                                success: false,
                                                error: 'Match ID required',
                                            })];
                                    }
                                    return [4 /*yield*/, verifyMatchMembership(userId, matchId)];
                                case 1:
                                    isMember = _a.sent();
                                    if (!isMember) {
                                        return [2 /*return*/, callback === null || callback === void 0 ? void 0 : callback({
                                                success: false,
                                                error: 'Unauthorized: You are not part of this match',
                                            })];
                                    }
                                    // TODO: Implement match decline logic
                                    // For now, just acknowledge
                                    callback === null || callback === void 0 ? void 0 : callback({
                                        success: true,
                                        message: 'Match decline feature coming soon',
                                    });
                                    console.log("  \u2514\u2500 Match declined: ".concat(matchId, " by ").concat(userId));
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_13 = _a.sent();
                                    console.error('Error handling match:decline:', error_13);
                                    callback === null || callback === void 0 ? void 0 : callback({
                                        success: false,
                                        error: 'Failed to decline match',
                                    });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ============================================================================
                    // Event: disconnect
                    // ============================================================================
                    socket.on('disconnect', function (reason) { return __awaiter(_this, void 0, void 0, function () {
                        var matchIds, error_14;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    console.log("\u2717 Socket disconnected: ".concat(socket.id, " (User: ").concat(userId, ", Reason: ").concat(reason, ")"));
                                    _a.label = 1;
                                case 1:
                                    _a.trys.push([1, 5, , 6]);
                                    // Set user as offline
                                    return [4 /*yield*/, setPresence(userId, 'offline')];
                                case 2:
                                    // Set user as offline
                                    _a.sent();
                                    // Clear rate limiter
                                    messageRateLimiter.clear(socket.id);
                                    return [4 /*yield*/, getUserMatches(userId)];
                                case 3:
                                    matchIds = _a.sent();
                                    return [4 /*yield*/, broadcastPresence(io, userId, matchIds)];
                                case 4:
                                    _a.sent();
                                    return [3 /*break*/, 6];
                                case 5:
                                    error_14 = _a.sent();
                                    console.error('Error during socket disconnect cleanup:', error_14);
                                    return [3 /*break*/, 6];
                                case 6: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ============================================================================
                    // Event: error
                    // ============================================================================
                    socket.on('error', function (error) {
                        console.error("\u274C Socket error (".concat(socket.id, ", User: ").concat(userId, "):"), error);
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    console.log('✓ Socket.IO server initialized');
    return io;
}
// ============================================================================
// Socket.IO Server Shutdown
// ============================================================================
/**
 * Gracefully closes all Socket.IO connections
 * @param io - Socket.IO server instance
 */
function closeSocket(io) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve) {
                    // Disconnect all clients
                    io.disconnectSockets(true);
                    // Close the server
                    io.close(function () {
                        console.log('✓ All Socket.IO connections closed');
                        resolve();
                    });
                })];
        });
    });
}
// ============================================================================
// Helper Functions for External Use
// ============================================================================
/**
 * Emit event to a specific user
 * @param io - Socket.IO server instance
 * @param userId - User ID to emit to
 * @param event - Event name
 * @param data - Event data
 */
function emitToUser(io, userId, event, data) {
    io.to("user:".concat(userId)).emit(event, data);
}
/**
 * Emit event to a match room
 * @param io - Socket.IO server instance
 * @param matchId - Match ID to emit to
 * @param event - Event name
 * @param data - Event data
 */
function emitToMatch(io, matchId, event, data) {
    io.to("match:".concat(matchId)).emit(event, data);
}
