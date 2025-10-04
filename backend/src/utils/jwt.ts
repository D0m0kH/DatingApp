// backend/src/utils/jwt.ts

import * as jwt from 'jsonwebtoken';
import { SignOptions, VerifyOptions, JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { Request } from 'express';
import { AuthError } from './errors';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ISSUER = process.env.JWT_ISSUER || 'dating-app-api';
const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS512'; // Advanced: Enforce algorithm

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set.');
}

/**
 * @description The FASE-Aligned payload contained within the JWT.
 */
export type JwtPayload = {
  /** @example "user-123" */
  userId: string;
  /** @example "alice@example.com" */
  email: string;
  /** @example "fp-101" (FASE: Fingerprint ID linked to RefreshToken record) */
  fingerprintId: string;
  /** @description Issued At timestamp (Unix epoch). */
  iat?: number;
  /** @description Expiration timestamp (Unix epoch). */
  exp?: number;
  /** @description Proof of Possession (PoP) hash. (Conceptual) */
  cnf?: { jkt: string };
};

/**
 * @description Signs a FASE-aligned JSON Web Token (JWT).
 * @param payload The data to sign. Must contain { userId, email, fingerprintId }.
 * @param expiresIn The duration before the token expires (e.g., '15m'). Defaults to '15m'.
 * @returns The signed JWT string.
 */
export function signJwt(payload: { userId: string, email: string, fingerprintId: string }, expiresIn: string = '15m'): string {
  const signOptions: SignOptions = {
    issuer: JWT_ISSUER,
    expiresIn,
    algorithm: JWT_ALGORITHM as jwt.Algorithm, // Enforce configured algorithm
    // Advanced: PoP Placeholder - Add a key thumbprint for sender constraint (PoP)
    // audience: payload.fingerprintId // Can use fingerprint as audience constraint
  };
  return jwt.sign(payload, JWT_SECRET!, signOptions);
}

/**
 * @description Verifies a JWT and returns the typed payload.
 * @param token The JWT string to verify.
 * @returns The decoded and verified JwtPayload.
 * @throws {AuthError} If the token is invalid or expired, with clear codes.
 */
export function verifyJwt(token: string): JwtPayload {
  try {
    const verifyOptions: VerifyOptions = {
      issuer: JWT_ISSUER,
      algorithms: [JWT_ALGORITHM as jwt.Algorithm], // Only allow configured algorithm
    };
    const payload = jwt.verify(token, JWT_SECRET!, verifyOptions) as JwtPayload;

    // Advanced: Critical Claim Validation
    if (typeof payload.userId !== 'string' || typeof payload.fingerprintId !== 'string') {
        throw new AuthError('Invalid token payload structure (missing FASE claims).', 'TOKEN_INVALID_PAYLOAD');
    }

    // Advanced: PoP Verification Placeholder - If cnf claim is present, verify client proof
    // if (payload.cnf && !verifyProofOfPossession(payload.cnf, req)) { ... }

    return payload;
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      throw new AuthError('Access token has expired. Initiate refresh.', 'TOKEN_EXPIRED');
    } else if (error instanceof JsonWebTokenError) {
      throw new AuthError(`Invalid access token: ${error.message}`, 'TOKEN_INVALID');
    }
    throw new AuthError('Token verification failed.', 'TOKEN_VERIFICATION_FAILED');
  }
}

/**
 * @description Extracts the Bearer token from the Authorization header of an Express request.
 */
export function getTokenFromHeader(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}