// backend/prisma/seed.ts

import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import * as geofire from 'geofire-common'; // Use geofire-common for GeoHash

const prisma = new PrismaClient();

// Helper to calculate age from DOB
const getAge = (dob: Date): number => {
  const diff = Date.now() - dob.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

// Seed function
async function main() {
  console.log('Seeding database with Advanced Multi-Vector Profiles...');

  const password = 'password123';
  const hashedPassword = await argon2.hash(password);
  const GEOHASH_PRECISION = 9;

  // 1. Define Demo Users with Multi-Vectors
  const demoUsers = [
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

  const createdUsers: any[] = [];
  for (const demo of demoUsers) {
    const geoHash = geofire.geohashForLocation([demo.latitude, demo.longitude], GEOHASH_PRECISION);

    const user = await prisma.user.create({
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
            bio: `Hello! I am ${demo.firstName}. My geoHash is ${geoHash.substring(0, 6)}!`,
            interests: demo.interests,
            traitVector: demo.traitVector,
            valueVector: demo.valueVector,
            nlpVector: demo.nlpVector,
            preferences: { minAge: 25, maxAge: 35, maxDistanceKm: 10 },
          },
        },
        photos: {
          create: demo.photos.map(p => ({
            s3Key: p.s3Key,
            url: `https://dummy-s3-bucket.com/${p.s3Key}`,
            isPrimary: p.isPrimary,
            status: 'APPROVED',
            aiTags: p.aiTags,
          })),
        },
      },
    });
    createdUsers.push(user);
    console.log(`- Created user: ${user.firstName} (Verified: ${user.isIdentityVerified})`);
  }

  const [alice, bob, carol] = createdUsers;

  // 2. Create one mutual like (Alice likes Bob, Bob likes Alice) -> Match
  console.log('\nCreating mutual like (Alice <-> Bob) to form a Match...');
  await prisma.like.createMany({
    data: [
      { likerId: alice.id, likedId: bob.id, isMatch: true },
      { likerId: bob.id, likedId: alice.id, isMatch: true },
    ],
    skipDuplicates: true,
  });

  // 3. Create the Match record with Advanced Scores
  const match = await prisma.match.create({
    data: {
      userId1: alice.id,
      userId2: bob.id,
      status: 'MATCHED',
      coreCompatibility: 0.92, // High match based on similar extroversion
      chatStyleScore: 0.88, // High match based on similar NLP vectors
    },
  });
  console.log(`- Created Match: ${match.id} (Core: ${match.coreCompatibility}, Chat: ${match.chatStyleScore})`);

  // 4. Add sample messages with NLP intent
  await prisma.message.createMany({
    data: [
      { matchId: match.id, senderId: alice.id, text: 'Hey Bob! That 92% score is promising! 👋', messageStatus: 'READ', nlpIntent: 'flirtatious_open' },
      { matchId: match.id, senderId: bob.id, text: 'Hi Alice! Definitely. What are you up to this weekend?', messageStatus: 'SENT', nlpIntent: 'open_question' },
    ],
  });
  console.log('- Added sample messages with NLP intent.');

  // 5. Create a match candidate score for Alice to see Carol (for recommendation testing)
  // Bob and Alice are compatible, but Carol is far away and has different traits.
  // We simulate a low score (0.2) for Carol in Alice's feed.
  const aliceProfile = await prisma.profile.findUnique({ where: { userId: alice.id } });
  if (aliceProfile) {
    await prisma.matchCandidate.create({
      data: {
        userId: alice.id,
        candidateProfileId: carol.profile!.id,
        finalScore: 0.21, // Low score
      }
    });
    console.log(`- Created low MatchCandidate score (0.21) for Carol in Alice's feed.`);
  }

  console.log('\n✅ Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });