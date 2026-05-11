import { Request, Response } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { parsePhoneNumber, isValidPhoneNumber, CountryCode } from 'libphonenumber-js';
import { sendMessage } from '../services/whatsappService';
import { getCredentialsForTenant } from '../services/whatsappConfigService';
import prisma from '../lib/prisma';


// Multer configuration for file uploads
const storage = multer.memoryStorage();
export const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv'
        ];
        if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Format de fichier non supporté. Utilisez .xlsx ou .csv'));
        }
    }
});

interface ImportRow {
    FirstName?: string;
    LastName?: string;
    Phone?: string;
    JobTitle?: string;
    SiteName?: string;
    Profile?: string;
}

interface ImportResult {
    imported: number;
    updated: number;
    sitesCreated: number;
    errors: Array<{ row: number; message: string }>;
}

const IMPORT_HEADERS: Array<keyof ImportRow> = ['FirstName', 'LastName', 'Phone', 'JobTitle', 'SiteName', 'Profile'];

async function parseImportRows(file: Express.Multer.File): Promise<ImportRow[]> {
    const filename = file.originalname.toLowerCase();

    if (filename.endsWith('.csv') || file.mimetype === 'text/csv') {
        return parseCsvRows(file.buffer.toString('utf8'));
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];

    const headerRow = worksheet.getRow(1);
    const headers = headerRow.values as Array<string | undefined>;
    const rows: ImportRow[] = [];

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const item: ImportRow = {};
        headers.forEach((header, index) => {
            if (!header || !IMPORT_HEADERS.includes(header as keyof ImportRow)) return;
            const value = row.getCell(index).text;
            item[header as keyof ImportRow] = value;
        });
        if (Object.values(item).some(Boolean)) rows.push(item);
    });

    return rows;
}

function parseCsvRows(content: string): ImportRow[] {
    const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
    const [headerLine, ...dataLines] = lines;
    if (!headerLine) return [];

    const delimiter = headerLine.includes(';') ? ';' : ',';
    const headers = splitCsvLine(headerLine, delimiter);

    return dataLines.map(line => {
        const values = splitCsvLine(line, delimiter);
        const row: ImportRow = {};
        headers.forEach((header, index) => {
            if (!IMPORT_HEADERS.includes(header as keyof ImportRow)) return;
            row[header as keyof ImportRow] = values[index] || '';
        });
        return row;
    });
}

function splitCsvLine(line: string, delimiter: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i + 1];
        if (char === '"' && next === '"') {
            current += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    return values;
}

/**
 * POST /api/import/employees
 * Import employees from Excel/CSV file with auto-site creation
 */
export const importEmployees = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
            res.status(401).json({ error: 'Non autorisé' });
            return;
        }

        if (!req.file) {
            res.status(400).json({ error: 'Aucun fichier fourni' });
            return;
        }

        // Get tenant info for country default and welcome message
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { country: true, name: true }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant non trouvé' });
            return;
        }

        const countryCode = (tenant.country || 'FR') as CountryCode;

        // Get WhatsApp credentials once before the loop (for auto-onboarding messages)
        const tenantCredentials = await getCredentialsForTenant(tenantId);

        const rows = await parseImportRows(req.file);

        if (rows.length === 0) {
            res.status(400).json({ error: 'Le fichier est vide' });
            return;
        }

        const result: ImportResult = {
            imported: 0,
            updated: 0,
            sitesCreated: 0,
            errors: []
        };

        // Cache for sites (case-insensitive lookup)
        const siteCache: Map<string, string> = new Map();

        // Pre-load existing sites
        const existingSites = await prisma.site.findMany({
            where: { tenantId },
            select: { id: true, name: true }
        });
        existingSites.forEach(site => {
            siteCache.set(site.name.toLowerCase(), site.id);
        });

        // Process each row
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2; // Excel rows start at 1, plus header

            try {
                // Validate required fields
                const firstName = String(row.FirstName || '').trim();
                const lastName = String(row.LastName || '').trim();
                const rawPhone = String(row.Phone || '').trim();
                const jobTitle = String(row.JobTitle || 'Employé').trim();
                const siteName = String(row.SiteName || '').trim();
                const profile = String(row.Profile || 'MOBILE').toUpperCase();

                if (!firstName && !lastName) {
                    result.errors.push({ row: rowNum, message: 'Nom requis' });
                    continue;
                }

                if (!rawPhone) {
                    result.errors.push({ row: rowNum, message: 'Téléphone requis' });
                    continue;
                }

                // Normalize phone number
                let normalizedPhone: string;
                try {
                    // Clean phone: remove spaces, dots, dashes
                    const cleanPhone = rawPhone.replace(/[\s.\-()]/g, '');

                    // Try to parse with country code
                    if (isValidPhoneNumber(cleanPhone, countryCode)) {
                        const parsed = parsePhoneNumber(cleanPhone, countryCode);
                        normalizedPhone = parsed.format('E.164').replace('+', '');
                    } else if (isValidPhoneNumber(cleanPhone)) {
                        // Already has country code
                        const parsed = parsePhoneNumber(cleanPhone);
                        normalizedPhone = parsed.format('E.164').replace('+', '');
                    } else {
                        result.errors.push({ row: rowNum, message: `Numéro invalide: ${rawPhone}` });
                        continue;
                    }
                } catch (phoneError) {
                    result.errors.push({ row: rowNum, message: `Numéro invalide: ${rawPhone}` });
                    continue;
                }

                // Handle site creation/lookup (case-insensitive)
                let siteId: string | null = null;
                if (siteName) {
                    const siteKey = siteName.toLowerCase();

                    if (siteCache.has(siteKey)) {
                        siteId = siteCache.get(siteKey)!;
                    } else {
                        // Create new site
                        const newSite = await prisma.site.create({
                            data: {
                                name: siteName,
                                tenantId
                            }
                        });
                        siteCache.set(siteKey, newSite.id);
                        siteId = newSite.id;
                        result.sitesCreated++;
                    }
                }

                // Upsert employee (use phone as unique key)
                const existingEmployee = await prisma.employee.findFirst({
                    where: {
                        tenantId,
                        phoneNumber: normalizedPhone
                    }
                });

                const fullName = `${firstName} ${lastName}`.trim();
                const workProfile = ['MOBILE', 'SEDENTARY'].includes(profile) ? profile : 'MOBILE';

                if (existingEmployee) {
                    // Update existing
                    await prisma.employee.update({
                        where: { id: existingEmployee.id },
                        data: {
                            name: fullName || existingEmployee.name,
                            siteId: siteId || existingEmployee.siteId
                        }
                    });
                    result.updated++;
                } else {
                    // Create new
                    await prisma.employee.create({
                        data: {
                            phoneNumber: normalizedPhone,
                            name: fullName,
                            role: 'EMPLOYEE',
                            workProfile,
                            tenantId,
                            siteId
                        }
                    });

                    // ----------------------------------------------------
                    // SOLOPRENEUR ONBOARDING: Send Welcome WhatsApp Message
                    // ----------------------------------------------------
                    const tenantName = tenant.name || 'votre entreprise';
                    const welcomeMsg = `👋 Bonjour ${firstName || fullName} ! Bienvenue sur le système WhatsPoint de ${tenantName}.\n\nJe suis l'assistant RH & Terrain. Vous pouvez m'envoyer directement vos 👉 *demandes de congés*, ou pointer vos arrivées/départs.\n\nEnvoyez-moi simplement le mot *"Menu"* pour démarrer 🚀`;
                    
                    try {
                        // Envoi asynchrone non-bloquant via la file d'attente (Redis)
                        await sendMessage(normalizedPhone, welcomeMsg, tenantCredentials);
                        console.log(`💬 [ONBOARDING] Welcome message queued for ${normalizedPhone}`);
                    } catch (e) {
                        console.error(`❌ [ONBOARDING] Failed to send welcome message to ${normalizedPhone}:`, e);
                    }

                    result.imported++;
                }

            } catch (rowError: any) {
                result.errors.push({ row: rowNum, message: rowError.message || 'Erreur inconnue' });
            }
        }

        console.log(`📥 Import completed: ${result.imported} created, ${result.updated} updated, ${result.sitesCreated} sites, ${result.errors.length} errors`);

        res.status(200).json(result);

    } catch (error: any) {
        console.error('Import error:', error);
        res.status(500).json({ error: error.message || 'Erreur lors de l\'import' });
    }
};

/**
 * GET /api/import/template
 * Generate and download Excel template
 */
export const downloadTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
        // Create template data
        const templateData = [
            {
                FirstName: 'Jean',
                LastName: 'Dupont',
                Phone: '0612345678',
                JobTitle: 'Ouvrier',
                SiteName: 'Agence Paris',
                Profile: 'MOBILE'
            },
            {
                FirstName: 'Marie',
                LastName: 'Martin',
                Phone: '+33698765432',
                JobTitle: 'Chef d\'équipe',
                SiteName: 'Agence Lyon',
                Profile: 'SEDENTARY'
            }
        ];

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Employés');
        worksheet.columns = [
            { header: 'FirstName', key: 'FirstName', width: 15 },
            { header: 'LastName', key: 'LastName', width: 15 },
            { header: 'Phone', key: 'Phone', width: 15 },
            { header: 'JobTitle', key: 'JobTitle', width: 20 },
            { header: 'SiteName', key: 'SiteName', width: 20 },
            { header: 'Profile', key: 'Profile', width: 12 }
        ];
        worksheet.addRows(templateData);

        const buffer = await workbook.xlsx.writeBuffer();

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=modele_import_employes.xlsx');
        res.send(buffer);

    } catch (error: any) {
        console.error('Template generation error:', error);
        res.status(500).json({ error: 'Erreur lors de la génération du modèle' });
    }
};
