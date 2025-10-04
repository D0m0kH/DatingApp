// app/src/types/shared.ts
// This file mirrors the backend types for use in the frontend

export interface UserPublic {
  id: string;
  firstName: string;
  age: number;
  gender: string;
  geoHash: string;
  isIdentityVerified: boolean;
  isPremium: boolean;
  photos: Array<{
    id: string;
    url: string;
    isPrimary: boolean;
    status: string;
    aiTags: string[];
  }>;
  topInterests: string[];
  scoreVector: number[];
  reason: string;
}

export interface AuthResponse {
  user: UserPublic;
  accessToken: string;
  refreshToken: string;
  fingerprintId: string;
}

export interface DeviceFingerprintDto {
  deviceId: string;
  platform: string;
  osVersion: string;
  appVersion: string;
  screenResolution: string;
  locale: string;
}

export interface LoginDto {
  email: string;
  password: string;
  fingerprint: DeviceFingerprintDto;
}

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  dateOfBirth: string;
  gender: string;
  fingerprint: DeviceFingerprintDto;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  attachments: string[];
  messageStatus: string;
  createdAt: Date;
}

export interface Match {
  id: string;
  user1Id: string;
  user2Id: string;
  status: string;
  createdAt: Date;
}

// Add any other types that are needed by the app
export type Dtos = any; // Placeholder for compatibility
