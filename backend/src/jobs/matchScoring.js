"use strict";
// backend/src/jobs/matchScoring.ts
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
exports.startMatchScoringWorker = exports.MatchScoringQueue = void 0;
var bullmq_1 = require("bullmq");
var prisma_1 = require("../utils/prisma");
var geofire = require("geofire-common");
// --- BullMQ Queue Setup ---
var connection = {
    connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
    }
};
exports.MatchScoringQueue = new bullmq_1.Queue('MatchScoring', connection);
// --- Math Utilities (Advanced: Cosine Similarity on vectors) ---
/**
 * @description Computes the Cosine Similarity between two vectors.
 */
var cosineSimilarity = function (vecA, vecB) {
    if (vecA.length !== vecB.length || vecA.length === 0)
        return 0;
    var dotProduct = vecA.reduce(function (sum, val, i) { return sum + val * vecB[i]; }, 0);
    var magnitudeA = Math.sqrt(vecA.reduce(function (sum, val) { return sum + val * val; }, 0));
    var magnitudeB = Math.sqrt(vecB.reduce(function (sum, val) { return sum + val * val; }, 0));
    if (magnitudeA === 0 || magnitudeB === 0)
        return 0;
    return dotProduct / (magnitudeA * magnitudeB);
};
/**
 * @description Advanced: Calculates a multiplier based on user activity/reciprocity.
 */
var getBehaviorMultiplier = function (userActivity) {
    var hoursSinceActive = (Date.now() - userActivity.lastActive.getTime()) / (1000 * 60 * 60);
    // Decay factor (active users get a boost)
    var activityDecay = Math.max(0.7, 1.0 - (hoursSinceActive / (24 * 7))); // Decays over 7 days
    // Response rate boost (responsive users get a boost)
    var responseBoost = 0.5 + (userActivity.responseRate * 0.5); // Range 0.5 to 1.0
    return activityDecay * responseBoost;
};
// --- Job Processor (Advanced) ---
var BATCH_SIZE = 50;
var GEOHASH_PROXIMITY_LENGTH = 6; // ~600m accuracy for initial filter
var processor = function (job) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, offset, profilesToScore, geoHashPrefixes, candidateProfiles, _loop_1, _i, profilesToScore_1, scorerProfile, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = job.data.offset, offset = _a === void 0 ? 0 : _a;
                console.log("Starting match scoring batch from offset ".concat(offset, "."));
                _b.label = 1;
            case 1:
                _b.trys.push([1, 9, , 10]);
                return [4 /*yield*/, prisma_1.prisma.profile.findMany({
                        take: BATCH_SIZE,
                        skip: offset,
                        where: { user: { isBanned: false, emailVerified: true } },
                        include: { user: true }
                    })];
            case 2:
                profilesToScore = _b.sent();
                if (profilesToScore.length === 0) {
                    console.log('No more profiles to score. Finishing job.');
                    return [2 /*return*/, { status: 'finished' }];
                }
                geoHashPrefixes = profilesToScore.map(function (p) { return p.user.geoHash.substring(0, GEOHASH_PROXIMITY_LENGTH); });
                return [4 /*yield*/, prisma_1.prisma.profile.findMany({
                        where: {
                            user: {
                                geoHash: { startsWith: geoHashPrefixes[0].substring(0, 5) }, // Use a single prefix for the batch origin's area
                                id: { notIn: profilesToScore.map(function (p) { return p.userId; }) } // Exclude self
                            }
                        },
                        include: { user: { select: { id: true, latitude: true, longitude: true, lastActive: true } } }
                    })];
            case 3:
                candidateProfiles = _b.sent();
                _loop_1 = function (scorerProfile) {
                    var scorerId, scorerTraits, scorerValues, candidateScores, _c, candidateProfiles_1, candidateProfile, candidateId, candidateTraits, candidateValues, alreadyInteracted, coreScore, valueScore, baseCompatibility, distanceKm, distancePenalty, activityMultiplier, finalScore, topScores;
                    return __generator(this, function (_d) {
                        switch (_d.label) {
                            case 0:
                                scorerId = scorerProfile.userId;
                                scorerTraits = scorerProfile.traitVector;
                                scorerValues = scorerProfile.valueVector;
                                candidateScores = [];
                                _c = 0, candidateProfiles_1 = candidateProfiles;
                                _d.label = 1;
                            case 1:
                                if (!(_c < candidateProfiles_1.length)) return [3 /*break*/, 4];
                                candidateProfile = candidateProfiles_1[_c];
                                candidateId = candidateProfile.userId;
                                candidateTraits = candidateProfile.traitVector;
                                candidateValues = candidateProfile.valueVector;
                                return [4 /*yield*/, prisma_1.prisma.like.count({
                                        where: { likerId: scorerId, likedId: candidateId }
                                    })];
                            case 2:
                                alreadyInteracted = _d.sent();
                                if (alreadyInteracted > 0)
                                    return [3 /*break*/, 3];
                                coreScore = cosineSimilarity(scorerTraits, candidateTraits);
                                valueScore = cosineSimilarity(scorerValues, candidateValues);
                                baseCompatibility = (coreScore * 0.7) + (valueScore * 0.3);
                                distanceKm = geofire.distanceBetween([scorerProfile.user.latitude, scorerProfile.user.longitude], [candidateProfile.user.latitude, candidateProfile.user.longitude]);
                                distancePenalty = Math.max(0.2, 1.0 - (distanceKm / 100));
                                activityMultiplier = getBehaviorMultiplier({ lastActive: candidateProfile.user.lastActive, responseRate: 0.9 });
                                finalScore = baseCompatibility * distancePenalty * activityMultiplier;
                                finalScore = parseFloat(Math.min(1.0, Math.max(0.0, finalScore)).toFixed(4));
                                if (finalScore > 0.4) {
                                    candidateScores.push({ candidateId: candidateId, score: finalScore });
                                }
                                _d.label = 3;
                            case 3:
                                _c++;
                                return [3 /*break*/, 1];
                            case 4:
                                topScores = candidateScores.sort(function (a, b) { return b.score - a.score; }).slice(0, 100);
                                // Use a transaction to upsert candidates
                                return [4 /*yield*/, prisma_1.prisma.$transaction(topScores.map(function (_a) {
                                        var candidateId = _a.candidateId, score = _a.score;
                                        return prisma_1.prisma.matchCandidate.upsert({
                                            where: { userId_candidateProfileId: { userId: scorerId, candidateProfileId: candidateProfile.id } },
                                            update: { finalScore: score, decayRate: 1.0 }, // Reset decay on update
                                            create: {
                                                userId: scorerId,
                                                candidateProfileId: candidateProfile.id,
                                                finalScore: score,
                                                decayRate: 1.0
                                            }
                                        });
                                    }))];
                            case 5:
                                // Use a transaction to upsert candidates
                                _d.sent();
                                return [2 /*return*/];
                        }
                    });
                };
                _i = 0, profilesToScore_1 = profilesToScore;
                _b.label = 4;
            case 4:
                if (!(_i < profilesToScore_1.length)) return [3 /*break*/, 7];
                scorerProfile = profilesToScore_1[_i];
                return [5 /*yield**/, _loop_1(scorerProfile)];
            case 5:
                _b.sent();
                _b.label = 6;
            case 6:
                _i++;
                return [3 /*break*/, 4];
            case 7: 
            // 5. Reschedule the job for the next batch
            return [4 /*yield*/, exports.MatchScoringQueue.add('score-batch', { offset: offset + BATCH_SIZE })];
            case 8:
                // 5. Reschedule the job for the next batch
                _b.sent();
                return [3 /*break*/, 10];
            case 9:
                error_1 = _b.sent();
                console.error('Error during advanced match scoring job:', error_1);
                return [3 /*break*/, 10];
            case 10: return [2 /*return*/];
        }
    });
}); };
/**
 * @description Starts the Match Scoring Worker.
 */
var startMatchScoringWorker = function () {
    var worker = new bullmq_1.Worker('MatchScoring', processor, connection);
    // Schedule the initial job if not already scheduled (runs every 6 hours)
    exports.MatchScoringQueue.add('score-batch-initial', { offset: 0 }, {
        repeat: { every: 1000 * 60 * 60 * 6 },
        removeOnComplete: true,
        removeOnFail: true,
        jobId: 'initial-scoring-run'
    }).catch(function (err) { });
    console.log('✅ Match Scoring Worker started.');
    return worker;
};
exports.startMatchScoringWorker = startMatchScoringWorker;
