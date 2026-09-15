import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
    webhookConfig: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn()
    },
    webhookLog: {
        create: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn()
    }
}));

vi.mock('../../src/lib/prisma', () => ({
    default: prismaMock
}));

describe('webhookService outgoing contract', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('fetch', fetchMock);
        fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));
        prismaMock.webhookConfig.update.mockResolvedValue({});
        prismaMock.webhookLog.create.mockResolvedValue({});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('sends leave webhooks with a stable event id and WhatsPoint signature headers', async () => {
        prismaMock.webhookConfig.findMany.mockResolvedValue([
            {
                id: 'webhook_kalldy',
                name: 'Kalldy POC',
                url: 'https://kalldy.test/webhooks/whatspoint',
                secret: 'kalldy-secret',
                events: ['leave.approved'],
                isActive: true,
                tenantId: 'tenant_fr',
                headers: {
                    'X-Partner': 'Kalldy',
                    'X-WhatsPoint-Signature': 'sha256=bad-custom-signature'
                },
                httpMethod: 'POST',
                payloadMapping: null
            }
        ]);

        const { WEBHOOK_EVENTS, dispatchWebhook } = await import('../../src/services/webhookService');
        const leavePayload = {
            status: 'APPROVED',
            businessDays: 6,
            leaveRequestId: 'leave_123',
            startDate: new Date('2026-06-10T00:00:00.000Z'),
            endDate: new Date('2026-06-17T00:00:00.000Z')
        };

        await dispatchWebhook(WEBHOOK_EVENTS.LEAVE_APPROVED, leavePayload, 'tenant_fr');

        expect(fetchMock).toHaveBeenCalledWith(
            'https://kalldy.test/webhooks/whatspoint',
            expect.objectContaining({ method: 'POST' })
        );

        const [, request] = fetchMock.mock.calls[0];
        const body = JSON.parse(request.body);
        const expectedSignature = `sha256=${crypto
            .createHmac('sha256', 'kalldy-secret')
            .update(request.body)
            .digest('hex')}`;

        expect(body).toEqual(expect.objectContaining({
            eventId: expect.stringMatching(/^wp_evt_[a-f0-9]{32}$/),
            event: 'leave.approved',
            tenantId: 'tenant_fr',
            data: expect.objectContaining({
                leaveRequestId: 'leave_123',
                status: 'APPROVED'
            })
        }));
        expect(request.headers).toEqual(expect.objectContaining({
            'X-Partner': 'Kalldy',
            'X-WhatsPoint-Event': 'leave.approved',
            'X-WhatsPoint-Event-Id': body.eventId,
            'X-WhatsPoint-Timestamp': body.timestamp,
            'X-WhatsPoint-Signature': expectedSignature,
            'X-Webhook-Event': 'leave.approved',
            'X-Webhook-Event-Id': body.eventId,
            'X-Webhook-Signature': expectedSignature
        }));

        await dispatchWebhook(WEBHOOK_EVENTS.LEAVE_APPROVED, {
            endDate: new Date('2026-06-17T00:00:00.000Z'),
            leaveRequestId: 'leave_123',
            businessDays: 6,
            status: 'APPROVED',
            startDate: new Date('2026-06-10T00:00:00.000Z')
        }, 'tenant_fr');

        const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
        expect(secondBody.eventId).toBe(body.eventId);
    });

    it('can send a strict leave.approved payload from the webhook test endpoint path', async () => {
        prismaMock.webhookConfig.findUnique.mockResolvedValue({
            id: 'webhook_kalldy',
            name: 'Kalldy POC',
            url: 'https://kalldy.test/webhooks/whatspoint',
            secret: 'kalldy-secret',
            events: ['leave.approved'],
            isActive: true,
            tenantId: 'tenant_fr',
            headers: null,
            httpMethod: 'POST',
            payloadMapping: null
        });

        const { WEBHOOK_EVENTS, testWebhook } = await import('../../src/services/webhookService');

        const result = await testWebhook('webhook_kalldy', {
            eventType: WEBHOOK_EVENTS.LEAVE_APPROVED
        });

        expect(result).toEqual({ success: true, statusCode: 200 });
        expect(fetchMock).toHaveBeenCalledWith(
            'https://kalldy.test/webhooks/whatspoint',
            expect.objectContaining({ method: 'POST' })
        );

        const [, request] = fetchMock.mock.calls[0];
        const body = JSON.parse(request.body);
        const expectedSignature = `sha256=${crypto
            .createHmac('sha256', 'kalldy-secret')
            .update(request.body)
            .digest('hex')}`;

        expect(body).toEqual(expect.objectContaining({
            eventId: expect.stringMatching(/^wp_evt_[a-f0-9]{32}$/),
            event: 'leave.approved',
            tenantId: 'tenant_fr',
            data: {
                leaveRequestId: 'leave_poc_001',
                employeePhoneNumber: '+33612345678',
                startDate: '2026-06-10',
                endDate: '2026-06-17',
                businessDays: 6,
                status: 'APPROVED'
            }
        }));
        expect(request.headers).toEqual(expect.objectContaining({
            'X-WhatsPoint-Event': 'leave.approved',
            'X-WhatsPoint-Event-Id': body.eventId,
            'X-WhatsPoint-Timestamp': body.timestamp,
            'X-WhatsPoint-Signature': expectedSignature
        }));
        expect(prismaMock.webhookConfig.update).toHaveBeenCalledWith({
            where: { id: 'webhook_kalldy' },
            data: {
                lastTriggeredAt: expect.any(Date),
                successCount: { increment: 1 }
            }
        });
        expect(prismaMock.webhookLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                webhookId: 'webhook_kalldy',
                eventType: 'leave.approved',
                status: 'SUCCESS',
                statusCode: 200,
                responseBody: 'ok',
                error: null,
                retryCount: 0,
                nextRetryAt: null,
                payload: expect.objectContaining({
                    eventId: body.eventId,
                    event: 'leave.approved',
                    tenantId: 'tenant_fr',
                    data: expect.objectContaining({
                        employeePhoneNumber: '[redacted]',
                        startDate: '2026-06-10',
                        endDate: '2026-06-17',
                        status: 'APPROVED'
                    })
                })
            })
        });
    });

    it('records failed controlled webhook tests without enqueueing retries', async () => {
        fetchMock.mockResolvedValue(new Response('temporary failure', { status: 503 }));
        prismaMock.webhookConfig.findUnique.mockResolvedValue({
            id: 'webhook_kalldy',
            name: 'Kalldy POC',
            url: 'https://kalldy.test/webhooks/whatspoint',
            secret: 'kalldy-secret',
            events: ['leave.approved'],
            isActive: true,
            tenantId: 'tenant_fr',
            headers: null,
            httpMethod: 'POST',
            payloadMapping: null
        });

        const { WEBHOOK_EVENTS, testWebhook } = await import('../../src/services/webhookService');

        const result = await testWebhook('webhook_kalldy', {
            eventType: WEBHOOK_EVENTS.LEAVE_APPROVED
        });

        expect(result).toEqual({
            success: false,
            error: 'HTTP 503: temporary failure',
            statusCode: 503
        });
        expect(prismaMock.webhookConfig.update).toHaveBeenCalledWith({
            where: { id: 'webhook_kalldy' },
            data: {
                lastTriggeredAt: expect.any(Date),
                failureCount: { increment: 1 }
            }
        });
        expect(prismaMock.webhookLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                webhookId: 'webhook_kalldy',
                eventType: 'leave.approved',
                status: 'FAILED',
                statusCode: 503,
                responseBody: 'temporary failure',
                error: 'HTTP 503: temporary failure',
                retryCount: 0,
                nextRetryAt: null
            })
        });
    });

    it('can send a strict document.received payload from the webhook test endpoint path', async () => {
        prismaMock.webhookConfig.findUnique.mockResolvedValue({
            id: 'webhook_kalldy',
            name: 'Kalldy POC',
            url: 'https://kalldy.test/webhooks/whatspoint',
            secret: 'kalldy-secret',
            events: ['document.received'],
            isActive: true,
            tenantId: 'tenant_fr',
            headers: null,
            httpMethod: 'POST',
            payloadMapping: null
        });

        const { WEBHOOK_EVENTS, testWebhook } = await import('../../src/services/webhookService');

        const result = await testWebhook('webhook_kalldy', {
            eventType: WEBHOOK_EVENTS.DOCUMENT_RECEIVED
        });

        expect(result).toEqual({ success: true, statusCode: 200 });

        const [, request] = fetchMock.mock.calls[0];
        const body = JSON.parse(request.body);
        const expectedSignature = `sha256=${crypto
            .createHmac('sha256', 'kalldy-secret')
            .update(request.body)
            .digest('hex')}`;

        expect(body).toEqual(expect.objectContaining({
            eventId: expect.stringMatching(/^wp_evt_[a-f0-9]{32}$/),
            event: 'document.received',
            tenantId: 'tenant_fr',
            data: expect.objectContaining({
                documentId: 'doc_poc_001',
                employeePhoneNumber: '+33612345678',
                documentType: 'absence_justification',
                fileName: 'justificatif-absence-poc.pdf',
                mimeType: 'application/pdf',
                mediaId: 'media_poc_001'
            })
        }));
        expect(body.data.mediaUrl).toContain('https://api.testbed.whatspoint.com/api/files/signed/');
        expect(new Date(body.data.mediaUrlExpiresAt).getTime()).toBeGreaterThan(Date.now());
        expect(request.headers).toEqual(expect.objectContaining({
            'X-WhatsPoint-Event': 'document.received',
            'X-WhatsPoint-Event-Id': body.eventId,
            'X-WhatsPoint-Timestamp': body.timestamp,
            'X-WhatsPoint-Signature': expectedSignature
        }));
    });

    it('can send a strict employee.secure_link.requested payload without sensitive WhatsApp data', async () => {
        prismaMock.webhookConfig.findUnique.mockResolvedValue({
            id: 'webhook_kalldy',
            name: 'Kalldy POC',
            url: 'https://kalldy.test/webhooks/whatspoint',
            secret: 'kalldy-secret',
            events: ['employee.secure_link.requested'],
            isActive: true,
            tenantId: 'tenant_fr',
            headers: null,
            httpMethod: 'POST',
            payloadMapping: null
        });

        const { WEBHOOK_EVENTS, testWebhook } = await import('../../src/services/webhookService');

        const result = await testWebhook('webhook_kalldy', {
            eventType: WEBHOOK_EVENTS.EMPLOYEE_SECURE_LINK_REQUESTED
        });

        expect(result).toEqual({ success: true, statusCode: 200 });

        const [, request] = fetchMock.mock.calls[0];
        const body = JSON.parse(request.body);
        const expectedSignature = `sha256=${crypto
            .createHmac('sha256', 'kalldy-secret')
            .update(request.body)
            .digest('hex')}`;

        expect(body).toEqual(expect.objectContaining({
            eventId: expect.stringMatching(/^wp_evt_[a-f0-9]{32}$/),
            event: 'employee.secure_link.requested',
            tenantId: 'tenant_fr',
            data: expect.objectContaining({
                employeeRef: 'emp_poc_001',
                employeePhoneNumber: '+33612345678',
                purpose: 'PROFILE_UPDATE',
                deliveryChannel: 'whatsapp',
                sensitiveDataInWhatsApp: false
            })
        }));
        expect(body.data.secureLink).toContain('https://testbed.fr.paie.kalldy.com/pwa/secure-intake/');
        expect(new Date(body.data.secureLinkExpiresAt).getTime()).toBeGreaterThan(Date.now());
        expect(JSON.stringify(body.data)).not.toMatch(/rib|nir|bulletin|identity|piece d'identite/i);
        expect(request.headers).toEqual(expect.objectContaining({
            'X-WhatsPoint-Event': 'employee.secure_link.requested',
            'X-WhatsPoint-Event-Id': body.eventId,
            'X-WhatsPoint-Timestamp': body.timestamp,
            'X-WhatsPoint-Signature': expectedSignature
        }));
    });

    it('redacts sensitive payload fields in successful webhook logs', async () => {
        prismaMock.webhookConfig.findMany.mockResolvedValue([
            {
                id: 'webhook_kalldy',
                name: 'Kalldy POC',
                url: 'https://kalldy.test/webhooks/whatspoint',
                secret: 'kalldy-secret',
                events: ['employee.secure_link.requested'],
                isActive: true,
                tenantId: 'tenant_fr',
                headers: null,
                httpMethod: 'POST',
                payloadMapping: null
            }
        ]);

        const { WEBHOOK_EVENTS, dispatchWebhook } = await import('../../src/services/webhookService');

        await dispatchWebhook(WEBHOOK_EVENTS.EMPLOYEE_SECURE_LINK_REQUESTED, {
            employeePhoneNumber: '+33612345678',
            employeeName: 'Camille Martin',
            secureLink: 'https://kalldy.test/pwa/token-secret',
            secureLinkExpiresAt: '2026-06-17T12:00:00.000Z',
            purpose: 'PROFILE_UPDATE',
            sensitiveDataInWhatsApp: false
        }, 'tenant_fr');

        expect(prismaMock.webhookLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                status: 'SUCCESS',
                payload: expect.objectContaining({
                    eventId: expect.stringMatching(/^wp_evt_[a-f0-9]{32}$/),
                    data: expect.objectContaining({
                        employeePhoneNumber: '[redacted]',
                        employeeName: '[redacted]',
                        secureLink: '[redacted]',
                        secureLinkExpiresAt: '[redacted]',
                        purpose: 'PROFILE_UPDATE',
                        sensitiveDataInWhatsApp: false
                    })
                })
            })
        });
    });

    it('does not deliver Kalldy v1 tenant events through a global webhook', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        prismaMock.webhookConfig.findMany.mockResolvedValue([
            {
                id: 'webhook_kalldy_global',
                name: 'Kalldy Global',
                url: 'https://kalldy.test/webhooks/whatspoint',
                secret: 'kalldy-secret',
                events: ['leave.approved'],
                isActive: true,
                tenantId: null,
                headers: null,
                httpMethod: 'POST',
                payloadMapping: null
            }
        ]);

        const { WEBHOOK_EVENTS, dispatchWebhook } = await import('../../src/services/webhookService');

        await dispatchWebhook(WEBHOOK_EVENTS.LEAVE_APPROVED, {
            leaveRequestId: 'leave_123',
            status: 'APPROVED'
        }, 'tenant_fr');

        expect(fetchMock).not.toHaveBeenCalled();
        expect(prismaMock.webhookLog.create).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith(
            'Connector webhook skipped because it is not tenant-scoped for this event',
            expect.objectContaining({
                provider: 'KALLDY',
                reason: 'TENANT_SCOPED_EVENT_REQUIRES_TENANT_WEBHOOK',
                webhookId: 'webhook_kalldy_global',
                eventType: 'leave.approved',
                hasTenantId: true,
                webhookTenantId: null
            })
        );
        warnSpy.mockRestore();
    });

    it('keeps non-Kalldy global webhooks working for tenant events', async () => {
        prismaMock.webhookConfig.findMany.mockResolvedValue([
            {
                id: 'webhook_generic_global',
                name: 'Generic Payroll',
                url: 'https://payroll.test/webhooks/whatspoint',
                secret: 'payroll-secret',
                events: ['leave.approved'],
                isActive: true,
                tenantId: null,
                headers: null,
                httpMethod: 'POST',
                payloadMapping: null
            }
        ]);

        const { WEBHOOK_EVENTS, dispatchWebhook } = await import('../../src/services/webhookService');

        await dispatchWebhook(WEBHOOK_EVENTS.LEAVE_APPROVED, {
            leaveRequestId: 'leave_123',
            status: 'APPROVED'
        }, 'tenant_fr');

        expect(fetchMock).toHaveBeenCalledWith(
            'https://payroll.test/webhooks/whatspoint',
            expect.objectContaining({ method: 'POST' })
        );
    });

    it('keeps the exact payload only while a webhook retry is pending', async () => {
        fetchMock.mockResolvedValue(new Response('temporary failure for +33612345678 at https://kalldy.test/private-token', { status: 503 }));
        prismaMock.webhookConfig.findMany.mockResolvedValue([
            {
                id: 'webhook_kalldy',
                name: 'Kalldy POC',
                url: 'https://kalldy.test/webhooks/whatspoint',
                secret: 'kalldy-secret',
                events: ['document.received'],
                isActive: true,
                tenantId: 'tenant_fr',
                headers: null,
                httpMethod: 'POST',
                payloadMapping: null
            }
        ]);

        const { WEBHOOK_EVENTS, dispatchWebhook } = await import('../../src/services/webhookService');

        await dispatchWebhook(WEBHOOK_EVENTS.DOCUMENT_RECEIVED, {
            employeePhoneNumber: '+33612345678',
            mediaUrl: 'https://api.testbed.whatspoint.com/api/files/signed/private-token',
            documentType: 'absence_justification'
        }, 'tenant_fr');

        expect(prismaMock.webhookLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                status: 'PENDING',
                error: expect.stringContaining('[redacted_phone]'),
                responseBody: expect.stringContaining('[redacted_url]'),
                payload: expect.objectContaining({
                    data: expect.objectContaining({
                        employeePhoneNumber: '+33612345678',
                        mediaUrl: 'https://api.testbed.whatspoint.com/api/files/signed/private-token'
                    })
                })
            })
        });
    });
});
