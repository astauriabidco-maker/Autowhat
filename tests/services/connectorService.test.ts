import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
    partnerConnector: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn()
    },
    webhookConfig: {
        create: vi.fn(),
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
        prismaMock.partnerConnector.findMany.mockResolvedValue([]);
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

        const guard = await getConnectorDispatchGuard({
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

    it('creates a dynamic partner connector and a tenant-scoped webhook with generated HMAC secret', async () => {
        prismaMock.partnerConnector.findUnique.mockResolvedValue(null);
        prismaMock.partnerConnector.create.mockResolvedValue({
            id: 'connector_acme',
            provider: 'ACME_PAYROLL',
            name: 'ACME Paie',
            displayName: 'ACME Paie',
            version: 'ACME_PAYROLL_V1',
            docsUrl: '/docs/connectors.md',
            openApiUrl: '/api/docs/public-v1.yaml',
            requiredEvents: ['employee.created'],
            searchTerms: ['acme_payroll', 'https://acme.test/webhooks/whatspoint'],
            sandboxEndpoint: 'https://acme.test/webhooks/whatspoint',
            productionEndpoint: 'https://acme.test/webhooks/whatspoint',
            requiresTenantScopedEvents: true,
            isActive: true
        });
        prismaMock.webhookConfig.create.mockResolvedValue({
            id: 'webhook_acme',
            name: 'ACME Paie POC',
            url: 'https://acme.test/webhooks/whatspoint',
            tenantId: 'tenant_fr',
            events: ['employee.created'],
            isActive: true,
            createdAt: new Date('2026-09-15T10:00:00.000Z')
        });

        const { createPartnerConnector } = await import('../../src/services/connectorService');
        const result = await createPartnerConnector({
            provider: 'acme payroll',
            displayName: 'ACME Paie',
            sandboxEndpoint: 'https://acme.test/webhooks/whatspoint',
            tenantId: 'tenant_fr',
            requiredEvents: ['employee.created']
        });

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            connector: expect.objectContaining({
                provider: 'ACME_PAYROLL',
                displayName: 'ACME Paie'
            }),
            webhook: expect.objectContaining({
                id: 'webhook_acme',
                secretPlaintext: expect.any(String)
            })
        }));
        expect(prismaMock.partnerConnector.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                provider: 'ACME_PAYROLL',
                requiredEvents: ['employee.created']
            })
        });
        expect(prismaMock.webhookConfig.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                name: 'ACME Paie POC',
                tenantId: 'tenant_fr',
                events: ['employee.created'],
                secret: expect.any(String)
            }),
            select: expect.any(Object)
        });
    });
});
