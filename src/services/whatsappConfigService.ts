/**
 * WhatsApp Config Service
 * Manages BYON (Bring Your Own Number) configurations for enterprise tenants.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Interface for WhatsApp API credentials
export interface WhatsAppCredentials {
    phoneNumberId: string;
    accessToken: string;
    displayName?: string;
}

/**
 * Get WhatsApp config for a specific tenant.
 * Returns null if tenant uses shared number.
 */
export async function getConfigForTenant(tenantId: string): Promise<WhatsAppCredentials | null> {
    const config = await prisma.whatsAppConfig.findUnique({
        where: { tenantId },
        select: {
            phoneNumberId: true,
            accessToken: true,
            displayName: true,
            isActive: true
        }
    });

    if (!config || !config.isActive) {
        return null;
    }

    return {
        phoneNumberId: config.phoneNumberId,
        accessToken: config.accessToken,
        displayName: config.displayName || undefined
    };
}

/**
 * Get tenant ID and config by incoming phone number ID.
 * Used by webhook to route messages to correct tenant.
 */
export async function getConfigByPhoneNumberId(phoneNumberId: string): Promise<{
    tenantId: string;
    config: WhatsAppCredentials;
} | null> {
    const result = await prisma.whatsAppConfig.findUnique({
        where: { phoneNumberId },
        select: {
            tenantId: true,
            phoneNumberId: true,
            accessToken: true,
            displayName: true,
            isActive: true
        }
    });

    if (!result || !result.isActive) {
        return null;
    }

    return {
        tenantId: result.tenantId,
        config: {
            phoneNumberId: result.phoneNumberId,
            accessToken: result.accessToken,
            displayName: result.displayName || undefined
        }
    };
}

/**
 * Get default (shared) WhatsApp credentials from environment.
 */
export function getDefaultConfig(): WhatsAppCredentials {
    const token = process.env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_TOKEN || '';
    const phoneId = process.env.WHATSAPP_PHONE_ID || '';

    return {
        phoneNumberId: phoneId,
        accessToken: token,
        displayName: 'WhatsPoint'
    };
}

/**
 * Get credentials for sending a message to an employee.
 * Checks if their tenant has BYON config, otherwise uses shared number.
 */
export async function getCredentialsForEmployee(employeeId: string): Promise<WhatsAppCredentials> {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { tenantId: true }
    });

    if (employee?.tenantId) {
        const tenantConfig = await getConfigForTenant(employee.tenantId);
        if (tenantConfig) {
            return tenantConfig;
        }
    }

    return getDefaultConfig();
}

/**
 * Get credentials for a specific tenant.
 * Priority order:
 * 1. BYON config (tenant's own WhatsApp number)
 * 2. Assigned System Number (from pool)
 * 3. Default environment credentials (fallback)
 */
export async function getCredentialsForTenant(tenantId: string): Promise<WhatsAppCredentials> {
    // Priority 1: Check for BYON config
    const byonConfig = await getConfigForTenant(tenantId);
    if (byonConfig) {
        console.log(`📞 Using BYON config for tenant ${tenantId}`);
        return byonConfig;
    }

    // Priority 2: Check for assigned system number from pool
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { assignedSystemNumber: true }
    });

    if (tenant?.assignedSystemNumber?.isActive) {
        console.log(`📞 Using assigned system number for tenant ${tenantId}: ${tenant.assignedSystemNumber.displayNumber}`);
        return {
            phoneNumberId: tenant.assignedSystemNumber.phoneNumberId,
            accessToken: tenant.assignedSystemNumber.accessToken,
            displayName: tenant.assignedSystemNumber.displayNumber
        };
    }

    // Priority 3: Fallback to default env credentials
    console.log(`📞 Using default credentials for tenant ${tenantId} (no BYON/assigned number)`);
    return getDefaultConfig();
}

// ==================== CRUD OPERATIONS ====================

/**
 * Upsert WhatsApp config for a tenant.
 */
export async function upsertWhatsAppConfig(
    tenantId: string,
    data: {
        phoneNumberId: string;
        accessToken: string;
        wabaId?: string;
        displayName?: string;
    }
) {
    return prisma.whatsAppConfig.upsert({
        where: { tenantId },
        create: {
            tenantId,
            phoneNumberId: data.phoneNumberId,
            accessToken: data.accessToken,
            wabaId: data.wabaId,
            displayName: data.displayName,
            isActive: true
        },
        update: {
            phoneNumberId: data.phoneNumberId,
            accessToken: data.accessToken,
            wabaId: data.wabaId,
            displayName: data.displayName,
            isActive: true
        }
    });
}

/**
 * Get config for API response (token masked for security).
 */
export async function getWhatsAppConfigForDisplay(tenantId: string): Promise<{
    exists: boolean;
    isActive: boolean;
    phoneNumberId?: string;
    wabaId?: string;
    displayName?: string;
    maskedToken?: string;
    createdAt?: Date;
} | null> {
    const config = await prisma.whatsAppConfig.findUnique({
        where: { tenantId }
    });

    if (!config) {
        return { exists: false, isActive: false };
    }

    // Mask token: show only last 4 chars
    const maskedToken = config.accessToken
        ? `${'*'.repeat(20)}${config.accessToken.slice(-4)}`
        : undefined;

    return {
        exists: true,
        isActive: config.isActive,
        phoneNumberId: config.phoneNumberId,
        wabaId: config.wabaId || undefined,
        displayName: config.displayName || undefined,
        maskedToken,
        createdAt: config.createdAt
    };
}

/**
 * Delete WhatsApp config for a tenant (reverts to shared number).
 */
export async function deleteWhatsAppConfig(tenantId: string): Promise<boolean> {
    try {
        await prisma.whatsAppConfig.delete({
            where: { tenantId }
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * Toggle active status of a WhatsApp config.
 */
export async function toggleWhatsAppConfig(tenantId: string, isActive: boolean) {
    return prisma.whatsAppConfig.update({
        where: { tenantId },
        data: { isActive }
    });
}
