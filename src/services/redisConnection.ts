/**
 * Redis Connection Singleton
 * Single shared connection for BullMQ to avoid opening multiple connections.
 */

import IORedis from 'ioredis';

// Singleton instance
let redisConnection: IORedis | null = null;

/**
 * Check if Redis is enabled via environment
 */
export function isRedisEnabled(): boolean {
    return process.env.USE_REDIS === 'true';
}

/**
 * Get the Redis connection URL from environment
 */
function getRedisUrl(): string {
    return process.env.REDIS_URL || 'redis://localhost:6379';
}

/**
 * Get or create the Redis connection singleton
 */
export function getRedisConnection(): IORedis {
    if (!redisConnection) {
        const url = getRedisUrl();
        console.log(`🔌 Creating Redis connection to: ${url}`);

        redisConnection = new IORedis(url, {
            maxRetriesPerRequest: null, // Required for BullMQ
            enableReadyCheck: false,
            retryStrategy: (times) => {
                if (times > 3) {
                    console.error('❌ Redis connection failed after 3 retries');
                    return null; // Stop retrying
                }
                return Math.min(times * 200, 2000);
            }
        });

        redisConnection.on('connect', () => {
            console.log('✅ Redis connected successfully');
        });

        redisConnection.on('error', (err) => {
            console.error('❌ Redis connection error:', err.message);
        });

        redisConnection.on('close', () => {
            console.log('🔌 Redis connection closed');
        });
    }

    return redisConnection;
}

/**
 * Close the Redis connection gracefully
 */
export async function closeRedisConnection(): Promise<void> {
    if (redisConnection) {
        await redisConnection.quit();
        redisConnection = null;
        console.log('🔌 Redis connection closed gracefully');
    }
}

export default {
    getRedisConnection,
    closeRedisConnection,
    isRedisEnabled
};
