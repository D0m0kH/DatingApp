"use strict";
// backend/src/controllers/report.ts
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
exports.getMyReports = exports.createReport = exports.ModerationQueue = void 0;
var prisma_1 = require("../utils/prisma");
var errors_1 = require("../utils/errors");
var client_1 = require("@prisma/client");
var bullmq_1 = require("bullmq");
// --- BullMQ Queue for Moderation ---
var connection = {
    connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
    }
};
exports.ModerationQueue = new bullmq_1.Queue('Moderation', connection);
// --- High Priority Escalation Rules (Advanced) ---
var HIGH_PRIORITY_CATEGORIES = [client_1.ReportCategory.HARASSMENT, client_1.ReportCategory.FRAUD];
var AUTO_BLOCK_CATEGORIES = [client_1.ReportCategory.HARASSMENT, client_1.ReportCategory.FRAUD];
var SHADOW_BAN_THRESHOLD = 5; // Advanced: 5 reports in 24 hours trigger a temporary shadow ban
/**
 * POST /api/report - Submit a new abuse report
 */
var createReport = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var reporterId, _a, reportedUserId, category, details, _b, attachments, shouldAutoBlock, report, recentReportsCount, isHighPriority_1, isHighPriority, error_1;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 8, , 9]);
                reporterId = req.user.id;
                _a = req.validatedBody, reportedUserId = _a.reportedUserId, category = _a.category, details = _a.details, _b = _a.attachments, attachments = _b === void 0 ? [] : _b;
                if (reporterId === reportedUserId) {
                    throw new errors_1.AppError('Cannot report yourself.', 400, 'SELF_REPORT_FORBIDDEN');
                }
                shouldAutoBlock = AUTO_BLOCK_CATEGORIES.includes(category);
                return [4 /*yield*/, prisma_1.prisma.report.create({
                        data: { reporterId: reporterId, reportedId: reportedUserId, category: category, details: details, attachments: attachments, autoBlocked: shouldAutoBlock, status: 'PENDING' },
                    })];
            case 1:
                report = _c.sent();
                if (!shouldAutoBlock) return [3 /*break*/, 3];
                return [4 /*yield*/, prisma_1.prisma.like.upsert({
                        where: { likerId_likedId: { likerId: reporterId, likedId: reportedUserId } },
                        update: { isDislike: true },
                        create: { likerId: reporterId, likedId: reportedUserId, isDislike: true },
                    })];
            case 2:
                _c.sent();
                _c.label = 3;
            case 3: return [4 /*yield*/, prisma_1.prisma.report.count({
                    where: {
                        reportedId: reportedUserId,
                        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
                    }
                })];
            case 4:
                recentReportsCount = _c.sent();
                if (!(recentReportsCount >= SHADOW_BAN_THRESHOLD)) return [3 /*break*/, 6];
                // Apply temporary shadow ban: prevent user from appearing in recommendations
                return [4 /*yield*/, redis.set("user:shadowban:".concat(reportedUserId), 'true', 'EX', 60 * 60 * 4)];
            case 5:
                // Apply temporary shadow ban: prevent user from appearing in recommendations
                _c.sent(); // 4-hour ban
                console.warn("[SHADOW BAN] User ".concat(reportedUserId, " hit ").concat(SHADOW_BAN_THRESHOLD, " reports in 24h. Applied temporary shadow ban."));
                isHighPriority_1 = true;
                _c.label = 6;
            case 6:
                isHighPriority = HIGH_PRIORITY_CATEGORIES.includes(category);
                return [4 /*yield*/, exports.ModerationQueue.add('review-report', { reportId: report.id }, { priority: isHighPriority ? 1 : 5 })];
            case 7:
                _c.sent();
                res.status(201).json({
                    message: 'Report submitted successfully. We will review it shortly.',
                    reportId: report.id,
                    autoBlocked: shouldAutoBlock,
                });
                return [3 /*break*/, 9];
            case 8:
                error_1 = _c.sent();
                next(error_1);
                return [3 /*break*/, 9];
            case 9: return [2 /*return*/];
        }
    });
}); };
exports.createReport = createReport;
/**
 * GET /api/report/my - Retrieve user's own report history
 */
var getMyReports = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var reporterId, reports, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                reporterId = req.user.id;
                return [4 /*yield*/, prisma_1.prisma.report.findMany({
                        where: { reporterId: reporterId },
                        orderBy: { createdAt: 'desc' },
                        select: { id: true, category: true, status: true, reported: { select: { firstName: true, email: true } } }
                    })];
            case 1:
                reports = _a.sent();
                res.status(200).json(reports);
                return [3 /*break*/, 3];
            case 2:
                error_2 = _a.sent();
                next(error_2);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getMyReports = getMyReports;
