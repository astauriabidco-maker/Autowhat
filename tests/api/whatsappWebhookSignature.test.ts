import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const prismaMock = vi.hoisted(() => ({
    platformConfig: {
        update: vi.fn()
    }
}));

vi.mock('../../src/lib/prisma', () => ({
    default: prismaMock
}));

vi.mock('../../src/services/authService', () => ({
    identifyUser: vi.fn()
}));

vi.mock('../../src/services/whatsappService', () => ({
    registerWebhookChannelCredentials: vi.fn(),
    sendMessage: vi.fn(),
    sendInteractiveList: vi.fn(),
    sendInteractiveButtons: vi.fn(),
    sendDocument: vi.fn(),
    sendTemplateMessage: vi.fn()
}));

vi.mock('../../src/services/attendanceService', () => ({
    checkIn: vi.fn(),
    checkOut: vi.fn()
}));

vi.mock('../../src/services/leaveService', () => ({
    createRequest: vi.fn(),
    handleManagerResponse: vi.fn(),
    formatDateForMessage: vi.fn()
}));

vi.mock('../../src/services/storageService', () => ({
    downloadAndSaveMetaImage: vi.fn()
}));

vi.mock('../../src/services/locationService', () => ({
    isWithinRange: vi.fn(),
    checkLocationCompliance: vi.fn()
}));

vi.mock('../../src/services/expenseService', () => ({
    setConversationState: vi.fn(),
    updateTempExpenseData: vi.fn(),
    createExpense: vi.fn(),
    EXPENSE_CATEGORIES: {}
}));

vi.mock('../../src/services/statsService', () => ({
    getWeeklySummary: vi.fn(),
    getHistory: vi.fn(),
    formatWeeklySummaryMessage: vi.fn(),
    formatHistoryMessage: vi.fn()
}));

vi.mock('../../src/services/documentService', () => ({
    getDocumentsForEmployee: vi.fn(),
    getDocumentById: vi.fn(),
    formatDocumentListMessage: vi.fn()
}));

vi.mock('../../src/services/notificationService', () => ({
    notifyAllManagers: vi.fn()
}));

vi.mock('../../src/config/i18nBot', () => ({
    getBotMessage: vi.fn(),
    getEmployeeLanguage: vi.fn()
}));

vi.mock('../../src/config/industryTemplates', () => ({
    getTemplate: vi.fn()
}));

vi.mock('../../src/services/webhookService', () => ({
    dispatchWebhook: vi.fn(),
    WEBHOOK_EVENTS: {}
}));

vi.mock('../../src/utils/signedFileUrl', () => ({
    absoluteSignedUploadUrl: vi.fn(),
    absoluteSignedUploadUrlIfNeeded: vi.fn()
}));

vi.mock('../../src/services/numberAllocationService', () => ({
    assignNumberToTenant: vi.fn()
}));

vi.mock('../../src/services/managerMagicLoginService', () => ({
    createManagerMagicLoginLink: vi.fn()
}));

function createResponse() {
    const res = {
        statusCode: 200,
        sendStatus: vi.fn((status: number) => {
            res.statusCode = status;
            return res;
        })
    } as unknown as Response & { statusCode: number; sendStatus: ReturnType<typeof vi.fn> };

    return res;
}

function createRequest(body: unknown, signature?: string) {
    const rawBody = Buffer.from(JSON.stringify(body));

    return {
        body,
        rawBody,
        header: vi.fn((name: string) => (
            name.toLowerCase() === 'x-hub-signature-256' ? signature : undefined
        ))
    } as unknown as Request;
}

describe('webhookController.handleMessage Meta signature', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('WHATSAPP_APP_SECRET', 'meta-secret');
        vi.stubEnv('META_APP_SECRET', '');
        vi.stubEnv('FACEBOOK_APP_SECRET', '');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('rejects a production webhook when the Meta signature is missing', async () => {
        const { handleMessage } = await import('../../src/controllers/webhookController');
        const body = { object: 'whatsapp_business_account', entry: [] };
        const res = createResponse();

        await handleMessage(createRequest(body), res);

        expect(res.sendStatus).toHaveBeenCalledWith(403);
    });

    it('rejects a production webhook when the Meta signature is invalid', async () => {
        const { handleMessage } = await import('../../src/controllers/webhookController');
        const body = { object: 'whatsapp_business_account', entry: [] };
        const res = createResponse();

        await handleMessage(createRequest(body, 'sha256=bad-signature'), res);

        expect(res.sendStatus).toHaveBeenCalledWith(403);
    });

    it('accepts a production webhook with a valid Meta signature', async () => {
        const { handleMessage } = await import('../../src/controllers/webhookController');
        const body = { object: 'whatsapp_business_account', entry: [] };
        const rawBody = Buffer.from(JSON.stringify(body));
        const signature = `sha256=${crypto
            .createHmac('sha256', 'meta-secret')
            .update(rawBody)
            .digest('hex')}`;
        const res = createResponse();

        await handleMessage(createRequest(body, signature), res);

        expect(res.sendStatus).toHaveBeenCalledWith(200);
    });
});
