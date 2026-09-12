import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
    employee: {
        findFirst: vi.fn()
    },
    document: {
        create: vi.fn()
    }
}));

vi.mock('../../src/lib/prisma', () => ({
    default: prismaMock
}));

describe('documentService.uploadDocument', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects a document linked to an employee from another tenant', async () => {
        const { uploadDocument } = await import('../../src/services/documentService');
        prismaMock.employee.findFirst.mockResolvedValue(null);

        await expect(uploadDocument({
            filePath: '/uploads/documents/contract.pdf',
            name: 'Contrat',
            type: 'CONTRACT',
            expiryDate: null,
            employeeId: 'employee-other-tenant',
            tenantId: 'tenant-a'
        })).rejects.toThrow('Employee does not belong to tenant');

        expect(prismaMock.employee.findFirst).toHaveBeenCalledWith({
            where: { id: 'employee-other-tenant', tenantId: 'tenant-a' },
            select: { id: true }
        });
        expect(prismaMock.document.create).not.toHaveBeenCalled();
    });

    it('creates a tenant-scoped document when the employee belongs to the tenant', async () => {
        const { uploadDocument } = await import('../../src/services/documentService');
        const createdDocument = {
            id: 'document-1',
            name: 'Contrat',
            type: 'CONTRACT',
            url: '/uploads/documents/contract.pdf',
            tenantId: 'tenant-a',
            employeeId: 'employee-a',
            expiryDate: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z')
        };
        prismaMock.employee.findFirst.mockResolvedValue({ id: 'employee-a' });
        prismaMock.document.create.mockResolvedValue(createdDocument);

        const result = await uploadDocument({
            filePath: '/uploads/documents/contract.pdf',
            name: 'Contrat',
            type: 'CONTRACT',
            expiryDate: null,
            employeeId: 'employee-a',
            tenantId: 'tenant-a'
        });

        expect(result).toBe(createdDocument);
        expect(prismaMock.document.create).toHaveBeenCalledWith({
            data: {
                name: 'Contrat',
                type: 'CONTRACT',
                url: '/uploads/documents/contract.pdf',
                expiryDate: null,
                employeeId: 'employee-a',
                tenantId: 'tenant-a'
            }
        });
    });
});
