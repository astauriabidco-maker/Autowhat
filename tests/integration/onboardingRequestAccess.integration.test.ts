import request from 'supertest';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import prisma from '../../src/lib/prisma';
import {
    describeIntegration,
    disconnectTestDatabase,
    resetTestDatabase
} from './helpers/db';

const whatsappServiceMocks = vi.hoisted(() => ({
    registerWebhookChannelCredentials: vi.fn(),
    sendMessage: vi.fn(),
    sendInteractiveList: vi.fn(),
    sendInteractiveButtons: vi.fn(),
    sendDocument: vi.fn(),
    sendTemplateMessage: vi.fn(),
    sendRawTemplateMessage: vi.fn(async () => ({ success: true }))
}));

vi.mock('../../src/services/whatsappService', () => whatsappServiceMocks);

describeIntegration('onboarding request access integration', () => {
    afterAll(disconnectTestDatabase);

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.stubEnv('LOG_HASH_SECRET', 'test-onboarding-log-hash-secret');
        vi.stubEnv('WHATSAPP_TOKEN', 'test-whatsapp-token');
        vi.stubEnv('WHATSAPP_PHONE_ID', 'test-phone-id');
        vi.stubEnv('ONBOARDING_ALLOWED_COUNTRIES', 'FR,BE');
        vi.stubEnv('ONBOARDING_BLOCKED_COUNTRIES', '');
        vi.stubEnv('ONBOARDING_BLOCKED_PHONE_PREFIXES', '');
        vi.stubEnv('ONBOARDING_PHONE_COOLDOWN_HOURS', '24');
        vi.stubEnv('ONBOARDING_PHONE_DAILY_LIMIT', '3');
        vi.stubEnv('ONBOARDING_IP_HOURLY_LIMIT', '5');
        vi.stubEnv('ONBOARDING_DAILY_GLOBAL_LIMIT', '100');
        vi.stubEnv('ONBOARDING_DAILY_COUNTRY_LIMIT', '50');
        vi.stubEnv('ONBOARDING_DAILY_COUNTRY_LIMITS', '{}');
        vi.stubEnv('ONBOARDING_TURNSTILE_ENABLED', 'false');
        await resetTestDatabase();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('accepts a valid served-country phone and sends the WhatsApp onboarding template', async () => {
        const { createApp } = await import('../../src/app');

        await request(createApp())
            .post('/api/onboarding/request-access')
            .set('x-forwarded-for', '203.0.113.10')
            .set('user-agent', 'vitest')
            .send({
                phoneNumber: '+33612345678',
                country: 'FR',
                source: 'landing'
            })
            .expect(202)
            .expect(({ body }) => {
                expect(body).toMatchObject({
                    success: true,
                    status: 'REQUEST_ACCEPTED',
                    nextAction: 'CHECK_WHATSAPP'
                });
            });

        expect(whatsappServiceMocks.sendRawTemplateMessage).toHaveBeenCalledWith(
            '33612345678',
            'whatspoint_request_access_fr',
            'fr',
            [],
            expect.objectContaining({
                phoneNumberId: 'test-phone-id',
                accessToken: 'test-whatsapp-token'
            })
        );

        const record = await prisma.onboardingAccessRequest.findFirstOrThrow();
        expect(record).toMatchObject({
            countryCode: 'FR',
            status: 'SENT',
            skipReason: null,
            channel: 'WHATSAPP',
            provider: 'META'
        });
        expect(record.phoneHash).toEqual(expect.any(String));
        expect(record.phoneHash).toHaveLength(64);
        expect(record.ipHash).toHaveLength(64);
    });

    it('applies a persistent cooldown to the same phone even when formats differ', async () => {
        const { createApp } = await import('../../src/app');
        const app = createApp();

        await request(app)
            .post('/api/onboarding/request-access')
            .send({ phoneNumber: '+33612345678', country: 'FR' })
            .expect(202);

        await request(app)
            .post('/api/onboarding/request-access')
            .send({ phoneNumber: '06 12 34 56 78', country: 'FR' })
            .expect(202);

        expect(whatsappServiceMocks.sendRawTemplateMessage).toHaveBeenCalledTimes(1);

        const records = await prisma.onboardingAccessRequest.findMany({
            orderBy: { createdAt: 'asc' }
        });

        expect(records).toHaveLength(2);
        expect(records[0].status).toBe('SENT');
        expect(records[1]).toMatchObject({
            status: 'SKIPPED',
            skipReason: 'COOLDOWN_ACTIVE'
        });
        expect(records[1].phoneHash).toBe(records[0].phoneHash);
    });

    it('skips unsupported countries without sending WhatsApp', async () => {
        const { createApp } = await import('../../src/app');

        await request(createApp())
            .post('/api/onboarding/request-access')
            .send({ phoneNumber: '+14155552671', country: 'US' })
            .expect(202);

        expect(whatsappServiceMocks.sendRawTemplateMessage).not.toHaveBeenCalled();

        const record = await prisma.onboardingAccessRequest.findFirstOrThrow();
        expect(record).toMatchObject({
            countryCode: 'US',
            status: 'SKIPPED',
            skipReason: 'COUNTRY_NOT_ALLOWED'
        });
    });

    it('enforces daily country budgets before sending', async () => {
        vi.stubEnv('ONBOARDING_DAILY_COUNTRY_LIMITS', '{"FR":1}');
        const { createApp } = await import('../../src/app');
        const app = createApp();

        await request(app)
            .post('/api/onboarding/request-access')
            .send({ phoneNumber: '+33612345678', country: 'FR' })
            .expect(202);

        await request(app)
            .post('/api/onboarding/request-access')
            .send({ phoneNumber: '+33623456789', country: 'FR' })
            .expect(202);

        expect(whatsappServiceMocks.sendRawTemplateMessage).toHaveBeenCalledTimes(1);

        const blocked = await prisma.onboardingAccessRequest.findFirstOrThrow({
            where: { skipReason: 'COUNTRY_DAILY_BUDGET_EXCEEDED' }
        });
        expect(blocked.status).toBe('SKIPPED');
        expect(blocked.countryCode).toBe('FR');
    });

    it('records invalid phones and keeps the public response non-enumerating', async () => {
        const { createApp } = await import('../../src/app');

        await request(createApp())
            .post('/api/onboarding/request-access')
            .send({ phoneNumber: 'not-a-phone', country: 'FR' })
            .expect(202)
            .expect(({ body }) => {
                expect(body.status).toBe('REQUEST_ACCEPTED');
            });

        expect(whatsappServiceMocks.sendRawTemplateMessage).not.toHaveBeenCalled();

        const record = await prisma.onboardingAccessRequest.findFirstOrThrow();
        expect(record).toMatchObject({
            countryCode: 'FR',
            status: 'SKIPPED',
            skipReason: 'PHONE_INVALID'
        });
    });
});
