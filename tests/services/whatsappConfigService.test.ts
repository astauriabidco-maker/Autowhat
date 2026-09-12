import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
    whatsAppConfig: {
        findUnique: vi.fn()
    },
    systemPhoneNumber: {
        findUnique: vi.fn()
    }
}));

vi.mock('../../src/lib/prisma', () => ({
    default: prismaMock
}));

describe('whatsappConfigService.resolveIncomingWhatsAppChannel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('WHATSAPP_PHONE_ID', 'default_phone_id');
        vi.stubEnv('WHATSAPP_API_TOKEN', 'default_token');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('resolves an active BYON number with a single tenant scope', async () => {
        prismaMock.whatsAppConfig.findUnique.mockResolvedValue({
            tenantId: 'tenant-byon',
            phoneNumberId: 'phone_byon',
            accessToken: 'token_byon',
            displayName: 'Tenant BYON',
            isActive: true,
            tenant: { status: 'ACTIVE' }
        });

        const { resolveIncomingWhatsAppChannel } = await import('../../src/services/whatsappConfigService');
        const channel = await resolveIncomingWhatsAppChannel('phone_byon');

        expect(channel).toEqual({
            type: 'BYON',
            phoneNumberId: 'phone_byon',
            tenantIds: ['tenant-byon'],
            config: {
                phoneNumberId: 'phone_byon',
                accessToken: 'token_byon',
                displayName: 'Tenant BYON'
            }
        });
        expect(prismaMock.systemPhoneNumber.findUnique).not.toHaveBeenCalled();
    });

    it('treats an inactive BYON number as a disabled inbound channel', async () => {
        prismaMock.whatsAppConfig.findUnique.mockResolvedValue({
            tenantId: 'tenant-disabled',
            phoneNumberId: 'phone_system',
            accessToken: 'token_disabled',
            displayName: 'Disabled BYON',
            isActive: false,
            tenant: { status: 'ACTIVE' }
        });

        const { resolveIncomingWhatsAppChannel } = await import('../../src/services/whatsappConfigService');
        const channel = await resolveIncomingWhatsAppChannel('phone_system');

        expect(channel).toEqual({
            type: 'DISABLED',
            phoneNumberId: 'phone_system',
            tenantIds: [],
            config: {
                phoneNumberId: 'default_phone_id',
                accessToken: 'default_token',
                displayName: 'WhatsPoint'
            }
        });
        expect(prismaMock.systemPhoneNumber.findUnique).not.toHaveBeenCalled();
    });

    it('uses default credentials for an unknown phone number id while preserving the inbound id', async () => {
        prismaMock.whatsAppConfig.findUnique.mockResolvedValue(null);
        prismaMock.systemPhoneNumber.findUnique.mockResolvedValue(null);

        const { resolveIncomingWhatsAppChannel } = await import('../../src/services/whatsappConfigService');
        const channel = await resolveIncomingWhatsAppChannel('phone_unknown');

        expect(channel).toEqual({
            type: 'DEFAULT',
            phoneNumberId: 'phone_unknown',
            config: {
                phoneNumberId: 'phone_unknown',
                accessToken: 'default_token',
                displayName: 'WhatsPoint'
            }
        });
    });
});
