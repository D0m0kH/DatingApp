"use strict";
// backend/src/middleware/auth.ts
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
exports.requireAuth = exports.requireVerified = void 0;
var errors_1 = require("../utils/errors");
var jwt_1 = require("../utils/jwt");
var prisma_1 = require("../utils/prisma");
/**
 * @description FASE-Aware Express middleware to authenticate a user via JWT,
 * perform basic session check against refresh token, load user data, and attach it to `req.user`.
 * @throws {AuthError} If token is missing, invalid, or user is not found.
 */
var authMiddleware = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var token, payload, userId, fingerprintId, activeSession, user, error_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                token = (0, jwt_1.getTokenFromHeader)(req);
                if (!token) {
                    // Advanced: Check for cookie-based token fallback (not implemented here)
                    throw new errors_1.AuthError('Authentication token not provided.', 'TOKEN_MISSING');
                }
                _b.label = 1;
            case 1:
                _b.trys.push([1, 4, , 5]);
                payload = (0, jwt_1.verifyJwt)(token);
                userId = payload.userId;
                fingerprintId = payload.fingerprintId;
                return [4 /*yield*/, prisma_1.prisma.refreshToken.findUnique({
                        where: { id: fingerprintId, userId: userId },
                        select: { id: true }
                    })];
            case 2:
                activeSession = _b.sent();
                if (!activeSession) {
                    // This means the refresh token has been revoked, rotated, or expired.
                    throw new errors_1.AuthError('Session invalid. Please re-login or refresh token.', 'SESSION_REVOKED');
                }
                return [4 /*yield*/, prisma_1.prisma.user.findUnique({
                        where: { id: userId },
                        select: { id: true, email: true, emailVerified: true, isIdentityVerified: true, profile: { select: { isPremium: true } } },
                    })];
            case 3:
                user = _b.sent();
                if (!user) {
                    throw new errors_1.AuthError('User not found or token payload is stale.', 'USER_NOT_FOUND');
                }
                // 4. Attach user to request object
                req.user = {
                    id: user.id,
                    email: user.email,
                    isIdentityVerified: user.isIdentityVerified,
                    isPremium: ((_a = user.profile) === null || _a === void 0 ? void 0 : _a.isPremium) || false,
                };
                next();
                return [3 /*break*/, 5];
            case 4:
                error_1 = _b.sent();
                if (error_1 instanceof errors_1.AppError) {
                    return [2 /*return*/, next(error_1)];
                }
                return [2 /*return*/, next(new errors_1.AuthError('An unexpected error occurred during authentication.', 'AUTH_UNEXPECTED'))];
            case 5: return [2 /*return*/];
        }
    });
}); };
/**
 * @description Advanced: Middleware to enforce that a user has completed identity verification.
 * @throws {IdentityError} If user is not identity verified.
 */
var requireVerified = function (req, res, next) {
    if (!req.user) {
        // Should be caught by authMiddleware if used correctly
        return next(new errors_1.AuthError('Authentication context missing.', 'CONTEXT_MISSING'));
    }
    if (!req.user.isIdentityVerified) {
        // Advanced: Add details on how to verify
        throw new errors_1.IdentityError('Action requires Identity Verification for safety and authenticity.', 'VERIFICATION_NEEDED');
    }
    next();
};
exports.requireVerified = requireVerified;
exports.requireAuth = authMiddleware;
exports.default = authMiddleware;
