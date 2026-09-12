import { vi } from 'vitest';
import prisma from '../../src/lib/prisma';
import { createRequest } from '../../src/services/leaveService';
import {
    describeIntegration,
    disconnectTestDatabase,
    resetTestDatabase,
    seedTenantGraph
} from './helpers/db';

const kpaieServiceMocks = vi.hoisted(() => ({
    getKPaieBalances: vi.fn()
}));

const webhookServiceMocks = vi.hoisted(() => ({
    dispatchWebhook: vi.fn(),
    WEBHOOK_EVENTS: {
        LEAVE_REQUESTED: 'leave.requested',
        LEAVE_APPROVED: 'leave.approved',
        LEAVE_REJECTED: 'leave.rejected'
    }
}));

vi.mock('../../src/services/kpaieService', () => kpaieServiceMocks);
vi.mock('../../src/services/webhookService', () => webhookServiceMocks);

describeIntegration('leave service safeguards', () => {
    afterAll(disconnectTestDatabase);

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        kpaieServiceMocks.getKPaieBalances.mockResolvedValue({ success: false, error: 'NO_CONFIG' });
        await resetTestDatabase();
    });

    it('does not create an orphan leave request when the tenant has no manager', async () => {
        const seeded = await seedTenantGraph('LeaveNoManager');
        await prisma.employee.delete({ where: { id: seeded.manager.id } });

        const result = await createRequest(
            { ...seeded.employee, tenant: { name: seeded.tenant.name } },
            '25/12/2026'
        );

        const count = await prisma.leaveRequest.count({
            where: { tenantId: seeded.tenant.id }
        });

        expect(result.success).toBe(false);
        expect(result.message).toContain('Aucun manager');
        expect(count).toBe(0);
        expect(webhookServiceMocks.dispatchWebhook).not.toHaveBeenCalled();
        expect(kpaieServiceMocks.getKPaieBalances).not.toHaveBeenCalled();
    });

    it('keeps KPaie insufficient balance as a manager warning by default', async () => {
        const seeded = await seedTenantGraph('LeaveKPaieWarning');
        kpaieServiceMocks.getKPaieBalances.mockResolvedValue({
            success: true,
            data: {
                paid_leave: 0,
                rtt: 0,
                seniority_leave: 0,
                last_update: '2026-09-12T00:00:00.000Z'
            }
        });

        const result = await createRequest(
            { ...seeded.employee, tenant: { name: seeded.tenant.name } },
            '25/12/2026'
        );

        const request = await prisma.leaveRequest.findFirstOrThrow({
            where: { tenantId: seeded.tenant.id, employeeId: seeded.employee.id }
        });

        expect(result.success).toBe(true);
        expect(result.request?.id).toBe(request.id);
        expect(result.kpaiePreCheckContext).toContain('Alerte KPaie');
        expect(result.managerPhoneNumber).toBe(seeded.manager.phoneNumber);
        expect(webhookServiceMocks.dispatchWebhook).toHaveBeenCalledWith(
            'leave.requested',
            expect.objectContaining({
                leaveRequestId: request.id,
                employeeId: seeded.employee.id,
                status: 'PENDING'
            }),
            seeded.tenant.id
        );
    });

    it('blocks insufficient KPaie balance only when strict leave checks are enabled', async () => {
        vi.stubEnv('ENABLE_KPAIE_STRICT_LEAVE_CHECK', 'true');
        const seeded = await seedTenantGraph('LeaveKPaieStrict');
        kpaieServiceMocks.getKPaieBalances.mockResolvedValue({
            success: true,
            data: {
                paid_leave: 0,
                rtt: 0,
                seniority_leave: 0,
                last_update: '2026-09-12T00:00:00.000Z'
            }
        });

        const result = await createRequest(
            { ...seeded.employee, tenant: { name: seeded.tenant.name } },
            '25/12/2026'
        );

        const count = await prisma.leaveRequest.count({
            where: { tenantId: seeded.tenant.id }
        });

        expect(result.success).toBe(false);
        expect(result.message).toContain('Refusé par la Paie');
        expect(count).toBe(0);
        expect(webhookServiceMocks.dispatchWebhook).not.toHaveBeenCalled();
    });
});
