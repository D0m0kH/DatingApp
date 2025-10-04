"use strict";
// backend/src/types/shared.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.exampleUserPublic = exports.ZKPVerifyDtoSchema = exports.MessageSendDtoSchema = exports.LikeDtoSchema = exports.ProfileUpdateDtoSchema = exports.LoginDtoSchema = exports.RegisterDtoSchema = exports.DeviceFingerprintSchema = void 0;
var zod_1 = require("zod");
var client_1 = require("@prisma/client"); // Import Prisma Enums for strictness
// --- DTOs and Zod Schemas (Advanced) ---
/**
 * @description Basic client device fingerprint.
 */
exports.DeviceFingerprintSchema = zod_1.z.object({
    /** @example "web-chrome-117" | "mobile-expo-sdk50" */
    userAgent: zod_1.z.string().min(1),
    /** @example "uuid-from-device" (Unique client ID, stored on device) */
    clientId: zod_1.z.string().min(1),
    /** @example "Europe/London" */
    timezone: zod_1.z.string().optional(),
});
// 1. Register DTO (Requires Device Fingerprint)
exports.RegisterDtoSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(12, 'Password must be at least 12 characters and complex'), // Stronger password policy
    firstName: zod_1.z.string().min(1),
    dateOfBirth: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    gender: zod_1.z.string().min(1),
    orientation: zod_1.z.string().min(1),
    // New: Device Fingerprint for FASE Session Engine
    fingerprint: exports.DeviceFingerprintSchema,
});
// 2. Login DTO (Requires Device Fingerprint)
exports.LoginDtoSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
    fingerprint: exports.DeviceFingerprintSchema,
});
// 3. Profile Update DTO
exports.ProfileUpdateDtoSchema = zod_1.z.object({
    bio: zod_1.z.string().max(1000).optional(),
    interests: zod_1.z.array(zod_1.z.string().min(1)).optional(),
    latitude: zod_1.z.number().min(-90).max(90).optional(),
    longitude: zod_1.z.number().min(-180).max(180).optional(),
    accuracyMeters: zod_1.z.number().min(0).max(5000).optional(), // Granular privacy control
    preferences: zod_1.z.record(zod_1.z.any()).optional(),
}).strict();
// 4. Like DTO (No change needed, but contextually handles Super/Regular)
exports.LikeDtoSchema = zod_1.z.object({
    toUserId: zod_1.z.string().min(1),
});
// 5. Message Send DTO (Add NLP tags for immediate feedback)
exports.MessageSendDtoSchema = zod_1.z.object({
    text: zod_1.z.string().min(1).max(1000).optional(),
    attachments: zod_1.z.array(zod_1.z.string()).optional(),
    nlpIntent: zod_1.z.string().optional(), // AI analyzed intent (e.g., 'joke', 'question', 'deep_topic')
}).refine(function (data) { return data.text || (data.attachments && data.attachments.length > 0); }, {
    message: 'Message must contain text or at least one attachment.',
});
// 6. Identity Verification DTO (Placeholder for ZKP)
exports.ZKPVerifyDtoSchema = zod_1.z.object({
    proof: zod_1.z.string().min(100), // Zero-Knowledge Proof payload
    verifierId: zod_1.z.string(), // ID of the verifier service used
});
// --- Example User Public ---
var exampleUserPublic = function () { return ({
    id: 'user-test-1',
    firstName: 'Testy',
    age: 28,
    gender: 'Non-Binary',
    geoHash: 'u4pruydqq',
    isIdentityVerified: true,
    isPremium: true,
    photos: [{ id: 'photo-test-1', url: 'https://s3.aws/test-photo.jpg', isPrimary: true, status: client_1.PhotoModerationStatus.APPROVED, aiTags: ['smiling', 'outdoor'] }],
    topInterests: ['music', 'travel', 'cooking'],
    scoreVector: [0.95, 0.88],
    reason: '95% personality alignment, 88% common interests.',
}); };
exports.exampleUserPublic = exampleUserPublic;
