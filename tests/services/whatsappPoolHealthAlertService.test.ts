import { beforeEach, describe, expect, it, vi } from 'vitest';

const emailMock = vi.hoisted(() => ({
    sendEmail: vi.fn()
}));

const numberHealthMock = vi.hoisted(() => ({
    getSystemNumberPoolHealth: vi.fn()
}));

const prismaMock = vi.hoisted(() => ({
    superAdmin: {
        findMany: vi.fn()
    }
}));

const redisMock = vi.hoisted(() => ({
    enabled: false,
    client: {
        del: vi.fn()
    }
}));

vi.mock('../../src/services/emailService', () => emailMock);
vi.mock('../../src/services/numberAllocationService', () => numberHealthMock);
vi.mock('../../src/lib/prisma', () => ({
    default: prismaMock
}));
vi.mock('../../src/services/redisConnection', () => ({
    isRedisEnabled: () => redisMock.enabled,
    getRedisConnection: () => redisMock.client
}));

const unhealthyPool = {
    summary: {
        totalAlerts: 1,
        criticalAlerts: 1,
        warningAlerts: 0
    },
    alerts: [
        {
            id: 'missing-capacity:FR:PRO',
            severity: 'critical',
            kind: 'missing_capacity',
            message: 'Aucun numero WhatsApp disponible pour FR / PRO.',
            countryCode: 'FR',
            planScope: 'PRO'
        }
    ]
};

describe('whatsappPoolHealthAlertService', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        redisMock.enabled = false;
        prismaMock.superAdmin.findMany.mockResolvedValue([
            { email: 'ops@example.test' }
        ]);
        numberHealthMock.getSystemNumberPoolHealth.mockResolvedValue(unhealthyPool);
        emailMock.sendEmail.mockResolvedValue(true);

        const { resetWhatsAppPoolHealthAlertState } = await import('../../src/services/whatsappPoolHealthAlertService');
        resetWhatsAppPoolHealthAlertState();
    });

    it('retries unchanged alerts when every email delivery failed', async () => {
        emailMock.sendEmail.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

        const { runWhatsAppPoolHealthAlert } = await import('../../src/services/whatsappPoolHealthAlertService');

        const first = await runWhatsAppPoolHealthAlert();
        const retry = await runWhatsAppPoolHealthAlert();

        expect(first).toEqual(expect.objectContaining({
            success: false,
            notificationsSent: 0,
            skippedReason: 'EMAIL_SEND_FAILED'
        }));
        expect(retry).toEqual(expect.objectContaining({
            success: true,
            notificationsSent: 1
        }));
        expect(emailMock.sendEmail).toHaveBeenCalledTimes(2);
    });

    it('does not deduplicate alerts when no recipient was available', async () => {
        prismaMock.superAdmin.findMany
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ email: 'ops@example.test' }]);

        const { runWhatsAppPoolHealthAlert } = await import('../../src/services/whatsappPoolHealthAlertService');

        const first = await runWhatsAppPoolHealthAlert();
        const retry = await runWhatsAppPoolHealthAlert();

        expect(first).toEqual(expect.objectContaining({
            success: true,
            notificationsSent: 0,
            skippedReason: 'NO_RECIPIENTS'
        }));
        expect(retry).toEqual(expect.objectContaining({
            success: true,
            notificationsSent: 1
        }));
        expect(emailMock.sendEmail).toHaveBeenCalledTimes(1);
    });
});
