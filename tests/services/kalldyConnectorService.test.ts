import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
    webhookConfig: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn()
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
                id: 'log_secure_link',
                webhookId: 'webhook_kalldy',
                eventType: 'employee.secure_link.requested',
                payload: {
                    eventId: 'wp_evt_secure_link',
                    event: 'employee.secure_link.requested'
                },
                status: 'SUCCESS',
                statusCode: 200,
                duration: 420,
                error: null,
                retryCount: 0,
                nextRetryAt: null,
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
                        id: 'log_secure_link',
                        webhookId: 'webhook_kalldy',
                        eventId: 'wp_evt_secure_link',
                        eventType: 'employee.secure_link.requested',
                        status: 'SUCCESS',
                        statusCode: 200,
                        durationMs: 420,
                        error: null,
                        retryCount: 0,
                        nextRetryAt: null,
                        createdAt: '2026-09-14T16:05:00.000Z'
                    },
                    recentDeliveries: [
                        {
                            id: 'log_secure_link',
                            webhookId: 'webhook_kalldy',
                            eventId: 'wp_evt_secure_link',
                            eventType: 'employee.secure_link.requested',
                            status: 'SUCCESS',
                            statusCode: 200,
                            durationMs: 420,
                            error: null,
                            retryCount: 0,
                            nextRetryAt: null,
                            createdAt: '2026-09-14T16:05:00.000Z'
                        }
                    ]
                })
            ],
            recentDeliveries: [
                {
                    id: 'log_secure_link',
                    webhookId: 'webhook_kalldy',
                    eventId: 'wp_evt_secure_link',
                    eventType: 'employee.secure_link.requested',
                    status: 'SUCCESS',
                    statusCode: 200,
                    durationMs: 420,
                    error: null,
                    retryCount: 0,
                    nextRetryAt: null,
                    createdAt: '2026-09-14T16:05:00.000Z'
                }
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

    it('exposes recent delivery metadata without leaking full webhook payloads', async () => {
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
                failureCount: 1,
                updatedAt: new Date('2026-09-14T16:00:00.000Z')
            }
        ]);
        prismaMock.webhookLog.findMany.mockResolvedValue([
            {
                id: 'log_failed',
                webhookId: 'webhook_kalldy',
                eventType: 'document.received',
                payload: {
                    eventId: 'wp_evt_document',
                    data: {
                        employeePhoneNumber: '[redacted]',
                        mediaUrl: '[redacted]'
                    }
                },
                status: 'PENDING',
                statusCode: 503,
                duration: 1500,
                error: 'HTTP 503: unavailable',
                retryCount: 1,
                nextRetryAt: new Date('2026-09-14T16:10:00.000Z'),
                createdAt: new Date('2026-09-14T16:05:00.000Z')
            }
        ]);
        prismaMock.tenant.findMany.mockResolvedValue([]);

        const { getKalldyConnectorStatus } = await import('../../src/services/kalldyConnectorService');
        const status = await getKalldyConnectorStatus();

        expect(status.recentDeliveries).toEqual([
            {
                id: 'log_failed',
                webhookId: 'webhook_kalldy',
                eventId: 'wp_evt_document',
                eventType: 'document.received',
                status: 'PENDING',
                statusCode: 503,
                durationMs: 1500,
                error: 'HTTP 503: unavailable',
                retryCount: 1,
                nextRetryAt: '2026-09-14T16:10:00.000Z',
                createdAt: '2026-09-14T16:05:00.000Z'
            }
        ]);
        expect(JSON.stringify(status)).not.toContain('+33612345678');
        expect(JSON.stringify(status)).not.toContain('mediaUrl');
    });

    it('updates only valid Kalldy v1 events for a tenant-scoped webhook', async () => {
        prismaMock.webhookConfig.findUnique.mockResolvedValue({
            id: 'webhook_kalldy',
            name: 'Kalldy POC',
            url: 'https://api.testbed.fr.paie.kalldy.com/api/webhooks/whatspoint',
            tenantId: 'tenant_fr'
        });
        prismaMock.webhookConfig.update.mockResolvedValue({
            id: 'webhook_kalldy',
            events: ['leave.approved', 'document.received'],
            updatedAt: new Date('2026-09-14T18:00:00.000Z')
        });

        const { updateKalldyWebhookEvents } = await import('../../src/services/kalldyConnectorService');
        const result = await updateKalldyWebhookEvents('webhook_kalldy', [
            'leave.approved',
            'document.received',
            'leave.approved'
        ]);

        expect(result).toEqual({
            ok: true,
            webhook: {
                id: 'webhook_kalldy',
                events: ['leave.approved', 'document.received'],
                updatedAt: '2026-09-14T18:00:00.000Z'
            }
        });
        expect(prismaMock.webhookConfig.update).toHaveBeenCalledWith({
            where: { id: 'webhook_kalldy' },
            data: { events: ['leave.approved', 'document.received'] },
            select: {
                id: true,
                events: true,
                updatedAt: true
            }
        });
    });

    it('rejects invalid events and global Kalldy webhooks', async () => {
        const { updateKalldyWebhookEvents } = await import('../../src/services/kalldyConnectorService');

        await expect(updateKalldyWebhookEvents('webhook_kalldy', ['expense.submitted']))
            .resolves.toEqual({
                ok: false,
                status: 400,
                error: 'Événements Kalldy invalides: expense.submitted'
            });

        prismaMock.webhookConfig.findUnique.mockResolvedValue({
            id: 'webhook_kalldy',
            name: 'Kalldy POC',
            url: 'https://api.testbed.fr.paie.kalldy.com/api/webhooks/whatspoint',
            tenantId: null
        });

        await expect(updateKalldyWebhookEvents('webhook_kalldy', ['leave.approved']))
            .resolves.toEqual({
                ok: false,
                status: 400,
                error: 'Le connecteur Kalldy v1 doit être rattaché à un tenant'
            });
    });
});
