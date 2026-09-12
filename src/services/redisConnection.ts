/**
 * Redis Connection Singleton
 * Single shared connection for BullMQ to avoid opening multiple connections.
 */

import IORedis from 'ioredis';

// Singleton instance
let redisConnection: IORedis | null = null;
let lastRedisErrorMessage: string | null = null;

export interface RedisRuntimeStatus {
    enabled: boolean;
    configured: boolean;
    connected: boolean;
    status: string;
    lastError: string | null;
}

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

function redactRedisUrl(url: string): string {
    try {
        const parsed = new URL(url);
        if (parsed.password) parsed.password = '***';
        if (parsed.username) parsed.username = '***';
        return parsed.toString();
    } catch {
        return '<invalid redis url>';
    }
}

/**
 * Get or create the Redis connection singleton
 */
export function getRedisConnection(): IORedis {
    if (!redisConnection) {
        const url = getRedisUrl();
        console.log(`🔌 Creating Redis connection to: ${redactRedisUrl(url)}`);

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
            lastRedisErrorMessage = null;
            console.log('✅ Redis connected successfully');
        });

        redisConnection.on('error', (err) => {
            lastRedisErrorMessage = err.message;
            console.error('❌ Redis connection error:', err.message);
        });

        redisConnection.on('close', () => {
            console.log('🔌 Redis connection closed');
        });
    }

    return redisConnection;
}

export function getRedisRuntimeStatus(): RedisRuntimeStatus {
    const status = redisConnection?.status || 'not_initialized';

    return {
        enabled: isRedisEnabled(),
        configured: Boolean(process.env.REDIS_URL),
        connected: status === 'ready',
        status,
        lastError: lastRedisErrorMessage
    };
}

/**
 * Close the Redis connection gracefully
 */
export async function closeRedisConnection(): Promise<void> {
    if (redisConnection) {
        await redisConnection.quit();
        redisConnection = null;
        lastRedisErrorMessage = null;
        console.log('🔌 Redis connection closed gracefully');
    }
}

export default {
    getRedisConnection,
    closeRedisConnection,
    isRedisEnabled,
    getRedisRuntimeStatus
};
