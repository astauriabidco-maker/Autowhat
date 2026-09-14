import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
    employee: {
        findFirst: vi.fn(),
        findMany: vi.fn()
    }
}));

const documentServiceMocks = vi.hoisted(() => ({
    DOCUMENT_TYPES: {
        CONTRACT: 'Contrat',
        CERTIFICATE: 'Certificat/Permis',
        IDENTITY: 'Pièce d\'identité',
        OTHER: 'Autre'
    },
    getDocumentsForSpecificEmployee: vi.fn(),
    getDocumentsForTenant: vi.fn(),
    getEmployeesForTenant: vi.fn(),
    getExpiryStatus: vi.fn(),
    uploadDocument: vi.fn()
}));

const whatsappServiceMocks = vi.hoisted(() => ({
    sendMessage: vi.fn()
}));

const webhookServiceMocks = vi.hoisted(() => ({
    dispatchWebhook: vi.fn(),
    WEBHOOK_EVENTS: {
        DOCUMENT_RECEIVED: 'document.received'
    }
}));

vi.mock('../../src/lib/prisma', () => ({
    default: prismaMock
}));

vi.mock('../../src/services/documentService', () => documentServiceMocks);
vi.mock('../../src/services/whatsappService', () => whatsappServiceMocks);
vi.mock('../../src/services/webhookService', () => webhookServiceMocks);

function createResponse() {
    const res: any = {};
    res.status = vi.fn(() => res);
    res.json = vi.fn(() => res);
    return res;
}

describe('documentController.uploadDocumentHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.FILE_URL_SECRET = 'test-file-secret';
        process.env.BACKEND_URL = 'https://api.testbed.whatspoint.com';
    });

    it('dispatches document.received with a temporary signed media URL for employee documents', async () => {
        const createdAt = new Date('2026-09-14T14:30:00.000Z');
        const uploadedDocument = {
            id: 'doc-123',
            name: 'Justificatif absence',
            type: 'OTHER',
            url: '/uploads/documents/justificatif.pdf',
            expiryDate: null,
            createdAt
        };

        prismaMock.employee.findFirst.mockResolvedValue({
            id: 'employee-123',
            name: 'Smoke Kalldy',
            phoneNumber: '33612345678'
        });
        documentServiceMocks.uploadDocument.mockResolvedValue(uploadedDocument);

        const { uploadDocumentHandler } = await import('../../src/controllers/documentController');
        const req: any = {
            user: { tenantId: 'tenant-fr' },
            protocol: 'https',
            get: vi.fn(() => 'api.testbed.whatspoint.com'),
            body: {
                name: 'Justificatif absence',
                type: 'OTHER',
                employeeId: 'employee-123'
            },
            file: {
                filename: 'doc-uploaded.pdf',
                originalname: 'justificatif-absence.pdf',
                mimetype: 'application/pdf',
                size: 245760,
                path: '/tmp/doc-uploaded.pdf'
            }
        };
        const res = createResponse();

        await uploadDocumentHandler(req, res);

        expect(webhookServiceMocks.dispatchWebhook).toHaveBeenCalledWith(
            'document.received',
            expect.objectContaining({
                documentId: 'doc-123',
                employeeId: 'employee-123',
                employeeName: 'Smoke Kalldy',
                employeePhoneNumber: '33612345678',
                documentType: 'OTHER',
                fileName: 'justificatif-absence.pdf',
                mimeType: 'application/pdf',
                fileSizeBytes: 245760,
                mediaId: 'doc-123',
                mediaUrl: expect.stringContaining('https://api.testbed.whatspoint.com/api/files/documents/justificatif.pdf?'),
                mediaUrlExpiresAt: expect.any(String)
            }),
            'tenant-fr'
        );
        expect(new Date(webhookServiceMocks.dispatchWebhook.mock.calls[0][1].mediaUrlExpiresAt).getTime())
            .toBeGreaterThan(Date.now());
        expect(res.status).toHaveBeenCalledWith(201);
    });
});
