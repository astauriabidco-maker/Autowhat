import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
    employee: {
        findFirst: vi.fn()
    }
}));

vi.mock('axios');
vi.mock('../../src/lib/prisma', () => ({
    default: prismaMock
}));
vi.mock('../../src/services/queueService', () => ({
    addToQueue: vi.fn()
}));
vi.mock('../../src/services/redisConnection', () => ({
    isRedisEnabled: vi.fn(() => false)
}));

describe('whatsappService webhook channel credentials', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('WHATSAPP_API_TOKEN', 'default_token');
        vi.stubEnv('WHATSAPP_PHONE_ID', 'default_phone');
        prismaMock.employee.findFirst.mockResolvedValue(null);
        vi.mocked(axios.post).mockResolvedValue({ data: { ok: true } });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('uses registered channel credentials when a legacy phone number id string is passed', async () => {
        const { registerWebhookChannelCredentials, sendMessage } = await import('../../src/services/whatsappService');

        registerWebhookChannelCredentials('phone_byon', {
            phoneNumberId: 'phone_byon',
            accessToken: 'token_byon',
            displayName: 'Tenant BYON'
        });

        await sendMessage('33699000001', 'Bonjour', 'phone_byon');

        expect(axios.post).toHaveBeenCalledWith(
            'https://graph.facebook.com/v17.0/phone_byon/messages',
            expect.objectContaining({
                messaging_product: 'whatsapp',
                to: '33699000001',
                text: { body: 'Bonjour' }
            }),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer token_byon'
                })
            })
        );
    });
});
