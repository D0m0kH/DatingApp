"use strict";
// backend/src/services/recommendation.ts
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeMultiCompatibilityScore = computeMultiCompatibilityScore;
exports.getRecommendationsForUser = getRecommendationsForUser;
var prisma_1 = require("../utils/prisma");
var client_1 = require("@prisma/client");
// --- Core Compatibility Computation ---
/**
 * @description Advanced: Computes the multi-dimensional compatibility scores.
 * @returns { core: number, chat: number } - Multi-vector scores.
 */
function computeMultiCompatibilityScore(userId1, userId2) {
    return __awaiter(this, void 0, void 0, function () {
        var profiles, p1, p2, scoreTraits, traitScore, valueScore, coreCompatibility, chatCompatibility;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma_1.prisma.profile.findMany({
                        where: { userId: { in: [userId1, userId2] } },
                        select: { userId: true, traitVector: true, valueVector: true, nlpVector: true },
                    })];
                case 1:
                    profiles = _a.sent();
                    p1 = profiles.find(function (p) { return p.userId === userId1; });
                    p2 = profiles.find(function (p) { return p.userId === userId2; });
                    if (!p1 || !p2)
                        return [2 /*return*/, { core: 0.0, chat: 0.0 }];
                    scoreTraits = function (vecA, vecB, weight) {
                        // Assume simplified dot product and normalization here for quick calculation
                        if (vecA.length === 0 || vecB.length === 0)
                            return 0.5 * weight;
                        var dot = vecA.reduce(function (sum, val, i) { return sum + val * vecB[i]; }, 0);
                        return ((dot / vecA.length) + 1) / 2 * weight;
                    };
                    traitScore = scoreTraits(p1.traitVector, p2.traitVector, 0.7);
                    valueScore = scoreTraits(p1.valueVector, p2.valueVector, 0.3);
                    coreCompatibility = traitScore + valueScore;
                    chatCompatibility = scoreTraits(p1.nlpVector, p2.nlpVector, 1.0);
                    return [2 /*return*/, {
                            core: parseFloat(coreCompatibility.toFixed(4)),
                            chat: parseFloat(chatCompatibility.toFixed(4)),
                        }];
            }
        });
    });
}
/**
 * @description Retrieves a paginated list of profiles for the recommendation/swipe feed,
 * leveraging the pre-computed MatchCandidate scores.
 */
function getRecommendationsForUser(userId, options) {
    return __awaiter(this, void 0, void 0, function () {
        var page, limit, filters, currentGeoHash, includeBoosts, skip, boostedCandidates, candidateWhere, rawCandidates, recommendations;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    page = options.page, limit = options.limit, filters = options.filters, currentGeoHash = options.currentGeoHash, includeBoosts = options.includeBoosts;
                    skip = (page - 1) * limit;
                    boostedCandidates = [];
                    if (includeBoosts) {
                        // STUB: Query Boost table for active profile boosts in the area
                        // boostedCandidates = await getBoostedProfiles(userId, currentGeoHash, 5);
                    }
                    candidateWhere = {
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
                    return [4 /*yield*/, prisma_1.prisma.matchCandidate.findMany({
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
                                                    where: { status: client_1.PhotoModerationStatus.APPROVED },
                                                    orderBy: { isPrimary: 'desc' }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                        })];
                case 1:
                    rawCandidates = _a.sent();
                    recommendations = rawCandidates.map(function (candidate) {
                        var user = candidate.candidateProfile.user;
                        var profile = candidate.candidateProfile;
                        // Advanced: Contextual Match Reason
                        var reason = "Core Match: ".concat((candidate.finalScore * 100).toFixed(0), "%");
                        if (currentGeoHash && user.geoHash.startsWith(currentGeoHash.substring(0, 5))) {
                            reason += ", 📍 Nearby You!";
                        }
                        else if (profile.interests.some(function (i) { return user.interests.includes(i); })) { // STUB: Check for common interest overlap
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
                            photos: user.photos.map(function (p) { return ({
                                id: p.id, url: p.url || "https://s3-bucket/photos/".concat(p.s3Key), isPrimary: p.isPrimary, status: p.status, aiTags: p.aiTags
                            }); }),
                            topInterests: profile.interests.slice(0, 3),
                            scoreVector: [candidate.finalScore, profile.nlpVector[0] || 0],
                            reason: reason
                        };
                    });
                    // Prepend boosted users
                    return [2 /*return*/, __spreadArray(__spreadArray([], boostedCandidates, true), recommendations, true)];
            }
        });
    });
}
