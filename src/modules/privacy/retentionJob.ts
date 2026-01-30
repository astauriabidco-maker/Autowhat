/**
 * Privacy Retention Job
 * 
 * CRON job that runs daily at 04:00 AM to purge old data
 * according to each tenant's dataRetentionDays setting.
 * 
 * Complies with RGPD requirements for data minimization.
 */

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Purge old records for a specific tenant.
 * Returns count of deleted records by type.
 */
async function purgeTenantData(
    tenantId: string,
    retentionDays: number
): Promise<{ attendances: number; tickets: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    console.log(`🗑️ Purging data older than ${cutoffDate.toISOString()} for tenant ${tenantId}`);

    let attendanceCount = 0;
    let ticketCount = 0;

    try {
        // 1. Delete old Attendance records
        const attendanceResult = await prisma.attendance.deleteMany({
            where: {
                tenantId,
                checkIn: { lt: cutoffDate }
            }
        });
        attendanceCount = attendanceResult.count;

        // 2. Delete old closed Tickets
        const ticketResult = await prisma.ticket.deleteMany({
            where: {
                tenantId,
                status: 'CLOSED',
                updatedAt: { lt: cutoffDate }
            }
        });
        ticketCount = ticketResult.count;

        // Update lastPurgeDate
        await prisma.tenant.update({
            where: { id: tenantId },
            data: { lastPurgeDate: new Date() }
        });

    } catch (error) {
        console.error(`❌ Error purging data for tenant ${tenantId}:`, error);
    }

    return { attendances: attendanceCount, tickets: ticketCount };
}

/**
 * Run the full purge job for all tenants.
 */
async function runPurgeJob(): Promise<void> {
    console.log('🔄 Starting daily data retention purge job...');
    const startTime = Date.now();

    try {
        // Get all tenants with retention enabled (dataRetentionDays > 0)
        const tenants = await prisma.tenant.findMany({
            where: {
                dataRetentionDays: { gt: 0 }
            },
            select: {
                id: true,
                name: true,
                dataRetentionDays: true
            }
        });

        console.log(`📋 Found ${tenants.length} tenants with data retention enabled`);

        let totalDeleted = 0;

        for (const tenant of tenants) {
            const result = await purgeTenantData(tenant.id, tenant.dataRetentionDays);
            const tenantTotal = result.attendances + result.tickets;
            totalDeleted += tenantTotal;

            if (tenantTotal > 0) {
                console.log(`  ✅ ${tenant.name}: Deleted ${result.attendances} attendances, ${result.tickets} tickets`);
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Purge job completed in ${duration}s. Total records deleted: ${totalDeleted}`);

    } catch (error) {
        console.error('❌ Fatal error in purge job:', error);
    }
}

/**
 * Get an estimate of records that would be purged.
 * Useful for UI preview.
 */
export async function getPurgeEstimate(
    tenantId: string,
    retentionDays: number
): Promise<{ attendances: number; tickets: number; total: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Count Attendances
    const attendances = await prisma.attendance.count({
        where: {
            tenantId,
            checkIn: { lt: cutoffDate }
        }
    });

    // Count closed Tickets
    const tickets = await prisma.ticket.count({
        where: {
            tenantId,
            status: 'CLOSED',
            updatedAt: { lt: cutoffDate }
        }
    });

    return {
        attendances,
        tickets,
        total: attendances + tickets
    };
}

/**
 * Initialize the retention job scheduler.
 * Should be called once at app startup.
 */
export function initRetentionJob(): void {
    // Schedule: Every day at 04:00 AM
    cron.schedule('0 4 * * *', () => {
        runPurgeJob().catch(console.error);
    }, {
        timezone: 'Europe/Paris'
    });

    console.log('📅 Data retention purge job scheduled for 04:00 AM daily');
}

/**
 * Manually trigger the purge job (for testing/admin use).
 */
export async function triggerManualPurge(): Promise<void> {
    await runPurgeJob();
}

export { runPurgeJob };
