
/**
 * GlobalSync AI - Type Definitions
 * Location: /src/types.ts
 * Role: Centralized Type System for API and Application State
 */

export enum PlanTier {
  FREE = 'FREE',
  PREMIUM = 'PREMIUM',
  PRO = 'PRO',
  BUSINESS = 'BUSINESS'
}

export enum CallType {
  AUDIO = 'audio',
  VIDEO = 'video'
}

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null; // Handle Supabase null return
  primaryLanguage: string;
  secondaryLanguage: string | null; // Handle Supabase null return
  planId: PlanTier;
  createdAt: string;
}

export interface UserUsage {
  userId: string;
  translatedCharsCount: number;
  callMinutesCount: number;
  storageUsedMb: number;
  lastResetAt: string;
}

export interface SubscriptionPlan {
  id: PlanTier;
  name: string;
  priceMonthly: number;
  translationLimitChars: number;
  callLimitMinutes: number;
  storageLimitMb: number;
  videoQuality: '720p' | '1080p' | '4k';
}

/**
 * Added for Gemini AI Translation logic consistency
 */
export interface TranslationResponse {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  charCount: number;
}

/**
 * Added for 100ms Video SDK Session context
 */
export interface CallSession {
  sessionId: string;
  type: CallType;
  participants: string[];
  startTime: string;
  isActive: boolean;
}