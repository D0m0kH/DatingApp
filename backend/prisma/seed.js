"use strict";
// backend/prisma/seed.ts
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
var client_1 = require("@prisma/client");
var argon2 = require("argon2");
var geofire = require("geofire-common"); // Use geofire-common for GeoHash
var prisma = new client_1.PrismaClient();
// Helper to calculate age from DOB
var getAge = function (dob) {
    var diff = Date.now() - dob.getTime();
    var ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
};
// Seed function
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var password, hashedPassword, GEOHASH_PRECISION, demoUsers, createdUsers, _i, demoUsers_1, demo, geoHash, user, alice, bob, carol, match, aliceProfile;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Seeding database with Advanced Multi-Vector Profiles...');
                    password = 'password123';
                    return [4 /*yield*/, argon2.hash(password)];
                case 1:
                    hashedPassword = _a.sent();
                    GEOHASH_PRECISION = 9;
                    demoUsers = [
                        {
                            email: 'alice@example.com',
                            firstName: 'Alice',
                            dateOfBirth: new Date('1990-05-15'),
                            gender: 'Female',
                            orientation: 'Straight',
                            latitude: 40.7580, // Times Square, NYC
                            longitude: -73.9855,
                            traitVector: [0.8, -0.2, 0.5, 0.1, 0.6], // High Extroversion (0.8)
                            valueVector: [0.9, 0.1, 0.3], // High Value for Adventure
                            nlpVector: [0.7, 0.2], // Direct Communication Style
                            interests: ['coding', 'hiking', 'jazz'],
                            isIdentityVerified: true,
                            photos: [{ s3Key: 'alice-photo-1', isPrimary: true, status: 'APPROVED', aiTags: ['smiling', 'outdoor'] }],
                        },
                        {
                            email: 'bob@example.com',
                            firstName: 'Bob',
                            dateOfBirth: new Date('1988-11-20'),
                            gender: 'Male',
                            orientation: 'Straight',
                            latitude: 40.7560, // Near Times Square, NYC (close match)
                            longitude: -73.9840,
                            traitVector: [0.7, -0.1, 0.6, 0.2, 0.5], // Also high Extroversion (0.7) - Good core compatibility
                            valueVector: [0.8, 0.2, 0.4],
                            nlpVector: [0.8, 0.1], // Direct Communication Style - Good chat match
                            interests: ['movies', 'gym', 'rock climbing'],
                            isIdentityVerified: true,
                            photos: [{ s3Key: 'bob-photo-1', isPrimary: true, status: 'APPROVED', aiTags: ['gym', 'serious'] }],
                        },
                        {
                            email: 'carol@example.com',
                            firstName: 'Carol',
                            dateOfBirth: new Date('1995-03-01'),
                            gender: 'Female',
                            orientation: 'Bisexual',
                            latitude: 34.0522, // Los Angeles
                            longitude: -118.2437,
                            traitVector: [-0.5, 0.9, -0.1, 0.5, 0.3], // High Introversion (-0.5)
                            valueVector: [0.2, 0.8, 0.7], // High Value for Stability
                            nlpVector: [0.1, 0.9], // Thoughtful Communication Style
                            interests: ['art', 'photography', 'coffee'],
                            isIdentityVerified: false, // Not verified for testing
                            photos: [{ s3Key: 'carol-photo-1', isPrimary: true, status: 'APPROVED', aiTags: ['art', 'filter'] }],
                        },
                    ];
                    createdUsers = [];
                    _i = 0, demoUsers_1 = demoUsers;
                    _a.label = 2;
                case 2:
                    if (!(_i < demoUsers_1.length)) return [3 /*break*/, 5];
                    demo = demoUsers_1[_i];
                    geoHash = geofire.geohashForLocation([demo.latitude, demo.longitude], GEOHASH_PRECISION);
                    return [4 /*yield*/, prisma.user.create({
                            data: {
                                email: demo.email,
                                password: hashedPassword,
                                firstName: demo.firstName,
                                dateOfBirth: demo.dateOfBirth,
                                gender: demo.gender,
                                orientation: demo.orientation,
                                emailVerified: true,
                                isIdentityVerified: demo.isIdentityVerified,
                                latitude: demo.latitude,
                                longitude: demo.longitude,
                                geoHash: geoHash,
                                profile: {
                                    create: {
                                        bio: "Hello! I am ".concat(demo.firstName, ". My geoHash is ").concat(geoHash.substring(0, 6), "!"),
                                        interests: demo.interests,
                                        traitVector: demo.traitVector,
                                        valueVector: demo.valueVector,
                                        nlpVector: demo.nlpVector,
                                        preferences: { minAge: 25, maxAge: 35, maxDistanceKm: 10 },
                                    },
                                },
                                photos: {
                                    create: demo.photos.map(function (p) { return ({
                                        s3Key: p.s3Key,
                                        url: "https://dummy-s3-bucket.com/".concat(p.s3Key),
                                        isPrimary: p.isPrimary,
                                        status: 'APPROVED',
                                        aiTags: p.aiTags,
                                    }); }),
                                },
                            },
                        })];
                case 3:
                    user = _a.sent();
                    createdUsers.push(user);
                    console.log("- Created user: ".concat(user.firstName, " (Verified: ").concat(user.isIdentityVerified, ")"));
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    alice = createdUsers[0], bob = createdUsers[1], carol = createdUsers[2];
                    // 2. Create one mutual like (Alice likes Bob, Bob likes Alice) -> Match
                    console.log('\nCreating mutual like (Alice <-> Bob) to form a Match...');
                    return [4 /*yield*/, prisma.like.createMany({
                            data: [
                                { likerId: alice.id, likedId: bob.id, isMatch: true },
                                { likerId: bob.id, likedId: alice.id, isMatch: true },
                            ],
                            skipDuplicates: true,
                        })];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, prisma.match.create({
                            data: {
                                userId1: alice.id,
                                userId2: bob.id,
                                status: 'MATCHED',
                                coreCompatibility: 0.92, // High match based on similar extroversion
                                chatStyleScore: 0.88, // High match based on similar NLP vectors
                            },
                        })];
                case 7:
                    match = _a.sent();
                    console.log("- Created Match: ".concat(match.id, " (Core: ").concat(match.coreCompatibility, ", Chat: ").concat(match.chatStyleScore, ")"));
                    // 4. Add sample messages with NLP intent
                    return [4 /*yield*/, prisma.message.createMany({
                            data: [
                                { matchId: match.id, senderId: alice.id, text: 'Hey Bob! That 92% score is promising! 👋', messageStatus: 'READ', nlpIntent: 'flirtatious_open' },
                                { matchId: match.id, senderId: bob.id, text: 'Hi Alice! Definitely. What are you up to this weekend?', messageStatus: 'SENT', nlpIntent: 'open_question' },
                            ],
                        })];
                case 8:
                    // 4. Add sample messages with NLP intent
                    _a.sent();
                    console.log('- Added sample messages with NLP intent.');
                    return [4 /*yield*/, prisma.profile.findUnique({ where: { userId: alice.id } })];
                case 9:
                    aliceProfile = _a.sent();
                    if (!aliceProfile) return [3 /*break*/, 11];
                    return [4 /*yield*/, prisma.matchCandidate.create({
                            data: {
                                userId: alice.id,
                                candidateProfileId: carol.profile.id,
                                finalScore: 0.21, // Low score
                            }
                        })];
                case 10:
                    _a.sent();
                    console.log("- Created low MatchCandidate score (0.21) for Carol in Alice's feed.");
                    _a.label = 11;
                case 11:
                    console.log('\n✅ Seeding complete.');
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error(e);
    process.exit(1);
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
