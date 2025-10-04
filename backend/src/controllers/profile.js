"use strict";
// backend/src/controllers/profile.ts
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
exports.deletePhoto = exports.handlePhotoUploadComplete = exports.requestPhotoUploadUrl = exports.updateProfile = exports.getPublicProfile = exports.getMe = void 0;
var client_s3_1 = require("@aws-sdk/client-s3");
var s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
var geofire = require("geofire-common");
var client_1 = require("@prisma/client");
var prisma_1 = require("../utils/prisma");
var errors_1 = require("../utils/errors");
// --- AWS S3 Setup ---
var S3_BUCKET = process.env.S3_BUCKET || 'dating-app-photos';
var AWS_REGION = process.env.AWS_REGION || 'us-east-1';
var PHOTO_EXPIRY_SECONDS = 60 * 5;
var GEOHASH_PRECISION = 9;
var s3Client = new client_s3_1.S3Client({ region: AWS_REGION });
// --- BullMQ/Job Stub (Externalized to worker.ts) ---
var worker_1 = require("../jobs/worker");
// --- Helpers ---
var toUserPublic = function (user) {
    var _a, _b, _c, _d;
    // Advanced: Calculate age precisely
    var ageDiffMs = Date.now() - user.dateOfBirth.getTime();
    var age = Math.floor(ageDiffMs / (1000 * 60 * 60 * 24 * 365.25));
    return {
        id: user.id,
        firstName: user.firstName,
        age: age,
        gender: user.gender,
        geoHash: user.geoHash,
        isIdentityVerified: user.isIdentityVerified,
        isPremium: ((_a = user.profile) === null || _a === void 0 ? void 0 : _a.isPremium) || false,
        photos: user.photos.map(function (p) { return ({
            id: p.id,
            url: "https://".concat(S3_BUCKET, ".s3.").concat(AWS_REGION, ".amazonaws.com/photos/").concat(p.s3Key),
            isPrimary: p.isPrimary,
            status: p.status,
            aiTags: p.aiTags,
        }); }),
        topInterests: ((_b = user.profile) === null || _b === void 0 ? void 0 : _b.interests.slice(0, 3)) || [],
        scoreVector: [((_c = user.profile) === null || _c === void 0 ? void 0 : _c.recommendationScore) || 0, ((_d = user.profile) === null || _d === void 0 ? void 0 : _d.nlpVector[0]) || 0], // Example vectors
        reason: 'Profile data loaded.',
    };
};
/**
 * GET /api/profile/me - Retrieve current user's profile
 */
var getMe = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, user, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                userId = req.user.id;
                return [4 /*yield*/, prisma_1.prisma.user.findUnique({
                        where: { id: userId },
                        include: {
                            profile: true,
                            photos: { orderBy: { createdAt: 'asc' } },
                        },
                    })];
            case 1:
                user = _a.sent();
                if (!user) {
                    throw new errors_1.NotFoundError('User not found.', 'USER_NOT_FOUND');
                }
                res.status(200).json(toUserPublic(user));
                return [3 /*break*/, 3];
            case 2:
                error_1 = _a.sent();
                next(error_1);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getMe = getMe;
/**
 * GET /api/profile/:id - Retrieve another user's public profile
 */
var getPublicProfile = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var viewerId, targetUserId, match, user, error_2;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                viewerId = req.user.id;
                targetUserId = req.params.id;
                // 1. Enforce Verification (handled by middleware, but check here too)
                if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isIdentityVerified)) {
                    throw new errors_1.AuthError('Identity verification required to view other profiles.', 'VERIFICATION_REQUIRED');
                }
                return [4 /*yield*/, prisma_1.prisma.match.findUnique({
                        where: { userId1_userId2: { userId1: viewerId < targetUserId ? viewerId : targetUserId, userId2: viewerId < targetUserId ? targetUserId : viewerId } },
                        select: { status: true },
                    })];
            case 1:
                match = _b.sent();
                if ((match === null || match === void 0 ? void 0 : match.status) === 'BLOCKED') {
                    throw new errors_1.AuthError('Profile viewing unauthorized.', 'PROFILE_BLOCKED');
                }
                return [4 /*yield*/, prisma_1.prisma.user.findUnique({
                        where: { id: targetUserId },
                        include: {
                            profile: true,
                            photos: {
                                where: { status: client_1.PhotoModerationStatus.APPROVED }, // Only approved photos
                                orderBy: { isPrimary: 'desc', createdAt: 'asc' },
                            }
                        },
                    })];
            case 2:
                user = _b.sent();
                if (!user || user.isBanned) {
                    throw new errors_1.NotFoundError('Profile not found.', 'PROFILE_NOT_FOUND');
                }
                // Advanced: Inject Contextual Compatibility Score (if pre-computed)
                // const matchScore = await getPrecomputedScore(viewerId, targetUserId);
                res.status(200).json(toUserPublic(user));
                return [3 /*break*/, 4];
            case 3:
                error_2 = _b.sent();
                next(error_2);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.getPublicProfile = getPublicProfile;
/**
 * PUT /api/profile/me - Update profile fields (includes GeoHash update)
 */
var updateProfile = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, validatedBody, latitude, longitude, interests, bio, preferences, updateData, updateProfileData, user, fullUser, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                userId = req.user.id;
                validatedBody = req.validatedBody;
                latitude = validatedBody.latitude, longitude = validatedBody.longitude, interests = validatedBody.interests, bio = validatedBody.bio, preferences = validatedBody.preferences;
                updateData = {};
                updateProfileData = {};
                if (latitude !== undefined && longitude !== undefined) {
                    updateData.latitude = latitude;
                    updateData.longitude = longitude;
                    // Advanced: Auto-generate GeoHash for proximity queries (using 6 char precision for 600m accuracy)
                    updateData.geoHash = geofire.geohashForLocation([latitude, longitude], 6);
                    // Advanced: Update lastActive to signal user movement/activity
                    updateData.lastActive = new Date();
                }
                if (interests)
                    updateProfileData.interests = interests;
                if (bio !== undefined)
                    updateProfileData.bio = bio;
                if (preferences)
                    updateProfileData.preferences = preferences;
                return [4 /*yield*/, prisma_1.prisma.$transaction([
                        prisma_1.prisma.user.update({
                            where: { id: userId },
                            data: updateData,
                        }),
                        Object.keys(updateProfileData).length > 0
                            ? prisma_1.prisma.profile.update({
                                where: { userId: userId },
                                data: updateProfileData,
                            })
                            : prisma_1.prisma.profile.findUnique({ where: { userId: userId } }),
                    ])];
            case 1:
                user = (_a.sent())[0];
                return [4 /*yield*/, prisma_1.prisma.user.findUnique({
                        where: { id: userId },
                        include: { profile: true, photos: { orderBy: { createdAt: 'asc' } } },
                    })];
            case 2:
                fullUser = _a.sent();
                res.status(200).json(toUserPublic(fullUser));
                return [3 /*break*/, 4];
            case 3:
                error_3 = _a.sent();
                next(error_3);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.updateProfile = updateProfile;
/**
 * POST /api/profile/me/photos - Request a presigned URL
 */
var requestPhotoUploadUrl = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, fileExtension, s3Key, photoCount, tempPhoto, command, presignedUrl, error_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                userId = req.user.id;
                fileExtension = req.body.fileExtension || 'jpg';
                s3Key = "".concat(userId, "/").concat(Date.now(), ".").concat(fileExtension);
                return [4 /*yield*/, prisma_1.prisma.photo.count({ where: { userId: userId } })];
            case 1:
                photoCount = _a.sent();
                if (photoCount >= 6) {
                    throw new errors_1.AppError('Maximum photo limit reached (6).', 400, 'PHOTO_LIMIT_EXCEEDED');
                }
                return [4 /*yield*/, prisma_1.prisma.photo.create({
                        data: {
                            userId: userId,
                            s3Key: s3Key,
                            status: client_1.PhotoModerationStatus.PENDING,
                            isPrimary: false,
                            aiTags: [],
                        },
                    })];
            case 2:
                tempPhoto = _a.sent();
                command = new client_s3_1.PutObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: "photos/".concat(s3Key),
                    ContentType: "image/".concat(fileExtension === 'png' ? 'png' : 'jpeg'),
                });
                return [4 /*yield*/, (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn: PHOTO_EXPIRY_SECONDS })];
            case 3:
                presignedUrl = _a.sent();
                res.status(200).json({ photoId: tempPhoto.id, s3Key: s3Key, presignedUrl: presignedUrl });
                return [3 /*break*/, 5];
            case 4:
                error_4 = _a.sent();
                next(error_4);
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.requestPhotoUploadUrl = requestPhotoUploadUrl;
/**
 * PATCH /api/profile/me/photos/:photoId/upload-complete - Finalize photo upload
 */
var handlePhotoUploadComplete = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, photoId, photo, updatedPhoto, error_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                userId = req.user.id;
                photoId = req.params.photoId;
                return [4 /*yield*/, prisma_1.prisma.photo.findUnique({ where: { id: photoId } })];
            case 1:
                photo = _a.sent();
                if (!photo || photo.userId !== userId) {
                    throw new errors_1.AuthError('Photo not found or unauthorized.', 'PHOTO_UNAUTHORIZED');
                }
                return [4 /*yield*/, prisma_1.prisma.photo.update({
                        where: { id: photoId },
                        data: { url: "https://".concat(S3_BUCKET, ".s3.").concat(AWS_REGION, ".amazonaws.com/photos/").concat(photo.s3Key) },
                    })];
            case 2:
                updatedPhoto = _a.sent();
                // 2. Enqueue AI analysis (for tags and moderation flagging)
                return [4 /*yield*/, worker_1.ModerationQueue.add('photo:ai-analysis', {
                        photoId: updatedPhoto.id,
                        s3Key: updatedPhoto.s3Key,
                    })];
            case 3:
                // 2. Enqueue AI analysis (for tags and moderation flagging)
                _a.sent();
                res.status(200).json({ message: 'Photo upload finalized. Awaiting AI analysis and moderation.', photo: updatedPhoto });
                return [3 /*break*/, 5];
            case 4:
                error_5 = _a.sent();
                next(error_5);
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.handlePhotoUploadComplete = handlePhotoUploadComplete;
/**
 * DELETE /api/profile/me/photos/:id - Delete photo
 */
var deletePhoto = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, photoId, photo, error_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                userId = req.user.id;
                photoId = req.params.id;
                return [4 /*yield*/, prisma_1.prisma.photo.findUnique({ where: { id: photoId } })];
            case 1:
                photo = _a.sent();
                if (!photo || photo.userId !== userId) {
                    throw new errors_1.AuthError('Photo not found or unauthorized.', 'PHOTO_UNAUTHORIZED');
                }
                // 1. Delete record from DB
                return [4 /*yield*/, prisma_1.prisma.photo.delete({ where: { id: photoId } })];
            case 2:
                // 1. Delete record from DB
                _a.sent();
                // 2. Schedule S3 file deletion (async job)
                worker_1.ModerationQueue.add('s3:delete-object', { s3Key: "photos/".concat(photo.s3Key) });
                res.status(204).send();
                return [3 /*break*/, 4];
            case 3:
                error_6 = _a.sent();
                next(error_6);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.deletePhoto = deletePhoto;
