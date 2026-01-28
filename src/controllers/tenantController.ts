import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getTemplate } from '../config/industryTemplates';

const prisma = new PrismaClient();

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

        return res.json({
            name: tenant.name,
            industry: tenant.industry,
            workStartTime: tenant.workStartTime,
            maxWorkHours: tenant.maxWorkHours,
            config: tenant.config || template.config,
            vocabulary: tenant.vocabulary || template.vocabulary,
            // Send template defaults for reference
            templateConfig: template.config,
            templateVocabulary: template.vocabulary
        });
    } catch (error) {
        console.error('❌ Error fetching settings:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
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
            workStartTime,
            maxWorkHours,
            config,
            vocabulary,
            resetToDefaults
        } = req.body;

        // Get current tenant to check if industry changed
        const currentTenant = await prisma.tenant.findUnique({
            where: { id: tenantId }
        });

        if (!currentTenant) {
            return res.status(404).json({ error: 'Tenant non trouvé' });
        }

        // Prepare update data
        const updateData: any = {};

        if (name) updateData.name = name;
        if (industry) updateData.industry = industry;
        if (workStartTime) updateData.workStartTime = workStartTime;
        if (maxWorkHours) updateData.maxWorkHours = maxWorkHours;

        // Handle config update
        if (config) {
            updateData.config = config;
        }

        // Handle vocabulary update
        if (vocabulary) {
            updateData.vocabulary = vocabulary;
        }

        // If industry changed and resetToDefaults is true, reset config/vocabulary
        if (industry && industry !== currentTenant.industry && resetToDefaults) {
            const template = getTemplate(industry);
            updateData.config = template.config;
            updateData.vocabulary = template.vocabulary;
            console.log(`🔄 Industry changed to ${industry}, resetting to defaults`);
        }

        const updatedTenant = await prisma.tenant.update({
            where: { id: tenantId },
            data: updateData
        });

        console.log(`⚙️ Settings updated for tenant: ${updatedTenant.name}`);

        // Get template for response
        const template = getTemplate(updatedTenant.industry);

        return res.json({
            success: true,
            message: 'Paramètres mis à jour',
            settings: {
                name: updatedTenant.name,
                industry: updatedTenant.industry,
                workStartTime: updatedTenant.workStartTime,
                maxWorkHours: updatedTenant.maxWorkHours,
                config: updatedTenant.config || template.config,
                vocabulary: updatedTenant.vocabulary || template.vocabulary
            }
        });
    } catch (error) {
        console.error('❌ Error updating settings:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};
