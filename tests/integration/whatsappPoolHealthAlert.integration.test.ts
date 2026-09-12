import bcrypt from 'bcryptjs';
import { afterAll, beforeEach, expect, vi } from 'vitest';
import prisma from '../../src/lib/prisma';
import {
    describeIntegration,
    disconnectTestDatabase,
    resetTestDatabase,
    seedTenantGraph
} from './helpers/db';

const emailMocks = vi.hoisted(() => ({
    sendEmail: vi.fn()
}));

const redisMocks = vi.hoisted(() => ({
    enabled: false,
    client: undefined as unknown
}));

vi.mock('../../src/services/emailService', () => emailMocks);
vi.mock('../../src/services/redisConnection', () => ({
    isRedisEnabled: () => redisMocks.enabled,
    getRedisConnection: () => redisMocks.client
}));

class FakeRedis {
    values = new Map<string, string>();

    async eval(_script: string, _keyCount: number, key: string, fingerprint: string): Promise<number> {
        if (this.values.get(key) === fingerprint) return 0;
        this.values.set(key, fingerprint);
        return 1;
    }

    async set(key: string, fingerprint: string): Promise<'OK'> {
        this.values.set(key, fingerprint);
        return 'OK';
    }

    async del(key: string): Promise<number> {
        return this.values.delete(key) ? 1 : 0;
    }
}

describeIntegration('WhatsApp pool health proactive alerts', () => {
    afterAll(disconnectTestDatabase);

    beforeEach(async () => {
        vi.clearAllMocks();
        redisMocks.enabled = false;
        redisMocks.client = new FakeRedis();
        emailMocks.sendEmail.mockResolvedValue(true);
        await resetTestDatabase();
        const { resetWhatsAppPoolHealthAlertState } = await import('../../src/services/whatsappPoolHealthAlertService');
        resetWhatsAppPoolHealthAlertState();
    });

    it('notifies superadmins once per unchanged alert fingerprint and supports forced checks', async () => {
        await prisma.superAdmin.create({
            data: {
                email: 'ops-alerts@example.test',
                password: await bcrypt.hash('ValidPass123!', 8),
                name: 'Ops Alerts'
            }
        });
        await seedTenantGraph('PoolAlertUnassigned');

        const { runWhatsAppPoolHealthAlert } = await import('../../src/services/whatsappPoolHealthAlertService');

        const first = await runWhatsAppPoolHealthAlert();
        const second = await runWhatsAppPoolHealthAlert();
        const forced = await runWhatsAppPoolHealthAlert({ force: true });

        expect(first.alertsDetected).toBeGreaterThan(0);
        expect(first.notificationsSent).toBe(1);
        expect(second.skippedReason).toBe('UNCHANGED');
        expect(second.notificationsSent).toBe(0);
        expect(forced.notificationsSent).toBe(1);
        expect(emailMocks.sendEmail).toHaveBeenCalledTimes(2);
        expect(emailMocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'ops-alerts@example.test',
            subject: expect.stringContaining('pool WhatsApp')
        }));
    });

    it('deduplicates unchanged alerts through Redis across process memory resets', async () => {
        redisMocks.enabled = true;
        redisMocks.client = new FakeRedis();
        await prisma.superAdmin.create({
            data: {
                email: 'redis-ops-alerts@example.test',
                password: await bcrypt.hash('ValidPass123!', 8),
                name: 'Redis Ops Alerts'
            }
        });
        await seedTenantGraph('PoolAlertRedis');

        const {
            resetWhatsAppPoolHealthAlertState,
            runWhatsAppPoolHealthAlert
        } = await import('../../src/services/whatsappPoolHealthAlertService');

        const first = await runWhatsAppPoolHealthAlert();
        resetWhatsAppPoolHealthAlertState();
        const second = await runWhatsAppPoolHealthAlert();

        expect(first.notificationsSent).toBe(1);
        expect(first.dedupeBackend).toBe('redis');
        expect(second.skippedReason).toBe('UNCHANGED');
        expect(second.dedupeBackend).toBe('redis');
        expect(emailMocks.sendEmail).toHaveBeenCalledTimes(1);
    });
});
