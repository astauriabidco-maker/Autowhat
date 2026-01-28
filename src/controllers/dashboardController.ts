import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { startOfWeek, addDays, format, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';

const prisma = new PrismaClient();

/**
 * Formate une date en heure locale (Europe/Paris)
 */
const formatTimeInParis = (date: Date): string => {
    return date.toLocaleTimeString('fr-FR', {
        timeZone: 'Europe/Paris',
        hour: '2-digit',
        minute: '2-digit'
    });
};

/**
 * Formate une date complète en locale (Europe/Paris)
 */
const formatDateInParis = (date: Date): string => {
    return date.toLocaleDateString('fr-FR', {
        timeZone: 'Europe/Paris',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

/**
 * GET /api/attendance
 * Retrieves attendance records for the manager's tenant.
 * SECURITY: Uses ONLY req.user.tenantId from JWT - never from query params.
 * 
 * Query params:
 * - period: 'today' | 'week' | 'month' (default: 'today')
 */
export const getAttendance = async (req: Request, res: Response): Promise<void> => {
    try {
        // CRITICAL: Get tenantId from JWT token ONLY (never from query params)
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
            res.status(401).json({ error: 'Non autorisé - tenantId manquant' });
            return;
        }

        const period = (req.query.period as string) || 'today';

        // Calculate date range based on period
        const now = new Date();
        let startDate: Date;
        let endDate: Date = new Date(now);
        endDate.setUTCHours(23, 59, 59, 999);

        switch (period) {
            case 'week':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 7);
                startDate.setUTCHours(0, 0, 0, 0);
                break;
            case 'month':
                startDate = new Date(now);
                startDate.setDate(1); // First day of current month
                startDate.setUTCHours(0, 0, 0, 0);
                break;
            case 'today':
            default:
                startDate = new Date(now);
                startDate.setUTCHours(0, 0, 0, 0);
                break;
        }

        // SECURITY: Query ALWAYS filtered by tenantId from JWT
        const attendances = await prisma.attendance.findMany({
            where: {
                tenantId: tenantId, // CRITICAL: Multi-tenant isolation
                checkIn: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        role: true
                    }
                }
            },
            orderBy: {
                checkIn: 'desc'
            }
        });

        // Format response with Paris timezone
        const formattedAttendances = attendances.map(a => ({
            id: a.id,
            employee: {
                id: a.employee.id,
                name: a.employee.name,
                phoneNumber: a.employee.phoneNumber,
                role: a.employee.role
            },
            date: formatDateInParis(a.checkIn),
            checkIn: formatTimeInParis(a.checkIn),
            checkOut: a.checkOut ? formatTimeInParis(a.checkOut) : null,
            status: a.status,
            photoUrl: a.photoUrl || null,
            latitude: a.latitude || null,
            longitude: a.longitude || null,
            distanceFromSite: a.distanceFromSite || null,
            duration: a.checkOut
                ? calculateDuration(a.checkIn, a.checkOut)
                : 'En cours'
        }));

        res.status(200).json({
            period,
            count: formattedAttendances.length,
            attendances: formattedAttendances
        });
    } catch (error) {
        console.error('Error fetching attendance:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

/**
 * GET /api/attendance/stats
 * Returns attendance statistics for the manager's tenant.
 */
export const getAttendanceStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
            res.status(401).json({ error: 'Non autorisé - tenantId manquant' });
            return;
        }

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setUTCHours(23, 59, 59, 999);

        // Count employees in this tenant
        const totalEmployees = await prisma.employee.count({
            where: { tenantId }
        });

        // Count check-ins today
        const checkedInToday = await prisma.attendance.count({
            where: {
                tenantId,
                checkIn: {
                    gte: today,
                    lte: endOfDay
                }
            }
        });

        // Count currently working (checked in but not checked out)
        const currentlyWorking = await prisma.attendance.count({
            where: {
                tenantId,
                checkIn: {
                    gte: today,
                    lte: endOfDay
                },
                checkOut: null
            }
        });

        res.status(200).json({
            totalEmployees,
            checkedInToday,
            currentlyWorking,
            absent: totalEmployees - checkedInToday
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

/**
 * Calculates duration between two dates
 */
function calculateDuration(checkIn: Date, checkOut: Date): string {
    const diffMs = checkOut.getTime() - checkIn.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h${minutes.toString().padStart(2, '0')}`;
}

/**
 * GET /api/dashboard/stats
 * Returns comprehensive dashboard statistics including KPIs, weekly activity, and recent events.
 * Query params:
 * - siteId: optional, filter by specific site
 */
export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
            res.status(401).json({ error: 'Non autorisé - tenantId manquant' });
            return;
        }

        // Optional siteId filter
        const siteId = req.query.siteId as string | undefined;
        const siteFilter = siteId ? { siteId } : {};

        const now = new Date();
        const today = new Date(now);
        today.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setUTCHours(23, 59, 59, 999);

        // KPI 1: Total employees (filtered by site if provided)
        const totalEmployees = await prisma.employee.count({
            where: { tenantId, ...siteFilter }
        });

        // KPI 2: Currently active (checked in but not out today)
        const activeNow = await prisma.attendance.count({
            where: {
                tenantId,
                ...siteFilter,
                checkIn: { gte: today, lte: endOfDay },
                checkOut: null
            }
        });

        // KPI 3: Pending expenses
        const pendingExpenses = await prisma.expense.count({
            where: { tenantId, ...siteFilter, status: 'PENDING' }
        });

        // Weekly Activity: Hours worked per day this week
        const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
        const weeklyActivity: { day: string; hours: number }[] = [];

        for (let i = 0; i < 7; i++) {
            const dayStart = addDays(weekStart, i);
            const dayEnd = new Date(dayStart);
            dayEnd.setUTCHours(23, 59, 59, 999);

            const dayAttendances = await prisma.attendance.findMany({
                where: {
                    tenantId,
                    ...siteFilter,
                    checkIn: { gte: dayStart, lte: dayEnd }
                }
            });

            let totalMinutes = 0;
            for (const att of dayAttendances) {
                const checkIn = new Date(att.checkIn);
                const checkOut = att.checkOut ? new Date(att.checkOut) : now;
                totalMinutes += differenceInMinutes(checkOut, checkIn);
            }

            weeklyActivity.push({
                day: format(dayStart, 'EEE', { locale: fr }).slice(0, 3),
                hours: Math.round(totalMinutes / 60)
            });
        }

        // Recent Activity: Last 10 events (mix of check-ins, check-outs, and expenses)
        const recentAttendances = await prisma.attendance.findMany({
            where: { tenantId, ...siteFilter },
            include: { employee: { select: { name: true } } },
            orderBy: { checkIn: 'desc' },
            take: 10
        });

        const recentExpenses = await prisma.expense.findMany({
            where: { tenantId, ...siteFilter },
            include: { employee: { select: { name: true } } },
            orderBy: { date: 'desc' },
            take: 10
        });

        // Combine and sort by date
        const combinedActivities = [
            ...recentAttendances.map(att => ({
                type: att.checkOut ? 'CHECKOUT' : 'CHECKIN',
                user: att.employee.name || 'Employé',
                time: att.checkOut || att.checkIn,
                details: att.checkOut
                    ? `Fin de journée (${calculateDuration(att.checkIn, att.checkOut)})`
                    : 'Début de journée'
            })),
            ...recentExpenses.map(exp => ({
                type: 'EXPENSE',
                user: exp.employee.name || 'Employé',
                time: exp.date,
                details: `${exp.amount}€ - ${exp.category}`
            }))
        ];

        // Sort by time descending and take last 10
        const recentActivity = combinedActivities
            .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
            .slice(0, 10)
            .map(act => ({
                ...act,
                time: formatTimeInParis(new Date(act.time)),
                timeAgo: getTimeAgo(new Date(act.time))
            }));

        res.status(200).json({
            totalEmployees,
            activeNow,
            pendingExpenses,
            weeklyActivity,
            recentActivity
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

/**
 * Helper: Get human-readable time ago string
 */
function getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Il y a ${diffHours}h`;

    const diffDays = Math.floor(diffHours / 24);
    return `Il y a ${diffDays}j`;
}
