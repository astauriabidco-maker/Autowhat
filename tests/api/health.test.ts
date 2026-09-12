import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

describe('GET /api/health', () => {
    it('returns the API health payload without starting jobs or a listener', async () => {
        vi.stubEnv('ENABLE_JOBS', 'false');
        vi.stubEnv('ENCRYPTION_KEY', '12345678901234567890123456789012');

        const { createApp } = await import('../../src/app');

        const response = await request(createApp())
            .get('/api/health')
            .expect(200);

        expect(response.body).toEqual(expect.objectContaining({
            status: 'online',
            message: 'WhatsPoint API is running',
            timestamp: expect.any(String),
            uptimeSeconds: expect.any(Number),
            environment: expect.any(String),
            redis: expect.objectContaining({
                enabled: false,
                connected: false,
                status: 'not_initialized'
            })
        }));
    }, 15000);
});
