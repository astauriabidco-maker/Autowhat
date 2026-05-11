import { startOfWeek, format, subDays, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import prisma from '../lib/prisma';


interface WeeklySummary {
    totalHours: number;
    totalMinutes: number;
    daysWorked: number;
    leaveBalanceStr: string;
    lastLeaveStatus: string | null;
    lastLeaveDate: string | null;
    weekStart: string;
    employeeName: string;
    ongoingSession: boolean;
}

/**
 * Get weekly summary for an employee
 */
export async function getWeeklySummary(
    employeeId: string,
    tenantId: string
): Promise<WeeklySummary> {
    // Calculate week bounds: Monday 00:00 to now
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // 1 = Monday

    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { name: true, phoneNumber: true }
    });

    // Get all attendance records for this week
    const attendances = await prisma.attendance.findMany({
        where: {
            employeeId,
            tenantId,
            checkIn: {
                gte: weekStart,
                lte: now
            }
        },
        orderBy: { checkIn: 'asc' }
    });

    // Calculate total time
    let totalMinutesWorked = 0;
    let ongoingSession = false;
    const uniqueDays = new Set<string>();

    for (const record of attendances) {
        const checkIn = new Date(record.checkIn);
        const day = format(checkIn, 'yyyy-MM-dd');
        uniqueDays.add(day);

        if (record.checkOut) {
            // Completed session
            const checkOut = new Date(record.checkOut);
            totalMinutesWorked += differenceInMinutes(checkOut, checkIn);
        } else {
            // Ongoing session - add time until now
            totalMinutesWorked += differenceInMinutes(now, checkIn);
            ongoingSession = true;
        }
    }

    // Get last leave request
    const lastLeave = await prisma.leaveRequest.findFirst({
        where: { employeeId, tenantId },
        orderBy: { startDate: 'desc' }
    });

    let lastLeaveStatus: string | null = null;
    let lastLeaveDate: string | null = null;
    if (lastLeave) {
        const statusMap: Record<string, string> = {
            PENDING: 'En attente',
            APPROVED: 'Validée',
            REJECTED: 'Refusée'
        };
        lastLeaveDate = format(new Date(lastLeave.startDate), 'dd/MM', { locale: fr });
        lastLeaveStatus = statusMap[lastLeave.status] || lastLeave.status;
    }

    // Real-time integration: Fetch real balance from ERP instead of DB
    const { getKPaieBalances } = require('./kpaieService');
    const balanceResult = await getKPaieBalances(tenantId, employee?.phoneNumber);
    let leaveBalanceStr = '25 jours (non synchro)';
    if (balanceResult.success && balanceResult.data) {
        leaveBalanceStr = `${balanceResult.data.paid_leave} jours (Synchro ERP)`;
    } else if (balanceResult.error === 'NO_CONFIG') {
        leaveBalanceStr = `Non configuré (Connecteur désactivé)`;
    }

    // Convert total minutes to hours and remaining minutes
    const hours = Math.floor(totalMinutesWorked / 60);
    const minutes = totalMinutesWorked % 60;

    return {
        totalHours: hours,
        totalMinutes: minutes,
        daysWorked: uniqueDays.size,
        leaveBalanceStr,
        lastLeaveStatus,
        lastLeaveDate,
        weekStart: format(weekStart, 'dd/MM/yyyy', { locale: fr }),
        employeeName: employee?.name || 'Employé',
        ongoingSession
    };
}

/**
 * Get attendance history for the last N days
 */
export async function getHistory(
    employeeId: string,
    tenantId: string,
    days: number = 10
): Promise<string[]> {
    const now = new Date();
    const startDate = subDays(now, days);

    const attendances = await prisma.attendance.findMany({
        where: {
            employeeId,
            tenantId,
            checkIn: {
                gte: startDate,
                lte: now
            }
        },
        orderBy: { checkIn: 'desc' }
    });

    return attendances.map(record => {
        const checkIn = new Date(record.checkIn);
        const dateStr = format(checkIn, 'dd/MM', { locale: fr });
        const checkInTime = format(checkIn, 'HH:mm');

        if (record.checkOut) {
            const checkOut = new Date(record.checkOut);
            const checkOutTime = format(checkOut, 'HH:mm');
            const durationMinutes = differenceInMinutes(checkOut, checkIn);
            const hours = Math.floor(durationMinutes / 60);
            const mins = durationMinutes % 60;
            return `📅 ${dateStr} : ${checkInTime} - ${checkOutTime} (${hours}h${mins > 0 ? mins + 'min' : ''})`;
        } else {
            return `📅 ${dateStr} : ${checkInTime} - En cours...`;
        }
    });
}

/**
 * Format weekly summary as WhatsApp message - "Mon Espace Salarié" format
 */
export function formatWeeklySummaryMessage(summary: WeeklySummary): string {
    const ongoingNote = summary.ongoingSession ? ' _(en cours)_' : '';

    // Format leave info
    let leaveInfo: string;
    if (summary.lastLeaveStatus && summary.lastLeaveDate) {
        leaveInfo = `• Dernière demande : ${summary.lastLeaveDate} (${summary.lastLeaveStatus})`;
    } else {
        leaveInfo = '• Dernière demande : Aucune';
    }

    // Format hours precisely (24.5h -> 24h 30m)
    const hoursStr = summary.totalHours > 0 ? `${summary.totalHours}h` : '0h';
    const minsStr = summary.totalMinutes > 0 ? ` ${summary.totalMinutes}m` : '';

    return `📊 *Mon Espace Salarié*
👤 ${summary.employeeName}

⏱️ *Cette semaine* :
• Travaillé : ${hoursStr}${minsStr}${ongoingNote}
• Présence : ${summary.daysWorked} jour(s)

🏖️ *Mes Congés* :
• Solde disponible : ${summary.leaveBalanceStr}
${leaveInfo}

_Tapez 'Frais' pour ajouter une dépense._`;
}

/**
 * Format history as WhatsApp message
 */
export function formatHistoryMessage(history: string[], employeeName: string): string {
    if (history.length === 0) {
        return `📋 *Historique des 10 derniers jours*\n\n_Aucun pointage trouvé._`;
    }

    return `📋 *Historique des 10 derniers jours*\n👤 ${employeeName}\n\n${history.join('\n')}`;
}
