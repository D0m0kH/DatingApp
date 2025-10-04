// backend/src/jobs/matchScoring.ts

import { Worker, Job, Queue } from 'bullmq';
import { prisma } from '../utils/prisma';
import { redis } from '../utils/redis';
import * as geofire from 'geofire-common';

// Export helper function for use in other modules
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return geofire.distanceBetween([lat1, lon1], [lat2, lon2]);
}

// --- BullMQ Queue Setup ---
const connection = {
    connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
    }
};

export const MatchScoringQueue = new Queue('MatchScoring', connection);

// --- Math Utilities (Advanced: Cosine Similarity on vectors) ---

/**
 * @description Computes the Cosine Similarity between two vectors.
 */
const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
    if (vecA.length !== vecB.length || vecA.length === 0) return 0;
    
    const dotProduct = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    
    return dotProduct / (magnitudeA * magnitudeB);
};

/**
 * @description Advanced: Calculates a multiplier based on user activity/reciprocity.
 */
const getBehaviorMultiplier = (userActivity: { lastActive: Date, responseRate: number }): number => {
    const hoursSinceActive = (Date.now() - userActivity.lastActive.getTime()) / (1000 * 60 * 60);
    
    // Decay factor (active users get a boost)
    const activityDecay = Math.max(0.7, 1.0 - (hoursSinceActive / (24 * 7))); // Decays over 7 days

    // Response rate boost (responsive users get a boost)
    const responseBoost = 0.5 + (userActivity.responseRate * 0.5); // Range 0.5 to 1.0

    return activityDecay * responseBoost;
};


// --- Job Processor (Advanced) ---

const BATCH_SIZE = 50;
const GEOHASH_PROXIMITY_LENGTH = 6; // ~600m accuracy for initial filter

interface MatchScoringData {
    offset: number;
}

const processor = async (job: Job<MatchScoringData>) => {
    const { offset = 0 } = job.data;
    console.log(`Starting match scoring batch from offset ${offset}.`);

    try {
        // 1. Fetch current batch of active users and their profiles
        const profilesToScore = await prisma.profile.findMany({
            take: BATCH_SIZE,
            skip: offset,
            where: { user: { isBanned: false, emailVerified: true } },
            include: { user: true }
        }) as (Profile & { user: { id: string, latitude: number, longitude: number, geoHash: string } })[];

        if (profilesToScore.length === 0) {
            console.log('No more profiles to score. Finishing job.');
            return { status: 'finished' };
        }

        // 2. Pre-filter Candidates: Load all profiles with a matching GeoHash prefix (Contextual Geo-Fencing)
        const geoHashPrefixes = profilesToScore.map(p => p.user.geoHash.substring(0, GEOHASH_PROXIMITY_LENGTH));
        
        // This query is highly simplified; real world uses bounding boxes/PostGIS
        const candidateProfiles = await prisma.profile.findMany({
            where: {
                user: {
                    geoHash: { startsWith: geoHashPrefixes[0].substring(0, 5) }, // Use a single prefix for the batch origin's area
                    id: { notIn: profilesToScore.map(p => p.userId) } // Exclude self
                }
            },
            include: { user: { select: { id: true, latitude: true, longitude: true, lastActive: true } } }
        }) as (Profile & { user: { id: string, latitude: number, longitude: number, lastActive: Date } })[];


        // 3. Score every profile in the batch against every candidate
        for (const scorerProfile of profilesToScore) {
            const scorerId = scorerProfile.userId;
            const scorerTraits = scorerProfile.traitVector as number[];
            const scorerValues = scorerProfile.valueVector as number[];
            
            const candidateScores: { candidateId: string; score: number }[] = [];

            for (const candidateProfile of candidateProfiles) {
                const candidateId = candidateProfile.userId;
                const candidateTraits = candidateProfile.traitVector as number[];
                const candidateValues = candidateProfile.valueVector as number[];

                // Skip if already interacted (Liked/Disliked/Matched)
                const alreadyInteracted = await prisma.like.count({
                    where: { likerId: scorerId, likedId: candidateId }
                });
                if (alreadyInteracted > 0) continue;

                // --- Multi-Vector Compatibility Score ---
                const coreScore = cosineSimilarity(scorerTraits, candidateTraits);
                const valueScore = cosineSimilarity(scorerValues, candidateValues);
                
                const baseCompatibility = (coreScore * 0.7) + (valueScore * 0.3); // Weighted score

                // --- Distance Penalty ---
                const distanceKm = geofire.distanceBetween([scorerProfile.user.latitude, scorerProfile.user.longitude], [candidateProfile.user.latitude, candidateProfile.user.longitude]);
                const distancePenalty = Math.max(0.2, 1.0 - (distanceKm / 100)); // Strong penalty past 100km

                // --- Behavior Multiplier ---
                const activityMultiplier = getBehaviorMultiplier({ lastActive: candidateProfile.user.lastActive, responseRate: 0.9 }); // STUB: 0.9 response rate
                
                // --- Final Hyper-Personalized Score ---
                let finalScore = baseCompatibility * distancePenalty * activityMultiplier;
                finalScore = parseFloat(Math.min(1.0, Math.max(0.0, finalScore)).toFixed(4));
                
                if (finalScore > 0.4) {
                    candidateScores.push({ candidateId, score: finalScore });
                }
            }
            
            // 4. Store top N scores in MatchCandidate table
            const topScores = candidateScores.sort((a, b) => b.score - a.score).slice(0, 100);

            // Use a transaction to upsert candidates
            await prisma.$transaction(
                topScores.map(({ candidateId, score }) => {
                    return prisma.matchCandidate.upsert({
                        where: { userId_candidateProfileId: { userId: scorerId, candidateProfileId: candidateProfile.id } },
                        update: { finalScore: score, decayRate: 1.0 }, // Reset decay on update
                        create: {
                            userId: scorerId,
                            candidateProfileId: candidateProfile.id,
                            finalScore: score,
                            decayRate: 1.0
                        }
                    });
                })
            );
        }

        // 5. Reschedule the job for the next batch
        await MatchScoringQueue.add('score-batch', { offset: offset + BATCH_SIZE });

    } catch (error) {
        console.error('Error during advanced match scoring job:', error);
    }
    // Lock release is handled conceptually by a higher-level BullMQ pattern or explicit deletion if using Redis lock.
};

/**
 * @description Starts the Match Scoring Worker.
 */
export const startMatchScoringWorker = () => {
    const worker = new Worker('MatchScoring', processor, connection);
    
    // Schedule the initial job if not already scheduled (runs every 6 hours)
    MatchScoringQueue.add('score-batch-initial', { offset: 0 }, { 
        repeat: { every: 1000 * 60 * 60 * 6 },
        removeOnComplete: true,
        removeOnFail: true,
        jobId: 'initial-scoring-run'
    }).catch(err => { /* Job already exists or failed to add */ });

    console.log('✅ Match Scoring Worker started.');
    return worker;
};