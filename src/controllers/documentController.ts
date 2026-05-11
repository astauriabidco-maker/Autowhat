import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadDocument, getDocumentsForTenant, getDocumentsForSpecificEmployee, getEmployeesForTenant, DOCUMENT_TYPES, getExpiryStatus } from '../services/documentService';
import { sendMessage } from '../services/whatsappService';
import prisma from '../lib/prisma';
import { signUploadPath, verifySignedUploadPath } from '../utils/signedFileUrl';


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

function signedDocumentUrl(url: string): string {
    return signUploadPath(url);
}

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

        const { name, type, expiryDate, employeeId } = req.body;

        if (!name || !type) {
            return res.status(400).json({ error: 'Nom et type requis' });
        }

        if (!DOCUMENT_TYPES[type as keyof typeof DOCUMENT_TYPES]) {
            return res.status(400).json({ error: 'Type invalide. Utilisez CONTRACT, CERTIFICATE, IDENTITY ou OTHER.' });
        }

        const filePath = `/uploads/documents/${req.file.filename}`;

        const document = await uploadDocument({
            filePath,
            name,
            type,
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            employeeId: employeeId || null,
            tenantId
        });

        console.log(`📄 Document uploaded: ${name} by tenant ${tenantId}`);

        // Send WhatsApp notification
        const notificationMessage = `🔔 *Nouveau document reçu*\n\n📄 *${name}*\n\n_Tapez '!doc' pour consulter vos documents._`;

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
                name: document.name,
                type: document.type,
                url: signedDocumentUrl(document.url),
                expiryDate: document.expiryDate,
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
            name: doc.name,
            type: doc.type,
            typeLabel: DOCUMENT_TYPES[doc.type as keyof typeof DOCUMENT_TYPES] || doc.type,
            url: signedDocumentUrl(doc.url),
            expiryDate: doc.expiryDate,
            expiryStatus: getExpiryStatus(doc.expiryDate),
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
 * Get documents for a specific employee
 * GET /api/employees/:id/documents
 */
export const getEmployeeDocuments = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const employeeId = req.params.id as string;

        // Verify employee belongs to tenant
        const employee = await prisma.employee.findFirst({
            where: { id: employeeId, tenantId }
        });

        if (!employee) {
            return res.status(404).json({ error: 'Employé non trouvé' });
        }

        const documents = await getDocumentsForSpecificEmployee(employeeId, tenantId);

        const formatted = documents.map(doc => ({
            id: doc.id,
            name: doc.name,
            type: doc.type,
            typeLabel: DOCUMENT_TYPES[doc.type as keyof typeof DOCUMENT_TYPES] || doc.type,
            url: signedDocumentUrl(doc.url),
            expiryDate: doc.expiryDate,
            expiryStatus: getExpiryStatus(doc.expiryDate),
            createdAt: doc.createdAt
        }));

        return res.json({
            employee: {
                id: employee.id,
                name: employee.name || 'Employé',
                phoneNumber: employee.phoneNumber
            },
            count: formatted.length,
            documents: formatted
        });
    } catch (error) {
        console.error('❌ Error fetching employee documents:', error);
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

        console.log(`🗑️ Document deleted: ${document.name}`);

        return res.json({ success: true, message: 'Document supprimé' });
    } catch (error) {
        console.error('❌ Error deleting document:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * GET /api/files/:filename
 * GET /api/files/:folder/:filename
 * Serve an uploaded file only when the URL signature is valid.
 */
export const serveSignedUpload = async (req: Request, res: Response): Promise<any> => {
    try {
        const rawFolder = req.params.folder;
        const rawFilename = req.params.filename;
        const folder = Array.isArray(rawFolder) ? rawFolder[0] : rawFolder;
        const filename = path.basename(Array.isArray(rawFilename) ? rawFilename[0] : rawFilename);
        const uploadPath = folder ? `/uploads/${path.basename(folder)}/${filename}` : `/uploads/${filename}`;
        const expires = Number(req.query.expires);
        const signature = String(req.query.sig || '');

        if (!verifySignedUploadPath(uploadPath, expires, signature)) {
            return res.status(403).json({ error: 'Lien expiré ou invalide' });
        }

        const uploadsRoot = path.join(process.cwd(), 'uploads');
        const filePath = path.resolve(process.cwd(), uploadPath.replace(/^\//, ''));
        if (!(filePath === uploadsRoot || filePath.startsWith(uploadsRoot + path.sep)) || !fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Fichier introuvable' });
        }

        return res.sendFile(filePath);
    } catch (error) {
        console.error('❌ Error serving signed document:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

// ==================== SUPER ADMIN ENDPOINTS ====================

/**
 * Get all documents across all tenants (SuperAdmin)
 * GET /superadmin/documents
 */
export const getSuperAdminDocuments = async (req: Request, res: Response): Promise<any> => {
    try {
        const { tenantId, type, expiryStatus } = req.query;

        const whereClause: any = {};

        // Filter by tenant
        if (tenantId && tenantId !== 'all') {
            whereClause.tenantId = tenantId as string;
        }

        // Filter by document type
        if (type && type !== 'all') {
            whereClause.type = type as string;
        }

        const documents = await prisma.document.findMany({
            where: whereClause,
            include: {
                employee: {
                    select: { id: true, name: true, phoneNumber: true, tenantId: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 200
        });

        // Get tenant names for display
        const tenantIds = [...new Set(documents.map(d => d.tenantId))];
        const tenants = await prisma.tenant.findMany({
            where: { id: { in: tenantIds } },
            select: { id: true, name: true }
        });
        const tenantMap = new Map(tenants.map(t => [t.id, t.name]));

        // Format and filter by expiry status if needed
        let formatted = documents.map(doc => {
            const status = getExpiryStatus(doc.expiryDate);
            return {
                id: doc.id,
                name: doc.name,
                type: doc.type,
                typeLabel: DOCUMENT_TYPES[doc.type as keyof typeof DOCUMENT_TYPES] || doc.type,
                url: signedDocumentUrl(doc.url),
                expiryDate: doc.expiryDate,
                expiryStatus: status,
                createdAt: doc.createdAt,
                tenantId: doc.tenantId,
                tenantName: tenantMap.get(doc.tenantId) || 'Unknown',
                employee: doc.employee ? {
                    id: doc.employee.id,
                    name: doc.employee.name || 'Employé',
                    phoneNumber: doc.employee.phoneNumber
                } : null,
                isGlobal: !doc.employee
            };
        });

        // Filter by expiry status
        if (expiryStatus && expiryStatus !== 'all') {
            formatted = formatted.filter(d => d.expiryStatus === expiryStatus);
        }

        return res.json({
            count: formatted.length,
            documents: formatted
        });
    } catch (error) {
        console.error('❌ Error fetching SuperAdmin documents:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * Get document statistics across all tenants (SuperAdmin)
 * GET /superadmin/documents/stats
 */
export const getSuperAdminDocumentStats = async (req: Request, res: Response): Promise<any> => {
    try {
        const now = new Date();
        const in30Days = new Date();
        in30Days.setDate(now.getDate() + 30);

        // Get all documents with expiry dates
        const allDocuments = await prisma.document.findMany({
            where: {
                expiryDate: { not: null }
            },
            select: {
                id: true,
                expiryDate: true,
                tenantId: true
            }
        });

        // Calculate stats
        let expired = 0;
        let expiringSoon = 0;

        for (const doc of allDocuments) {
            if (doc.expiryDate) {
                if (doc.expiryDate < now) {
                    expired++;
                } else if (doc.expiryDate <= in30Days) {
                    expiringSoon++;
                }
            }
        }

        // Count totals
        const [totalDocuments, totalTenants] = await Promise.all([
            prisma.document.count(),
            prisma.document.groupBy({
                by: ['tenantId'],
                _count: { id: true }
            })
        ]);

        // Get tenants for filter dropdown
        const tenants = await prisma.tenant.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        });

        return res.json({
            totalDocuments,
            expired,
            expiringSoon,
            tenantsWithDocs: totalTenants.length,
            tenants
        });
    } catch (error) {
        console.error('❌ Error fetching SuperAdmin document stats:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};
