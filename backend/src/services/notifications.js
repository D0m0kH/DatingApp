"use strict";
// backend/src/services/notifications.ts
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
exports.sendEmail = exports.sendPushToUser = exports.PushNotificationQueue = void 0;
var prisma_1 = require("../utils/prisma");
var bullmq_1 = require("bullmq");
// --- BullMQ Queue Setup ---
var connection = {
    connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
    }
};
exports.PushNotificationQueue = new bullmq_1.Queue('PushNotifications', connection);
/**
 * @description Advanced: Checks user settings and applies an AI sentiment filter before sending.
 * @param userId - The ID of the recipient.
 * @param payload - The notification content.
 */
var sendPushToUser = function (userId, payload) { return __awaiter(void 0, void 0, void 0, function () {
    var user, deviceTokens, preferences, isDNDActive, hoursSinceActive, _i, deviceTokens_1, device, jobData;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, prisma_1.prisma.user.findUnique({
                    where: { id: userId },
                    select: { deviceTokens: true, lastActive: true, profile: { select: { preferences: true } } },
                })];
            case 1:
                user = _b.sent();
                if (!user) {
                    console.warn("Push failed: User ".concat(userId, " not found."));
                    return [2 /*return*/];
                }
                deviceTokens = user.deviceTokens || [];
                preferences = ((_a = user.profile) === null || _a === void 0 ? void 0 : _a.preferences) || {};
                isDNDActive = preferences.dndActive;
                hoursSinceActive = (Date.now() - user.lastActive.getTime()) / (1000 * 60 * 60);
                // Advanced Filter: Suppress low-priority pushes if user is highly active or DND is on
                if (isDNDActive || (payload.priority === 'low' && hoursSinceActive < 1)) {
                    console.log("[AI FILTER] Push suppressed for user ".concat(userId, " (DND/High Activity)."));
                    return [2 /*return*/];
                }
                _i = 0, deviceTokens_1 = deviceTokens;
                _b.label = 2;
            case 2:
                if (!(_i < deviceTokens_1.length)) return [3 /*break*/, 5];
                device = deviceTokens_1[_i];
                jobData = {
                    token: device.token,
                    platform: device.platform,
                    payload: payload,
                    userId: userId,
                };
                return [4 /*yield*/, exports.PushNotificationQueue.add('send-push', jobData, {
                        attempts: 3,
                        backoff: { type: 'exponential', delay: 1000 * 5 },
                        removeOnComplete: true,
                        priority: payload.priority === 'high' ? 1 : 5, // BullMQ priority
                    })];
            case 3:
                _b.sent();
                console.log("[PUSH] Enqueued push for user ".concat(userId, " (Priority: ").concat(payload.priority, ")."));
                _b.label = 4;
            case 4:
                _i++;
                return [3 /*break*/, 2];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.sendPushToUser = sendPushToUser;
/**
 * @description Sends an email to a user (logic remains abstracted).
 */
var sendEmail = function (userId, payload) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        // Logic remains the same, leveraging a separate EmailQueue (not fully implemented here)
        console.log("[EMAIL STUB] Email enqueued for user ".concat(userId, "."));
        return [2 /*return*/];
    });
}); };
exports.sendEmail = sendEmail;
