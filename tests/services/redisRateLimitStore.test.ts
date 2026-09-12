import rateLimit from 'express-rate-limit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Options } from 'express-rate-limit';

const redisMock = vi.hoisted(() => ({
    client: undefined as unknown
}));

vi.mock('../../src/services/redisConnection', () => ({
    getRedisConnection: () => redisMock.client
}));

import { RedisRateLimitStore } from '../../src/services/redisRateLimitStore';

type RedisValue = {
    value: number;
    expiresAt?: number;
};

class FakeRedis {
    private values = new Map<string, RedisValue>();
    private scanSnapshot: string[] = [];

    async get(key: string): Promise<string | null> {
        const entry = this.getLiveEntry(key);
        return entry ? String(entry.value) : null;
    }

    async incr(key: string): Promise<number> {
        const entry = this.getLiveEntry(key);
        const next = (entry?.value || 0) + 1;
        this.values.set(key, { value: next, expiresAt: entry?.expiresAt });
        return next;
    }

    async decr(key: string): Promise<number> {
        const entry = this.getLiveEntry(key);
        const next = (entry?.value || 0) - 1;
        this.values.set(key, { value: next, expiresAt: entry?.expiresAt });
        return next;
    }

    async pttl(key: string): Promise<number> {
        const entry = this.getLiveEntry(key);
        if (!entry) return -2;
        if (!entry.expiresAt) return -1;
        return Math.max(0, entry.expiresAt - Date.now());
    }

    async pexpire(key: string, ttlMs: number): Promise<number> {
        const entry = this.getLiveEntry(key);
        if (!entry) return 0;
        entry.expiresAt = Date.now() + ttlMs;
        return 1;
    }

    async del(...keys: string[]): Promise<number> {
        let deleted = 0;
        for (const key of keys) {
            if (this.values.delete(key)) deleted += 1;
        }
        return deleted;
    }

    async scan(cursor: string, ...args: string[]): Promise<[string, string[]]> {
        const matchIndex = args.indexOf('MATCH');
        const countIndex = args.indexOf('COUNT');
        const pattern = matchIndex >= 0 ? args[matchIndex + 1] : '*';
        const count = countIndex >= 0 ? Number(args[countIndex + 1]) : 10;
        const start = Number(cursor);

        if (cursor === '0') {
            this.scanSnapshot = Array.from(this.values.keys())
                .filter((key) => this.getLiveEntry(key))
                .filter((key) => this.matches(pattern, key));
        }

        const keys = this.scanSnapshot.slice(start, start + count);
        const nextCursor = start + count < this.scanSnapshot.length ? String(start + count) : '0';
        return [nextCursor, keys];
    }

    has(key: string): boolean {
        return Boolean(this.getLiveEntry(key));
    }

    private getLiveEntry(key: string): RedisValue | undefined {
        const entry = this.values.get(key);
        if (!entry) return undefined;

        if (entry.expiresAt && entry.expiresAt <= Date.now()) {
            this.values.delete(key);
            return undefined;
        }

        return entry;
    }

    private matches(pattern: string, key: string): boolean {
        if (pattern === '*') return true;
        if (pattern.endsWith('*')) return key.startsWith(pattern.slice(0, -1));
        return key === pattern;
    }
}

class FailingRedis extends FakeRedis {
    async incr(): Promise<number> {
        throw new Error('redis unavailable');
    }
}

function createStore(scope = 'auth', windowMs = 60_000): RedisRateLimitStore {
    const store = new RedisRateLimitStore(scope, 'whatspoint:rate-limit');
    store.init({ windowMs } as Options);
    return store;
}

async function runLimiter(limiter: ReturnType<typeof rateLimit>): Promise<Error | undefined> {
    const req = {
        ip: '127.0.0.1',
        ips: [],
        method: 'GET',
        originalUrl: '/resource',
        app: {
            get: () => false
        },
        socket: {
            remoteAddress: '127.0.0.1'
        }
    };
    const res = {
        setHeader: vi.fn(),
        getHeader: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
    };

    return new Promise((resolve) => {
        void limiter(
            req as never,
            res as never,
            (error?: Error) => resolve(error)
        );
    });
}

describe('RedisRateLimitStore', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-11T10:00:00.000Z'));
        redisMock.client = new FakeRedis();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it('increments hits and keeps the original TTL inside the same window', async () => {
        const store = createStore('auth', 60_000);

        const first = await store.increment('ip:127.0.0.1');
        expect(first.totalHits).toBe(1);
        expect(first.resetTime?.getTime()).toBe(Date.now() + 60_000);

        vi.advanceTimersByTime(5_000);

        const second = await store.increment('ip:127.0.0.1');
        expect(second.totalHits).toBe(2);
        expect(second.resetTime?.getTime()).toBe(Date.now() + 55_000);

        const current = await store.get('ip:127.0.0.1');
        expect(current?.totalHits).toBe(2);
        expect(current?.resetTime?.getTime()).toBe(Date.now() + 55_000);
    });

    it('expires keys when the configured window has elapsed', async () => {
        const store = createStore('webhook', 1_000);

        await store.increment('meta');
        vi.advanceTimersByTime(1_001);

        expect(await store.get('meta')).toBeUndefined();
    });

    it('resets one key without touching other clients in the same scope', async () => {
        const store = createStore('otp');

        await store.increment('client-a');
        await store.increment('client-b');
        await store.resetKey('client-a');

        expect(await store.get('client-a')).toBeUndefined();
        expect((await store.get('client-b'))?.totalHits).toBe(1);
    });

    it('resets all keys in its own scope across scan pages only', async () => {
        const redis = redisMock.client as FakeRedis;
        const authStore = createStore('auth');
        const webhookStore = createStore('webhook');

        await authStore.increment('a');
        await authStore.increment('b');
        await authStore.increment('c');
        await webhookStore.increment('survivor');

        await authStore.resetAll();

        expect(redis.has('whatspoint:rate-limit:auth:a')).toBe(false);
        expect(redis.has('whatspoint:rate-limit:auth:b')).toBe(false);
        expect(redis.has('whatspoint:rate-limit:auth:c')).toBe(false);
        expect(redis.has('whatspoint:rate-limit:webhook:survivor')).toBe(true);
    });

    it('decrements hits and removes the key when it reaches zero', async () => {
        const store = createStore('external-notify');

        await store.increment('client');
        await store.decrement('client');

        expect(await store.get('client')).toBeUndefined();
    });
});

describe('RedisRateLimitStore passOnStoreError behavior', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('lets requests pass when express-rate-limit is configured with passOnStoreError=true', async () => {
        redisMock.client = new FailingRedis();
        const limiter = rateLimit({
            windowMs: 60_000,
            limit: 1,
            store: createStore('failing-pass'),
            passOnStoreError: true
        });

        await expect(runLimiter(limiter)).resolves.toBeUndefined();
    });

    it('blocks through the error pipeline when passOnStoreError=false', async () => {
        redisMock.client = new FailingRedis();
        const limiter = rateLimit({
            windowMs: 60_000,
            limit: 1,
            store: createStore('failing-block'),
            passOnStoreError: false
        });

        const error = await runLimiter(limiter);

        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toBe('redis unavailable');
    });
});
