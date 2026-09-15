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

describe('connectorService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns all registered connectors without requiring frontend-specific panels', async () => {
        prismaMock.webhookConfig.findMany
            .mockResolvedValueOnce([
                {
                    id: 'webhook_kalldy',
                    name: 'Kalldy POC',
                    url: 'https://api.testbed.fr.paie.kalldy.com/api/webhooks/whatspoint',
                    tenantId: 'tenant_fr',
                    events: ['leave.approved', 'document.received', 'employee.secure_link.requested'],
                    isActive: true,
                    lastTriggeredAt: null,
                    successCount: 1,
                    failureCount: 0,
                    updatedAt: new Date('2026-09-15T08:00:00.000Z')
                }
            ])
            .mockResolvedValueOnce([
                {
                    id: 'webhook_sandbox_partner',
                    name: 'Sandbox Partner POC',
                    url: 'https://sandbox.partner.invalid/webhooks/whatspoint',
                    tenantId: 'tenant_fr',
                    events: ['employee.created', 'message.status.updated'],
                    isActive: true,
                    lastTriggeredAt: null,
                    successCount: 0,
                    failureCount: 0,
                    updatedAt: new Date('2026-09-15T08:00:00.000Z')
                }
            ]);
        prismaMock.webhookLog.findMany.mockResolvedValue([]);
        prismaMock.tenant.findMany.mockResolvedValue([
            {
                id: 'tenant_fr',
                name: 'Tenant Pilote',
                country: 'FR',
                plan: 'PRO',
                status: 'ACTIVE'
            }
        ]);

        const { getConnectorsStatus } = await import('../../src/services/connectorService');

        const connectors = await getConnectorsStatus();

        expect(connectors).toEqual([
            expect.objectContaining({
                provider: 'KALLDY',
                displayName: 'Kalldy Paie',
                state: 'configured',
                webhooks: [expect.objectContaining({ id: 'webhook_kalldy' })]
            }),
            expect.objectContaining({
                provider: 'SANDBOX_PARTNER',
                displayName: 'Partenaire Sandbox',
                state: 'configured',
                webhooks: [expect.objectContaining({ id: 'webhook_sandbox_partner' })]
            })
        ]);
        expect(JSON.stringify(connectors)).not.toContain('"ok"');
    });

    it('applies the same tenant-scoped dispatch guard to the sandbox partner', async () => {
        const { getConnectorDispatchGuard } = await import('../../src/services/connectorService');

        const guard = getConnectorDispatchGuard({
            id: 'webhook_sandbox_global',
            name: 'Sandbox Partner Global',
            url: 'https://sandbox.partner.invalid/webhooks/whatspoint',
            tenantId: null
        }, 'employee.created', 'tenant_fr');

        expect(guard).toEqual({
            allowed: false,
            provider: 'SANDBOX_PARTNER',
            reason: 'TENANT_SCOPED_EVENT_REQUIRES_TENANT_WEBHOOK'
        });
    });
});
