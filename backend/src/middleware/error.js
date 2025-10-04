"use strict";
// backend/src/middleware/error.ts
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = void 0;
var node_1 = require("@sentry/node");
var errors_1 = require("../utils/errors");
var isProduction = process.env.NODE_ENV === 'production';
var sentryEnabled = !!process.env.SENTRY_DSN;
/**
 * @description Global error handler middleware.
 */
var errorMiddleware = function (err, req, res, next) {
    var statusCode = 500;
    var code = 'SERVER_ERROR';
    var message = 'An unexpected server error occurred.';
    var details = undefined;
    var shouldLogStack = true;
    if (err instanceof errors_1.AppError) {
        statusCode = err.statusCode;
        code = err.code;
        message = err.message;
        // Advanced: Only expose error details (validation fields, etc.) for client errors (4xx)
        if (statusCode < 500 || !isProduction) {
            details = err.details;
        }
        // Do not log stack for client-expected errors (4xx)
        if (statusCode >= 400 && statusCode < 500) {
            shouldLogStack = false;
        }
        // Capture all 5xx AppErrors in Sentry
        if (sentryEnabled && statusCode >= 500) {
            node_1.default.captureException(err);
        }
    }
    else {
        // Handle unhandled exceptions (e.g., programming errors)
        if (sentryEnabled) {
            node_1.default.captureException(err);
        }
    }
    if (shouldLogStack && !isProduction) {
        console.error("[".concat(code, " - ").concat(statusCode, "] ").concat(message), err.stack);
    }
    else if (shouldLogStack && isProduction) {
        console.error("[".concat(code, " - ").concat(statusCode, "] ").concat(message, " (Stack hidden in prod)"));
    }
    // 2. Content Negotiation (Simplified: JSON only for API)
    // 3. Return JSON response
    var errorResponse = __assign(__assign({ error: message, code: code }, (details && { details: details })), (!isProduction && shouldLogStack && { stack: err.stack }));
    res.status(statusCode).json(errorResponse);
};
exports.errorMiddleware = errorMiddleware;
