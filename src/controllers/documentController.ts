import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { uploadDocument, getDocumentsForTenant, getEmployeesForTenant, DOCUMENT_CATEGORIES } from '../services/documentService';
import { sendMessage } from '../services/whatsappService';

const prisma = new PrismaClient();

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads', 'documents');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `doc-${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowed = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Type de fichier non supporté. Utilisez PDF, DOC, DOCX ou images.'));
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

/**
 * Upload a new document and send WhatsApp notification
 * POST /api/documents
 */
export const uploadDocumentHandler = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier fourni' });
        }

        const { title, category, employeeId } = req.body;

        if (!title || !category) {
            return res.status(400).json({ error: 'Titre et catégorie requis' });
        }

        if (!DOCUMENT_CATEGORIES[category as keyof typeof DOCUMENT_CATEGORIES]) {
            return res.status(400).json({ error: 'Catégorie invalide. Utilisez PAIE, CONTRAT ou INTERNE.' });
        }

        const filePath = `/uploads/documents/${req.file.filename}`;

        const document = await uploadDocument({
            filePath,
            title,
            category,
            employeeId: employeeId || null,
            tenantId
        });

        console.log(`📄 Document uploaded: ${title} by tenant ${tenantId}`);

        // Send WhatsApp notification
        const notificationMessage = `🔔 *Nouveau document reçu*\n\n📄 *${title}*\n\n_Tapez 'Documents' pour le consulter._`;

        if (employeeId) {
            // Send to specific employee
            const employee = await prisma.employee.findUnique({
                where: { id: employeeId },
                select: { phoneNumber: true }
            });
            if (employee) {
                await sendMessage(employee.phoneNumber.replace('+', ''), notificationMessage);
                console.log(`📨 Document notification sent to ${employee.phoneNumber}`);
            }
        } else {
            // Global document: send to all employees in tenant
            const employees = await prisma.employee.findMany({
                where: { tenantId, role: 'EMPLOYEE' },
                select: { phoneNumber: true }
            });
            for (const emp of employees) {
                await sendMessage(emp.phoneNumber.replace('+', ''), notificationMessage);
            }
            console.log(`📨 Global document notification sent to ${employees.length} employees`);
        }

        return res.status(201).json({
            success: true,
            document: {
                id: document.id,
                title: document.title,
                category: document.category,
                url: document.url,
                createdAt: document.createdAt
            }
        });
    } catch (error) {
        console.error('❌ Error uploading document:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * Get all documents for tenant (manager view)
 * GET /api/documents
 */
export const getDocuments = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const documents = await getDocumentsForTenant(tenantId);

        const formatted = documents.map(doc => ({
            id: doc.id,
            title: doc.title,
            category: doc.category,
            categoryLabel: DOCUMENT_CATEGORIES[doc.category as keyof typeof DOCUMENT_CATEGORIES] || doc.category,
            url: doc.url,
            createdAt: doc.createdAt,
            employee: doc.employee ? {
                id: doc.employee.id,
                name: doc.employee.name || 'Employé',
                phoneNumber: doc.employee.phoneNumber
            } : null,
            isGlobal: !doc.employee
        }));

        return res.json({
            count: formatted.length,
            documents: formatted
        });
    } catch (error) {
        console.error('❌ Error fetching documents:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * Get employees for document assignment dropdown
 * GET /api/documents/employees
 */
export const getEmployees = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const employees = await getEmployeesForTenant(tenantId);

        return res.json({
            employees: employees.map(emp => ({
                id: emp.id,
                name: emp.name || 'Employé',
                phoneNumber: emp.phoneNumber
            }))
        });
    } catch (error) {
        console.error('❌ Error fetching employees:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * Delete a document
 * DELETE /api/documents/:id
 */
export const deleteDocument = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const { id } = req.params;

        // Check document exists and belongs to tenant
        const document = await prisma.document.findFirst({
            where: { id: id as string, tenantId }
        });

        if (!document) {
            return res.status(404).json({ error: 'Document non trouvé' });
        }

        // Delete file from disk
        const filePath = path.join(process.cwd(), document.url);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Delete from database
        await prisma.document.delete({
            where: { id: id as string }
        });

        console.log(`🗑️ Document deleted: ${document.title}`);

        return res.json({ success: true, message: 'Document supprimé' });
    } catch (error) {
        console.error('❌ Error deleting document:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};
