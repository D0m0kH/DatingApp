"use strict";
// backend/src/index.ts
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
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
exports.io = exports.server = void 0;
require("dotenv/config"); // Must be the first line
var http_1 = require("http");
var terminus_1 = require("@godaddy/terminus");
var node_1 = require("@sentry/node");
var app_1 = require("./app");
var socket_1 = require("./socket");
var prisma_1 = require("./utils/prisma");
var redis_1 = require("./utils/redis");
var worker_1 = require("./jobs/worker"); // New worker entry point
// --- Environment Validation (Stricter) ---
var requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'JWT_ALGORITHM', 'S3_BUCKET', 'REDIS_HOST'];
var missingEnvVars = requiredEnvVars.filter(function (key) { return !process.env[key]; });
if (missingEnvVars.length > 0) {
    console.error("\u274C Fatal: Missing required environment variables: ".concat(missingEnvVars.join(', ')));
    console.error('Ensure JWT_ALGORITHM is set (e.g., HS512 or RS256).');
    process.exit(1);
}
// --- Sentry Initialization ---
if (process.env.SENTRY_DSN) {
    node_1.default.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 1.0,
    });
    console.log('✅ Sentry initialized.');
}
// --- Server Setup ---
var PORT = process.env.PORT || 4000;
// Create HTTP server and attach Socket.IO
var server = http_1.default.createServer(app_1.default);
exports.server = server;
var io = (0, socket_1.initSocket)(server);
exports.io = io;
// Start BullMQ Workers
var matchWorker = (0, worker_1.startMatchScoringWorker)();
var moderationWorker = (0, worker_1.startModerationWorker)();
// --- Graceful Shutdown (Extended) ---
var onSignal = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('Gracefully shutting down...');
                // 1. Close HTTP server (stops accepting new connections)
                server.close();
                // 2. Close Socket.IO
                io.close();
                // 3. Close BullMQ Workers
                return [4 /*yield*/, matchWorker.close()];
            case 1:
                // 3. Close BullMQ Workers
                _a.sent();
                return [4 /*yield*/, moderationWorker.close()];
            case 2:
                _a.sent();
                // 4. Disconnect Prisma
                return [4 /*yield*/, prisma_1.prisma.$disconnect()];
            case 3:
                // 4. Disconnect Prisma
                _a.sent();
                // 5. Disconnect Redis
                return [4 /*yield*/, redis_1.redis.quit()];
            case 4:
                // 5. Disconnect Redis
                _a.sent();
                console.log('Server, Workers, DB, and Redis connections closed.');
                return [2 /*return*/];
        }
    });
}); };
var onHealthCheck = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: 
            // Check DB connection
            return [4 /*yield*/, prisma_1.prisma.$queryRaw(templateObject_1 || (templateObject_1 = __makeTemplateObject(["SELECT 1"], ["SELECT 1"])))];
            case 1:
                // Check DB connection
                _a.sent();
                // Check Redis connection
                return [4 /*yield*/, redis_1.redis.ping()];
            case 2:
                // Check Redis connection
                _a.sent();
                return [2 /*return*/, { prisma: 'ok', redis: 'ok', workers: 'ok' }];
        }
    });
}); };
var terminusOptions = {
    healthChecks: {
        '/health': onHealthCheck,
        verbatim: true,
    },
    signal: 'SIGTERM',
    onSignal: onSignal,
    onShutdown: function () { return console.log('Shutdown finished.'); },
    timeout: 10000, // Increased timeout for workers to finish current jobs
    use: use,
    UnifiedTopology: false,
};
(0, terminus_1.createTerminus)(server, terminusOptions);
// --- Start Server ---
function start() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            server.listen(PORT, function () {
                console.log("\uD83D\uDE80 API Server ready at http://localhost:".concat(PORT));
                console.log("\uD83D\uDCE1 Socket.IO listening");
                console.log("\uD83D\uDEE0\uFE0F Background Workers running");
            });
            return [2 /*return*/];
        });
    });
}
// Start the server if the module is run directly
if (require.main === module) {
    start();
}
var templateObject_1;
