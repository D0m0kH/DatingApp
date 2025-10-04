// backend/src/lib/index.ts
import Redis from 'ioredis';

// ============================================================================
// Redis Configuration
// ============================================================================

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Redis client instance
 * Used for caching, sessions, and real-time features
 */
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Only reconnect when the error contains "READONLY"
      return true;
    }
    return false;
  },
});

// Redis event handlers
redis.on('connect', () => {
  console.log('🔴 Redis: Connecting...');
});

redis.on('ready', () => {
  console.log('✓ Redis: Ready');
});

redis.on('error', (err) => {
  console.error('❌ Redis Error:', err.message);
});

redis.on('close', () => {
  console.log('🔴 Redis: Connection closed');
});

redis.on('reconnecting', () => {
  console.log('🔴 Redis: Reconnecting...');
});

// ============================================================================
// Exports
// ============================================================================

export default redis;
export { redis };