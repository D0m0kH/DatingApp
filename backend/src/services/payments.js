"use strict";
// backend/src/services/payments.ts
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
exports.createCheckoutSession = createCheckoutSession;
exports.processWebhook = processWebhook;
exports.handleStripeEvent = handleStripeEvent;
var stripe_1 = require("stripe");
var prisma_1 = require("../utils/prisma");
var errors_1 = require("../utils/errors");
var notifications_1 = require("./notifications");
// --- Configuration ---
var STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
var STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
if (!STRIPE_SECRET) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set.');
}
var stripe = new stripe_1.default(STRIPE_SECRET, { apiVersion: '2023-10-16' });
// --- Public Functions ---
/**
 * @description Creates a new Stripe Checkout Session.
 */
function createCheckoutSession(userId, priceId, successUrl, cancelUrl) {
    return __awaiter(this, void 0, void 0, function () {
        var user, customerId, customer, price, mode, session;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma_1.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, stripeCustomerId: true } })];
                case 1:
                    user = _a.sent();
                    if (!user) {
                        throw new errors_1.AppError('User not found for payment processing.', 404, 'USER_NOT_FOUND_PAYMENT');
                    }
                    customerId = user.stripeCustomerId;
                    if (!!customerId) return [3 /*break*/, 4];
                    return [4 /*yield*/, stripe.customers.create({ email: user.email, metadata: { userId: user.id } })];
                case 2:
                    customer = _a.sent();
                    customerId = customer.id;
                    return [4 /*yield*/, prisma_1.prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } })];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4: return [4 /*yield*/, stripe.prices.retrieve(priceId)];
                case 5:
                    price = _a.sent();
                    mode = price.type === 'recurring' ? 'subscription' : 'payment';
                    return [4 /*yield*/, stripe.checkout.sessions.create({
                            customer: customerId,
                            payment_method_types: ['card'],
                            line_items: [{ price: priceId, quantity: 1 }],
                            mode: mode,
                            success_url: successUrl,
                            cancel_url: cancelUrl,
                            metadata: { userId: userId, priceType: price.metadata.priceType || 'UNKNOWN' }, // Pass custom internal type
                        })];
                case 6:
                    session = _a.sent();
                    return [2 /*return*/, session];
            }
        });
    });
}
/**
 * @description Processes a raw Stripe webhook event.
 */
function processWebhook(req) {
    if (!STRIPE_WEBHOOK_SECRET) {
        throw new Error('Stripe Webhook Secret not configured.');
    }
    var sig = req.headers['stripe-signature'];
    var rawBody = req.rawBody;
    try {
        var event_1 = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
        return event_1;
    }
    catch (err) {
        console.error('⚠️ Webhook signature verification failed.', err.message);
        throw new errors_1.AppError('Webhook Signature Invalid', 400, 'STRIPE_WEBHOOK_FAIL');
    }
}
/**
 * @description Handles the business logic for specific Stripe events.
 */
function handleStripeEvent(event) {
    return __awaiter(this, void 0, void 0, function () {
        var data, userId, _a, session, priceType;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    data = event.data.object;
                    userId = (_b = data.metadata) === null || _b === void 0 ? void 0 : _b.userId;
                    // Advanced: Handle Product Catalog Sync (e.g., store price/product info locally)
                    if (event.type === 'product.created' || event.type === 'product.updated') {
                        // const product = data as Stripe.Product;
                        console.log("Product event handled: ".concat(event.type, " - ").concat(data.id));
                        // Logic to update local product catalog in Redis/DB
                        return [2 /*return*/];
                    }
                    if (!userId) {
                        return [2 /*return*/];
                    }
                    _a = event.type;
                    switch (_a) {
                        case 'checkout.session.completed': return [3 /*break*/, 1];
                        case 'customer.subscription.created': return [3 /*break*/, 3];
                        case 'invoice.paid': return [3 /*break*/, 3];
                        case 'customer.subscription.deleted': return [3 /*break*/, 5];
                    }
                    return [3 /*break*/, 7];
                case 1:
                    session = data;
                    priceType = ((_c = session.metadata) === null || _c === void 0 ? void 0 : _c.priceType) || 'UNKNOWN';
                    return [4 /*yield*/, creditUserForPurchase(userId, priceType)];
                case 2:
                    _d.sent();
                    return [3 /*break*/, 8];
                case 3: 
                // const sub = data as Stripe.Subscription;
                return [4 /*yield*/, prisma_1.prisma.profile.update({
                        where: { userId: userId },
                        data: { isPremium: true },
                    })];
                case 4:
                    // const sub = data as Stripe.Subscription;
                    _d.sent();
                    (0, notifications_1.sendPushToUser)(userId, { title: 'Premium Active', body: 'Your subscription is now live!', priority: 'high' });
                    return [3 /*break*/, 8];
                case 5: return [4 /*yield*/, prisma_1.prisma.profile.update({
                        where: { userId: userId },
                        data: { isPremium: false },
                    })];
                case 6:
                    _d.sent();
                    return [3 /*break*/, 8];
                case 7:
                    console.log("Unhandled event type ".concat(event.type));
                    _d.label = 8;
                case 8: return [2 /*return*/];
            }
        });
    });
}
/**
 * @description Business logic to update user account after a successful ONE-TIME purchase.
 */
function creditUserForPurchase(userId, priceType) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Crediting user ".concat(userId, " for purchase type: ").concat(priceType));
                    if (!(priceType === 'BOOST')) return [3 /*break*/, 2];
                    return [4 /*yield*/, prisma_1.prisma.boost.create({
                            data: { userId: userId, type: 'PROFILE_BOOST', expiresAt: new Date(Date.now() + 60 * 60 * 1000) }, // 1 hour boost
                        })];
                case 1:
                    _a.sent();
                    (0, notifications_1.sendPushToUser)(userId, { title: 'Boost Activated!', body: 'Your profile is now featured!', priority: 'high' });
                    return [3 /*break*/, 3];
                case 2:
                    if (priceType.includes('SUPER_LIKE')) {
                        // Update a credit counter field on the Profile table (conceptual)
                        console.log("Credited Super Likes to user ".concat(userId));
                    }
                    _a.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    });
}
