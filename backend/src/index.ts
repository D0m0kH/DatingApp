// backend/src/index.ts

import 'dotenv/config'; // Must be the first line

import http from 'http';
import { createTerminus, HealthCheck, TerminusOptions } from '@godaddy/terminus';
import Sentry from '@sentry/node';
import { Server } from 'socket.io';

import app from './app';
import { initSocket } from './socket';
import { prisma } from './utils/prisma';
import { redis } from './utils/redis';
import { startMatchScoringWorker, startModerationWorker } from './jobs/worker'; // New worker entry point

// --- Environment Validation (Stricter) ---

const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'JWT_ALGORITHM', 'S3_BUCKET', 'REDIS_HOST'];
const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingEnvVars.length > 0) {
  console.error(`❌ Fatal: Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Ensure JWT_ALGORITHM is set (e.g., HS512 or RS256).');
  process.exit(1);
}

// --- Sentry Initialization ---

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
  });
  console.log('✅ Sentry initialized.');
}

// --- Server Setup ---

const PORT = process.env.PORT || 4000;

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io: Server = initSocket(server);

// Start BullMQ Workers
const matchWorker = startMatchScoringWorker();
const moderationWorker = startModerationWorker();


// --- Graceful Shutdown (Extended) ---

const onSignal = async () => {
  console.log('Gracefully shutting down...');
  // 1. Close HTTP server (stops accepting new connections)
  server.close();
  // 2. Close Socket.IO
  io.close();
  // 3. Close BullMQ Workers
  await matchWorker.close();
  await moderationWorker.close();
  // 4. Disconnect Prisma
  await prisma.$disconnect();
  // 5. Disconnect Redis
  await redis.quit();
  console.log('Server, Workers, DB, and Redis connections closed.');
};

const onHealthCheck: HealthCheck = async () => {
  // Check DB connection
  await prisma.$queryRaw`SELECT 1`;
  // Check Redis connection
  await redis.ping();
  return { prisma: 'ok', redis: 'ok', workers: 'ok' };
};

const terminusOptions: TerminusOptions = {
  healthChecks: {
    '/health': onHealthCheck,
    verbatim: true,
  },
  signal: 'SIGTERM',
  onSignal,
  onShutdown: () => console.log('Shutdown finished.'),
  timeout: 10000, // Increased timeout for workers to finish current jobs
  use  ,UnifiedTopology: false,
};

createTerminus(server, terminusOptions);

// --- Start Server ---

async function start() {
  server.listen(PORT, () => {
    console.log(`🚀 API Server ready at http://localhost:${PORT}`);
    console.log(`📡 Socket.IO listening`);
    console.log(`🛠️ Background Workers running`);
  });
}

// Start the server if the module is run directly
if (require.main === module) {
  start();
}

// Export the server for testing purposes
export { server, io }; // Export io as well for easier mocking/testing