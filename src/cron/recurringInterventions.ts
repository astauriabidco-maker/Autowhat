/**
 * Recurring Interventions CRON Job 🔄
 * 
 * Runs every 15 minutes to detect recurring interventions whose
 * `nextOccurrence` is due (≤ now) and automatically generates
 * the corresponding scheduled intervention.
 * 
 * After each generation the `nextOccurrence` is advanced according
 * to the configured frequency/interval, or the recurring rule
 * is deactivated if `endDate` has been reached.
 */

import cron from 'node-cron';
import prisma from '../lib/prisma';
import { addDays, addWeeks, addMonths, addYears } from 'date-fns';

// ─── helpers ─────────────────────────────────────────────

/**
 * Calculate the next occurrence after `fromDate` based on frequency config.
 * Mirrors the logic in opsLevel2Controller.ts → kept DRY here for the CRON.
 */
function calculateNextOccurrence(
    fromDate: Date,
    frequency: string,
    intervalValue: number = 1,
    dayOfWeek?: number | null,
    dayOfMonth?: number | null,
): Date {
    let next: Date;
    switch (frequency) {
        case 'DAILY':
            next = addDays(fromDate, intervalValue);
            break;
        case 'WEEKLY':
            next = addWeeks(fromDate, intervalValue);
            if (dayOfWeek !== undefined && dayOfWeek !== null) {
                const diff = dayOfWeek - next.getDay();
                next = addDays(next, diff >= 0 ? diff : diff + 7);
            }
            break;
        case 'BIWEEKLY':
            next = addWeeks(fromDate, 2 * intervalValue);
            break;
        case 'MONTHLY':
            next = addMonths(fromDate, intervalValue);
            if (dayOfMonth) {
                const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
                next.setDate(Math.min(dayOfMonth, maxDay));
            }
            break;
        case 'QUARTERLY':
            next = addMonths(fromDate, 3 * intervalValue);
            break;
        case 'BIANNUAL':
            next = addMonths(fromDate, 6 * intervalValue);
            break;
        case 'ANNUAL':
            next = addYears(fromDate, intervalValue);
            break;
        default:
            next = addMonths(fromDate, intervalValue);
    }
    return next;
}

// ─── core logic ──────────────────────────────────────────

/**
 * Process a single recurring rule:
 * 1. Create an Intervention with SCHEDULED status.
 * 2. Advance (or deactivate) the recurring rule.
 */
async function processRecurring(recurring: any): Promise<{ success: boolean; interventionId?: string; error?: string }> {
    try {
        // Parse preferred time
        const [hours, minutes] = (recurring.preferredTime || '09:00').split(':').map(Number);
        const scheduledStart = new Date(recurring.nextOccurrence!);
        scheduledStart.setHours(hours, minutes, 0, 0);

        const duration = recurring.interventionType?.defaultDuration || 60;
        const scheduledEnd = new Date(scheduledStart.getTime() + duration * 60_000);

        // Create intervention
        const intervention = await prisma.intervention.create({
            data: {
                title: recurring.title,
                description: recurring.description,
                interventionTypeId: recurring.interventionTypeId,
                status: 'SCHEDULED',
                scheduledStart,
                scheduledEnd,
                customerId: recurring.customerId,
                customerSiteId: recurring.customerSiteId,
                employeeId: recurring.employeeId,
                recurringInterventionId: recurring.id,
                tenantId: recurring.tenantId,
            },
        });

        // Calculate next occurrence
        const nextOccurrence = calculateNextOccurrence(
            scheduledStart,
            recurring.frequency,
            recurring.intervalValue,
            recurring.dayOfWeek,
            recurring.dayOfMonth,
        );

        const shouldDeactivate = recurring.endDate && nextOccurrence > recurring.endDate;

        // Update recurring rule
        await prisma.recurringIntervention.update({
            where: { id: recurring.id },
            data: {
                lastGenerated: new Date(),
                nextOccurrence: shouldDeactivate ? null : nextOccurrence,
                isActive: !shouldDeactivate,
            },
        });

        return { success: true, interventionId: intervention.id };
    } catch (error: any) {
        console.error(`  ❌ Error processing recurring ${recurring.id}:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Main runner — finds all due recurring interventions and processes them.
 */
export async function runRecurringInterventions(): Promise<{
    processed: number;
    generated: number;
    errors: number;
}> {
    const now = new Date();
    console.log(`🔄 [Recurring] Running check at ${now.toISOString()}`);

    let processed = 0;
    let generated = 0;
    let errors = 0;

    try {
        // Find all active recurring interventions whose nextOccurrence is due
        const dueRecurring = await prisma.recurringIntervention.findMany({
            where: {
                isActive: true,
                nextOccurrence: {
                    lte: now,     // Due at or before now
                    not: null,    // Must have a nextOccurrence set
                },
            },
            include: {
                interventionType: { select: { id: true, defaultDuration: true } },
                customer: { select: { id: true, companyName: true } },
                employee: { select: { id: true, name: true } },
            },
            orderBy: { nextOccurrence: 'asc' },
        });

        if (dueRecurring.length === 0) {
            console.log('🔄 [Recurring] No recurring interventions due — nothing to do.');
            return { processed: 0, generated: 0, errors: 0 };
        }

        console.log(`🔄 [Recurring] Found ${dueRecurring.length} due recurring intervention(s)`);

        for (const rec of dueRecurring) {
            processed++;
            console.log(`  📌 Processing: "${rec.title}" for ${rec.customer?.companyName || rec.customerId} (${rec.frequency} / technicien: ${rec.employee?.name || rec.employeeId})`);

            const result = await processRecurring(rec);

            if (result.success) {
                generated++;
                console.log(`  ✅ Generated intervention ${result.interventionId}`);
            } else {
                errors++;
            }
        }

        console.log(`🔄 [Recurring] Complete: ${generated} generated, ${errors} errors out of ${processed} processed.`);
    } catch (error) {
        console.error('❌ [Recurring] Critical error:', error);
    }

    return { processed, generated, errors };
}

// ─── CRON registration ──────────────────────────────────

/**
 * Initialize the recurring interventions CRON job.
 * Schedule: every 15 minutes, 24/7 — lightweight query, only acts when due.
 */
export function initRecurringInterventionsJob(): void {
    // Run every 15 minutes
    cron.schedule('*/15 * * * *', () => {
        runRecurringInterventions().catch((err) =>
            console.error('❌ [Recurring CRON] Uncaught error:', err)
        );
    }, { timezone: 'Europe/Paris' });

    console.log('🔄 [Cron] Recurring Interventions Job scheduled (every 15 min)');

    // Also run once at startup after a 10-second delay to catch up any missed occurrences
    setTimeout(() => {
        console.log('🔄 [Recurring] Running catch-up pass at startup...');
        runRecurringInterventions().catch((err) =>
            console.error('❌ [Recurring] Startup catch-up error:', err)
        );
    }, 10_000);
}
