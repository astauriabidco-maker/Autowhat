import { PrismaClient } from '@prisma/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

// Document categories
export const DOCUMENT_CATEGORIES = {
    PAIE: 'Fiche de paie',
    CONTRAT: 'Contrat',
    INTERNE: 'Document interne'
};

interface UploadDocumentParams {
    filePath: string;
    title: string;
    category: string;
    employeeId: string | null; // null = global document
    tenantId: string;
}

/**
 * Save document record to database
 */
export async function uploadDocument(params: UploadDocumentParams) {
    const { filePath, title, category, employeeId, tenantId } = params;

    const document = await prisma.document.create({
        data: {
            title,
            category,
            url: filePath,
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
    limit: number = 5
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
 * Format document list for WhatsApp message
 */
export function formatDocumentListMessage(
    documents: { id: string; title: string; category: string; createdAt: Date }[],
    employeeName: string
): string {
    if (documents.length === 0) {
        return `📂 *Mes Documents*\n\n_Votre dossier est vide pour le moment._`;
    }

    const lines = documents.map((doc, index) => {
        const dateStr = format(new Date(doc.createdAt), 'dd/MM/yyyy', { locale: fr });
        const catLabel = DOCUMENT_CATEGORIES[doc.category as keyof typeof DOCUMENT_CATEGORIES] || doc.category;
        return `${index + 1}. 📄 *${doc.title}*\n   ${catLabel} • ${dateStr}`;
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
