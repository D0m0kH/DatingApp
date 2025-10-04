// backend/src/app.ts

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { AppError } from './utils/errors';
import { errorMiddleware } from './middleware/error';
import authMiddleware, { requireVerified } from './middleware/auth'; // Import requireVerified
import { requireAdmin } from './middleware/admin'; // New admin middleware

// --- Type Augmentation for Express Request ---

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        isIdentityVerified: boolean; // Advanced: Check status here
        isPremium: boolean;
      };
      // Used by validate middleware
      validatedBody: any;
    }
  }
}

// --- Configuration ---

const isDev = process.env.NODE_ENV !== 'production';
const bodyLimit = '10mb';

// Stricter CORS: Allow specific origins and limit to API version header
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : isDev ? ['http://localhost:4000', 'http://localhost:8081'] : [];

// Rate limiting for auth endpoints (higher security risk)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Strict limit: 20 requests per IP per 15 min for login/register
  message: new AppError('Too many login/registration attempts. Try again later.', 429, 'RATE_LIMIT_AUTH'),
  standardHeaders: true,
  legacyHeaders: false,
});

// General rate limiter for authenticated API endpoints
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute
  message: new AppError('Too many requests. Slow down.', 429, 'RATE_LIMIT_API'),
  standardHeaders: true,
  legacyHeaders: false,
});


// --- Express App Initialization ---
const app = express();

// --- Security Middleware ---
app.use(helmet({
    contentSecurityPolicy: isDev ? false : undefined, // Disable CSP in dev for swagger/docs
}));
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Fingerprint', 'X-Api-Version'], // Enforce Fingerprint header
}));
app.use(compression());

// --- Logging Middleware ---
if (isDev) {
  app.use(morgan('dev'));
}

// --- Body Parsing & Raw Body for Webhooks ---
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

// --- Health Check & Metadata ---
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ ok: true, version: process.env.npm_package_version || '1.0.0' });
});

// --- Route Mountpoints ---

// 1. Auth routes (Strictest rate limit)
app.use('/api/auth', authLimiter, require('./routes/auth').default);

// 2. Authenticated API routes (General rate limit + Auth/Verification check)
// Auth middleware runs on all paths below this point
app.use('/api/*', authMiddleware, apiLimiter);

// Require identity verification for swiping/messaging for safety
app.use('/api/match', requireVerified, require('./routes/match').default);
app.use('/api/message', requireVerified, require('./routes/message').default);

// Profile and Payments are typically fine without immediate verification
app.use('/api/profile', require('./routes/profile').default);
app.use('/api/payments', require('./routes/payments').default);
app.use('/api/report', require('./routes/report').default);

// Admin routes (Must have admin flag set)
app.use('/api/admin', requireAdmin, require('./routes/admin').default);

// --- Centralized Error Handling Middleware ---
app.use(errorMiddleware);

export default app;