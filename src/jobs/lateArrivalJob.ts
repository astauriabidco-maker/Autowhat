import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { sendMessage } from '../services/whatsappService';

const prisma = new PrismaClient();

/**
 * Core logic to scan for missing attendance and notify managers
 */
export const runLateArrivalScan = async () => {
    console.log('⏰ [Job] Starting Late Arrival Scan...');

    try {
        const tenants = await prisma.tenant.findMany({
            include: {
                employees: true
            }
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);

        for (const tenant of tenants) {
            const managers = tenant.employees.filter(e => e.role === 'MANAGER');
            const employees = tenant.employees.filter(e => e.role === 'EMPLOYEE');

            if (managers.length === 0) {
                console.log(`⚠️ No manager found for tenant ${tenant.name}, skipping alerts.`);
                continue;
            }

            for (const employee of employees) {
                // Check if employee has pointed today
                const attendance = await prisma.attendance.findFirst({
                    where: {
                        employeeId: employee.id,
                        checkIn: {
                            gte: today,
                            lte: endOfDay
                        }
                    }
                });

                if (!attendance) {
                    console.log(`🚨 Alert: ${employee.name} (Tenant: ${tenant.name}) has not checked in today.`);

                    // Notify each manager of this tenant
                    for (const manager of managers) {
                        const message = `⚠️ *Alerte : Absence/Retard*\n\nL'employé *${employee.name}* n'a pas encore pointé aujourd'hui.`;
                        await sendMessage(manager.phoneNumber.replace('+', ''), message);
                    }
                }
            }
        }
        console.log('✅ [Job] Late Arrival Scan completed.');
    } catch (error) {
        console.error('❌ [Job] Error during Late Arrival Scan:', error);
    }
};

/**
 * Initialize the scheduled job
 */
export const initLateArrivalJob = () => {
    // Every day Monday-Friday at 10:00 AM
    cron.schedule('0 10 * * 1-5', async () => {
        await runLateArrivalScan();
    }, {
        timezone: "Europe/Paris"
    });

    console.log('📅 [Cron] Late Arrival Job scheduled (10:00 AM, Mon-Fri)');
};
