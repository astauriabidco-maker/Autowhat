import { PrismaClient } from '@prisma/client';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

const prisma = new PrismaClient();

// Document types for HR documents
export const DOCUMENT_TYPES = {
    CONTRACT: 'Contrat',
    CERTIFICATE: 'Certificat/Permis',
    IDENTITY: 'Pièce d\'identité',
    OTHER: 'Autre'
};

interface UploadDocumentParams {
    filePath: string;
    name: string;
    type: string;
    expiryDate?: Date | null;
    employeeId: string | null; // null = global document
    tenantId: string;
}

/**
 * Save document record to database
 */
export async function uploadDocument(params: UploadDocumentParams) {
    const { filePath, name, type, expiryDate, employeeId, tenantId } = params;

    const document = await prisma.document.create({
        data: {
            name,
            type,
            url: filePath,
            expiryDate: expiryDate || null,
            employeeId,
            tenantId
        }
    });

    return document;
}

/**
 * Get documents for an employee (personal + global)
 */
export async function getDocumentsForEmployee(
    employeeId: string,
    tenantId: string,
    limit: number = 20
) {
    const documents = await prisma.document.findMany({
        where: {
            tenantId,
            OR: [
                { employeeId }, // Personal documents
                { employeeId: null } // Global documents
            ]
        },
        orderBy: { createdAt: 'desc' },
        take: limit
    });

    return documents;
}

/**
 * Get all documents for a tenant (for manager view)
 */
export async function getDocumentsForTenant(tenantId: string) {
    const documents = await prisma.document.findMany({
        where: { tenantId },
        include: {
            employee: {
                select: { id: true, name: true, phoneNumber: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    return documents;
}

/**
 * Get documents for a specific employee (manager view)
 */
export async function getDocumentsForSpecificEmployee(employeeId: string, tenantId: string) {
    const documents = await prisma.document.findMany({
        where: {
            tenantId,
            employeeId
        },
        orderBy: { createdAt: 'desc' }
    });

    return documents;
}

/**
 * Get a specific document by ID
 */
export async function getDocumentById(documentId: string, tenantId: string) {
    return prisma.document.findFirst({
        where: {
            id: documentId,
            tenantId
        }
    });
}

/**
 * Get documents expiring soon (for cron job)
 */
export async function getExpiringDocuments(daysAhead: number = 30) {
    const now = new Date();
    const targetDate = new Date();
    targetDate.setDate(now.getDate() + daysAhead);

    const documents = await prisma.document.findMany({
        where: {
            expiryDate: {
                gte: now,
                lte: targetDate
            }
        },
        include: {
            employee: {
                select: { id: true, name: true, phoneNumber: true, tenantId: true }
            }
        }
    });

    return documents;
}

/**
 * Get already expired documents
 */
export async function getExpiredDocuments() {
    const now = new Date();

    const documents = await prisma.document.findMany({
        where: {
            expiryDate: {
                lt: now
            }
        },
        include: {
            employee: {
                select: { id: true, name: true, phoneNumber: true, tenantId: true }
            }
        }
    });

    return documents;
}

/**
 * Calculate expiry status for a document
 */
export function getExpiryStatus(expiryDate: Date | null): 'ok' | 'warning' | 'expired' | 'none' {
    if (!expiryDate) return 'none';

    const now = new Date();
    const days = differenceInDays(expiryDate, now);

    if (days < 0) return 'expired';
    if (days <= 30) return 'warning';
    return 'ok';
}

/**
 * Format document list for WhatsApp message
 */
export function formatDocumentListMessage(
    documents: { id: string; name: string; type: string; createdAt: Date; expiryDate?: Date | null }[],
    employeeName: string
): string {
    if (documents.length === 0) {
        return `📂 *Mes Documents*\n\n_Votre dossier est vide pour le moment._`;
    }

    const lines = documents.map((doc, index) => {
        const dateStr = format(new Date(doc.createdAt), 'dd/MM/yyyy', { locale: fr });
        const typeLabel = DOCUMENT_TYPES[doc.type as keyof typeof DOCUMENT_TYPES] || doc.type;
        let expiryInfo = '';
        if (doc.expiryDate) {
            const status = getExpiryStatus(doc.expiryDate);
            const expiryStr = format(new Date(doc.expiryDate), 'dd/MM/yyyy', { locale: fr });
            expiryInfo = status === 'expired' ? ` ⛔️ Expiré` :
                status === 'warning' ? ` ⚠️ Expire ${expiryStr}` :
                    ` • Expire ${expiryStr}`;
        }
        return `${index + 1}. 📄 *${doc.name}*\n   ${typeLabel}${expiryInfo}`;
    });

    return `📂 *Mes Documents*\n👤 ${employeeName}\n\n${lines.join('\n\n')}\n\n_Répondez avec le numéro (ex: "1") pour télécharger._`;
}

/**
 * Get employees for dropdown (manager use)
 */
export async function getEmployeesForTenant(tenantId: string) {
    return prisma.employee.findMany({
        where: { tenantId },
        select: { id: true, name: true, phoneNumber: true },
        orderBy: { name: 'asc' }
    });
}
