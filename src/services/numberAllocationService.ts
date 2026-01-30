/**
 * Number Allocation Service
 * 
 * Manages the allocation of system WhatsApp numbers to tenants.
 * Implements load balancing across the number pool with country-based routing.
 */

import { PrismaClient, SystemPhoneNumber } from '@prisma/client';

const prisma = new PrismaClient();

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
        // Step 1: Find active numbers for the specified country
        let candidates = await prisma.systemPhoneNumber.findMany({
            where: {
                countryCode: countryCode.toUpperCase(),
                isActive: true
            },
            orderBy: {
                tenantCount: 'asc' // Load balancing: pick least loaded
            }
        });

        // Step 2: Fallback to DEFAULT if no country-specific numbers
        if (candidates.length === 0) {
            console.log(`📞 No numbers for ${countryCode}, falling back to DEFAULT`);
            candidates = await prisma.systemPhoneNumber.findMany({
                where: {
                    countryCode: 'DEFAULT',
                    isActive: true
                },
                orderBy: {
                    tenantCount: 'asc'
                }
            });
        }

        // Step 3: Second fallback to US (most common international)
        if (candidates.length === 0) {
            console.log(`📞 No DEFAULT numbers, falling back to US`);
            candidates = await prisma.systemPhoneNumber.findMany({
                where: {
                    countryCode: 'US',
                    isActive: true
                },
                orderBy: {
                    tenantCount: 'asc'
                }
            });
        }

        // No numbers available at all
        if (candidates.length === 0) {
            console.warn(`⚠️ No system phone numbers available for allocation!`);
            return null;
        }

        // Step 4: Pick the number with lowest tenant count
        const selectedNumber = candidates[0];

        // Step 5: Transaction - Update tenant and increment counter atomically
        const [updatedNumber] = await prisma.$transaction([
            prisma.systemPhoneNumber.update({
                where: { id: selectedNumber.id },
                data: { tenantCount: { increment: 1 } }
            }),
            prisma.tenant.update({
                where: { id: tenantId },
                data: { assignedSystemNumberId: selectedNumber.id }
            })
        ]);

        console.log(`✅ Assigned ${selectedNumber.displayNumber} (${selectedNumber.countryCode}) to tenant ${tenantId}`);
        console.log(`   Load: ${selectedNumber.tenantCount + 1} tenants on this number`);

        return updatedNumber;
    } catch (error) {
        console.error('❌ Error assigning number to tenant:', error);
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

        // Transaction - Clear assignment and decrement counter
        await prisma.$transaction([
            prisma.systemPhoneNumber.update({
                where: { id: tenant.assignedSystemNumberId },
                data: { tenantCount: { decrement: 1 } }
            }),
            prisma.tenant.update({
                where: { id: tenantId },
                data: { assignedSystemNumberId: null }
            })
        ]);

        console.log(`✅ Unassigned number from tenant ${tenantId}`);
    } catch (error) {
        console.error('❌ Error unassigning number from tenant:', error);
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
