import { Request, Response } from 'express';
import { getTemplate } from '../config/industryTemplates';
import prisma from '../lib/prisma';
import { signUploadUrlIfNeeded, uploadPathFromUrl } from '../utils/signedFileUrl';


/**
 * Get tenant settings
 * GET /api/settings
 */
export const getSettings = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId }
        });

        if (!tenant) {
            return res.status(404).json({ error: 'Tenant non trouvé' });
        }

        // Get template defaults for this industry
        const template = getTemplate(tenant.industry);

        const config: Record<string, any> = {
            ...(tenant.config && typeof tenant.config === 'object' ? tenant.config as Record<string, any> : template.config),
        };
        if (typeof config.logoUrl === 'string') {
            config.logoUrl = signUploadUrlIfNeeded(config.logoUrl);
        }

        return res.json({
            // Basic info
            name: tenant.name,
            industry: tenant.industry,

            // Legal info (international)
            country: tenant.country,
            legalName: tenant.legalName,
            legalId: tenant.legalId,
            taxId: tenant.taxId,
            address: tenant.address,
            city: tenant.city,

            // Work config
            workStartTime: tenant.workStartTime,
            maxWorkHours: tenant.maxWorkHours,
            config,
            vocabulary: tenant.vocabulary || template.vocabulary,

            // Template defaults for reference
            templateConfig: template.config,
            templateVocabulary: template.vocabulary
        });
    } catch (error) {
        console.error('❌ Error fetching settings:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * Upload tenant logo
 * POST /api/settings/logo
 */
export const uploadLogo = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier uploadé' });
        }

        // Utiliser le nom de fichier généré par multer
        const logoUrl = `/uploads/${req.file.filename}`;

        // Récupérer le tenant actuel
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId }
        });

        if (!tenant) {
            return res.status(404).json({ error: 'Tenant non trouvé' });
        }

        const currentConfig = typeof tenant.config === 'object' && tenant.config !== null ? tenant.config : {};

        // Mettre à jour la DB
        await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                config: {
                    ...currentConfig,
                    logoUrl
                }
            }
        });

        console.log(`🖼️ Logo mis à jour pour le tenant ${tenantId}`);

        return res.json({ success: true, logoUrl: signUploadUrlIfNeeded(logoUrl) });
    } catch (error) {
        console.error('❌ Erreur uploadLogo:', error);
        return res.status(500).json({ error: 'Erreur serveur lors de l\'upload' });
    }
};

/**
 * Update tenant settings
 * PUT /api/settings
 */
export const updateSettings = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const {
            name,
            industry,
            country,
            legalName,
            legalId,
            taxId,
            address,
            city,
            workStartTime,
            maxWorkHours,
            config,
            vocabulary,
            resetToDefaults
        } = req.body;

        // Get current tenant
        const currentTenant = await prisma.tenant.findUnique({
            where: { id: tenantId }
        });

        if (!currentTenant) {
            return res.status(404).json({ error: 'Tenant non trouvé' });
        }

        // Prepare update data
        const updateData: any = {};

        // Basic info
        if (name !== undefined) updateData.name = name;
        if (industry !== undefined) updateData.industry = industry;

        // Legal info
        if (country !== undefined) updateData.country = country;
        if (legalName !== undefined) updateData.legalName = legalName;
        if (legalId !== undefined) updateData.legalId = legalId;
        if (taxId !== undefined) updateData.taxId = taxId;
        if (address !== undefined) updateData.address = address;
        if (city !== undefined) updateData.city = city;

        // Work config
        if (workStartTime) updateData.workStartTime = workStartTime;
        if (maxWorkHours) updateData.maxWorkHours = maxWorkHours;

        // Handle config update
        if (config) {
            const nextConfig = { ...config };
            if (typeof nextConfig.logoUrl === 'string') {
                nextConfig.logoUrl = uploadPathFromUrl(nextConfig.logoUrl) || nextConfig.logoUrl;
            }
            updateData.config = nextConfig;
        }

        // Handle vocabulary update
        if (vocabulary) {
            updateData.vocabulary = vocabulary;
        }

        // If industry changed, check if it's a known template or use GENERIC
        if (industry && industry !== currentTenant.industry) {
            const template = getTemplate(industry);
            if (resetToDefaults) {
                updateData.config = template.config;
                updateData.vocabulary = template.vocabulary;
                console.log(`🔄 Industry changed to ${industry}, resetting to defaults`);
            }
        }

        const updatedTenant = await prisma.tenant.update({
            where: { id: tenantId },
            data: updateData
        });

        console.log(`⚙️ Settings updated for tenant: ${updatedTenant.name}`);

        // Get template for response
        const template = getTemplate(updatedTenant.industry);

        const responseConfig: Record<string, any> = {
            ...(updatedTenant.config && typeof updatedTenant.config === 'object' ? updatedTenant.config as Record<string, any> : template.config),
        };
        if (typeof responseConfig.logoUrl === 'string') {
            responseConfig.logoUrl = signUploadUrlIfNeeded(responseConfig.logoUrl);
        }

        return res.json({
            success: true,
            message: 'Paramètres mis à jour',
            settings: {
                name: updatedTenant.name,
                industry: updatedTenant.industry,
                country: updatedTenant.country,
                legalName: updatedTenant.legalName,
                legalId: updatedTenant.legalId,
                taxId: updatedTenant.taxId,
                address: updatedTenant.address,
                city: updatedTenant.city,
                workStartTime: updatedTenant.workStartTime,
                maxWorkHours: updatedTenant.maxWorkHours,
                config: responseConfig,
                vocabulary: updatedTenant.vocabulary || template.vocabulary
            }
        });
    } catch (error) {
        console.error('❌ Error updating settings:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * Get tenant info for SaaS (plan, trial, quota)
 * GET /api/tenant/info
 */
export const getTenantInfo = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                id: true,
                name: true,
                country: true,
                plan: true,
                trialEndsAt: true,
                maxEmployees: true
            }
        });

        if (!tenant) {
            return res.status(404).json({ error: 'Tenant non trouvé' });
        }

        // Count current active employees
        const currentEmployees = await prisma.employee.count({
            where: {
                tenantId,
                role: { not: 'ARCHIVED' }
            }
        });

        return res.json({
            ...tenant,
            currentEmployees
        });
    } catch (error) {
        console.error('❌ Error fetching tenant info:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};
