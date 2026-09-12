import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('rateLimitMiddleware', () => {
    afterEach(() => {
        vi.resetModules();
        vi.unstubAllEnvs();
    });

    it('skips rate limiting when NODE_ENV is test', async () => {
        vi.stubEnv('NODE_ENV', 'test');
        vi.stubEnv('AUTH_RATE_LIMIT_MAX', '1');

        const { authRateLimit } = await import('../../src/middlewares/rateLimitMiddleware');
        const app = express();
        app.post('/login', authRateLimit, (_req, res) => res.json({ ok: true }));

        await request(app).post('/login').expect(200);
        await request(app).post('/login').expect(200);
    });

    it('returns a scoped 429 payload after the configured auth limit', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('AUTH_RATE_LIMIT_MAX', '1');
        vi.stubEnv('AUTH_RATE_LIMIT_WINDOW_MS', '60000');

        const { authRateLimit } = await import('../../src/middlewares/rateLimitMiddleware');
        const app = express();
        app.post('/login', authRateLimit, (_req, res) => res.json({ ok: true }));

        await request(app).post('/login').expect(200);

        const response = await request(app)
            .post('/login')
            .expect(429);

        expect(response.body).toEqual({
            error: 'Too many requests',
            code: 'RATE_LIMITED',
            scope: 'auth'
        });
    });
});
