// backend/src/services/recommendation.ts

import { prisma } from '../utils/prisma';
import { UserPublic, PhotoModerationStatus } from '../types/shared';
import { haversineDistance } from '../jobs/matchScoring';

// --- Core Compatibility Computation ---

/**
 * @description Advanced: Computes the multi-dimensional compatibility scores.
 * @returns { core: number, chat: number } - Multi-vector scores.
 */
export async function computeMultiCompatibilityScore(userId1: string, userId2: string): Promise<{ core: number, chat: number }> {
    // 1. Fetch profiles
    const profiles = await prisma.profile.findMany({
        where: { userId: { in: [userId1, userId2] } },
        select: { userId: true, traitVector: true, valueVector: true, nlpVector: true },
    });

    const p1 = profiles.find(p => p.userId === userId1);
    const p2 = profiles.find(p => p.userId === userId2);

    if (!p1 || !p2) return { core: 0.0, chat: 0.0 };

    const scoreTraits = (vecA: number[], vecB: number[], weight: number) => {
        // Assume simplified dot product and normalization here for quick calculation
        if (vecA.length === 0 || vecB.length === 0) return 0.5 * weight;
        const dot = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
        return ((dot / vecA.length) + 1) / 2 * weight;
    };

    // 2. Core Score (Personality + Values)
    const traitScore = scoreTraits(p1.traitVector as number[], p2.traitVector as number[], 0.7);
    const valueScore = scoreTraits(p1.valueVector as number[], p2.valueVector as number[], 0.3);
    const coreCompatibility = traitScore + valueScore;

    // 3. Chat Style Score (NLP Vector)
    const chatCompatibility = scoreTraits(p1.nlpVector as number[], p2.nlpVector as number[], 1.0);

    return {
        core: parseFloat(coreCompatibility.toFixed(4)),
        chat: parseFloat(chatCompatibility.toFixed(4)),
    };
}


// --- Recommendation Retrieval ---

interface RecommendationFilters {
    minAge?: number;
    maxAge?: number;
    maxDistanceKm?: number;
    gender?: string;
    orientation?: string;
    vibePreference?: string; // New: Vibe preference from JSON settings
}

interface RecommendationOptions {
    page: number;
    limit: number;
    filters: RecommendationFilters;
    currentGeoHash?: string; // Advanced: Contextual GeoHash
    includeBoosts: boolean;
}

/**
 * @description Retrieves a paginated list of profiles for the recommendation/swipe feed, 
 * leveraging the pre-computed MatchCandidate scores.
 */
export async function getRecommendationsForUser(
    userId: string,
    options: RecommendationOptions
): Promise<UserPublic[]> {
    const { page, limit, filters, currentGeoHash, includeBoosts } = options;
    const skip = (page - 1) * limit;

    // 1. Premium & Boost Logic (Advanced: Prepend boosted profiles)
    let boostedCandidates: UserPublic[] = [];
    if (includeBoosts) {
        // STUB: Query Boost table for active profile boosts in the area
        // boostedCandidates = await getBoostedProfiles(userId, currentGeoHash, 5);
    }
    
    // 2. Build Primary Query (based on MatchCandidate table)
    
    // Filter candidates based on hard geo/preference limits (if not already filtered by the job)
    const candidateWhere: Prisma.MatchCandidateWhereInput = {
        userId: userId,
        finalScore: { gt: 0.5 }, // Only show relevant scores
        candidateProfile: {
            user: {
                // GeoHash check based on current context (optional real-time override)
                // If currentGeoHash is present, prioritize nearby matches
                geoHash: currentGeoHash ? { startsWith: currentGeoHash.substring(0, 5) } : undefined, 
            }
        }
    };

    const rawCandidates = await prisma.matchCandidate.findMany({
        where: candidateWhere,
        orderBy: [{ decayRate: 'desc' }, { finalScore: 'desc' }], // Prioritize fresh/high scores
        take: limit,
        skip: skip,
        include: {
            candidateProfile: {
                include: {
                    user: {
                        include: {
                            photos: {
                                where: { status: PhotoModerationStatus.APPROVED },
                                orderBy: { isPrimary: 'desc' }
                            }
                        }
                    }
                }
            }
        },
    });

    // 3. Post-processing and DTO mapping
    const recommendations: UserPublic[] = rawCandidates.map(candidate => {
        const user = candidate.candidateProfile.user;
        const profile = candidate.candidateProfile;
        
        // Advanced: Contextual Match Reason
        let reason = `Core Match: ${(candidate.finalScore * 100).toFixed(0)}%`;
        if (currentGeoHash && user.geoHash.startsWith(currentGeoHash.substring(0, 5))) {
            reason += ", 📍 Nearby You!";
        } else if (profile.interests.some(i => user.interests.includes(i))) { // STUB: Check for common interest overlap
            reason += ", 💖 Common Interests";
        }

        return {
            id: user.id,
            firstName: user.firstName,
            age: Math.floor((Date.now() - user.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24 * 365.25)),
            gender: user.gender,
            geoHash: user.geoHash,
            isIdentityVerified: user.isIdentityVerified,
            isPremium: profile.isPremium,
            photos: user.photos.map(p => ({
                id: p.id, url: p.url || `https://s3-bucket/photos/${p.s3Key}`, isPrimary: p.isPrimary, status: p.status, aiTags: p.aiTags
            })),
            topInterests: profile.interests.slice(0, 3),
            scoreVector: [candidate.finalScore, profile.nlpVector[0] || 0],
            reason: reason
        } as unknown as UserPublic;
    });

    // Prepend boosted users
    return [...boostedCandidates, ...recommendations];
}