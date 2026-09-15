import crypto from 'crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
    webhookConfig: {
        findMany: vi.fn()
    }
}));

vi.mock('../../src/lib/prisma', () => ({
    default: prismaMock
}));

function sign(payload: string, secret: string) {
    return `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
}

describe('POST /api/sandbox/webhooks/echo', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('ENABLE_SANDBOX_WEBHOOK_ECHO', 'true');
        vi.stubEnv('ENABLE_JOBS', 'false');
        vi.stubEnv('ENCRYPTION_KEY', '12345678901234567890123456789012');
    });

    it('accepts a WhatsPoint signed sandbox webhook without exposing the full payload', async () => {
        const secret = 'sandbox_echo_secret';
        const payload = {
            eventId: 'wp_evt_echo_001',
            event: 'employee.created',
            timestamp: new Date().toISOString(),
            tenantId: 'tenant_test',
            data: {
                employeeId: 'emp_001',
                employeePhoneNumber: '+33612345678',
                firstName: 'Camille'
            }
        };
        const payloadString = JSON.stringify(payload);

        prismaMock.webhookConfig.findMany.mockResolvedValue([
            {
                id: 'webhook_echo',
                name: 'Sandbox Partner POC',
                url: 'https://api.testbed.whatspoint.com/api/sandbox/webhooks/echo',
                tenantId: 'tenant_test',
                secret
            }
        ]);

        const { createApp } = await import('../../src/app');

        const response = await request(createApp())
            .post('/api/sandbox/webhooks/echo')
            .set('Host', 'api.testbed.whatspoint.com')
            .set('X-Forwarded-Proto', 'https')
            .set('Content-Type', 'application/json')
            .set('X-WhatsPoint-Event', payload.event)
            .set('X-WhatsPoint-Event-Id', payload.eventId)
            .set('X-WhatsPoint-Timestamp', payload.timestamp)
            .set('X-WhatsPoint-Signature', sign(payloadString, secret))
            .send(payloadString)
            .expect(200);

        expect(response.body).toEqual({
            success: true,
            receiver: 'whatspoint.sandbox.echo',
            webhookId: 'webhook_echo',
            webhookName: 'Sandbox Partner POC',
            tenantId: 'tenant_test',
            event: 'employee.created',
            eventId: 'wp_evt_echo_001',
            receivedAt: expect.any(String),
            payloadKeys: ['employeeId', 'employeePhoneNumber', 'firstName']
        });
        expect(JSON.stringify(response.body)).not.toContain('+33612345678');
        expect(prismaMock.webhookConfig.findMany).toHaveBeenCalledWith({
            where: {
                isActive: true,
                events: { has: 'employee.created' }
            },
            select: {
                id: true,
                name: true,
                url: true,
                tenantId: true,
                secret: true
            }
        });
    });

    it('rejects an invalid HMAC signature', async () => {
        const payload = {
            eventId: 'wp_evt_echo_002',
            event: 'employee.created',
            timestamp: new Date().toISOString(),
            data: { employeeId: 'emp_002' }
        };

        prismaMock.webhookConfig.findMany.mockResolvedValue([
            {
                id: 'webhook_echo',
                name: 'Sandbox Partner POC',
                url: 'https://api.testbed.whatspoint.com/api/sandbox/webhooks/echo',
                tenantId: 'tenant_test',
                secret: 'sandbox_echo_secret'
            }
        ]);

        const { createApp } = await import('../../src/app');

        const response = await request(createApp())
            .post('/api/sandbox/webhooks/echo')
            .set('Host', 'api.testbed.whatspoint.com')
            .set('X-Forwarded-Proto', 'https')
            .set('Content-Type', 'application/json')
            .set('X-WhatsPoint-Event', payload.event)
            .set('X-WhatsPoint-Event-Id', payload.eventId)
            .set('X-WhatsPoint-Timestamp', payload.timestamp)
            .set('X-WhatsPoint-Signature', 'sha256=bad')
            .send(JSON.stringify(payload))
            .expect(401);

        expect(response.body).toEqual({
            success: false,
            error: 'INVALID_WEBHOOK_SIGNATURE'
        });
    });

    it('rejects stale timestamps', async () => {
        const payload = {
            eventId: 'wp_evt_echo_003',
            event: 'employee.created',
            timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            data: { employeeId: 'emp_003' }
        };

        const { createApp } = await import('../../src/app');

        const response = await request(createApp())
            .post('/api/sandbox/webhooks/echo')
            .set('Content-Type', 'application/json')
            .set('X-WhatsPoint-Event', payload.event)
            .set('X-WhatsPoint-Event-Id', payload.eventId)
            .set('X-WhatsPoint-Timestamp', payload.timestamp)
            .set('X-WhatsPoint-Signature', 'sha256=unused')
            .send(JSON.stringify(payload))
            .expect(401);

        expect(response.body).toEqual({
            success: false,
            error: 'STALE_WEBHOOK_TIMESTAMP'
        });
    });
});
