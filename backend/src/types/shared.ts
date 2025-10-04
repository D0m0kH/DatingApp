// backend/src/types/shared.ts

import { z, ZodSchema } from 'zod';
import { MatchStatus, PhotoModerationStatus } from '@prisma/client'; // Import Prisma Enums for strictness

/**
 * @description Represents a user's public-facing information for the swipe deck.
 * @example { "id": "user-123", "firstName": "Alice", "age": 30, "geoHash": "u4pruydqq", "photos": [...], "scoreVector": [0.85, 0.92], "reason": "92% core compatibility, 85% chat style match" }
 */
export interface UserPublic {
  /** @example "user-123" */
  id: string;
  /** @example "Alice" */
  firstName: string;
  /** @example 30 */
  age: number;
  /** @example "Female" */
  gender: string;
  /** @example "u4pruydqq" (Geohash for privacy-preserving location) */
  geoHash: string;
  /** @example true (Identity verified via ZKP/biometrics) */
  isIdentityVerified: boolean;
  /** @example true (Premium user status) */
  isPremium: boolean;
  /** @example [{ "id": "photo-456", "url": "https://s3.aws/photo.jpg", "isPrimary": true }] */
  photos: Photo[];
  /** @example ["coding", "hiking", "jazz"] (Top 3 detected interests) */
  topInterests: string[];
  /** @example [0.85, 0.92] (Compatibility score for Core Personality, Communication Style, etc.) */
  scoreVector: number[];
  /** @example "92% core compatibility, 85% chat style match" */
  reason: string;
}

/**
 * @description Response from authentication endpoints, includes FASE (Fingerprint-Aware Session Engine) data.
 * @example { "accessToken": "eyJ...", "refreshToken": "opaque-token-hash", "fingerprintId": "fp-101", "user": { "id": "user-123", ... } }
 */
export interface AuthResponse {
  /** @example "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." (Short-lived, must be renewed often) */
  accessToken: string;
  /** @example "opaque-token-hash" (One-time use, used for rotation) */
  refreshToken: string;
  /** @example "fp-101" (ID linking refresh token to device/browser fingerprint) */
  fingerprintId: string;
  /** @example { "id": "user-123", ... } */
  user: UserPublic;
}

/**
 * @description Detailed user profile data, including vectors from AI analysis.
 * @example { "id": "profile-789", "traitVector": [0.5, -0.2, 0.9], "nlpVector": [0.7, 0.1] }
 */
export interface Profile {
  /** @example "profile-789" */
  id: string;
  /** @example [0.5, -0.2, 0.9, 0.1] (Big 5 Personality Traits, normalized) */
  traitVector: number[];
  /** @example [0.7, 0.1] (NLP/Communication style vector derived from chat history) */
  nlpVector: number[];
  /** @example { "minAge": 25, "maxAge": 35, "maxDistanceKm": 50, "vibePreference": "Adventurous" } */
  preferences: { [key: string]: any };
  /** @example "2023-10-03T21:00:00.000Z" */
  updatedAt: Date;
}

/**
 * @description Photo metadata including moderation status and AI tags.
 */
export interface Photo {
  /** @example "photo-456" */
  id: string;
  /** @example "https://s3.aws/photo.jpg" */
  url: string;
  /** @example true */
  isPrimary: boolean;
  /** @example "APPROVED" (Uses Prisma Enum) */
  status: PhotoModerationStatus;
  /** @example ["face_clear", "outdoor", "smiling"] (AI-generated tags for moderation/matching) */
  aiTags: string[];
}

/**
 * @description Match metadata for the match list.
 */
export interface Match {
  /** @example "match-101" */
  id: string;
  /** @example "MATCHED" (Uses Prisma Enum) */
  status: MatchStatus;
  /** @example 0.92 */
  coreCompatibility: number;
  /** @example "Hey!" */
  lastMessage: string | null;
  /** @example 1 */
  unreadCount: number;
}

/**
 * @description Chat message payload.
 */
export interface Message {
  /** @example "msg-202" */
  id: string;
  /** @example "user-123" */
  senderId: string;
  /** @example "Hi there!" */
  text: string;
  /** @example ["s3-key-img-1"] */
  attachments: string[];
  /** @example "DELIVERED" | "READ" (Granular status) */
  messageStatus: 'SENT' | 'DELIVERED' | 'READ';
  /** @example "2023-10-03T21:00:00.000Z" */
  createdAt: Date;
}

/**
 * @description Advanced Geo-location data for Contextual Matching.
 * @example { "lat": 40.7128, "lng": -74.0060, "hash": "u4pruydqq", "accuracyMeters": 100 }
 */
export interface Location {
  /** @example 40.7128 */
  lat: number;
  /** @example -74.0060 */
  lng: number;
  /** @example "u4pruydqq" (6-char geohash for proximity matching) */
  hash: string;
  /** @example 100 (Accuracy of the location in meters, for privacy control) */
  accuracyMeters: number;
}

/**
 * @description Multi-Vector for AI Matching.
 */
export type MultiTraitVector = {
  personality: number[];
  values: number[];
  communication: number[];
};


// --- DTOs and Zod Schemas (Advanced) ---

/**
 * @description Basic client device fingerprint.
 */
export const DeviceFingerprintSchema = z.object({
  /** @example "web-chrome-117" | "mobile-expo-sdk50" */
  userAgent: z.string().min(1),
  /** @example "uuid-from-device" (Unique client ID, stored on device) */
  clientId: z.string().min(1),
  /** @example "Europe/London" */
  timezone: z.string().optional(),
});
export type DeviceFingerprintDto = z.infer<typeof DeviceFingerprintSchema>;

// 1. Register DTO (Requires Device Fingerprint)
export const RegisterDtoSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12, 'Password must be at least 12 characters and complex'), // Stronger password policy
  firstName: z.string().min(1),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.string().min(1),
  orientation: z.string().min(1),
  // New: Device Fingerprint for FASE Session Engine
  fingerprint: DeviceFingerprintSchema,
});
export type RegisterDto = z.infer<typeof RegisterDtoSchema>;

// 2. Login DTO (Requires Device Fingerprint)
export const LoginDtoSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  fingerprint: DeviceFingerprintSchema,
});
export type LoginDto = z.infer<typeof LoginDtoSchema>;

// 3. Profile Update DTO
export const ProfileUpdateDtoSchema = z.object({
  bio: z.string().max(1000).optional(),
  interests: z.array(z.string().min(1)).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracyMeters: z.number().min(0).max(5000).optional(), // Granular privacy control
  preferences: z.record(z.string(), z.any()).optional(),
}).strict();
export type ProfileUpdateDto = z.infer<typeof ProfileUpdateDtoSchema>;

// 4. Like DTO (No change needed, but contextually handles Super/Regular)
export const LikeDtoSchema = z.object({
  toUserId: z.string().min(1),
});
export type LikeDto = z.infer<typeof LikeDtoSchema>;

// 5. Message Send DTO (Add NLP tags for immediate feedback)
export const MessageSendDtoSchema = z.object({
  text: z.string().min(1).max(1000).optional(),
  attachments: z.array(z.string()).optional(),
  nlpIntent: z.string().optional(), // AI analyzed intent (e.g., 'joke', 'question', 'deep_topic')
}).refine(data => data.text || (data.attachments && data.attachments.length > 0), {
  message: 'Message must contain text or at least one attachment.',
});
export type MessageSendDto = z.infer<typeof MessageSendDtoSchema>;


// 6. Identity Verification DTO (Placeholder for ZKP)
export const ZKPVerifyDtoSchema = z.object({
  proof: z.string().min(100), // Zero-Knowledge Proof payload
  verifierId: z.string(), // ID of the verifier service used
});
export type ZKPVerifyDto = z.infer<typeof ZKPVerifyDtoSchema>;


// --- Example User Public ---
export const exampleUserPublic = (): UserPublic => ({
  id: 'user-test-1',
  firstName: 'Testy',
  age: 28,
  gender: 'Non-Binary',
  geoHash: 'u4pruydqq',
  isIdentityVerified: true,
  isPremium: true,
  photos: [{ id: 'photo-test-1', url: 'https://s3.aws/test-photo.jpg', isPrimary: true, status: PhotoModerationStatus.APPROVED, aiTags: ['smiling', 'outdoor'] }],
  topInterests: ['music', 'travel', 'cooking'],
  scoreVector: [0.95, 0.88],
  reason: '95% personality alignment, 88% common interests.',
});