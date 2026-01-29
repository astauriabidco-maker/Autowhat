/**
 * Integration Controller
 * Manages encrypted API keys and secrets for external services.
 * SECURITY: Never returns raw secret values - only masked previews.
 */
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt } from '../utils/crypto';

const prisma = new PrismaClient();

// Define known providers and their expected keys
const PROVIDER_DEFINITIONS: Record<string, { name: string; icon: string; keys: string[] }> = {
    STRIPE: {
        name: 'Stripe Paiements',
        icon: 'CreditCard',
        keys: ['SECRET_KEY', 'PUBLISHABLE_KEY', 'WEBHOOK_SECRET'],
    },
    SMTP: {
        name: 'Email SMTP',
        icon: 'Mail',
        keys: ['HOST', 'PORT', 'USER', 'PASSWORD', 'FROM_EMAIL'],
    },
    SENDGRID: {
        name: 'SendGrid',
        icon: 'Mail',
        keys: ['API_KEY'],
    },
    WHATSAPP: {
        name: 'WhatsApp Business',
        icon: 'MessageSquare',
        keys: ['TOKEN', 'PHONE_ID', 'VERIFY_TOKEN'],
    },
    REDIS: {
        name: 'Redis Cache',
        icon: 'Database',
        keys: ['URL'],
    },
    GOOGLE_MAPS: {
        name: 'Google Maps',
        icon: 'Map',
        keys: ['API_KEY'],
    },
};

/**
 * Generate a masked preview of a secret
 * Shows last 4 characters only
 */
function maskSecret(value: string): string {
    if (value.length <= 4) {
        return '●●●●';
    }
    return '●●●●●●●●' + value.slice(-4);
}

/**
 * GET /superadmin/integrations
 * Returns all integrations grouped by provider with masked values.
 */
export const getIntegrations = async (req: Request, res: Response): Promise<void> => {
    try {
        // Get all integrations from DB
        const integrations = await prisma.integration.findMany({
            orderBy: [{ provider: 'asc' }, { key: 'asc' }],
        });

        // Build response grouped by provider
        const result: Record<string, {
            name: string;
            icon: string;
            keys: Array<{
                key: string;
                isSet: boolean;
                isEnabled: boolean;
                preview: string | null;
                updatedAt: string | null;
            }>;
        }> = {};

        // Initialize all known providers
        for (const [provider, def] of Object.entries(PROVIDER_DEFINITIONS)) {
            result[provider] = {
                name: def.name,
                icon: def.icon,
                keys: def.keys.map(key => ({
                    key,
                    isSet: false,
                    isEnabled: true,
                    preview: null,
                    updatedAt: null,
                })),
            };
        }

        // Update with actual values from DB
        for (const integration of integrations) {
            const provider = integration.provider;

            // Handle known providers
            if (result[provider]) {
                const keyIndex = result[provider].keys.findIndex(k => k.key === integration.key);
                if (keyIndex >= 0) {
                    try {
                        const decrypted = decrypt(integration.value);
                        result[provider].keys[keyIndex] = {
                            key: integration.key,
                            isSet: true,
                            isEnabled: integration.isEnabled,
                            preview: maskSecret(decrypted),
                            updatedAt: integration.updatedAt.toISOString(),
                        };
                    } catch (e) {
                        // Decryption failed - mark as corrupted
                        result[provider].keys[keyIndex] = {
                            key: integration.key,
                            isSet: true,
                            isEnabled: integration.isEnabled,
                            preview: '⚠️ Corrupted',
                            updatedAt: integration.updatedAt.toISOString(),
                        };
                    }
                } else {
                    // Custom key not in predefined list
                    try {
                        const decrypted = decrypt(integration.value);
                        result[provider].keys.push({
                            key: integration.key,
                            isSet: true,
                            isEnabled: integration.isEnabled,
                            preview: maskSecret(decrypted),
                            updatedAt: integration.updatedAt.toISOString(),
                        });
                    } catch (e) {
                        result[provider].keys.push({
                            key: integration.key,
                            isSet: true,
                            isEnabled: integration.isEnabled,
                            preview: '⚠️ Corrupted',
                            updatedAt: integration.updatedAt.toISOString(),
                        });
                    }
                }
            } else {
                // Custom provider not in predefined list
                try {
                    const decrypted = decrypt(integration.value);
                    result[provider] = {
                        name: provider,
                        icon: 'Key',
                        keys: [{
                            key: integration.key,
                            isSet: true,
                            isEnabled: integration.isEnabled,
                            preview: maskSecret(decrypted),
                            updatedAt: integration.updatedAt.toISOString(),
                        }],
                    };
                } catch (e) {
                    result[provider] = {
                        name: provider,
                        icon: 'Key',
                        keys: [{
                            key: integration.key,
                            isSet: true,
                            isEnabled: integration.isEnabled,
                            preview: '⚠️ Corrupted',
                            updatedAt: integration.updatedAt.toISOString(),
                        }],
                    };
                }
            }
        }

        res.status(200).json(result);
    } catch (error: any) {
        console.error('Error fetching integrations:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des intégrations' });
    }
};

/**
 * PUT /superadmin/integrations
 * Creates or updates an encrypted integration.
 */
export const upsertIntegration = async (req: Request, res: Response): Promise<void> => {
    try {
        const { provider, key, value, isEnabled } = req.body;

        if (!provider || !key) {
            res.status(400).json({ error: 'Provider et Key sont requis' });
            return;
        }

        // If value is provided, encrypt and upsert
        if (value !== undefined && value !== null && value !== '') {
            const encryptedValue = encrypt(value);

            await prisma.integration.upsert({
                where: {
                    provider_key: { provider: provider.toUpperCase(), key: key.toUpperCase() },
                },
                update: {
                    value: encryptedValue,
                    isEnabled: isEnabled ?? true,
                },
                create: {
                    provider: provider.toUpperCase(),
                    key: key.toUpperCase(),
                    value: encryptedValue,
                    isEnabled: isEnabled ?? true,
                },
            });

            console.log(`🔐 Integration updated: ${provider}.${key}`);
            res.status(200).json({ success: true, message: 'Intégration sauvegardée' });
        } else if (isEnabled !== undefined) {
            // Just updating isEnabled flag
            await prisma.integration.update({
                where: {
                    provider_key: { provider: provider.toUpperCase(), key: key.toUpperCase() },
                },
                data: { isEnabled },
            });

            res.status(200).json({ success: true, message: 'Statut mis à jour' });
        } else {
            res.status(400).json({ error: 'Value ou isEnabled requis' });
        }
    } catch (error: any) {
        console.error('Error upserting integration:', error);
        res.status(500).json({ error: 'Erreur lors de la sauvegarde de l\'intégration' });
    }
};

/**
 * DELETE /superadmin/integrations
 * Deletes an integration.
 */
export const deleteIntegration = async (req: Request, res: Response): Promise<void> => {
    try {
        const { provider, key } = req.body;

        if (!provider || !key) {
            res.status(400).json({ error: 'Provider et Key sont requis' });
            return;
        }

        await prisma.integration.delete({
            where: {
                provider_key: { provider: provider.toUpperCase(), key: key.toUpperCase() },
            },
        });

        console.log(`🗑️ Integration deleted: ${provider}.${key}`);
        res.status(200).json({ success: true, message: 'Intégration supprimée' });
    } catch (error: any) {
        console.error('Error deleting integration:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
};
