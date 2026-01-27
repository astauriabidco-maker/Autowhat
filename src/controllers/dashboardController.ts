import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

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
