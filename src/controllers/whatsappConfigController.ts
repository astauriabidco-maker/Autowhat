/**
 * WhatsApp Config Controller
 * Handles BYON (Bring Your Own Number) configuration for enterprise tenants.
 */

import { Request, Response } from 'express';
import {
    getWhatsAppConfigForDisplay,
    upsertWhatsAppConfig,
    deleteWhatsAppConfig,
    toggleWhatsAppConfig
} from '../services/whatsappConfigService';
import { testConnection } from '../services/whatsappService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get current WhatsApp config for tenant (token masked)
 * GET /api/whatsapp-config
 */
export const getConfig = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        // Check if tenant is on Enterprise plan
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { plan: true, name: true }
        });

        if (!tenant) {
            return res.status(404).json({ error: 'Tenant non trouvé' });
        }

        // Feature gating - only LARGE/ENTERPRISE plans can use BYON
        const isEnterprise = ['LARGE', 'ENTERPRISE'].includes(tenant.plan);

        const config = await getWhatsAppConfigForDisplay(tenantId);

        return res.json({
            isEnterprise,
            tenantName: tenant.name,
            ...config
        });
    } catch (error) {
        console.error('❌ Error getting WhatsApp config:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * Create or update WhatsApp config
 * POST /api/whatsapp-config
 */
export const saveConfig = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        // Check if tenant is on Enterprise plan
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { plan: true }
        });

        if (!tenant || !['LARGE', 'ENTERPRISE'].includes(tenant.plan)) {
            return res.status(403).json({
                error: 'Cette fonctionnalité nécessite un plan Enterprise'
            });
        }

        const { phoneNumberId, accessToken, wabaId, displayName } = req.body;

        if (!phoneNumberId || !accessToken) {
            return res.status(400).json({
                error: 'phoneNumberId et accessToken sont requis'
            });
        }

        await upsertWhatsAppConfig(tenantId, {
            phoneNumberId,
            accessToken,
            wabaId,
            displayName
        });

        console.log(`🔧 BYON config saved for tenant ${tenantId}`);

        return res.json({
            success: true,
            message: 'Configuration WhatsApp sauvegardée'
        });
    } catch (error) {
        console.error('❌ Error saving WhatsApp config:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * Test WhatsApp connection with provided credentials
 * POST /api/whatsapp-config/test
 */
export const testConfig = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        // Get test phone and credentials from request body
        const { phoneNumberId, accessToken, displayName, testPhone } = req.body;

        if (!phoneNumberId || !accessToken) {
            return res.status(400).json({
                error: 'phoneNumberId et accessToken sont requis'
            });
        }

        const result = await testConnection(testPhone, {
            phoneNumberId,
            accessToken,
            displayName
        });

        if (result.success) {
            return res.json({
                success: true,
                message: 'Test réussi ! Vérifiez votre WhatsApp.'
            });
        } else {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('❌ Error testing WhatsApp config:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * Delete WhatsApp config (revert to shared number)
 * DELETE /api/whatsapp-config
 */
export const removeConfig = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const deleted = await deleteWhatsAppConfig(tenantId);

        if (deleted) {
            console.log(`🗑️ BYON config deleted for tenant ${tenantId}`);
            return res.json({
                success: true,
                message: 'Configuration supprimée. Vous utilisez maintenant le numéro partagé.'
            });
        } else {
            return res.status(404).json({ error: 'Configuration non trouvée' });
        }
    } catch (error) {
        console.error('❌ Error deleting WhatsApp config:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * Toggle config active state
 * PATCH /api/whatsapp-config/toggle
 */
export const toggleConfig = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const { isActive } = req.body;

        if (typeof isActive !== 'boolean') {
            return res.status(400).json({ error: 'isActive doit être un booléen' });
        }

        await toggleWhatsAppConfig(tenantId, isActive);

        if (isActive) {
            console.log(`✅ BYON config enabled for tenant ${tenantId}`);
        } else {
            console.log(`⏸️ BYON config disabled for tenant ${tenantId}`);
        }

        return res.json({
            success: true,
            message: isActive
                ? 'WhatsApp marque blanche activé'
                : 'Basculé sur le numéro partagé'
        });
    } catch (error) {
        console.error('❌ Error toggling WhatsApp config:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};
