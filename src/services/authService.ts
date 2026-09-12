import prisma from '../lib/prisma';

function tenantConfig(config: unknown): Record<string, any> {
    if (!config || typeof config !== 'object' || Array.isArray(config)) return {};
    return config as Record<string, any>;
}

function isResetTestTenant(config: unknown): boolean {
    const parsed = tenantConfig(config);
    return parsed.isTestTenant === true && Boolean(parsed.lastOnboardingResetAt);
}

/**
 * Identifies a user by their phone number.
 * Returns the Employee object including the Tenant and state fields.
 * 
 * @param phoneNumber The phone number to search for.
 * @returns Employee with Tenant or null if not found.
 */
export const identifyUser = async (phoneNumber: string, options?: { tenantIds?: string[] }) => {
    if (options?.tenantIds && options.tenantIds.length === 0) {
        return null;
    }

    // Simple cleanup: remove spaces and hyphens to match E.164 loose formatting if needed.
    // Assuming the DB stores standard strict E.164, we might just pass it through.
    // But the prompt asked to handle spaces or dashes.
    const cleanedPhoneNumber = phoneNumber.replace(/[\s-]/g, '');

    const withoutPlus = cleanedPhoneNumber.replace(/^\+/, '');

    const matches = await prisma.employee.findMany({
        where: {
            role: { not: 'ARCHIVED' },
            tenant: {
                status: 'ACTIVE'
            },
            ...(options?.tenantIds ? { tenantId: { in: options.tenantIds } } : {}),
            OR: [
                { phoneNumber: cleanedPhoneNumber },
                { phoneNumber: withoutPlus },
                { phoneNumber: `+${withoutPlus}` },
                { phoneNumber: { endsWith: withoutPlus.slice(-9) } }
            ]
        },
        include: {
            tenant: true,
        },
        orderBy: [
            { updatedAt: 'desc' },
            { createdAt: 'desc' }
        ],
        take: 10
    });

    const activeOperationalMatch = matches.find(employee => !isResetTestTenant(employee.tenant?.config));
    return activeOperationalMatch || null;
};
