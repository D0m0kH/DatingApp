// backend/src/utils/errors.ts

/**
 * @description Base class for all application-specific errors.
 */
export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode: number = 500, code: string = 'SERVER_ERROR', details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * @description Error for authentication and authorization failures (HTTP 401).
 */
export class AuthError extends AppError {
  constructor(message: string = 'Authentication failed.', code: string = 'UNAUTHORIZED', details?: any) {
    super(message, 401, code, details);
    this.name = 'AuthError';
  }
}

/**
 * @description Error for resources not found (HTTP 404).
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found.', code: string = 'NOT_FOUND', details?: any) {
    super(message, 404, code, details);
    this.name = 'NotFoundError';
  }
}

/**
 * @description Error for invalid input or request payload (HTTP 400).
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Invalid request data.', code: string = 'BAD_REQUEST', details?: any) {
    super(message, 400, code, details);
    this.name = 'ValidationError';
  }
}

/**
 * @description Error for exceeding a rate limit (HTTP 429).
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests. Please try again later.', code: string = 'RATE_LIMIT_EXCEEDED', details?: any) {
    super(message, 429, code, details);
    this.name = 'RateLimitError';
  }
}

/**
 * @description Advanced: Error for required identity/ZKP verification missing (HTTP 403).
 */
export class IdentityError extends AppError {
  constructor(message: string = 'Identity verification required.', code: string = 'IDENTITY_REQUIRED', details?: any) {
    super(message, 403, code, details);
    this.name = 'IdentityError';
  }
}