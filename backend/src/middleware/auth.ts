// backend/src/middleware/auth.ts

import { Request, Response, NextFunction } from 'express';
import { AuthError, AppError, IdentityError } from '../utils/errors';
import { verifyJwt, getTokenFromHeader } from '../utils/jwt';
import { prisma } from '../utils/prisma';

// --- Type Augmentation for Express Request ---

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        isIdentityVerified: boolean;
        isPremium: boolean;
      };
    }
  }
}

/**
 * @description FASE-Aware Express middleware to authenticate a user via JWT,
 * perform basic session check against refresh token, load user data, and attach it to `req.user`.
 * @throws {AuthError} If token is missing, invalid, or user is not found.
 */
const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const token = getTokenFromHeader(req);

  if (!token) {
    // Advanced: Check for cookie-based token fallback (not implemented here)
    throw new AuthError('Authentication token not provided.', 'TOKEN_MISSING');
  }

  try {
    // 1. Verify JWT (signature, algorithm, expiration)
    const payload = verifyJwt(token);
    const userId = payload.userId;
    const fingerprintId = payload.fingerprintId;

    // 2. FASE Check: Verify the JWT's `fingerprintId` still corresponds to an active session
    const activeSession = await prisma.refreshToken.findUnique({
        where: { id: fingerprintId, userId: userId },
        select: { id: true }
    });

    if (!activeSession) {
        // This means the refresh token has been revoked, rotated, or expired.
        throw new AuthError('Session invalid. Please re-login or refresh token.', 'SESSION_REVOKED');
    }

    // 3. Fetch user data (including profile/verification status)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, emailVerified: true, isIdentityVerified: true, profile: { select: { isPremium: true } } },
    });

    if (!user) {
      throw new AuthError('User not found or token payload is stale.', 'USER_NOT_FOUND');
    }

    // 4. Attach user to request object
    req.user = {
      id: user.id,
      email: user.email,
      isIdentityVerified: user.isIdentityVerified,
      isPremium: user.profile?.isPremium || false,
    };

    next();

  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    return next(new AuthError('An unexpected error occurred during authentication.', 'AUTH_UNEXPECTED'));
  }
};

/**
 * @description Advanced: Middleware to enforce that a user has completed identity verification.
 * @throws {IdentityError} If user is not identity verified.
 */
export const requireVerified = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        // Should be caught by authMiddleware if used correctly
        return next(new AuthError('Authentication context missing.', 'CONTEXT_MISSING'));
    }

    if (!req.user.isIdentityVerified) {
        // Advanced: Add details on how to verify
        throw new IdentityError('Action requires Identity Verification for safety and authenticity.', 'VERIFICATION_NEEDED');
    }

    next();
};

export const requireAuth = authMiddleware;
export default authMiddleware;