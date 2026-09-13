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
