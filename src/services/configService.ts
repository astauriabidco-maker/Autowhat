/**
 * Configuration Service
 * Retrieves decrypted provider configurations from the Integration vault.
 * Falls back to process.env for backward compatibility.
 */
import { PrismaClient } from '@prisma/client';
import { decrypt } from '../utils/crypto';

const prisma = new PrismaClient();

// Mapping of provider keys to environment variable names
const ENV_FALLBACK_MAP: Record<string, Record<string, string>> = {
    STRIPE: {
        SECRET_KEY: 'STRIPE_SECRET_KEY',
        PUBLISHABLE_KEY: 'STRIPE_PUBLISHABLE_KEY',
        WEBHOOK_SECRET: 'STRIPE_WEBHOOK_SECRET',
    },
    SMTP: {
        HOST: 'SMTP_HOST',
        PORT: 'SMTP_PORT',
        USER: 'SMTP_USER',
        PASSWORD: 'SMTP_PASSWORD',
        FROM_EMAIL: 'SMTP_FROM_EMAIL',
    },
    SENDGRID: {
        API_KEY: 'SENDGRID_API_KEY',
    },
    WHATSAPP: {
        TOKEN: 'WHATSAPP_TOKEN',
        PHONE_ID: 'WHATSAPP_PHONE_ID',
        VERIFY_TOKEN: 'VERIFY_TOKEN',
    },
    REDIS: {
        URL: 'REDIS_URL',
    },
    GOOGLE_MAPS: {
        API_KEY: 'GOOGLE_MAPS_API_KEY',
    },
};

/**
 * Get decrypted configuration for a provider
 * @param providerName - Provider name (e.g., "STRIPE", "SMTP")
 * @returns Object with key/value pairs of decrypted secrets
 */
export async function getProviderConfig(providerName: string): Promise<Record<string, string>> {
    const result: Record<string, string> = {};

    try {
        // Try to get from database first
        const integrations = await prisma.integration.findMany({
            where: {
                provider: providerName,
                isEnabled: true,
            },
        });

        if (integrations.length > 0) {
            // Decrypt each value from database
            for (const integration of integrations) {
                try {
                    result[integration.key] = decrypt(integration.value);
                } catch (decryptError) {
                    console.error(`Failed to decrypt ${providerName}.${integration.key}:`, decryptError);
                }
            }
            return result;
        }

        // Fallback to environment variables
        const envMap = ENV_FALLBACK_MAP[providerName];
        if (envMap) {
            for (const [key, envVar] of Object.entries(envMap)) {
                const value = process.env[envVar];
                if (value) {
                    result[key] = value;
                }
            }
        }
    } catch (error) {
        console.error(`Error fetching config for ${providerName}:`, error);

        // On error, try env fallback
        const envMap = ENV_FALLBACK_MAP[providerName];
        if (envMap) {
            for (const [key, envVar] of Object.entries(envMap)) {
                const value = process.env[envVar];
                if (value) {
                    result[key] = value;
                }
            }
        }
    }

    return result;
}

/**
 * Get a single config value for a provider/key pair
 * @param providerName - Provider name
 * @param key - Key name
 * @returns Decrypted value or null
 */
export async function getConfigValue(providerName: string, key: string): Promise<string | null> {
    try {
        const integration = await prisma.integration.findUnique({
            where: {
                provider_key: { provider: providerName, key },
            },
        });

        if (integration && integration.isEnabled) {
            return decrypt(integration.value);
        }

        // Fallback to env
        const envMap = ENV_FALLBACK_MAP[providerName];
        if (envMap && envMap[key]) {
            return process.env[envMap[key]] || null;
        }

        return null;
    } catch (error) {
        console.error(`Error fetching config ${providerName}.${key}:`, error);

        // Fallback to env on error
        const envMap = ENV_FALLBACK_MAP[providerName];
        if (envMap && envMap[key]) {
            return process.env[envMap[key]] || null;
        }
        return null;
    }
}

/**
 * Check if a provider is configured (either in DB or env)
 */
export async function isProviderConfigured(providerName: string): Promise<boolean> {
    const config = await getProviderConfig(providerName);
    return Object.keys(config).length > 0;
}
