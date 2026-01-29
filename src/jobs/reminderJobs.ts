import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { sendInteractiveButtons } from '../services/whatsappService';
import { getTenantText } from '../utils/textHelper';
import { notifyAllManagers } from '../services/notificationService';

const prisma = new PrismaClient();

/**
 * Parse HH:MM time string to hours and minutes
 */
function parseTime(timeStr: string): { hours: number; minutes: number } {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours: hours || 9, minutes: minutes || 0 };
}

/**
 * Check if current time matches workStartTime + 30 minutes
 */
function isReminderTime(workStartTime: string): boolean {
    const now = new Date();
    const { hours, minutes } = parseTime(workStartTime);

    // Add 30 minutes to work start time
    let reminderMinutes = minutes + 30;
    let reminderHours = hours;
    if (reminderMinutes >= 60) {
        reminderMinutes -= 60;
        reminderHours += 1;
    }

    return now.getHours() === reminderHours && now.getMinutes() >= reminderMinutes && now.getMinutes() < reminderMinutes + 30;
}

/**
 * Check if today is a weekend (Saturday or Sunday)
 */
function isWeekend(): boolean {
    const day = new Date().getDay();
    return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Job 1: Morning Nudge
 * Runs every 30 minutes, checks if employees haven't checked in 30min after work start
 */
async function morningNudgeJob() {
    // Skip weekends
    if (isWeekend()) {
        console.log('📅 [Morning Nudge] Skipping weekend');
        return;
    }

    console.log('🌅 [Morning Nudge] Running check...');

    try {
        // Get all tenants with their work start time
        const tenants = await prisma.tenant.findMany({
            include: { employees: true }
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const tenant of tenants) {
            // Check if it's reminder time for this tenant
            if (!isReminderTime(tenant.workStartTime)) {
                continue;
            }

            console.log(`🏢 [Morning Nudge] Checking tenant: ${tenant.name} (start: ${tenant.workStartTime})`);

            // Get dynamic vocabulary for this tenant
            const workplace = getTenantText(tenant, 'workplace');
            const attendance = getTenantText(tenant, 'attendance');

            // Find employees who haven't checked in today
            for (const employee of tenant.employees) {
                if (employee.role === 'MANAGER') continue; // Skip managers

                const todayAttendance = await prisma.attendance.findFirst({
                    where: {
                        employeeId: employee.id,
                        checkIn: { gte: today }
                    }
                });

                if (!todayAttendance) {
                    // No check-in today, send reminder with dynamic wording
                    console.log(`📨 [Morning Nudge] Sending reminder to ${employee.name || employee.phoneNumber}`);

                    const firstName = employee.name?.split(' ')[0] || 'Collègue';
                    await sendInteractiveButtons(
                        employee.phoneNumber.replace('+', ''),
                        `👋 Salut ${firstName}, tu es au ${workplace.toLowerCase()} ?\nTu as oublié ton ${attendance.toLowerCase()} ce matin.`,
                        [
                            { id: 'cmd_hi', title: '✅ Pointer Arrivée' }
                        ]
                    );

                    // Notify managers about late employee
                    await notifyAllManagers(
                        tenant.id,
                        'LATE',
                        'Retard de pointage',
                        `⚠️ ${employee.name || 'Un employé'} n'a toujours pas pointé ce matin.`,
                        employee.id
                    );
                }
            }
        }

        console.log('✅ [Morning Nudge] Check completed');
    } catch (error) {
        console.error('❌ [Morning Nudge] Error:', error);
    }
}

/**
 * Job 2: Ghost Session Detection
 * Runs every hour, finds sessions open longer than maxWorkHours
 */
async function ghostSessionJob() {
    console.log('🌙 [Ghost Session] Running check...');

    try {
        // Find all open sessions (no checkOut)
        const openSessions = await prisma.attendance.findMany({
            where: { checkOut: null },
            include: {
                employee: {
                    include: { tenant: true }
                }
            }
        });

        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        for (const session of openSessions) {
            const tenant = session.employee.tenant;
            const maxHours = tenant.maxWorkHours;

            // Calculate session duration in hours
            const durationMs = now.getTime() - session.checkIn.getTime();
            const durationHours = durationMs / (1000 * 60 * 60);

            if (durationHours <= maxHours) {
                continue; // Session not long enough to trigger alert
            }

            // Anti-spam: check if reminder was sent in last 24h
            if (session.lastReminderSentAt && session.lastReminderSentAt > oneDayAgo) {
                console.log(`⏭️ [Ghost Session] Skipping ${session.employee.name} - reminder sent recently`);
                continue;
            }

            // Get dynamic vocabulary
            const actionOut = getTenantText(tenant, 'action_out');

            // Send reminder
            console.log(`📨 [Ghost Session] Alerting ${session.employee.name || session.employee.phoneNumber} (${Math.round(durationHours)}h open)`);

            await sendInteractiveButtons(
                session.employee.phoneNumber.replace('+', ''),
                `🌙 Tu as oublié de partir ?\n\nTa session est ouverte depuis *${Math.round(durationHours)}h*.\nClique ci-dessous pour faire "${actionOut}".`,
                [
                    { id: 'cmd_bye', title: '🏁 Finir Journée' }
                ]
            );

            // Update lastReminderSentAt to prevent spam
            await prisma.attendance.update({
                where: { id: session.id },
                data: { lastReminderSentAt: now }
            });
        }

        console.log('✅ [Ghost Session] Check completed');
    } catch (error) {
        console.error('❌ [Ghost Session] Error:', error);
    }
}

/**
 * Initialize and schedule all reminder jobs
 */
export function initReminderJobs() {
    // Morning Nudge: runs every 30 minutes from 9:00 to 11:00 (Mon-Fri)
    // Cron: at minute 0 and 30, from 9h to 11h, Mon-Fri
    cron.schedule('0,30 9-11 * * 1-5', morningNudgeJob, {
        timezone: 'Europe/Paris'
    });
    console.log('🌅 [Cron] Morning Nudge Job scheduled (every 30min, 9h-11h, Mon-Fri)');

    // Ghost Session: runs every hour (24/7 to catch forgotten checkouts)
    cron.schedule('0 * * * *', ghostSessionJob, {
        timezone: 'Europe/Paris'
    });
    console.log('🌙 [Cron] Ghost Session Job scheduled (hourly)');
}

// Export for manual testing
export { morningNudgeJob, ghostSessionJob };
