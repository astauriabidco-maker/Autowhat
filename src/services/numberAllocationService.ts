/**
 * Number Allocation Service
 * 
 * Manages the allocation of system WhatsApp numbers to tenants.
 * Implements load balancing across the number pool with country-based routing.
 */

import {
    SystemPhoneNumber,
    SystemPhoneNumberChannelType,
    SystemPhoneNumberSetupStatus
} from '@prisma/client';
import axios from 'axios';
import prisma from '../lib/prisma';
import { encryptSecret } from '../utils/crypto';
import { isDemoMode, isFlagEnabled } from '../utils/featureFlags';

const ENABLE_DYNAMIC_NUMBER_PROVISIONING = 'ENABLE_DYNAMIC_NUMBER_PROVISIONING';
const DEFAULT_SHARED_NUMBER_CAPACITY = 50;
const ANY_PLAN_SCOPE = 'ANY';
const CAPACITY_WARNING_THRESHOLD = 0.8;
const DISABLED_WEBHOOK_TRAFFIC_WINDOW_MS = 24 * 60 * 60 * 1000;

export type NumberPoolHealthAlert = {
    id: string;
    severity: 'critical' | 'warning';
    kind:
        | 'NO_AVAILABLE_NUMBER'
        | 'HIGH_CAPACITY'
        | 'ASSIGNED_UNHEALTHY_NUMBER'
        | 'DISABLED_NUMBER_TRAFFIC'
        | 'UNASSIGNED_TENANT'
        | 'POTENTIAL_MISROUTING';
    message: string;
    countryCode?: string;
    planScope?: string;
    tenantId?: string;
    tenantName?: string;
    numberId?: string;
    displayNumber?: string;
};

export type NumberPoolHealth = {
    summary: {
        totalAlerts: number;
        criticalAlerts: number;
        warningAlerts: number;
        activeTenants: number;
        activeNumbers: number;
        availableSharedSlots: number;
    };
    alerts: NumberPoolHealthAlert[];
};

function normalizeChannelType(channelType: string | null | undefined): SystemPhoneNumberChannelType {
    if (channelType === 'DEDICATED' || channelType === 'BYON') return channelType;
    return 'SHARED';
}

function normalizeSetupStatus(setupStatus: string | null | undefined): SystemPhoneNumberSetupStatus {
    if (setupStatus === 'PENDING_MANUAL_SETUP' || setupStatus === 'SUSPENDED' || setupStatus === 'FAILED') {
        return setupStatus;
    }
    return 'ACTIVE';
}

function normalizeMaxTenants(maxTenants: number | null | undefined, channelType: SystemPhoneNumberChannelType): number {
    if (channelType === 'DEDICATED' || channelType === 'BYON') return 1;
    if (!Number.isFinite(maxTenants) || !maxTenants || maxTenants < 1) return DEFAULT_SHARED_NUMBER_CAPACITY;
    return Math.floor(maxTenants);
}

function normalizeCountryCode(countryCode: string | null | undefined): string {
    return (countryCode || 'DEFAULT').trim().toUpperCase() || 'DEFAULT';
}

function normalizePlanScope(planScope: string | null | undefined): string {
    return (planScope || ANY_PLAN_SCOPE).trim().toUpperCase() || ANY_PLAN_SCOPE;
}

async function syncTenantCount(numberId: string): Promise<SystemPhoneNumber> {
    const tenantCount = await prisma.tenant.count({
        where: { assignedSystemNumberId: numberId }
    });

    return prisma.systemPhoneNumber.update({
        where: { id: numberId },
        data: { tenantCount }
    });
}

async function findAllocationCandidates(countryCode: string, tenantPlan: string): Promise<SystemPhoneNumber[]> {
    const country = normalizeCountryCode(countryCode);
    const plan = normalizePlanScope(tenantPlan);
    const fallbacks = Array.from(new Set([country, 'DEFAULT', 'US']));

    for (const fallbackCountry of fallbacks) {
        const candidates = await prisma.systemPhoneNumber.findMany({
            where: {
                countryCode: fallbackCountry,
                isActive: true,
                channelType: 'SHARED',
                setupStatus: 'ACTIVE',
                planScope: { in: [plan, ANY_PLAN_SCOPE] }
            },
            orderBy: [
                { tenantCount: 'asc' },
                { createdAt: 'asc' }
            ]
        });

        const availableCandidates = candidates
            .filter(candidate => candidate.tenantCount < candidate.maxTenants)
            .sort((a, b) => {
                if (a.planScope === plan && b.planScope !== plan) return -1;
                if (a.planScope !== plan && b.planScope === plan) return 1;
                return a.tenantCount - b.tenantCount || a.createdAt.getTime() - b.createdAt.getTime();
            });

        if (availableCandidates.length > 0) {
            if (fallbackCountry !== country) {
                console.log(`📞 No numbers for ${country}, falling back to ${fallbackCountry}`);
            }
            return availableCandidates;
        }
    }

    return [];
}

/**
 * Assigns a system phone number to a tenant based on their country.
 * Uses load balancing to distribute tenants evenly across available numbers.
 * 
 * Algorithm:
 * 1. Find active numbers matching the tenant's country
 * 2. If none found, fallback to "DEFAULT" country numbers
 * 3. Sort by tenantCount ASC and pick the least loaded number
 * 4. Update tenant with assigned number
 * 5. Increment the number's tenant count
 * 
 * @param tenantId - The tenant to assign a number to
 * @param countryCode - ISO country code (FR, US, ES, etc.)
 * @returns The assigned SystemPhoneNumber or null if no numbers available
 */
export async function assignNumberToTenant(
    tenantId: string,
    countryCode: string
): Promise<SystemPhoneNumber | null> {
    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            include: { assignedSystemNumber: true }
        });

        if (!tenant) {
            console.warn(`⚠️ Tenant ${tenantId} not found for number allocation`);
            return null;
        }

        if (tenant.assignedSystemNumber?.isActive) {
            console.log(`📞 Tenant ${tenantId} already assigned to ${tenant.assignedSystemNumber.displayNumber}`);
            return syncTenantCount(tenant.assignedSystemNumber.id);
        }

        const candidates = await findAllocationCandidates(countryCode, tenant.plan);
        if (candidates.length === 0) {
            console.warn(`⚠️ No system phone numbers available for allocation!`);
            return null;
        }

        const selectedNumber = candidates[0];
        const updatedNumber = await assignExistingNumberToTenant(tenantId, selectedNumber.id);

        if (!updatedNumber) return null;

        console.log(`✅ Assigned ${updatedNumber.displayNumber} (${updatedNumber.countryCode}) to tenant ${tenantId}`);
        console.log(`   Load: ${updatedNumber.tenantCount} tenants on this number`);

        return updatedNumber;
    } catch (error) {
        console.error('❌ Error assigning number to tenant:', error);
        return null;
    }
}

export async function assignExistingNumberToTenant(
    tenantId: string,
    systemPhoneNumberId: string,
    options: { exclusive?: boolean } = {}
): Promise<SystemPhoneNumber | null> {
    try {
        return await prisma.$transaction(async (tx) => {
            const [tenant, selectedNumber] = await Promise.all([
                tx.tenant.findUnique({
                    where: { id: tenantId },
                    select: { id: true, plan: true, assignedSystemNumberId: true }
                }),
                tx.systemPhoneNumber.findUnique({
                    where: { id: systemPhoneNumberId },
                    include: { tenants: { select: { id: true } } }
                })
            ]);

            if (!tenant) {
                throw new Error(`Tenant ${tenantId} not found`);
            }
            if (!selectedNumber || !selectedNumber.isActive || selectedNumber.setupStatus !== 'ACTIVE') {
                throw new Error(`System phone number ${systemPhoneNumberId} not found or inactive`);
            }
            const maxTenants = normalizeMaxTenants(selectedNumber.maxTenants, selectedNumber.channelType);

            if (tenant.assignedSystemNumberId === selectedNumber.id) {
                const currentCount = await tx.tenant.count({
                    where: { assignedSystemNumberId: selectedNumber.id }
                });
                return tx.systemPhoneNumber.update({
                    where: { id: selectedNumber.id },
                    data: { tenantCount: currentCount, maxTenants }
                });
            }

            if ((options.exclusive || selectedNumber.channelType !== 'SHARED') && selectedNumber.tenants.length > 0) {
                throw new Error('System phone number is already assigned to another tenant');
            }
            if (selectedNumber.planScope !== ANY_PLAN_SCOPE && selectedNumber.planScope !== normalizePlanScope(tenant.plan)) {
                throw new Error('System phone number is reserved for another plan scope');
            }
            if (selectedNumber.tenants.length >= maxTenants) {
                throw new Error('System phone number capacity reached');
            }

            const previousNumberId = tenant.assignedSystemNumberId;

            await tx.tenant.update({
                where: { id: tenant.id },
                data: { assignedSystemNumberId: selectedNumber.id }
            });

            if (previousNumberId) {
                const previousCount = await tx.tenant.count({
                    where: { assignedSystemNumberId: previousNumberId }
                });
                await tx.systemPhoneNumber.update({
                    where: { id: previousNumberId },
                    data: { tenantCount: previousCount }
                });
            }

            const selectedCount = await tx.tenant.count({
                where: { assignedSystemNumberId: selectedNumber.id }
            });

            return tx.systemPhoneNumber.update({
                where: { id: selectedNumber.id },
                data: { tenantCount: selectedCount, maxTenants }
            });
        });
    } catch (error) {
        console.error('❌ Error assigning existing number to tenant:', error);
        return null;
    }
}

/**
 * Unassigns a system phone number from a tenant.
 * Decrements the tenant count on the number.
 * 
 * @param tenantId - The tenant to unassign
 */
export async function unassignNumberFromTenant(tenantId: string): Promise<void> {
    try {
        // Get current assignment
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { assignedSystemNumberId: true }
        });

        if (!tenant?.assignedSystemNumberId) {
            console.log(`📞 Tenant ${tenantId} has no assigned number to unassign`);
            return;
        }

        await prisma.$transaction(async (tx) => {
            const previousNumberId = tenant.assignedSystemNumberId!;
            await tx.tenant.update({
                where: { id: tenantId },
                data: { assignedSystemNumberId: null }
            });
            const tenantCount = await tx.tenant.count({
                where: { assignedSystemNumberId: previousNumberId }
            });
            await tx.systemPhoneNumber.update({
                where: { id: previousNumberId },
                data: { tenantCount }
            });
        });

        console.log(`✅ Unassigned number from tenant ${tenantId}`);
    } catch (error) {
        console.error('❌ Error unassigning number from tenant:', error);
    }
}

export async function recordDisabledSystemNumberWebhookTraffic(phoneNumberId: string | undefined): Promise<SystemPhoneNumber | null> {
    if (!phoneNumberId) return null;

    try {
        return await prisma.systemPhoneNumber.update({
            where: { phoneNumberId },
            data: {
                disabledWebhookCount: { increment: 1 },
                lastDisabledWebhookAt: new Date()
            }
        });
    } catch {
        return null;
    }
}

export async function importSystemPhoneNumber(data: {
    phoneNumberId: string;
    displayNumber: string;
    countryCode: string;
    accessToken: string;
    wabaId: string;
    isActive?: boolean;
    channelType?: string;
    setupStatus?: string;
    maxTenants?: number;
    planScope?: string;
}): Promise<SystemPhoneNumber> {
    const phoneNumberId = data.phoneNumberId.trim();
    if (!phoneNumberId || !data.displayNumber.trim() || !data.accessToken.trim() || !data.wabaId.trim()) {
        throw new Error('phoneNumberId, displayNumber, accessToken and wabaId are required');
    }

    const channelType = normalizeChannelType(data.channelType);
    const maxTenants = normalizeMaxTenants(data.maxTenants, channelType);
    const setupStatus = normalizeSetupStatus(data.setupStatus);
    const planScope = normalizePlanScope(data.planScope);

    const number = await prisma.systemPhoneNumber.upsert({
        where: { phoneNumberId },
        create: {
            phoneNumberId,
            displayNumber: data.displayNumber.trim(),
            countryCode: normalizeCountryCode(data.countryCode),
            accessToken: encryptSecret(data.accessToken),
            wabaId: data.wabaId.trim(),
            isActive: data.isActive ?? true,
            channelType,
            setupStatus,
            planScope,
            maxTenants,
            tenantCount: 0
        },
        update: {
            displayNumber: data.displayNumber.trim(),
            countryCode: normalizeCountryCode(data.countryCode),
            accessToken: encryptSecret(data.accessToken),
            wabaId: data.wabaId.trim(),
            isActive: data.isActive ?? true,
            channelType,
            setupStatus,
            planScope,
            maxTenants
        }
    });

    return syncTenantCount(number.id);
}

export async function listSystemPhoneNumbers() {
    return prisma.systemPhoneNumber.findMany({
        orderBy: [
            { countryCode: 'asc' },
            { tenantCount: 'asc' },
            { createdAt: 'desc' }
        ],
        include: {
            tenants: {
                select: {
                    id: true,
                    name: true,
                    country: true,
                    plan: true,
                    status: true
                },
                orderBy: { name: 'asc' }
            }
        }
    });
}

export async function getSystemNumberPoolHealth(): Promise<NumberPoolHealth> {
    const [numbers, tenants] = await Promise.all([
        prisma.systemPhoneNumber.findMany({
            include: {
                tenants: {
                    select: {
                        id: true,
                        name: true,
                        country: true,
                        plan: true,
                        status: true
                    }
                }
            }
        }),
        prisma.tenant.findMany({
            where: { status: 'ACTIVE' },
            select: {
                id: true,
                name: true,
                country: true,
                plan: true,
                assignedSystemNumberId: true,
                assignedSystemNumber: true,
                whatsAppConfig: {
                    select: { isActive: true }
                }
            }
        })
    ]);

    const alerts: NumberPoolHealthAlert[] = [];
    const activeTenants = tenants;
    const activeSharedNumbers = numbers.filter(number => (
        number.isActive &&
        number.setupStatus === 'ACTIVE' &&
        number.channelType === 'SHARED'
    ));
    const disabledTrafficSince = new Date(Date.now() - DISABLED_WEBHOOK_TRAFFIC_WINDOW_MS);

    for (const number of numbers) {
        const maxTenants = normalizeMaxTenants(number.maxTenants, number.channelType);
        const tenantCount = number.tenants.length;
        const usageRatio = maxTenants > 0 ? tenantCount / maxTenants : 1;

        if (tenantCount > 0 && usageRatio >= CAPACITY_WARNING_THRESHOLD) {
            alerts.push({
                id: `capacity:${number.id}`,
                severity: usageRatio >= 1 ? 'critical' : 'warning',
                kind: 'HIGH_CAPACITY',
                message: `${number.displayNumber} est utilisé à ${tenantCount}/${maxTenants} clients.`,
                countryCode: number.countryCode,
                planScope: number.planScope,
                numberId: number.id,
                displayNumber: number.displayNumber
            });
        }

        if (tenantCount > 0 && (!number.isActive || number.setupStatus !== 'ACTIVE')) {
            alerts.push({
                id: `unhealthy-number:${number.id}`,
                severity: 'critical',
                kind: 'ASSIGNED_UNHEALTHY_NUMBER',
                message: `${number.displayNumber} n'est pas prêt mais reste assigné à ${tenantCount} client(s).`,
                countryCode: number.countryCode,
                planScope: number.planScope,
                numberId: number.id,
                displayNumber: number.displayNumber
            });
        }

        if (
            number.lastDisabledWebhookAt &&
            number.lastDisabledWebhookAt >= disabledTrafficSince &&
            (!number.isActive || number.setupStatus !== 'ACTIVE')
        ) {
            alerts.push({
                id: `disabled-traffic:${number.id}`,
                severity: 'critical',
                kind: 'DISABLED_NUMBER_TRAFFIC',
                message: `${number.displayNumber} reçoit encore du trafic webhook alors que le canal n'est pas prêt.`,
                countryCode: number.countryCode,
                planScope: number.planScope,
                numberId: number.id,
                displayNumber: number.displayNumber
            });
        }
    }

    const segmentKeys = new Set(
        activeTenants.map(tenant => `${normalizeCountryCode(tenant.country)}:${normalizePlanScope(tenant.plan)}`)
    );

    for (const segmentKey of segmentKeys) {
        const [countryCode, planScope] = segmentKey.split(':');
        const hasAvailableNumber = activeSharedNumbers.some(number => (
            number.countryCode === countryCode &&
            (number.planScope === planScope || number.planScope === ANY_PLAN_SCOPE) &&
            number.tenants.length < normalizeMaxTenants(number.maxTenants, number.channelType)
        ));

        if (!hasAvailableNumber) {
            alerts.push({
                id: `missing:${countryCode}:${planScope}`,
                severity: 'critical',
                kind: 'NO_AVAILABLE_NUMBER',
                message: `Aucun numéro mutualisé disponible pour ${countryCode} + ${planScope}.`,
                countryCode,
                planScope
            });
        }
    }

    for (const tenant of activeTenants) {
        const hasActiveByon = Boolean(tenant.whatsAppConfig?.isActive);
        if (!tenant.assignedSystemNumberId && !hasActiveByon) {
            alerts.push({
                id: `unassigned:${tenant.id}`,
                severity: 'critical',
                kind: 'UNASSIGNED_TENANT',
                message: `${tenant.name} n'a aucun numéro WhatsApp assigné.`,
                countryCode: normalizeCountryCode(tenant.country),
                planScope: normalizePlanScope(tenant.plan),
                tenantId: tenant.id,
                tenantName: tenant.name
            });
            continue;
        }

        const assignedNumber = tenant.assignedSystemNumber;
        if (!assignedNumber) continue;

        if (!assignedNumber.isActive || assignedNumber.setupStatus !== 'ACTIVE') {
            alerts.push({
                id: `tenant-unhealthy-number:${tenant.id}`,
                severity: 'critical',
                kind: 'ASSIGNED_UNHEALTHY_NUMBER',
                message: `${tenant.name} est attaché à un numéro non prêt.`,
                countryCode: normalizeCountryCode(tenant.country),
                planScope: normalizePlanScope(tenant.plan),
                tenantId: tenant.id,
                tenantName: tenant.name,
                numberId: assignedNumber.id,
                displayNumber: assignedNumber.displayNumber
            });
        }

        const tenantCountry = normalizeCountryCode(tenant.country);
        const numberCountry = normalizeCountryCode(assignedNumber.countryCode);
        if (numberCountry !== tenantCountry && numberCountry !== 'DEFAULT') {
            alerts.push({
                id: `country-mismatch:${tenant.id}`,
                severity: 'warning',
                kind: 'POTENTIAL_MISROUTING',
                message: `${tenant.name} (${tenantCountry}) est routé vers ${assignedNumber.displayNumber} (${numberCountry}).`,
                countryCode: tenantCountry,
                planScope: normalizePlanScope(tenant.plan),
                tenantId: tenant.id,
                tenantName: tenant.name,
                numberId: assignedNumber.id,
                displayNumber: assignedNumber.displayNumber
            });
        }

        const tenantPlan = normalizePlanScope(tenant.plan);
        if (assignedNumber.planScope !== ANY_PLAN_SCOPE && assignedNumber.planScope !== tenantPlan) {
            alerts.push({
                id: `plan-mismatch:${tenant.id}`,
                severity: 'warning',
                kind: 'POTENTIAL_MISROUTING',
                message: `${tenant.name} (${tenantPlan}) est attaché à un numéro réservé ${assignedNumber.planScope}.`,
                countryCode: tenantCountry,
                planScope: tenantPlan,
                tenantId: tenant.id,
                tenantName: tenant.name,
                numberId: assignedNumber.id,
                displayNumber: assignedNumber.displayNumber
            });
        }
    }

    const availableSharedSlots = activeSharedNumbers.reduce((sum, number) => (
        sum + Math.max(normalizeMaxTenants(number.maxTenants, number.channelType) - number.tenants.length, 0)
    ), 0);

    return {
        summary: {
            totalAlerts: alerts.length,
            criticalAlerts: alerts.filter(alert => alert.severity === 'critical').length,
            warningAlerts: alerts.filter(alert => alert.severity === 'warning').length,
            activeTenants: activeTenants.length,
            activeNumbers: numbers.filter(number => number.isActive && number.setupStatus === 'ACTIVE').length,
            availableSharedSlots
        },
        alerts: alerts.sort((a, b) => {
            if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
            return a.kind.localeCompare(b.kind) || a.message.localeCompare(b.message);
        })
    };
}

export async function updateSystemPhoneNumber(
    systemPhoneNumberId: string,
    data: {
        displayNumber?: string;
        countryCode?: string;
        accessToken?: string;
        wabaId?: string;
        isActive?: boolean;
        channelType?: string;
        setupStatus?: string;
        maxTenants?: number;
        planScope?: string;
    }
): Promise<SystemPhoneNumber | null> {
    try {
        const updateData: {
            displayNumber?: string;
            countryCode?: string;
            accessToken?: string;
            wabaId?: string;
            isActive?: boolean;
            channelType?: SystemPhoneNumberChannelType;
            setupStatus?: SystemPhoneNumberSetupStatus;
            maxTenants?: number;
            planScope?: string;
        } = {};

        if (data.displayNumber !== undefined) updateData.displayNumber = data.displayNumber.trim();
        if (data.countryCode !== undefined) updateData.countryCode = normalizeCountryCode(data.countryCode);
        if (data.accessToken !== undefined && data.accessToken.trim()) updateData.accessToken = encryptSecret(data.accessToken);
        if (data.wabaId !== undefined) updateData.wabaId = data.wabaId.trim();
        if (data.isActive !== undefined) updateData.isActive = data.isActive;
        if (data.channelType !== undefined) updateData.channelType = normalizeChannelType(data.channelType);
        if (data.setupStatus !== undefined) updateData.setupStatus = normalizeSetupStatus(data.setupStatus);
        if (data.planScope !== undefined) updateData.planScope = normalizePlanScope(data.planScope);
        if (data.maxTenants !== undefined || updateData.channelType !== undefined) {
            const existingNumber = await prisma.systemPhoneNumber.findUnique({
                where: { id: systemPhoneNumberId },
                select: { channelType: true }
            });
            const channelType = updateData.channelType ?? existingNumber?.channelType ?? 'SHARED';
            updateData.maxTenants = normalizeMaxTenants(data.maxTenants, channelType);
        }

        const number = await prisma.systemPhoneNumber.update({
            where: { id: systemPhoneNumberId },
            data: updateData
        });

        return syncTenantCount(number.id);
    } catch (error) {
        console.error('❌ Error updating system phone number:', error);
        return null;
    }
}

/**
 * =========================================================================
 * SOLOPRENEUR AUTOMATION: DYNAMIC NUMBER PROVISIONING (Twilio -> Meta)
 * =========================================================================
 * 
 * Automatically buys a new phone number from Twilio API, registers it on 
 * WhatsApp Business API, and assigns it to a Premium tenant instantly. 
 * Allows 100% hands-off "Virtual Number" SaaS provisioning.
 */
export async function provisionDedicatedNumber(
    tenantId: string,
    countryCode: string = 'FR'
): Promise<SystemPhoneNumber | null> {
    console.log(`🚀 [TWILIO PROVISIONING] Initiating dynamic number purchase for Tenant ${tenantId} [${countryCode}]`);

    try {
        const provisioningEnabled = isFlagEnabled(ENABLE_DYNAMIC_NUMBER_PROVISIONING, process.env.NODE_ENV !== 'production');
        const demoMode = isDemoMode();

        if (!provisioningEnabled && !demoMode) {
            throw new Error(
                `Dynamic Twilio/Meta provisioning disabled. Set ${ENABLE_DYNAMIC_NUMBER_PROVISIONING}=true for a real integration, or DEMO_MODE=true only for demo environments.`
            );
        }

        if (process.env.NODE_ENV === 'production' && provisioningEnabled && !demoMode) {
            throw new Error(
                'Dynamic Twilio/Meta provisioning has no real provider implementation yet. Use DEMO_MODE=true only for demos, or disable automatic provisioning in production.'
            );
        }

        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
            console.warn('⚠️ [TWILIO PROVISIONING] Twilio credentials missing; demo provisioning requires DEMO_MODE=true in production.');
        }

        // 1. DYNAMIC PURCHASE VIA TWILIO API
        // In Production: 
        // const searchRes = await axios.get(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/AvailablePhoneNumbers/${countryCode}/Mobile.json`, { auth });
        // const availableNumber = searchRes.data.available_phone_numbers[0].phone_number;
        // const buyRes = await axios.post(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json`, `PhoneNumber=${availableNumber}`, { auth });

        await new Promise(resolve => setTimeout(resolve, 2000)); // DEMO: Simulating Twilio API purchase
        const purchasedNumber = `+336${Math.floor(10000000 + Math.random() * 90000000)}`;
        console.log(`✅ [TWILIO] Successfully purchased virtual number: ${purchasedNumber} (approx $1.00/mo)`);

        // 2. META WHATSAPP REGISTRATION
        // In Production: We POST this number to Meta API with SMS verification (Twilio SMS webhook captures the OTP).
        await new Promise(resolve => setTimeout(resolve, 1500)); // DEMO: Simulating Meta API Registration
        
        const mockMetaPhoneNumberId = `PHONE_ID_${Math.floor(Math.random() * 100000000)}`;
        const mockMetaAccessToken = `EAA_SYSTEM_TOKEN_${Math.floor(Math.random() * 10000000)}`;
        const mockWabaId = `WABA_${Math.floor(Math.random() * 10000000)}`;

        console.log(`✅ [META] Successfully registered ${purchasedNumber} as a dedicated WhatsApp Sender`);

        // 3. INJECT INTO PRISMA AS "SYSTEM NUMBER" POOL (EXCLUSIVE TO THIS TENANT)
        const [newSystemNumber] = await prisma.$transaction([
            prisma.systemPhoneNumber.create({
                data: {
                    phoneNumberId: mockMetaPhoneNumberId,
                    displayNumber: purchasedNumber,
                    countryCode: countryCode,
                    accessToken: encryptSecret(mockMetaAccessToken),
                    wabaId: mockWabaId,
                    isActive: true,
                    channelType: 'DEDICATED',
                    setupStatus: 'ACTIVE',
                    planScope: 'ENTERPRISE',
                    maxTenants: 1,
                    tenantCount: 1 // Assigned immediately
                }
            }),
            prisma.tenant.update({
                where: { id: tenantId },
                data: { assignedSystemNumberId: mockMetaPhoneNumberId } // using phoneId or SystemPhoneNumber.id
            })
        ]);

        // Fix correct relation update
        await prisma.tenant.update({
            where: { id: tenantId },
            data: { assignedSystemNumberId: newSystemNumber.id }
        });

        console.log(`🎉 [PROVISIONING COMPLETE] Tenant ${tenantId} is now operating on an exclusive dedicated channel!`);
        return newSystemNumber;

    } catch (error) {
        console.error('❌ [TWILIO PROVISIONING] Fatal error during number generation:', error);
        return null;
    }
}

/**
 * Reassigns a tenant to a different number (e.g., when changing country or rebalancing).
 * 
 * @param tenantId - The tenant to reassign
 * @param newCountryCode - The new country code for number selection
 */
export async function reassignNumber(
    tenantId: string,
    newCountryCode: string
): Promise<SystemPhoneNumber | null> {
    // First unassign current number
    await unassignNumberFromTenant(tenantId);

    // Then assign a new one
    return assignNumberToTenant(tenantId, newCountryCode);
}

/**
 * Gets pool statistics for admin dashboard
 */
export async function getNumberPoolStats(): Promise<{
    totalNumbers: number;
    activeNumbers: number;
    totalTenants: number;
    byCountry: Array<{ country: string; count: number; load: number }>;
}> {
    const numbers = await prisma.systemPhoneNumber.findMany();

    const byCountry = numbers.reduce((acc, num) => {
        const existing = acc.find(c => c.country === num.countryCode);
        if (existing) {
            existing.count++;
            existing.load += num.tenantCount;
        } else {
            acc.push({
                country: num.countryCode,
                count: 1,
                load: num.tenantCount
            });
        }
        return acc;
    }, [] as Array<{ country: string; count: number; load: number }>);

    return {
        totalNumbers: numbers.length,
        activeNumbers: numbers.filter(n => n.isActive).length,
        totalTenants: numbers.reduce((sum, n) => sum + n.tenantCount, 0),
        byCountry
    };
}
