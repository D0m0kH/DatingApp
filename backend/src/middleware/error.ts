// backend/src/middleware/error.ts

import { Request, Response, NextFunction } from 'express';
import Sentry from '@sentry/node';

import { AppError } from '../utils/errors';

const isProduction = process.env.NODE_ENV === 'production';
const sentryEnabled = !!process.env.SENTRY_DSN;

/**
 * @description Global error handler middleware.
 */
export const errorMiddleware = (err: Error, req: Request, res: Response, next: NextFunction) => {
  let statusCode = 500;
  let code = 'SERVER_ERROR';
  let message = 'An unexpected server error occurred.';
  let details: any = undefined;
  let shouldLogStack = true;

  if (err instanceof AppError) {
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
        Sentry.captureException(err);
    }
  } else {
    // Handle unhandled exceptions (e.g., programming errors)
    if (sentryEnabled) {
      Sentry.captureException(err);
    }
  }

  if (shouldLogStack && !isProduction) {
    console.error(`[${code} - ${statusCode}] ${message}`, err.stack);
  } else if (shouldLogStack && isProduction) {
    console.error(`[${code} - ${statusCode}] ${message} (Stack hidden in prod)`);
  }


  // 2. Content Negotiation (Simplified: JSON only for API)

  // 3. Return JSON response
  const errorResponse = {
    error: message,
    code: code,
    ...(details && { details }),
    ...(!isProduction && shouldLogStack && { stack: err.stack }),
  };

  res.status(statusCode).json(errorResponse);
};