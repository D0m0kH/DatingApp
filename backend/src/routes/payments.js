"use strict";
// backend/src/routes/payments.ts
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
var express_1 = require("express");
var auth_1 = require("../middleware/auth");
var payments_1 = require("../services/payments");
var zod_1 = require("zod");
var validate_1 = require("../middleware/validate");
var errors_1 = require("../utils/errors");
var body_parser_1 = require("body-parser");
var router = (0, express_1.Router)();
// Zod schema for checkout session request (simplified as the service handles price details)
var CheckoutSchema = zod_1.z.object({
    priceId: zod_1.z.string().min(1),
    successUrl: zod_1.z.string().url(),
    cancelUrl: zod_1.z.string().url(),
});
/**
 * POST /api/payments/create-checkout-session
 * Creates a Stripe checkout session URL. Requires auth.
 */
router.post('/create-checkout-session', auth_1.requireAuth, (0, validate_1.validateBody)(CheckoutSchema), function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, _a, priceId, successUrl, cancelUrl, session, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                userId = req.user.id;
                _a = req.validatedBody, priceId = _a.priceId, successUrl = _a.successUrl, cancelUrl = _a.cancelUrl;
                return [4 /*yield*/, (0, payments_1.createCheckoutSession)(userId, priceId, successUrl, cancelUrl)];
            case 1:
                session = _b.sent();
                res.status(200).json({ url: session.url, sessionId: session.id });
                return [3 /*break*/, 3];
            case 2:
                error_1 = _b.sent();
                next(error_1);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * POST /api/payments/webhook
 * Handles incoming Stripe webhooks. Must use raw body for signature verification.
 */
// Use body-parser to get the raw body string *only* for this route
router.post('/webhook', body_parser_1.default.raw({ type: 'application/json', limit: '5mb' }), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var event_1, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                // Ensure raw body is available
                req.rawBody = req.body.toString('utf8');
                event_1 = (0, payments_1.processWebhook)(req);
                // 2. Handle business logic
                return [4 /*yield*/, (0, payments_1.handleStripeEvent)(event_1)];
            case 1:
                // 2. Handle business logic
                _a.sent();
                // 3. Acknowledge receipt
                res.json({ received: true });
                return [3 /*break*/, 3];
            case 2:
                error_2 = _a.sent();
                if (error_2 instanceof errors_1.AppError) {
                    console.error('Webhook error:', error_2.message);
                    return [2 /*return*/, res.status(error_2.statusCode).send({ error: error_2.message })];
                }
                console.error('Unexpected webhook error:', error_2);
                res.status(500).send({ error: 'Internal Server Error' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
exports.default = router;
