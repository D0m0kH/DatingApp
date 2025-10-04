"use strict";
// backend/src/utils/jwt.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.signJwt = signJwt;
exports.verifyJwt = verifyJwt;
exports.getTokenFromHeader = getTokenFromHeader;
var jsonwebtoken_1 = require("jsonwebtoken");
var errors_1 = require("./errors");
var JWT_SECRET = process.env.JWT_SECRET;
var JWT_ISSUER = process.env.JWT_ISSUER || 'dating-app-api';
var JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS512'; // Advanced: Enforce algorithm
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set.');
}
/**
 * @description Signs a FASE-aligned JSON Web Token (JWT).
 * @param payload The data to sign. Must contain { userId, email, fingerprintId }.
 * @param expiresIn The duration before the token expires (e.g., '15m'). Defaults to '15m'.
 * @returns The signed JWT string.
 */
function signJwt(payload, expiresIn) {
    if (expiresIn === void 0) { expiresIn = '15m'; }
    var signOptions = {
        issuer: JWT_ISSUER,
        expiresIn: expiresIn,
        algorithm: JWT_ALGORITHM, // Enforce configured algorithm
        // Advanced: PoP Placeholder - Add a key thumbprint for sender constraint (PoP)
        // audience: payload.fingerprintId // Can use fingerprint as audience constraint
    };
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, signOptions);
}
/**
 * @description Verifies a JWT and returns the typed payload.
 * @param token The JWT string to verify.
 * @returns The decoded and verified JwtPayload.
 * @throws {AuthError} If the token is invalid or expired, with clear codes.
 */
function verifyJwt(token) {
    try {
        var verifyOptions = {
            issuer: JWT_ISSUER,
            algorithms: [JWT_ALGORITHM], // Only allow configured algorithm
        };
        var payload = jsonwebtoken_1.default.verify(token, JWT_SECRET, verifyOptions);
        // Advanced: Critical Claim Validation
        if (typeof payload.userId !== 'string' || typeof payload.fingerprintId !== 'string') {
            throw new errors_1.AuthError('Invalid token payload structure (missing FASE claims).', 'TOKEN_INVALID_PAYLOAD');
        }
        // Advanced: PoP Verification Placeholder - If cnf claim is present, verify client proof
        // if (payload.cnf && !verifyProofOfPossession(payload.cnf, req)) { ... }
        return payload;
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.TokenExpiredError) {
            throw new errors_1.AuthError('Access token has expired. Initiate refresh.', 'TOKEN_EXPIRED');
        }
        else if (error instanceof jsonwebtoken_1.JsonWebTokenError) {
            throw new errors_1.AuthError("Invalid access token: ".concat(error.message), 'TOKEN_INVALID');
        }
        throw new errors_1.AuthError('Token verification failed.', 'TOKEN_VERIFICATION_FAILED');
    }
}
/**
 * @description Extracts the Bearer token from the Authorization header of an Express request.
 */
function getTokenFromHeader(req) {
    var authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    return null;
}
