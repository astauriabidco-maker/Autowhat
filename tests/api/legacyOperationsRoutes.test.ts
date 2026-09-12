import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

let app: ReturnType<(typeof import('../../src/app'))['createApp']>;

describe('legacy operations route boundary', () => {
    beforeAll(async () => {
        vi.stubEnv('ENCRYPTION_KEY', '12345678901234567890123456789012');
        vi.stubEnv('ENABLE_JOBS', 'false');
        vi.stubEnv('SERVE_FRONTEND', 'false');
        const { createApp } = await import('../../src/app');
        app = createApp();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.stubEnv('ENCRYPTION_KEY', '12345678901234567890123456789012');
        vi.stubEnv('ENABLE_JOBS', 'false');
        vi.stubEnv('SERVE_FRONTEND', 'false');
    });

    it.each([
        ['GET', '/api/customers'],
        ['GET', '/api/interventions'],
        ['POST', '/api/operations/daily-briefing'],
        ['GET', '/api/quotes/some-id/pdf'],
        ['GET', '/api/parts'],
        ['GET', '/api/recurring-interventions'],
        ['GET', '/api/intervention-requests'],
        ['GET', '/api/public/intervention/fake-token'],
    ])('blocks %s %s in production when legacy operations are disabled', async (method, path) => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('ENABLE_LEGACY_OPERATIONS', 'false');

        const response = await request(app)[method.toLowerCase() as 'get' | 'post'](path).expect(404);

        expect(response.body).toEqual({
            error: 'Legacy operations module is disabled',
            code: 'LEGACY_OPERATIONS_DISABLED'
        });
    });

    it('lets protected legacy routes reach auth when explicitly enabled', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('ENABLE_LEGACY_OPERATIONS', 'true');

        const response = await request(app)
            .get('/api/customers')
            .expect(response => {
                expect(response.status).not.toBe(404);
            });

        expect(response.body.code).not.toBe('LEGACY_OPERATIONS_DISABLED');
    });

    it('keeps core routes outside the legacy boundary', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('ENABLE_LEGACY_OPERATIONS', 'false');

        await request(app).get('/api/health').expect(200);

        const attendanceResponse = await request(app)
            .get('/api/attendance')
            .expect(response => {
                expect(response.status).not.toBe(404);
            });

        expect(attendanceResponse.body.code).not.toBe('LEGACY_OPERATIONS_DISABLED');
    });
});

