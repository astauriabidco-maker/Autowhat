/**
 * Privacy Controller
 * 
 * API endpoints for managing Privacy Suite settings
 * and getting purge estimates.
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getPurgeEstimate, triggerManualPurge } from '../modules/privacy/retentionJob';
import { getAnonymizationPreview } from '../modules/privacy/anonymizer';

const prisma = new PrismaClient();

/**
 * GET /api/privacy/settings
 * Get privacy settings for the authenticated tenant
 */
export const getPrivacySettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = (req as any).tenantId;

        if (!tenantId) {
            res.status(401).json({ error: 'Tenant non authentifié' });
            return;
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                isPrivacyModeEnabled: true,
                dataRetentionDays: true,
                lastPurgeDate: true
            }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant non trouvé' });
            return;
        }

        res.status(200).json(tenant);
    } catch (error: any) {
        console.error('Error fetching privacy settings:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des paramètres' });
    }
};

/**
 * PUT /api/privacy/settings
 * Update privacy settings for the authenticated tenant
 */
export const updatePrivacySettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = (req as any).tenantId;

        if (!tenantId) {
            res.status(401).json({ error: 'Tenant non authentifié' });
            return;
        }

        const { isPrivacyModeEnabled, dataRetentionDays } = req.body;

        const updateData: any = {};

        if (typeof isPrivacyModeEnabled === 'boolean') {
            updateData.isPrivacyModeEnabled = isPrivacyModeEnabled;
        }

        if (typeof dataRetentionDays === 'number' && dataRetentionDays >= 0) {
            updateData.dataRetentionDays = dataRetentionDays;
        }

        const tenant = await prisma.tenant.update({
            where: { id: tenantId },
            data: updateData,
            select: {
                isPrivacyModeEnabled: true,
                dataRetentionDays: true,
                lastPurgeDate: true
            }
        });

        console.log(`🛡️ Privacy settings updated for tenant ${tenantId}:`, updateData);
        res.status(200).json(tenant);
    } catch (error: any) {
        console.error('Error updating privacy settings:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour des paramètres' });
    }
};

/**
 * GET /api/privacy/purge-estimate
 * Get an estimate of records that would be purged with current settings
 */
export const getPurgeEstimateHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = (req as any).tenantId;

        if (!tenantId) {
            res.status(401).json({ error: 'Tenant non authentifié' });
            return;
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { dataRetentionDays: true }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant non trouvé' });
            return;
        }

        if (tenant.dataRetentionDays === 0) {
            res.status(200).json({
                attendances: 0,
                tickets: 0,
                total: 0,
                message: 'Rétention illimitée - aucune donnée ne sera purgée'
            });
            return;
        }

        const estimate = await getPurgeEstimate(tenantId, tenant.dataRetentionDays);
        res.status(200).json(estimate);
    } catch (error: any) {
        console.error('Error getting purge estimate:', error);
        res.status(500).json({ error: 'Erreur lors du calcul de l\'estimation' });
    }
};

/**
 * GET /api/privacy/preview
 * Get a preview of anonymization
 */
export const getAnonymizationPreviewHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const sampleMessage = "Rendez-vous au Chantier Tour Eiffel demain. Jean Dupont sera votre contact.";

        const preview = getAnonymizationPreview(sampleMessage, {
            siteId: 'sample-site-id',
            siteName: 'Chantier Tour Eiffel',
            employeeName: 'Jean Dupont'
        });

        res.status(200).json(preview);
    } catch (error: any) {
        console.error('Error generating preview:', error);
        res.status(500).json({ error: 'Erreur lors de la génération de l\'aperçu' });
    }
};

/**
 * POST /api/privacy/purge (Admin only)
 * Manually trigger a purge for this tenant
 */
export const triggerPurge = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = (req as any).tenantId;

        if (!tenantId) {
            res.status(401).json({ error: 'Tenant non authentifié' });
            return;
        }

        console.log(`🗑️ Manual purge triggered for tenant ${tenantId}`);

        // This is a simplified version - in production you might want to
        // run this in the background
        await triggerManualPurge();

        res.status(200).json({ success: true, message: 'Purge déclenchée avec succès' });
    } catch (error: any) {
        console.error('Error triggering purge:', error);
        res.status(500).json({ error: 'Erreur lors du déclenchement de la purge' });
    }
};
