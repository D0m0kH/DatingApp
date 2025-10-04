"use strict";
// backend/src/controllers/auth.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyIdentity = exports.verifyEmail = exports.logout = exports.refresh = exports.login = exports.register = void 0;
var argon2 = require("argon2");
var crypto_1 = require("crypto");
var prisma_1 = require("../utils/prisma");
var jwt_1 = require("../utils/jwt");
var errors_1 = require("../utils/errors");
// --- Stubbed Function for Email Service ---
var sendVerificationEmail = function (email, token) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        console.log("[EMAIL STUB] Sending verification email to ".concat(email, ". Token: ").concat(token));
        return [2 /*return*/];
    });
}); };
// --- Refresh Token Utility Functions ---
var REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'insecure-default-refresh-secret';
var hashRefreshToken = function (token) { return argon2.hash(token); };
var verifyRefreshTokenHash = function (hash, token) { return argon2.verify(hash, token); };
/**
 * @description User registration controller (FASE-Aligned).
 */
var register = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, email, password, firstName, dateOfBirth, gender, orientation_1, fingerprint, existingUser, hashedPassword, newUser, userId, refreshToken, refreshTokenHash, fingerprintId, accessToken, emailVerificationToken, authResponse, error_1;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 7, , 8]);
                _a = req.validatedBody, email = _a.email, password = _a.password, firstName = _a.firstName, dateOfBirth = _a.dateOfBirth, gender = _a.gender, orientation_1 = _a.orientation, fingerprint = _a.fingerprint;
                return [4 /*yield*/, prisma_1.prisma.user.findUnique({ where: { email: email } })];
            case 1:
                existingUser = _c.sent();
                if (existingUser) {
                    throw new errors_1.ValidationError('Email address is already in use.', 'EMAIL_DUPLICATE');
                }
                return [4 /*yield*/, argon2.hash(password)];
            case 2:
                hashedPassword = _c.sent();
                return [4 /*yield*/, prisma_1.prisma.user.create({
                        data: {
                            email: email,
                            password: hashedPassword,
                            firstName: firstName,
                            dateOfBirth: new Date(dateOfBirth),
                            gender: gender,
                            orientation: orientation_1,
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
                    })];
            case 3:
                newUser = _c.sent();
                userId = newUser.id;
                refreshToken = crypto_1.default.randomBytes(48).toString('base64');
                return [4 /*yield*/, hashRefreshToken(refreshToken)];
            case 4:
                refreshTokenHash = _c.sent();
                fingerprintId = crypto_1.default.randomBytes(16).toString('hex');
                return [4 /*yield*/, prisma_1.prisma.refreshToken.create({
                        data: {
                            id: fingerprintId, // Use the unique ID as the primary key
                            tokenHash: refreshTokenHash,
                            userId: userId,
                            userAgent: fingerprint.userAgent,
                            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                        },
                    })];
            case 5:
                _c.sent();
                accessToken = (0, jwt_1.signJwt)({ userId: userId, email: newUser.email, fingerprintId: fingerprintId }, '15m');
                emailVerificationToken = crypto_1.default.randomBytes(32).toString('hex');
                return [4 /*yield*/, sendVerificationEmail(email, emailVerificationToken)];
            case 6:
                _c.sent();
                authResponse = {
                    accessToken: accessToken,
                    refreshToken: refreshToken,
                    fingerprintId: fingerprintId,
                    user: {
                        id: userId,
                        firstName: newUser.firstName,
                        age: Math.floor((Date.now() - newUser.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24 * 365.25)),
                        gender: newUser.gender,
                        geoHash: newUser.geoHash || 'u0',
                        isIdentityVerified: newUser.isIdentityVerified,
                        isPremium: ((_b = newUser.profile) === null || _b === void 0 ? void 0 : _b.isPremium) || false,
                        photos: [],
                        topInterests: [],
                        scoreVector: [0, 0],
                        reason: 'New user.',
                    },
                };
                res.status(201).json(authResponse);
                return [3 /*break*/, 8];
            case 7:
                error_1 = _c.sent();
                next(error_1);
                return [3 /*break*/, 8];
            case 8: return [2 /*return*/];
        }
    });
}); };
exports.register = register;
/**
 * @description User login controller (FASE-Aligned).
 */
var login = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, email, password, fingerprint, user, passwordMatch, newRefreshToken, newRefreshTokenHash, newFingerprintId, accessToken, authResponse, error_2;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 5, , 6]);
                _a = req.validatedBody, email = _a.email, password = _a.password, fingerprint = _a.fingerprint;
                return [4 /*yield*/, prisma_1.prisma.user.findUnique({
                        where: { email: email },
                        include: { profile: true, photos: { where: { status: 'APPROVED' }, orderBy: { createdAt: 'asc' } } },
                    })];
            case 1:
                user = _d.sent();
                if (!user || !user.password) {
                    throw new errors_1.AuthError('Invalid email or password.', 'INVALID_CREDENTIALS');
                }
                return [4 /*yield*/, argon2.verify(user.password, password)];
            case 2:
                passwordMatch = _d.sent();
                if (!passwordMatch) {
                    throw new errors_1.AuthError('Invalid email or password.', 'INVALID_CREDENTIALS');
                }
                newRefreshToken = crypto_1.default.randomBytes(48).toString('base64');
                return [4 /*yield*/, hashRefreshToken(newRefreshToken)];
            case 3:
                newRefreshTokenHash = _d.sent();
                newFingerprintId = crypto_1.default.randomBytes(16).toString('hex');
                // Delete any old tokens tied to the same device/client ID for security (Optional: depends on UX choice)
                // await prisma.refreshToken.deleteMany({ where: { userId: user.id, userAgent: fingerprint.userAgent } });
                return [4 /*yield*/, prisma_1.prisma.refreshToken.create({
                        data: {
                            id: newFingerprintId,
                            tokenHash: newRefreshTokenHash,
                            userId: user.id,
                            userAgent: fingerprint.userAgent,
                            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                        },
                    })];
            case 4:
                // Delete any old tokens tied to the same device/client ID for security (Optional: depends on UX choice)
                // await prisma.refreshToken.deleteMany({ where: { userId: user.id, userAgent: fingerprint.userAgent } });
                _d.sent();
                accessToken = (0, jwt_1.signJwt)({ userId: user.id, email: user.email, fingerprintId: newFingerprintId }, '15m');
                authResponse = {
                    accessToken: accessToken,
                    refreshToken: newRefreshToken,
                    fingerprintId: newFingerprintId,
                    user: {
                        id: user.id,
                        firstName: user.firstName,
                        age: Math.floor((Date.now() - user.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24 * 365.25)),
                        gender: user.gender,
                        geoHash: user.geoHash || 'u0',
                        isIdentityVerified: user.isIdentityVerified,
                        isPremium: ((_b = user.profile) === null || _b === void 0 ? void 0 : _b.isPremium) || false,
                        photos: user.photos.map(function (p) { return ({
                            id: p.id,
                            url: "https://".concat(process.env.S3_BUCKET, "/photos/").concat(p.s3Key),
                            isPrimary: p.isPrimary,
                            status: 'APPROVED',
                            aiTags: [],
                        }); }),
                        topInterests: ((_c = user.profile) === null || _c === void 0 ? void 0 : _c.interests.slice(0, 3)) || [],
                        scoreVector: [0, 0],
                        reason: 'Successful login.',
                    },
                };
                res.status(200).json(authResponse);
                return [3 /*break*/, 6];
            case 5:
                error_2 = _d.sent();
                next(error_2);
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); };
exports.login = login;
/**
 * @description Token refresh controller (FASE-Aligned Rotation).
 */
var refresh = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, refreshToken, fingerprintId, validTokenRecord, tokenMatch, userId, newRefreshToken, newRefreshTokenHash, newFingerprintId, newAccessToken, user, authResponse, error_3;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 7, , 8]);
                _a = req.validatedBody, refreshToken = _a.refreshToken, fingerprintId = _a.fingerprintId;
                return [4 /*yield*/, prisma_1.prisma.refreshToken.findUnique({
                        where: { id: fingerprintId, expiresAt: { gt: new Date() } },
                        select: { id: true, tokenHash: true, userId: true, userAgent: true, user: { select: { email: true, firstName: true } } },
                    })];
            case 1:
                validTokenRecord = _d.sent();
                if (!validTokenRecord) {
                    throw new errors_1.AuthError('Invalid or expired fingerprint session ID.', 'REFRESH_SESSION_INVALID');
                }
                return [4 /*yield*/, verifyRefreshTokenHash(validTokenRecord.tokenHash, refreshToken)];
            case 2:
                tokenMatch = _d.sent();
                if (!tokenMatch) {
                    // Advanced: Implement "Stolen Token" detection and cascade revocation if a failed attempt is detected
                    throw new errors_1.AuthError('Invalid refresh token.', 'REFRESH_TOKEN_INVALID');
                }
                // 3. Revoke the old token (Rotation: one-time use token)
                return [4 /*yield*/, prisma_1.prisma.refreshToken.delete({ where: { id: validTokenRecord.id } })];
            case 3:
                // 3. Revoke the old token (Rotation: one-time use token)
                _d.sent();
                userId = validTokenRecord.userId;
                newRefreshToken = crypto_1.default.randomBytes(48).toString('base64');
                return [4 /*yield*/, hashRefreshToken(newRefreshToken)];
            case 4:
                newRefreshTokenHash = _d.sent();
                newFingerprintId = crypto_1.default.randomBytes(16).toString('hex');
                return [4 /*yield*/, prisma_1.prisma.refreshToken.create({
                        data: {
                            id: newFingerprintId,
                            tokenHash: newRefreshTokenHash,
                            userId: userId,
                            userAgent: validTokenRecord.userAgent,
                            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                        },
                    })];
            case 5:
                _d.sent();
                newAccessToken = (0, jwt_1.signJwt)({ userId: userId, email: validTokenRecord.user.email, fingerprintId: newFingerprintId }, '15m');
                return [4 /*yield*/, prisma_1.prisma.user.findUnique({
                        where: { id: userId },
                        include: { profile: true, photos: { where: { status: 'APPROVED' }, orderBy: { createdAt: 'asc' } } },
                    })];
            case 6:
                user = _d.sent();
                if (!user) {
                    throw new errors_1.AuthError('User not found for refresh token.', 'USER_NOT_FOUND');
                }
                authResponse = {
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
                        isPremium: ((_b = user.profile) === null || _b === void 0 ? void 0 : _b.isPremium) || false,
                        photos: user.photos.map(function (p) { return ({
                            id: p.id, url: "https://".concat(process.env.S3_BUCKET, "/photos/").concat(p.s3Key), isPrimary: p.isPrimary, status: 'APPROVED', aiTags: []
                        }); }),
                        topInterests: ((_c = user.profile) === null || _c === void 0 ? void 0 : _c.interests.slice(0, 3)) || [],
                        scoreVector: [0, 0],
                        reason: 'Token refreshed.',
                    },
                };
                res.status(200).json(authResponse);
                return [3 /*break*/, 8];
            case 7:
                error_3 = _d.sent();
                next(error_3);
                return [3 /*break*/, 8];
            case 8: return [2 /*return*/];
        }
    });
}); };
exports.refresh = refresh;
/**
 * @description Token logout/revocation controller.
 */
var logout = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, token, fingerprintId, result, error_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                userId = req.user.id;
                token = getTokenFromHeader(req);
                if (!token)
                    throw new errors_1.AuthError('Token required to identify session.', 'TOKEN_MISSING');
                fingerprintId = verifyJwt(token).fingerprintId;
                return [4 /*yield*/, prisma_1.prisma.refreshToken.delete({ where: { id: fingerprintId, userId: userId } })];
            case 1:
                result = _a.sent();
                console.log("FASE session revoked: ".concat(result.id));
                res.status(204).send();
                return [3 /*break*/, 3];
            case 2:
                error_4 = _a.sent();
                // If deletion fails (e.g., token already expired), we still report success to the client
                console.error('Logout error but client logged out:', error_4);
                res.status(204).send();
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.logout = logout;
/**
 * @description Email verification controller (Simple update).
 */
var verifyEmail = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, token, userId, updatedUser, error_5;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                _a = req.query, token = _a.token, userId = _a.userId;
                if (typeof token !== 'string' || typeof userId !== 'string') {
                    throw new errors_1.ValidationError('Invalid verification link.', 'INVALID_LINK');
                }
                if (!token || token.length < 30) {
                    throw new errors_1.AuthError('Verification token invalid or expired.', 'TOKEN_EXPIRED');
                }
                return [4 /*yield*/, prisma_1.prisma.user.update({
                        where: { id: userId, emailVerified: false },
                        data: { emailVerified: true },
                        select: { email: true },
                    })];
            case 1:
                updatedUser = _b.sent();
                if (!updatedUser) {
                    throw new errors_1.NotFoundError('User not found or email already verified.', 'USER_OR_EMAIL_VERIFIED');
                }
                res.status(200).json({ message: "Email ".concat(updatedUser.email, " successfully verified!") });
                return [3 /*break*/, 3];
            case 2:
                error_5 = _b.sent();
                next(error_5);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.verifyEmail = verifyEmail;
/**
 * @description Advanced: Identity Verification with Zero-Knowledge Proof (ZKP) placeholder.
 */
var verifyIdentity = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, _a, proof_1, verifierId, isValid, updatedUser, error_6;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                userId = req.user.id;
                _a = req.validatedBody, proof_1 = _a.proof, verifierId = _a.verifierId;
                // 1. Call ZKP/Biometric Service (Conceptual)
                console.log("[ZKP STUB] Validating proof for user ".concat(userId, " via verifier ").concat(verifierId, "..."));
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(function () { return resolve(proof_1.length > 150); }, 1000); })];
            case 1:
                isValid = _b.sent();
                if (!isValid) {
                    throw new errors_1.IdentityError('ZKP validation failed. Proof is invalid or expired.', 'ZKP_INVALID');
                }
                return [4 /*yield*/, prisma_1.prisma.user.update({
                        where: { id: userId },
                        data: { isIdentityVerified: true },
                        select: { id: true, firstName: true }
                    })];
            case 2:
                updatedUser = _b.sent();
                res.status(200).json({
                    message: "Identity verified successfully! You now have access to verified-only features.",
                    user: { id: updatedUser.id, firstName: updatedUser.firstName, isIdentityVerified: true }
                });
                return [3 /*break*/, 4];
            case 3:
                error_6 = _b.sent();
                next(error_6);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.verifyIdentity = verifyIdentity;
