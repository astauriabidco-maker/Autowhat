import type { ClientRateLimitInfo, IncrementResponse, Options, Store } from 'express-rate-limit';
import { getRedisConnection } from './redisConnection';

function sanitizeKeySegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9:_-]/g, '_');
}

export class RedisRateLimitStore implements Store {
    localKeys = false;
    prefix: string;
    private windowMs = 60 * 1000;

    constructor(scope: string, prefix = process.env.RATE_LIMIT_REDIS_PREFIX || 'rate-limit') {
        this.prefix = `${sanitizeKeySegment(prefix)}:${sanitizeKeySegment(scope)}:`;
    }

    init(options: Options): void {
        this.windowMs = options.windowMs;
    }

    async get(key: string): Promise<ClientRateLimitInfo | undefined> {
        const redisKey = this.buildKey(key);
        const [rawHits, ttlMs] = await Promise.all([
            getRedisConnection().get(redisKey),
            getRedisConnection().pttl(redisKey)
        ]);

        if (!rawHits) return undefined;

        const totalHits = Number(rawHits);
        return {
            totalHits: Number.isFinite(totalHits) ? totalHits : 0,
            resetTime: this.resetTimeFromTtl(ttlMs)
        };
    }

    async increment(key: string): Promise<IncrementResponse> {
        const redis = getRedisConnection();
        const redisKey = this.buildKey(key);
        const totalHits = await redis.incr(redisKey);
        let ttlMs = await redis.pttl(redisKey);

        if (ttlMs < 0) {
            await redis.pexpire(redisKey, this.windowMs);
            ttlMs = this.windowMs;
        }

        return {
            totalHits,
            resetTime: this.resetTimeFromTtl(ttlMs)
        };
    }

    async decrement(key: string): Promise<void> {
        const redis = getRedisConnection();
        const redisKey = this.buildKey(key);
        const totalHits = await redis.decr(redisKey);

        if (totalHits <= 0) {
            await redis.del(redisKey);
        }
    }

    async resetKey(key: string): Promise<void> {
        await getRedisConnection().del(this.buildKey(key));
    }

    async resetAll(): Promise<void> {
        const redis = getRedisConnection();
        let cursor = '0';

        do {
            const [nextCursor, keys] = await redis.scan(
                cursor,
                'MATCH',
                `${this.prefix}*`,
                'COUNT',
                '100'
            );
            cursor = nextCursor;

            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } while (cursor !== '0');
    }

    private buildKey(key: string): string {
        return `${this.prefix}${key}`;
    }

    private resetTimeFromTtl(ttlMs: number): Date {
        return new Date(Date.now() + (ttlMs > 0 ? ttlMs : this.windowMs));
    }
}
