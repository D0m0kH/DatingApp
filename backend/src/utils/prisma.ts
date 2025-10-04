// backend/src/utils/prisma.ts

import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client instance
 * Used for database operations
 */
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export { prisma };
export default prisma;
