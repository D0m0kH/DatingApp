"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
// backend/src/lib/index.ts
var ioredis_1 = require("ioredis");
// ============================================================================
// Redis Configuration
// ============================================================================
var REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
/**
 * Redis client instance
 * Used for caching, sessions, and real-time features
 */
var redis = new ioredis_1.default(REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy: function (times) {
        var delay = Math.min(times * 50, 2000);
        return delay;
    },
    reconnectOnError: function (err) {
        var targetError = 'READONLY';
        if (err.message.includes(targetError)) {
            // Only reconnect when the error contains "READONLY"
            return true;
        }
        return false;
    },
});
exports.redis = redis;
// Redis event handlers
redis.on('connect', function () {
    console.log('🔴 Redis: Connecting...');
});
redis.on('ready', function () {
    console.log('✓ Redis: Ready');
});
redis.on('error', function (err) {
    console.error('❌ Redis Error:', err.message);
});
redis.on('close', function () {
    console.log('🔴 Redis: Connection closed');
});
redis.on('reconnecting', function () {
    console.log('🔴 Redis: Reconnecting...');
});
// ============================================================================
// Exports
// ============================================================================
exports.default = redis;
