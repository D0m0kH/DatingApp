"use strict";
// backend/src/utils/errors.ts
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentityError = exports.RateLimitError = exports.ValidationError = exports.NotFoundError = exports.AuthError = exports.AppError = void 0;
/**
 * @description Base class for all application-specific errors.
 */
var AppError = /** @class */ (function (_super) {
    __extends(AppError, _super);
    function AppError(message, statusCode, code, details) {
        if (statusCode === void 0) { statusCode = 500; }
        if (code === void 0) { code = 'SERVER_ERROR'; }
        var _this = _super.call(this, message) || this;
        _this.statusCode = statusCode;
        _this.code = code;
        _this.details = details;
        _this.name = _this.constructor.name;
        Error.captureStackTrace(_this, _this.constructor);
        return _this;
    }
    return AppError;
}(Error));
exports.AppError = AppError;
/**
 * @description Error for authentication and authorization failures (HTTP 401).
 */
var AuthError = /** @class */ (function (_super) {
    __extends(AuthError, _super);
    function AuthError(message, code, details) {
        if (message === void 0) { message = 'Authentication failed.'; }
        if (code === void 0) { code = 'UNAUTHORIZED'; }
        var _this = _super.call(this, message, 401, code, details) || this;
        _this.name = 'AuthError';
        return _this;
    }
    return AuthError;
}(AppError));
exports.AuthError = AuthError;
/**
 * @description Error for resources not found (HTTP 404).
 */
var NotFoundError = /** @class */ (function (_super) {
    __extends(NotFoundError, _super);
    function NotFoundError(message, code, details) {
        if (message === void 0) { message = 'Resource not found.'; }
        if (code === void 0) { code = 'NOT_FOUND'; }
        var _this = _super.call(this, message, 404, code, details) || this;
        _this.name = 'NotFoundError';
        return _this;
    }
    return NotFoundError;
}(AppError));
exports.NotFoundError = NotFoundError;
/**
 * @description Error for invalid input or request payload (HTTP 400).
 */
var ValidationError = /** @class */ (function (_super) {
    __extends(ValidationError, _super);
    function ValidationError(message, code, details) {
        if (message === void 0) { message = 'Invalid request data.'; }
        if (code === void 0) { code = 'BAD_REQUEST'; }
        var _this = _super.call(this, message, 400, code, details) || this;
        _this.name = 'ValidationError';
        return _this;
    }
    return ValidationError;
}(AppError));
exports.ValidationError = ValidationError;
/**
 * @description Error for exceeding a rate limit (HTTP 429).
 */
var RateLimitError = /** @class */ (function (_super) {
    __extends(RateLimitError, _super);
    function RateLimitError(message, code, details) {
        if (message === void 0) { message = 'Too many requests. Please try again later.'; }
        if (code === void 0) { code = 'RATE_LIMIT_EXCEEDED'; }
        var _this = _super.call(this, message, 429, code, details) || this;
        _this.name = 'RateLimitError';
        return _this;
    }
    return RateLimitError;
}(AppError));
exports.RateLimitError = RateLimitError;
/**
 * @description Advanced: Error for required identity/ZKP verification missing (HTTP 403).
 */
var IdentityError = /** @class */ (function (_super) {
    __extends(IdentityError, _super);
    function IdentityError(message, code, details) {
        if (message === void 0) { message = 'Identity verification required.'; }
        if (code === void 0) { code = 'IDENTITY_REQUIRED'; }
        var _this = _super.call(this, message, 403, code, details) || this;
        _this.name = 'IdentityError';
        return _this;
    }
    return IdentityError;
}(AppError));
exports.IdentityError = IdentityError;
