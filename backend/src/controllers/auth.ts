// backend/src/controllers/auth.ts

import { Request, Response, NextFunction } from 'express';
import * as argon2 from 'argon2';
import crypto from 'crypto';
import { ZodError } from 'zod';

import { prisma } from '../utils/prisma';
import { signJwt, getTokenFromHeader, verifyJwt } from '../utils/jwt';
import { AuthError, ValidationError, AppError, NotFoundError, IdentityError } from '../utils/errors';
import { AuthResponse, RegisterDto, LoginDto } from '../types/shared';

// --- Stubbed Function for Email Service ---
const sendVerificationEmail = async (email: string, token: string) => {
  console.log(`[EMAIL STUB] Sending verification email to ${email}. Token: ${token}`);
};

// --- Refresh Token Utility Functions ---
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'insecure-default-refresh-secret';
const hashRefreshToken = (token: string) => argon2.hash(token);
const verifyRefreshTokenHash = (hash: string, token: string) => argon2.verify(hash, token);

/**
 * @description User registration controller (FASE-Aligned).
 */
export const register = async (req: Request, res: Response<AuthResponse>, next: NextFunction) => {
  try {
    const { email, password, firstName, dateOfBirth, gender, orientation, fingerprint } = req.validatedBody as RegisterDto;

    // 1. Check for duplicate email
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ValidationError('Email address is already in use.', 'EMAIL_DUPLICATE');
    }

    // 2. Hash password
    const hashedPassword = await argon2.hash(password);

    // 3. Create User & Profile (with initial location)
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        orientation,
        // Advanced: Initial location is 0, client must update post-login
        latitude: 0, longitude: 0, geoHash: '',
        profile: {
          create: {
            traitVector: [],
            nlpVector: [],
            preferences: { minAge: 25, maxAge: 35, maxDistanceKm: 50 },
          },
        },
      },
      include: { profile: true },
    });

    const userId = newUser.id;

    // 4. Create and store Refresh Token (FASE: linked to fingerprint)
    const refreshToken = crypto.randomBytes(48).toString('base64');
    const refreshTokenHash = await hashRefreshToken(refreshToken);
    const fingerprintId = crypto.randomBytes(16).toString('hex'); // Generate unique ID for this session

    await prisma.refreshToken.create({
      data: {
        id: fingerprintId, // Use the unique ID as the primary key
        tokenHash: refreshTokenHash,
        userId,
        userAgent: fingerprint.userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // 5. Generate Access Token (short-lived, FASE-aligned)
    const accessToken = signJwt({ userId, email: newUser.email, fingerprintId }, '15m');

    // 6. Send Verification Email (Stubbed)
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    await sendVerificationEmail(email, emailVerificationToken);

    // 7. Return AuthResponse
    const authResponse: AuthResponse = {
      accessToken,
      refreshToken,
      fingerprintId,
      user: {
        id: userId,
        firstName: newUser.firstName,
        age: Math.floor((Date.now() - newUser.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24 * 365.25)),
        gender: newUser.gender,
        geoHash: newUser.geoHash || 'u0',
        isIdentityVerified: newUser.isIdentityVerified,
        isPremium: newUser.profile?.isPremium || false,
        photos: [],
        topInterests: [],
        scoreVector: [0, 0],
        reason: 'New user.',
      },
    };

    res.status(201).json(authResponse);
  } catch (error) {
    next(error);
  }
};

/**
 * @description User login controller (FASE-Aligned).
 */
export const login = async (req: Request, res: Response<AuthResponse>, next: NextFunction) => {
  try {
    const { email, password, fingerprint } = req.validatedBody as LoginDto;

    // 1. Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true, photos: { where: { status: 'APPROVED' }, orderBy: { createdAt: 'asc' } } },
    });

    if (!user || !user.password) {
      throw new AuthError('Invalid email or password.', 'INVALID_CREDENTIALS');
    }

    // 2. Verify password
    const passwordMatch = await argon2.verify(user.password, password);
    if (!passwordMatch) {
      throw new AuthError('Invalid email or password.', 'INVALID_CREDENTIALS');
    }

    // 3. Rotate Refresh Token: Invalidate old tokens and issue a new one (FASE)
    // In a real app, you would check if an active session exists for this fingerprint.
    // Here, we simply issue a new, unique session ID.

    const newRefreshToken = crypto.randomBytes(48).toString('base64');
    const newRefreshTokenHash = await hashRefreshToken(newRefreshToken);
    const newFingerprintId = crypto.randomBytes(16).toString('hex');

    // Delete any old tokens tied to the same device/client ID for security (Optional: depends on UX choice)
    // await prisma.refreshToken.deleteMany({ where: { userId: user.id, userAgent: fingerprint.userAgent } });

    await prisma.refreshToken.create({
      data: {
        id: newFingerprintId,
        tokenHash: newRefreshTokenHash,
        userId: user.id,
        userAgent: fingerprint.userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // 4. Generate Access Token (FASE-aligned)
    const accessToken = signJwt({ userId: user.id, email: user.email, fingerprintId: newFingerprintId }, '15m');

    // 5. Return AuthResponse
    const authResponse: AuthResponse = {
      accessToken,
      refreshToken: newRefreshToken,
      fingerprintId: newFingerprintId,
      user: {
        id: user.id,
        firstName: user.firstName,
        age: Math.floor((Date.now() - user.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24 * 365.25)),
        gender: user.gender,
        geoHash: user.geoHash || 'u0',
        isIdentityVerified: user.isIdentityVerified,
        isPremium: user.profile?.isPremium || false,
        photos: user.photos.map(p => ({
            id: p.id,
            url: `https://${process.env.S3_BUCKET}/photos/${p.s3Key}`,
            isPrimary: p.isPrimary,
            status: 'APPROVED',
            aiTags: [],
        })),
        topInterests: user.profile?.interests.slice(0, 3) || [],
        scoreVector: [0, 0],
        reason: 'Successful login.',
      },
    };

    res.status(200).json(authResponse);
  } catch (error) {
    next(error);
  }
};

/**
 * @description Token refresh controller (FASE-Aligned Rotation).
 */
export const refresh = async (req: Request, res: Response<AuthResponse>, next: NextFunction) => {
  try {
    const { refreshToken, fingerprintId } = req.validatedBody as { refreshToken: string, fingerprintId: string };

    // 1. Find and verify the specific refresh token session ID
    const validTokenRecord = await prisma.refreshToken.findUnique({
        where: { id: fingerprintId, expiresAt: { gt: new Date() } },
        select: { id: true, tokenHash: true, userId: true, userAgent: true, user: { select: { email: true, firstName: true } } },
    });

    if (!validTokenRecord) {
        throw new AuthError('Invalid or expired fingerprint session ID.', 'REFRESH_SESSION_INVALID');
    }

    // 2. Verify the opaque token hash
    const tokenMatch = await verifyRefreshTokenHash(validTokenRecord.tokenHash, refreshToken);
    if (!tokenMatch) {
        // Advanced: Implement "Stolen Token" detection and cascade revocation if a failed attempt is detected
        throw new AuthError('Invalid refresh token.', 'REFRESH_TOKEN_INVALID');
    }

    // 3. Revoke the old token (Rotation: one-time use token)
    await prisma.refreshToken.delete({ where: { id: validTokenRecord.id } });

    // 4. Issue new Access Token and new Refresh Token
    const userId = validTokenRecord.userId;
    const newRefreshToken = crypto.randomBytes(48).toString('base64');
    const newRefreshTokenHash = await hashRefreshToken(newRefreshToken);
    const newFingerprintId = crypto.randomBytes(16).toString('hex'); // Generate a brand new FASE ID

    await prisma.refreshToken.create({
      data: {
        id: newFingerprintId,
        tokenHash: newRefreshTokenHash,
        userId,
        userAgent: validTokenRecord.userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Generate Access Token with new FASE ID
    const newAccessToken = signJwt({ userId, email: validTokenRecord.user.email, fingerprintId: newFingerprintId }, '15m');

    // 5. Fetch user data (simplified for response)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, photos: { where: { status: 'APPROVED' }, orderBy: { createdAt: 'asc' } } },
    });

    if (!user) { throw new AuthError('User not found for refresh token.', 'USER_NOT_FOUND'); }

    // 6. Return AuthResponse
    const authResponse: AuthResponse = {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      fingerprintId: newFingerprintId,
      user: {
          id: user.id,
          firstName: user.firstName,
          age: Math.floor((Date.now() - user.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24 * 365.25)),
          gender: user.gender,
          geoHash: user.geoHash || 'u0',
          isIdentityVerified: user.isIdentityVerified,
          isPremium: user.profile?.isPremium || false,
          photos: user.photos.map(p => ({
              id: p.id, url: `https://${process.env.S3_BUCKET}/photos/${p.s3Key}`, isPrimary: p.isPrimary, status: 'APPROVED', aiTags: []
          })),
          topInterests: user.profile?.interests.slice(0, 3) || [],
          scoreVector: [0, 0],
          reason: 'Token refreshed.',
      },
    };

    res.status(200).json(authResponse);
  } catch (error) {
    next(error);
  }
};

/**
 * @description Token logout/revocation controller.
 */
export const logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        // The fingerprintId of the active session is stored in the access token payload (req.user is not enough)
        const token = getTokenFromHeader(req);
        if (!token) throw new AuthError('Token required to identify session.', 'TOKEN_MISSING');

        const { fingerprintId } = verifyJwt(token);

        // Revoke the specific FASE session
        const result = await prisma.refreshToken.delete({ where: { id: fingerprintId, userId } });
        console.log(`FASE session revoked: ${result.id}`);

        res.status(204).send();
    } catch (error) {
        // If deletion fails (e.g., token already expired), we still report success to the client
        console.error('Logout error but client logged out:', error);
        res.status(204).send();
    }
};

/**
 * @description Email verification controller (Simple update).
 */
export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Logic remains the same, focuses on emailVerified boolean
    const { token, userId } = req.query;
    if (typeof token !== 'string' || typeof userId !== 'string') { throw new ValidationError('Invalid verification link.', 'INVALID_LINK'); }
    if (!token || token.length < 30) { throw new AuthError('Verification token invalid or expired.', 'TOKEN_EXPIRED'); }

    const updatedUser = await prisma.user.update({
      where: { id: userId, emailVerified: false },
      data: { emailVerified: true },
      select: { email: true },
    });

    if (!updatedUser) { throw new NotFoundError('User not found or email already verified.', 'USER_OR_EMAIL_VERIFIED'); }

    res.status(200).json({ message: `Email ${updatedUser.email} successfully verified!` });
  } catch (error) {
    next(error);
  }
};

/**
 * @description Advanced: Identity Verification with Zero-Knowledge Proof (ZKP) placeholder.
 */
export const verifyIdentity = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        const { proof, verifierId } = req.validatedBody as Dtos.ZKPVerifyDto;

        // 1. Call ZKP/Biometric Service (Conceptual)
        console.log(`[ZKP STUB] Validating proof for user ${userId} via verifier ${verifierId}...`);
        const isValid = await new Promise(resolve => setTimeout(() => resolve(proof.length > 150), 1000)); // Simulate ZKP validation delay

        if (!isValid) {
            throw new IdentityError('ZKP validation failed. Proof is invalid or expired.', 'ZKP_INVALID');
        }

        // 2. Update user status
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { isIdentityVerified: true },
            select: { id: true, firstName: true }
        });

        res.status(200).json({
            message: `Identity verified successfully! You now have access to verified-only features.`,
            user: { id: updatedUser.id, firstName: updatedUser.firstName, isIdentityVerified: true }
        });

    } catch (error) {
        next(error);
    }
};