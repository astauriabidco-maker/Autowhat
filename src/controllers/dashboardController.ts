import { Request, Response } from 'express';
import { startOfWeek, addDays, format, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import prisma from '../lib/prisma';
import { signUploadUrlIfNeeded } from '../utils/signedFileUrl';


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
            photoUrl: signUploadUrlIfNeeded(a.photoUrl),
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

        // Get tenant for workStartTime
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { workStartTime: true }
        });
        const workStartTime = tenant?.workStartTime || '09:00';
        const [workStartHour, workStartMin] = workStartTime.split(':').map(Number);

        // Optional siteId filter
        const siteId = req.query.siteId as string | undefined;
        const siteFilter = siteId ? { siteId } : {};

        const now = new Date();
        const today = new Date(now);
        today.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setUTCHours(23, 59, 59, 999);

        // === KPIs de base ===

        // KPI 1: Total employees (filtered by site if provided)
        const totalEmployees = await prisma.employee.count({
            where: { tenantId, ...siteFilter, role: { not: 'ARCHIVED' } }
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

        // === ANALYTICS AVANCÉS ===

        // Date range for 30 days
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        thirtyDaysAgo.setUTCHours(0, 0, 0, 0);

        // Fetch all attendances from last 30 days for analytics
        const monthAttendances = await prisma.attendance.findMany({
            where: {
                tenantId,
                ...siteFilter,
                checkIn: { gte: thirtyDaysAgo }
            },
            select: {
                checkIn: true,
                checkOut: true
            }
        });

        // === 1. Taux de Ponctualité ===
        let onTimeCount = 0;
        let lateCount = 0;
        const TOLERANCE_MINUTES = 15;

        for (const att of monthAttendances) {
            const checkInDate = new Date(att.checkIn);
            const checkInHour = checkInDate.getHours();
            const checkInMin = checkInDate.getMinutes();

            // Calculate minutes since start of day
            const checkInTotalMin = checkInHour * 60 + checkInMin;
            const expectedTotalMin = workStartHour * 60 + workStartMin + TOLERANCE_MINUTES;

            if (checkInTotalMin <= expectedTotalMin) {
                onTimeCount++;
            } else {
                lateCount++;
            }
        }

        const punctualityRate = monthAttendances.length > 0
            ? Math.round((onTimeCount / monthAttendances.length) * 100)
            : 100;

        // === 2. Productivité Trend (heures par jour sur 30 jours) ===
        const productivityTrend: { date: string; hours: number }[] = [];

        for (let i = 29; i >= 0; i--) {
            const dayStart = new Date(now);
            dayStart.setDate(now.getDate() - i);
            dayStart.setUTCHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart);
            dayEnd.setUTCHours(23, 59, 59, 999);

            let dayMinutes = 0;
            for (const att of monthAttendances) {
                const checkInDate = new Date(att.checkIn);
                if (checkInDate >= dayStart && checkInDate <= dayEnd) {
                    const checkOut = att.checkOut ? new Date(att.checkOut) : now;
                    dayMinutes += differenceInMinutes(checkOut, checkInDate);
                }
            }

            productivityTrend.push({
                date: format(dayStart, 'dd/MM', { locale: fr }),
                hours: Math.round(dayMinutes / 60)
            });
        }

        // === 3. Moyenne Hebdo par employé ===
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekAttendances = monthAttendances.filter(att =>
            new Date(att.checkIn) >= weekStart
        );

        let totalWeekMinutes = 0;
        for (const att of weekAttendances) {
            const checkOut = att.checkOut ? new Date(att.checkOut) : now;
            totalWeekMinutes += differenceInMinutes(checkOut, new Date(att.checkIn));
        }

        // Get unique employees who worked this week
        const weekEmployeeAttendances = await prisma.attendance.findMany({
            where: {
                tenantId,
                ...siteFilter,
                checkIn: { gte: weekStart }
            },
            select: { employeeId: true },
            distinct: ['employeeId']
        });
        const activeEmployeesThisWeek = weekEmployeeAttendances.length || 1;

        const avgWeeklyMinutesPerEmployee = Math.round(totalWeekMinutes / activeEmployeesThisWeek);
        const avgWeeklyHours = Math.floor(avgWeeklyMinutesPerEmployee / 60);
        const avgWeeklyMins = avgWeeklyMinutesPerEmployee % 60;

        // === 4. Moyenne quotidienne (aujourd'hui) ===
        const todayAttendances = monthAttendances.filter(att => {
            const checkInDate = new Date(att.checkIn);
            return checkInDate >= today && checkInDate <= endOfDay;
        });

        let todayTotalMinutes = 0;
        for (const att of todayAttendances) {
            const checkOut = att.checkOut ? new Date(att.checkOut) : now;
            todayTotalMinutes += differenceInMinutes(checkOut, new Date(att.checkIn));
        }
        const avgDailyMinutes = todayAttendances.length > 0
            ? Math.round(todayTotalMinutes / todayAttendances.length)
            : 0;
        const avgDailyHours = Math.floor(avgDailyMinutes / 60);
        const avgDailyMins = avgDailyMinutes % 60;

        // === 5. Taux de remplissage (présents vs effectif) ===
        const checkedInToday = await prisma.attendance.groupBy({
            by: ['employeeId'],
            where: {
                tenantId,
                ...siteFilter,
                checkIn: { gte: today, lte: endOfDay }
            }
        });
        const fillRate = totalEmployees > 0
            ? Math.round((checkedInToday.length / totalEmployees) * 100)
            : 0;

        // === Weekly Activity (pour graphique existant) ===
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

        // Recent Activity: Last 10 events
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

        const recentActivity = combinedActivities
            .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
            .slice(0, 10)
            .map(act => ({
                ...act,
                time: formatTimeInParis(new Date(act.time)),
                timeAgo: getTimeAgo(new Date(act.time))
            }));

        // === Supervision GPS ===
        const siteWhere = siteId ? { tenantId, id: siteId } : { tenantId };
        const gpsSites = await prisma.site.findMany({
            where: siteWhere,
            select: {
                id: true,
                name: true,
                latitude: true,
                longitude: true,
                gpsMode: true,
                country: true
            },
            orderBy: { name: 'asc' }
        });
        const gpsSiteMap = new Map(gpsSites.map(site => [site.id, site]));

        const pendingGpsManagers = await prisma.employee.findMany({
            where: {
                tenantId,
                role: 'MANAGER',
                conversationState: 'WAITING_MANAGER_SITE_GPS_APPROVAL'
            },
            select: { id: true, name: true, tempExpenseData: true }
        });

        const pendingGpsProposals = pendingGpsManagers
            .map(manager => {
                const data = typeof manager.tempExpenseData === 'object' && manager.tempExpenseData && !Array.isArray(manager.tempExpenseData)
                    ? manager.tempExpenseData as Record<string, any>
                    : {};
                const proposalSiteId = data.siteId ? String(data.siteId) : null;
                if (siteId && proposalSiteId !== siteId) return null;
                const site = proposalSiteId ? gpsSiteMap.get(proposalSiteId) : null;

                return {
                    managerId: manager.id,
                    managerName: manager.name,
                    siteId: proposalSiteId,
                    siteName: data.siteName || site?.name || 'Site',
                    providerName: data.providerName || data.providerPhone || null,
                    sharedAt: data.sharedAt || null,
                    countryMismatch: Boolean(data.siteCountry && data.detectedCountry && data.siteCountry !== data.detectedCountry)
                };
            })
            .filter((proposal): proposal is NonNullable<typeof proposal> => Boolean(proposal));

        const gpsEventsRaw = await prisma.onboardingEvent.findMany({
            where: {
                tenantId,
                type: { in: ['SITE_GPS_POSITION_SHARED', 'SITE_GPS_UPDATED', 'SITE_GPS_REJECTED', 'SITE_GPS_APPROVAL_REMINDER_SENT'] }
            },
            include: {
                employee: { select: { id: true, name: true, phoneNumber: true, role: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        const gpsEvents = gpsEventsRaw
            .map(event => {
                const metadata = typeof event.metadata === 'object' && event.metadata && !Array.isArray(event.metadata)
                    ? event.metadata as Record<string, any>
                    : {};
                const eventSiteId = metadata.siteId ? String(metadata.siteId) : null;
                if (siteId && eventSiteId !== siteId) return null;
                const site = eventSiteId ? gpsSiteMap.get(eventSiteId) : null;

                return {
                    id: event.id,
                    type: event.type,
                    createdAt: event.createdAt,
                    siteId: eventSiteId,
                    siteName: metadata.siteName || site?.name || 'Site',
                    source: metadata.source || null,
                    actor: event.employee?.name || event.employee?.phoneNumber || null,
                    countryMismatch: Boolean(metadata.siteCountry && metadata.detectedCountry && metadata.siteCountry !== metadata.detectedCountry)
                };
            })
            .filter((event): event is NonNullable<typeof event> => Boolean(event));

        const gpsSevenDaysAgo = new Date(now);
        gpsSevenDaysAgo.setDate(now.getDate() - 7);
        const missingGpsSites = gpsSites.filter(site => !site.latitude || !site.longitude);
        const nonStrictSites = gpsSites.filter(site => site.latitude && site.longitude && site.gpsMode !== 'STRICT');
        const disabledGpsSites = gpsSites.filter(site => site.gpsMode === 'DISABLED');
        const recentlyRejected = gpsEvents.filter(event => event.type === 'SITE_GPS_REJECTED' && new Date(event.createdAt) >= gpsSevenDaysAgo);
        const recentlyValidated = gpsEvents.filter(event => event.type === 'SITE_GPS_UPDATED' && new Date(event.createdAt) >= gpsSevenDaysAgo);
        const riskLevel = missingGpsSites.length > 0 || disabledGpsSites.length > 0
            ? 'high'
            : pendingGpsProposals.length > 0 || nonStrictSites.length > 0 || recentlyRejected.length > 0
                ? 'medium'
                : 'low';

        res.status(200).json({
            // KPIs de base
            totalEmployees,
            activeNow,
            pendingExpenses,
            weeklyActivity,
            recentActivity,

            // Analytics avancés
            analytics: {
                punctuality: {
                    onTime: onTimeCount,
                    late: lateCount,
                    rate: punctualityRate
                },
                productivityTrend,
                avgWeekly: {
                    hours: avgWeeklyHours,
                    minutes: avgWeeklyMins,
                    formatted: `${avgWeeklyHours}h${avgWeeklyMins.toString().padStart(2, '0')}`
                },
                avgDaily: {
                    hours: avgDailyHours,
                    minutes: avgDailyMins,
                    formatted: `${avgDailyHours}h${avgDailyMins.toString().padStart(2, '0')}`
                },
                fillRate
            },
            gpsSupervision: {
                riskLevel,
                summary: {
                    totalSites: gpsSites.length,
                    strictSites: gpsSites.filter(site => site.latitude && site.longitude && site.gpsMode === 'STRICT').length,
                    missingGpsSites: missingGpsSites.length,
                    nonStrictSites: nonStrictSites.length,
                    disabledGpsSites: disabledGpsSites.length,
                    pendingProposals: pendingGpsProposals.length,
                    rejectedLast7Days: recentlyRejected.length,
                    validatedLast7Days: recentlyValidated.length
                },
                riskSites: [
                    ...missingGpsSites.map(site => ({
                        id: site.id,
                        name: site.name,
                        reason: 'Coordonnées GPS manquantes',
                        severity: 'high'
                    })),
                    ...nonStrictSites.map(site => ({
                        id: site.id,
                        name: site.name,
                        reason: site.gpsMode === 'DISABLED' ? 'Contrôle GPS désactivé' : 'Mode strict non activé',
                        severity: site.gpsMode === 'DISABLED' ? 'high' : 'medium'
                    }))
                ].slice(0, 5),
                pendingProposals: pendingGpsProposals.slice(0, 5),
                recentEvents: gpsEvents.slice(0, 6)
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

/**
 * GET /api/onboarding/progress
 * Returns manager-facing first steps after WhatsApp onboarding.
 */
export const getOnboardingProgress = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
            res.status(401).json({ error: 'Non autorisé - tenantId manquant' });
            return;
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                id: true,
                name: true,
                createdAt: true,
                maxEmployees: true,
                employees: {
                    where: { role: { not: 'ARCHIVED' } },
                    orderBy: { createdAt: 'asc' },
                    select: {
                        id: true,
                        name: true,
                        role: true,
                        hasCompletedOnboarding: true,
                        createdAt: true,
                        updatedAt: true,
                        attendances: {
                            orderBy: { checkIn: 'asc' },
                            take: 1,
                            select: { checkIn: true }
                        }
                    }
                },
                onboardingEvents: {
                    orderBy: { createdAt: 'asc' },
                    select: { type: true, employeeId: true, createdAt: true }
                }
            }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant non trouvé' });
            return;
        }

        const manager = tenant.employees.find(e => e.role === 'MANAGER');
        const employees = tenant.employees.filter(e => e.role === 'EMPLOYEE');
        const firstInvited = employees[0] || null;
        const firstActivated = employees.find(e => e.hasCompletedOnboarding) || null;
        const firstWithCheckin = employees.find(e => e.attendances.length > 0) || null;
        const eventTime = (type: string, employeeId?: string | null) =>
            tenant.onboardingEvents.find(e => e.type === type && (!employeeId || e.employeeId === employeeId))?.createdAt || null;
        const firstInvitedAt = firstInvited
            ? eventTime('EMPLOYEE_INVITED', firstInvited.id) || firstInvited.createdAt
            : null;
        const firstActivationReminderAt = firstInvited
            ? eventTime('FIRST_EMPLOYEE_ACTIVATION_REMINDER_SENT', firstInvited.id)
            : null;

        const steps = [
            {
                key: 'manager_activated',
                label: 'Manager WhatsApp activé',
                done: Boolean(manager?.hasCompletedOnboarding || eventTime('MANAGER_ACTIVATED', manager?.id)),
                timestamp: eventTime('MANAGER_ACTIVATED', manager?.id) || manager?.updatedAt || null
            },
            {
                key: 'employee_invited',
                label: 'Premier collaborateur invité',
                done: Boolean(firstInvited),
                timestamp: firstInvitedAt
            },
            {
                key: 'employee_activated',
                label: 'Collaborateur activé',
                done: Boolean(firstActivated),
                timestamp: firstActivated ? eventTime('EMPLOYEE_ACTIVATED', firstActivated.id) || firstActivated.updatedAt : null
            },
            {
                key: 'first_checkin',
                label: 'Premier pointage reçu',
                done: Boolean(firstWithCheckin?.attendances[0]?.checkIn),
                timestamp: firstWithCheckin ? eventTime('FIRST_CHECKIN', firstWithCheckin.id) || firstWithCheckin.attendances[0]?.checkIn || null : null
            }
        ];

        res.status(200).json({
            tenant: {
                id: tenant.id,
                name: tenant.name,
                createdAt: tenant.createdAt,
                maxEmployees: tenant.maxEmployees
            },
            summary: {
                employeeCount: employees.length,
                activatedEmployees: employees.filter(e => e.hasCompletedOnboarding).length,
                employeesWithCheckin: employees.filter(e => e.attendances.length > 0).length,
                remainingSeats: Math.max(tenant.maxEmployees - tenant.employees.length, 0)
            },
            firstEmployee: firstInvited ? {
                id: firstInvited.id,
                name: firstInvited.name,
                activated: firstInvited.hasCompletedOnboarding,
                invitedAt: firstInvitedAt,
                activationReminderSentAt: firstActivationReminderAt,
                firstCheckinAt: firstInvited.attendances[0]?.checkIn || null
            } : null,
            steps,
            nextAction: steps.find(s => !s.done)?.key || 'invite_next_employee'
        });
    } catch (error) {
        console.error('Error fetching onboarding progress:', error);
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
