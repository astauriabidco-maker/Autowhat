import prisma from '../lib/prisma';
import { assignNumberToTenant } from './numberAllocationService';
import { decryptSecretIfEncrypted, encryptSecret } from '../utils/crypto';
/**
 * WhatsApp Config Service
 * Manages BYON (Bring Your Own Number) configurations for enterprise tenants.
 */



// Interface for WhatsApp API credentials
export interface WhatsAppCredentials {
    phoneNumberId: string;
    accessToken: string;
    displayName?: string;
}

export type WhatsAppChannelType = 'BYON' | 'SYSTEM' | 'DEFAULT' | 'DISABLED';
export type OutgoingWhatsAppChannelType = 'BYON' | 'SYSTEM_DEDICATED' | 'SYSTEM_SHARED' | 'DEFAULT';
export type OutgoingWhatsAppIntent =
    | 'LOGIN_OTP'
    | 'ONBOARDING'
    | 'ATTENDANCE'
    | 'MANAGER_NOTIFICATION'
    | 'EMPLOYEE_NOTIFICATION'
    | 'CUSTOMER_NOTIFICATION'
    | 'GENERAL'
    | string;

export interface IncomingWhatsAppChannel {
    type: WhatsAppChannelType;
    phoneNumberId?: string;
    config: WhatsAppCredentials;
    tenantIds?: string[];
}

export interface OutgoingWhatsAppChannel {
    type: OutgoingWhatsAppChannelType;
    intent: OutgoingWhatsAppIntent;
    tenantId: string;
    phoneNumberId: string;
    config: WhatsAppCredentials;
    systemPhoneNumberId?: string;
    countryCode?: string;
    planScope?: string;
}

function decryptWhatsAppToken(accessToken: string): string {
    try {
        return decryptSecretIfEncrypted(accessToken);
    } catch (error) {
        console.error('❌ Failed to decrypt WhatsApp access token:', error);
        throw new Error('Invalid encrypted WhatsApp access token');
    }
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
        accessToken: decryptWhatsAppToken(config.accessToken),
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
            accessToken: decryptWhatsAppToken(result.accessToken),
            displayName: result.displayName || undefined
        }
    };
}

/**
 * Get default (shared) WhatsApp credentials from environment.
 */
export function getDefaultConfig(): WhatsAppCredentials {
    const token = process.env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_TOKEN || '';
    const phoneId = process.env.WHATSAPP_PHONE_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || '';

    return {
        phoneNumberId: phoneId,
        accessToken: token,
        displayName: 'WhatsPoint'
    };
}

function normalizeRoutingSegment(value: string | null | undefined, fallback: string): string {
    return (value || fallback).trim().toUpperCase() || fallback;
}

function isDefaultFallbackAllowed(): boolean {
    return process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEFAULT_WHATSAPP_FALLBACK === 'true';
}

function credentialsFromSystemNumber(number: {
    phoneNumberId: string;
    accessToken: string;
    displayNumber: string;
}): WhatsAppCredentials {
    return {
        phoneNumberId: number.phoneNumberId,
        accessToken: decryptWhatsAppToken(number.accessToken),
        displayName: number.displayNumber
    };
}

/**
 * Resolves the channel that received an inbound webhook message.
 * BYON and system-pool numbers carry a tenant scope; default credentials keep
 * the historic global lookup behavior for the MVP shared number.
 */
export async function resolveIncomingWhatsAppChannel(phoneNumberId?: string): Promise<IncomingWhatsAppChannel> {
    const defaultConfig = getDefaultConfig();

    if (!phoneNumberId) {
        return {
            type: 'DEFAULT',
            config: defaultConfig
        };
    }

    const byonConfig = await prisma.whatsAppConfig.findUnique({
        where: { phoneNumberId },
        select: {
            tenantId: true,
            phoneNumberId: true,
            accessToken: true,
            displayName: true,
            isActive: true,
            tenant: {
                select: {
                    status: true
                }
            }
        }
    });

    if (byonConfig && (!byonConfig.isActive || byonConfig.tenant.status !== 'ACTIVE')) {
        return {
            type: 'DISABLED',
            phoneNumberId,
            tenantIds: [],
            config: defaultConfig
        };
    }

    if (byonConfig?.isActive && byonConfig.tenant.status === 'ACTIVE') {
        return {
            type: 'BYON',
            phoneNumberId,
            tenantIds: [byonConfig.tenantId],
            config: {
                phoneNumberId: byonConfig.phoneNumberId,
                accessToken: decryptWhatsAppToken(byonConfig.accessToken),
                displayName: byonConfig.displayName || undefined
            }
        };
    }

    const systemNumber = await prisma.systemPhoneNumber.findUnique({
        where: { phoneNumberId },
        select: {
            phoneNumberId: true,
            accessToken: true,
            displayNumber: true,
            isActive: true,
            setupStatus: true,
            tenants: {
                where: { status: 'ACTIVE' },
                select: { id: true }
            }
        }
    });

    if (systemNumber && (!systemNumber.isActive || systemNumber.setupStatus !== 'ACTIVE')) {
        return {
            type: 'DISABLED',
            phoneNumberId,
            tenantIds: [],
            config: defaultConfig
        };
    }

    if (systemNumber?.isActive) {
        return {
            type: 'SYSTEM',
            phoneNumberId,
            tenantIds: systemNumber.tenants.map(tenant => tenant.id),
            config: {
                phoneNumberId: systemNumber.phoneNumberId,
                accessToken: decryptWhatsAppToken(systemNumber.accessToken),
                displayName: systemNumber.displayNumber
            }
        };
    }

    return {
        type: 'DEFAULT',
        phoneNumberId,
        config: {
            ...defaultConfig,
            phoneNumberId
        }
    };
}

/**
 * Resolves the best outbound WhatsApp channel for a tenant and business intent.
 *
 * Priority:
 * 1. Active tenant BYON config.
 * 2. Active dedicated WhatsPoint number assigned to the tenant.
 * 3. Active shared WhatsPoint number assigned to, or allocatable for, the tenant country/plan.
 * 4. Default env credentials only outside production, or with an explicit emergency flag.
 */
export async function resolveOutgoingWhatsAppChannel(
    tenantId: string,
    intent: OutgoingWhatsAppIntent = 'GENERAL'
): Promise<OutgoingWhatsAppChannel> {
    const byonConfig = await getConfigForTenant(tenantId);
    if (byonConfig) {
        console.log(`📞 Using BYON WhatsApp channel for tenant ${tenantId}`, { intent });
        return {
            type: 'BYON',
            intent,
            tenantId,
            phoneNumberId: byonConfig.phoneNumberId,
            config: byonConfig
        };
    }

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { assignedSystemNumber: true }
    });

    if (!tenant) {
        throw new Error(`Tenant ${tenantId} not found for WhatsApp outbound routing`);
    }

    const tenantCountry = normalizeRoutingSegment(tenant.country, 'DEFAULT');
    const tenantPlan = normalizeRoutingSegment(tenant.plan, 'ANY');
    const assignedNumber = tenant.assignedSystemNumber;

    if (assignedNumber?.isActive && assignedNumber.setupStatus === 'ACTIVE') {
        const numberCountry = normalizeRoutingSegment(assignedNumber.countryCode, 'DEFAULT');
        const numberPlanScope = normalizeRoutingSegment(assignedNumber.planScope, 'ANY');
        const countryMatches = numberCountry === 'DEFAULT' || tenantCountry === 'DEFAULT' || numberCountry === tenantCountry;
        const planMatches = numberPlanScope === 'ANY' || numberPlanScope === tenantPlan;

        if (countryMatches && planMatches) {
            const type = assignedNumber.channelType === 'DEDICATED' ? 'SYSTEM_DEDICATED' : 'SYSTEM_SHARED';
            console.log(`📞 Using ${type} WhatsApp channel for tenant ${tenantId}`, { intent });
            return {
                type,
                intent,
                tenantId,
                phoneNumberId: assignedNumber.phoneNumberId,
                systemPhoneNumberId: assignedNumber.id,
                countryCode: assignedNumber.countryCode,
                planScope: assignedNumber.planScope,
                config: credentialsFromSystemNumber(assignedNumber)
            };
        }

        console.warn('⚠️ Skipping incompatible assigned WhatsApp channel for outbound routing', {
            tenantId,
            intent,
            tenantCountry,
            tenantPlan,
            systemPhoneNumberId: assignedNumber.id,
            numberCountry,
            numberPlanScope
        });
    }

    const allocatedNumber = await assignNumberToTenant(tenantId, tenantCountry);
    if (allocatedNumber?.isActive && allocatedNumber.setupStatus === 'ACTIVE') {
        const type = allocatedNumber.channelType === 'DEDICATED' ? 'SYSTEM_DEDICATED' : 'SYSTEM_SHARED';
        console.log(`📞 Using allocated ${type} WhatsApp channel for tenant ${tenantId}`, { intent });
        return {
            type,
            intent,
            tenantId,
            phoneNumberId: allocatedNumber.phoneNumberId,
            systemPhoneNumberId: allocatedNumber.id,
            countryCode: allocatedNumber.countryCode,
            planScope: allocatedNumber.planScope,
            config: credentialsFromSystemNumber(allocatedNumber)
        };
    }

    const defaultConfig = getDefaultConfig();
    if (isDefaultFallbackAllowed() && defaultConfig.phoneNumberId && defaultConfig.accessToken) {
        console.warn(`⚠️ Using default WhatsApp fallback for tenant ${tenantId}`, {
            intent,
            nodeEnv: process.env.NODE_ENV || 'development'
        });
        return {
            type: 'DEFAULT',
            intent,
            tenantId,
            phoneNumberId: defaultConfig.phoneNumberId,
            config: defaultConfig
        };
    }

    throw new Error(`No active WhatsApp outbound channel available for tenant ${tenantId}`);
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
        return (await resolveOutgoingWhatsAppChannel(employee.tenantId, 'EMPLOYEE_NOTIFICATION')).config;
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
    return (await resolveOutgoingWhatsAppChannel(tenantId, 'GENERAL')).config;
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
    const encryptedAccessToken = encryptSecret(data.accessToken);

    return prisma.whatsAppConfig.upsert({
        where: { tenantId },
        create: {
            tenantId,
            phoneNumberId: data.phoneNumberId,
            accessToken: encryptedAccessToken,
            wabaId: data.wabaId,
            displayName: data.displayName,
            isActive: true
        },
        update: {
            phoneNumberId: data.phoneNumberId,
            accessToken: encryptedAccessToken,
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
    const accessToken = config.accessToken
        ? decryptWhatsAppToken(config.accessToken)
        : undefined;

    const maskedToken = accessToken
        ? `${'*'.repeat(20)}${accessToken.slice(-4)}`
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
