import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
    webhookConfig: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn()
    }
}));

vi.mock('../../src/lib/prisma', () => ({
    default: prismaMock
}));

function mockResponse() {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
}

describe('webhookConfigController safe responses', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not expose persisted secrets or sensitive custom headers when listing webhooks', async () => {
        prismaMock.webhookConfig.findMany.mockResolvedValue([
            {
                id: 'webhook_1',
                name: 'Kalldy POC',
                url: 'https://kalldy.test/webhooks/whatspoint',
                secret: 'stored-hmac-secret',
                events: ['leave.approved'],
                isActive: true,
                tenantId: 'tenant_fr',
                payloadMapping: null,
                httpMethod: 'POST',
                headers: {
                    Authorization: 'Bearer partner-secret',
                    'X-API-Key': 'partner-api-key',
                    'X-Partner': 'Kalldy'
                },
                createdAt: new Date('2026-09-14T12:00:00.000Z'),
                updatedAt: new Date('2026-09-14T12:00:00.000Z'),
                lastTriggeredAt: null,
                successCount: 1,
                failureCount: 0,
                _count: { logs: 1 }
            }
        ]);

        const { getWebhooks } = await import('../../src/controllers/webhookConfigController');
        const res = mockResponse();

        await getWebhooks({ superAdmin: { id: 'superadmin_1' } } as any, res);

        expect(res.json).toHaveBeenCalledWith([
            expect.objectContaining({
                id: 'webhook_1',
                secretConfigured: true,
                headers: {
                    Authorization: '[redacted]',
                    'X-API-Key': '[redacted]',
                    'X-Partner': 'Kalldy'
                }
            })
        ]);
        expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('stored-hmac-secret');
        expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('partner-secret');
        expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('partner-api-key');
    });

    it('only returns a plaintext secret at creation time, not the persisted secret field', async () => {
        prismaMock.webhookConfig.create.mockImplementation(async ({ data }) => ({
            id: 'webhook_2',
            name: data.name,
            url: data.url,
            secret: data.secret,
            events: data.events,
            isActive: true,
            tenantId: data.tenantId,
            payloadMapping: data.payloadMapping ?? null,
            httpMethod: data.httpMethod,
            headers: data.headers ?? null,
            createdAt: new Date('2026-09-14T12:00:00.000Z'),
            updatedAt: new Date('2026-09-14T12:00:00.000Z'),
            lastTriggeredAt: null,
            successCount: 0,
            failureCount: 0
        }));

        const { createWebhook } = await import('../../src/controllers/webhookConfigController');
        const res = mockResponse();

        await createWebhook({
            superAdmin: { id: 'superadmin_1' },
            body: {
                name: 'Kalldy POC',
                url: 'https://kalldy.test/webhooks/whatspoint',
                events: ['leave.approved'],
                tenantId: 'tenant_fr',
                generateSecret: true,
                headers: { Authorization: 'Bearer partner-secret' }
            }
        } as any, res);

        const body = res.json.mock.calls[0][0];
        expect(res.status).toHaveBeenCalledWith(201);
        expect(body.secretPlaintext).toMatch(/^[a-f0-9]{64}$/);
        expect(body.secret).toBeUndefined();
        expect(body.secretConfigured).toBe(true);
        expect(body.headers).toEqual({ Authorization: '[redacted]' });
    });
});
