"use strict";
// backend/src/controllers/admin.ts
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReports = exports.reviewPhoto = exports.banUser = exports.getUsers = void 0;
var prisma_1 = require("../utils/prisma");
var errors_1 = require("../utils/errors");
var client_1 = require("@prisma/client");
// --- Admin Audit Logging Helper ---
var createAuditLog = function (adminId, action, targetUserId, details, req) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma_1.prisma.adminAudit.create({
                    data: {
                        adminId: adminId,
                        action: action,
                        targetUserId: targetUserId,
                        details: details,
                        ipAddress: req.ip,
                    },
                })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
/**
 * GET /api/admin/users - Paginated list of users
 */
var getUsers = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, page, limit, search, status_1, skip, where, _b, users, total, error_1;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 2, , 3]);
                _a = req.validatedBody, page = _a.page, limit = _a.limit, search = _a.search, status_1 = _a.status;
                skip = (page - 1) * limit;
                where = {};
                if (search) {
                    where.OR = [
                        { email: { contains: search, mode: 'insensitive' } },
                        { firstName: { contains: search, mode: 'insensitive' } },
                    ];
                }
                // Advanced Status Filter
                if (status_1 === 'BANNED')
                    where.isBanned = true;
                if (status_1 === 'VERIFIED')
                    where.isIdentityVerified = true;
                if (status_1 === 'UNVERIFIED')
                    where.isIdentityVerified = false;
                return [4 /*yield*/, prisma_1.prisma.$transaction([
                        prisma_1.prisma.user.findMany({
                            where: where,
                            take: limit,
                            skip: skip,
                            select: {
                                id: true, email: true, firstName: true, isBanned: true, isAdmin: true,
                                isIdentityVerified: true, createdAt: true, lastActive: true,
                            },
                            orderBy: { createdAt: 'desc' }
                        }),
                        prisma_1.prisma.user.count({ where: where }),
                    ])];
            case 1:
                _b = _c.sent(), users = _b[0], total = _b[1];
                res.status(200).json({ users: users, total: total, page: page, limit: limit });
                return [3 /*break*/, 3];
            case 2:
                error_1 = _c.sent();
                next(error_1);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getUsers = getUsers;
/**
 * PATCH /api/admin/users/:id/ban - Ban/unban user
 */
var banUser = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var adminId, targetUserId, _a, isBanned, reason, user, updatedUser, action, error_2;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 6, , 7]);
                adminId = req.user.id;
                targetUserId = req.params.id;
                _a = req.validatedBody, isBanned = _a.isBanned, reason = _a.reason;
                return [4 /*yield*/, prisma_1.prisma.user.findUnique({ where: { id: targetUserId } })];
            case 1:
                user = _b.sent();
                if (!user) {
                    throw new errors_1.NotFoundError('Target user not found.', 'USER_NOT_FOUND_ADMIN');
                }
                if (user.isAdmin && isBanned) {
                    throw new errors_1.AppError('Cannot ban another admin user.', 403, 'ADMIN_BAN_FORBIDDEN');
                }
                return [4 /*yield*/, prisma_1.prisma.user.update({
                        where: { id: targetUserId },
                        data: { isBanned: isBanned },
                        select: { id: true, email: true, isBanned: true }
                    })];
            case 2:
                updatedUser = _b.sent();
                action = isBanned ? 'BAN_USER' : 'UNBAN_USER';
                return [4 /*yield*/, createAuditLog(adminId, action, targetUserId, { reason: reason, source: 'Manual Admin' }, req)];
            case 3:
                _b.sent();
                if (!isBanned) return [3 /*break*/, 5];
                return [4 /*yield*/, prisma_1.prisma.refreshToken.deleteMany({ where: { userId: targetUserId } })];
            case 4:
                _b.sent();
                _b.label = 5;
            case 5:
                res.status(200).json({ message: "User ".concat(updatedUser.email, " ").concat(isBanned ? 'banned' : 'unbanned', "."), user: updatedUser });
                return [3 /*break*/, 7];
            case 6:
                error_2 = _b.sent();
                next(error_2);
                return [3 /*break*/, 7];
            case 7: return [2 /*return*/];
        }
    });
}); };
exports.banUser = banUser;
/**
 * PATCH /api/admin/photos/:id/review - Review/Moderate photo
 */
var reviewPhoto = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var adminId, photoId, _a, status_2, _b, manualTags, photo, updatedPhoto, error_3;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 4, , 5]);
                adminId = req.user.id;
                photoId = req.params.id;
                _a = req.validatedBody, status_2 = _a.status, _b = _a.manualTags, manualTags = _b === void 0 ? [] : _b;
                return [4 /*yield*/, prisma_1.prisma.photo.findUnique({ where: { id: photoId } })];
            case 1:
                photo = _c.sent();
                if (!photo) {
                    throw new errors_1.NotFoundError('Photo not found.', 'PHOTO_NOT_FOUND_ADMIN');
                }
                return [4 /*yield*/, prisma_1.prisma.photo.update({
                        where: { id: photoId },
                        data: {
                            status: status_2,
                            // Advanced: Merge/Override AI tags with manual admin tags
                            aiTags: status_2 === client_1.PhotoModerationStatus.APPROVED
                                ? Array.from(new Set(__spreadArray(__spreadArray([], (photo.aiTags || []), true), manualTags, true)))
                                : (photo.aiTags || []),
                        },
                    })];
            case 2:
                updatedPhoto = _c.sent();
                // Audit Log
                return [4 /*yield*/, createAuditLog(adminId, "PHOTO_REVIEW_".concat(status_2), updatedPhoto.userId, { photoId: photoId, manualTags: manualTags }, req)];
            case 3:
                // Audit Log
                _c.sent();
                res.status(200).json({ message: "Photo status updated to ".concat(status_2, "."), photo: updatedPhoto });
                return [3 /*break*/, 5];
            case 4:
                error_3 = _c.sent();
                next(error_3);
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.reviewPhoto = reviewPhoto;
/**
 * GET /api/admin/reports - View reports
 */
var getReports = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, status_3, page, limit, priority, skip, where, _b, reports, total, error_4;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 2, , 3]);
                _a = req.validatedBody, status_3 = _a.status, page = _a.page, limit = _a.limit, priority = _a.priority;
                skip = (page - 1) * limit;
                where = { status: status_3 };
                // Advanced: Filter reports by priority (simulated)
                if (priority === 'HIGH')
                    where.category = { in: ['HARASSMENT', 'FRAUD'] };
                return [4 /*yield*/, prisma_1.prisma.$transaction([
                        prisma_1.prisma.report.findMany({
                            where: where,
                            take: limit,
                            skip: skip,
                            include: { reporter: { select: { email: true, firstName: true } }, reported: { select: { email: true, firstName: true } } },
                            orderBy: [{ category: 'desc' }, { createdAt: 'asc' }] // Priority sort: Category then time
                        }),
                        prisma_1.prisma.report.count({ where: where }),
                    ])];
            case 1:
                _b = _c.sent(), reports = _b[0], total = _b[1];
                res.status(200).json({ reports: reports, total: total, page: page, limit: limit });
                return [3 /*break*/, 3];
            case 2:
                error_4 = _c.sent();
                next(error_4);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getReports = getReports;
