// backend/src/middleware/admin.ts

import { Request, Response, NextFunction } from 'express';
import { AuthError } from '../utils/errors';

/**
 * @description Middleware to check if the authenticated user has admin privileges
 * @throws {AuthError} If user is not authenticated or not an admin
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new AuthError('Authentication required', 'UNAUTHORIZED');
  }

  // Check if user has admin role (you may need to add this to the user type)
  // For now, we'll check if there's an isAdmin property or similar
  // This needs to be adjusted based on your actual user schema
  const user = req.user as any;
  
  if (!user.isAdmin) {
    throw new AuthError('Admin privileges required', 'FORBIDDEN');
  }

  next();
};
