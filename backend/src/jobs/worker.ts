// backend/src/jobs/worker.ts

import { Worker, Queue } from 'bullmq';
import { redis } from '../utils/redis';

/**
 * Start the match scoring worker
 */
export function startMatchScoringWorker() {
  const worker = new Worker('match-scoring', async (job) => {
    console.log(`Processing match scoring job ${job.id}`);
    // Job processing logic would go here
    // For now, just a placeholder
  }, {
    connection: redis as any,
  });

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
  });

  return worker;
}

/**
 * Start the moderation worker
 */
export function startModerationWorker() {
  const worker = new Worker('moderation', async (job) => {
    console.log(`Processing moderation job ${job.id}`);
    // Job processing logic would go here
    // For now, just a placeholder
  }, {
    connection: redis as any,
  });

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
  });

  return worker;
}

/**
 * Export the queue for adding jobs
 */
export const ModerationQueue = new Queue('moderation', {
  connection: redis as any,
});

export { Queue };
