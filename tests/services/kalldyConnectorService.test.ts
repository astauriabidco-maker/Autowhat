import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
    webhookConfig: {
        findMany: vi.fn()
    },
    webhookLog: {
        findMany: vi.fn()
    },
    tenant: {
        findMany: vi.fn()
    }
}));

vi.mock('../../src/lib/prisma', () => ({
    default: prismaMock
}));

describe('kalldyConnectorService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reports a healthy Kalldy v1 connector from active webhooks and successful logs', async () => {
        prismaMock.webhookConfig.findMany.mockResolvedValue([
            {
                id: 'webhook_kalldy',
                name: 'Kalldy POC',
                url: 'https://api.testbed.fr.paie.kalldy.com/api/webhooks/whatspoint',
                tenantId: 'tenant_fr',
                events: ['leave.approved', 'document.received', 'employee.secure_link.requested'],
                isActive: true,
                lastTriggeredAt: new Date('2026-09-14T16:00:00.000Z'),
                successCount: 3,
                failureCount: 0,
                updatedAt: new Date('2026-09-14T16:00:00.000Z')
            }
        ]);
        prismaMock.webhookLog.findMany.mockResolvedValue([
            {
                webhookId: 'webhook_kalldy',
                eventType: 'employee.secure_link.requested',
                status: 'SUCCESS',
                statusCode: 200,
                duration: 420,
                error: null,
                createdAt: new Date('2026-09-14T16:05:00.000Z')
            }
        ]);
        prismaMock.tenant.findMany.mockResolvedValue([
            {
                id: 'tenant_fr',
                name: 'Tenant Pilote',
                country: 'FR',
                plan: 'PRO',
                status: 'ACTIVE'
            }
        ]);

        const { getKalldyConnectorStatus } = await import('../../src/services/kalldyConnectorService');

        await expect(getKalldyConnectorStatus()).resolves.toEqual({
            provider: 'KALLDY',
            version: 'KALLDY_V1',
            requiredEvents: ['leave.approved', 'document.received', 'employee.secure_link.requested'],
            endpoints: {
                sandbox: 'https://api.testbed.fr.paie.kalldy.com/api/webhooks/whatspoint',
                production: 'https://api.fr.paie.kalldy.com/api/webhooks/whatspoint'
            },
            state: 'healthy',
            totals: {
                webhooks: 1,
                activeWebhooks: 1,
                successes: 3,
                failures: 0
            },
            webhooks: [
                expect.objectContaining({
                    id: 'webhook_kalldy',
                    environment: 'sandbox',
                    tenant: {
                        id: 'tenant_fr',
                        name: 'Tenant Pilote',
                        country: 'FR',
                        plan: 'PRO',
                        status: 'ACTIVE'
                    },
                    missingEvents: [],
                    latestDelivery: {
                        eventType: 'employee.secure_link.requested',
                        status: 'SUCCESS',
                        statusCode: 200,
                        durationMs: 420,
                        error: null,
                        createdAt: '2026-09-14T16:05:00.000Z'
                    }
                })
            ]
        });
    });

    it('reports partial when the active Kalldy webhook misses required POC events', async () => {
        prismaMock.webhookConfig.findMany.mockResolvedValue([
            {
                id: 'webhook_kalldy',
                name: 'Kalldy POC',
                url: 'https://api.testbed.fr.paie.kalldy.com/api/webhooks/whatspoint',
                tenantId: 'tenant_fr',
                events: ['leave.approved'],
                isActive: true,
                lastTriggeredAt: null,
                successCount: 0,
                failureCount: 0,
                updatedAt: new Date('2026-09-14T16:00:00.000Z')
            }
        ]);
        prismaMock.webhookLog.findMany.mockResolvedValue([]);
        prismaMock.tenant.findMany.mockResolvedValue([]);

        const { getKalldyConnectorStatus } = await import('../../src/services/kalldyConnectorService');
        const status = await getKalldyConnectorStatus();

        expect(status.state).toBe('partial');
        expect(status.webhooks[0].missingEvents).toEqual([
            'document.received',
            'employee.secure_link.requested'
        ]);
    });
});
