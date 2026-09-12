import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
    platformConfig: {
        findUnique: vi.fn()
    },
    employee: {
        findFirst: vi.fn(),
        update: vi.fn()
    },
    tenant: {
        findUnique: vi.fn()
    }
}));

const whatsappServiceMock = vi.hoisted(() => ({
    sendRawMessage: vi.fn(),
    sendRawTemplateMessage: vi.fn()
}));

const whatsappConfigMock = vi.hoisted(() => ({
    getDefaultConfig: vi.fn()
}));

vi.mock('../../src/lib/prisma', () => ({
    default: prismaMock
}));

vi.mock('../../src/services/whatsappService', () => whatsappServiceMock);
vi.mock('../../src/services/whatsappConfigService', () => whatsappConfigMock);
vi.mock('../../src/services/emailService', () => ({
    sendWelcomeEmail: vi.fn(),
    sendPasswordResetEmail: vi.fn()
}));
vi.mock('../../src/services/numberAllocationService', () => ({
    assignNumberToTenant: vi.fn()
}));
vi.mock('../../src/services/managerMagicLoginService', () => ({
    consumeManagerMagicLoginToken: vi.fn()
}));

function createResponse() {
    const res = {
        status: vi.fn(),
        json: vi.fn()
    };
    res.status.mockReturnValue(res);
    return res;
}

describe('authController', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        process.env.JWT_SECRET = 'test-jwt-secret-change-me';
        process.env.WHATSAPP_LOGIN_OTP_TEMPLATE = 'whatspoint_login_otp_fr';
        process.env.WHATSAPP_LOGIN_OTP_TEMPLATE_LANG = 'fr';

        prismaMock.platformConfig.findUnique.mockResolvedValue(null);
        prismaMock.employee.findFirst.mockResolvedValue({
            id: 'employee-1',
            tenantId: 'tenant-1',
            role: 'MANAGER',
            name: 'Manager Test'
        });
        prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', status: 'ACTIVE' });
        prismaMock.employee.update.mockResolvedValue({});
        whatsappConfigMock.getDefaultConfig.mockReturnValue({
            phoneNumberId: 'phone-id',
            accessToken: 'access-token'
        });
        whatsappServiceMock.sendRawTemplateMessage.mockResolvedValue({ success: true });
    });

    it('sends manager login OTP auth templates with body and copy-code button parameters', async () => {
        const { requestOtp } = await import('../../src/controllers/authController');
        const res = createResponse();

        await requestOtp({ body: { phoneNumber: '+33 6 00 00 00 00' } } as any, res as any);

        expect(whatsappServiceMock.sendRawTemplateMessage).toHaveBeenCalledWith(
            '33600000000',
            'whatspoint_login_otp_fr',
            'fr',
            [
                {
                    type: 'body',
                    parameters: [{ type: 'text', text: expect.stringMatching(/^\d{6}$/) }]
                },
                {
                    type: 'button',
                    sub_type: 'url',
                    index: '0',
                    parameters: [{ type: 'text', text: expect.stringMatching(/^\d{6}$/) }]
                }
            ],
            {
                phoneNumberId: 'phone-id',
                accessToken: 'access-token'
            }
        );
        expect(res.status).toHaveBeenCalledWith(200);
    });
});
