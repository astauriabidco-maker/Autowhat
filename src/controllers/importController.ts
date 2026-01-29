import { Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { parsePhoneNumber, isValidPhoneNumber, CountryCode } from 'libphonenumber-js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

/**
 * POST /api/import/employees
 * Import employees from Excel/CSV file with auto-site creation
 */
export const importEmployees = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = (req as any).tenantId;

        if (!req.file) {
            res.status(400).json({ error: 'Aucun fichier fourni' });
            return;
        }

        // Get tenant info for country default
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { country: true }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant non trouvé' });
            return;
        }

        const countryCode = (tenant.country || 'FR') as CountryCode;

        // Parse the file
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows: ImportRow[] = XLSX.utils.sheet_to_json(worksheet);

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

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Employés');

        // Set column widths
        worksheet['!cols'] = [
            { wch: 15 }, // FirstName
            { wch: 15 }, // LastName
            { wch: 15 }, // Phone
            { wch: 20 }, // JobTitle
            { wch: 20 }, // SiteName
            { wch: 12 }  // Profile
        ];

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=modele_import_employes.xlsx');
        res.send(buffer);

    } catch (error: any) {
        console.error('Template generation error:', error);
        res.status(500).json({ error: 'Erreur lors de la génération du modèle' });
    }
};
