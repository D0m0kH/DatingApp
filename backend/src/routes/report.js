"use strict";
// backend/src/routes/report.ts
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var auth_1 = require("../middleware/auth");
var validate_1 = require("../middleware/validate");
var reportController = require("../controllers/report");
var zod_1 = require("zod");
var client_1 = require("@prisma/client");
var router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
var ReportCreateSchema = zod_1.z.object({
    reportedUserId: zod_1.z.string().min(1),
    category: zod_1.z.nativeEnum(client_1.ReportCategory, {
        errorMap: function () { return ({ message: "Category must be one of: ".concat(Object.keys(client_1.ReportCategory).join(', ')) }); }
    }),
    details: zod_1.z.string().min(10).max(1000),
    attachments: zod_1.z.array(zod_1.z.string()).optional(),
});
/**
 * POST /api/report
 * Submit a new abuse report.
 */
router.post('/', (0, validate_1.validateBody)(ReportCreateSchema), reportController.createReport);
/**
 * GET /api/report/my
 * Retrieve the current user's history of reports sent.
 */
router.get('/my', reportController.getMyReports);
exports.default = router;
