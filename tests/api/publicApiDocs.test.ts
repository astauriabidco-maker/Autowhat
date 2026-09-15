import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

describe('GET /api/docs/public-v1.yaml', () => {
    it('serves the public API OpenAPI YAML', async () => {
        vi.stubEnv('ENABLE_JOBS', 'false');
        vi.stubEnv('ENCRYPTION_KEY', '12345678901234567890123456789012');

        const { createApp } = await import('../../src/app');

        const response = await request(createApp())
            .get('/api/docs/public-v1.yaml')
            .expect(200);

        expect(response.headers['content-type']).toContain('application/yaml');
        expect(response.text).toContain('title: WhatsPoint Public API');
        expect(response.text).toContain('/api/v1/employees:');
        expect(response.text).toContain('/api/v1/attendance/summary:');
        expect(response.text).toContain('/api/v1/messages:');
        expect(response.text).toContain('/admin/tenants/{tenantId}/api-keys:');
    }, 15000);
});

describe('GET /api/docs/partners', () => {
    it('lists public partner documentation', async () => {
        vi.stubEnv('ENABLE_JOBS', 'false');
        vi.stubEnv('ENCRYPTION_KEY', '12345678901234567890123456789012');

        const { createApp } = await import('../../src/app');

        const response = await request(createApp())
            .get('/api/docs/partners')
            .expect(200);

        expect(response.body.docs).toEqual(expect.arrayContaining([
            expect.objectContaining({
                slug: 'kalldy-v1.md',
                title: 'Kalldy v1',
                url: '/api/docs/partners/kalldy-v1.md'
            }),
            expect.objectContaining({
                slug: 'kalldy-poc.md',
                title: 'Kalldy POC',
                url: '/api/docs/partners/kalldy-poc.md'
            })
        ]));
    }, 15000);

    it('serves the Kalldy v1 partner Markdown documentation', async () => {
        vi.stubEnv('ENABLE_JOBS', 'false');
        vi.stubEnv('ENCRYPTION_KEY', '12345678901234567890123456789012');

        const { createApp } = await import('../../src/app');

        const response = await request(createApp())
            .get('/api/docs/partners/kalldy-v1.md')
            .expect(200);

        expect(response.headers['content-type']).toContain('text/markdown');
        expect(response.text).toContain('Kalldy');
        expect(response.text).toContain('message.status.updated');
        expect(response.text).toContain('X-WhatsPoint-Signature');
        expect(response.text).toContain('sandbox -> production');
    }, 15000);

    it('returns 404 for unknown partner documentation', async () => {
        vi.stubEnv('ENABLE_JOBS', 'false');
        vi.stubEnv('ENCRYPTION_KEY', '12345678901234567890123456789012');

        const { createApp } = await import('../../src/app');

        await request(createApp())
            .get('/api/docs/partners/private-secrets.md')
            .expect(404);
    }, 15000);
});
