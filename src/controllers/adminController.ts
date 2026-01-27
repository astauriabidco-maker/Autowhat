import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

/**
 * POST /admin/login
 * Authenticates a Super Admin and returns a JWT token.
 */
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'Email et mot de passe requis' });
            return;
        }

        const superAdmin = await prisma.superAdmin.findUnique({
            where: { email }
        });

        if (!superAdmin) {
            res.status(401).json({ error: 'Identifiants invalides' });
            return;
        }

        const isPasswordValid = await bcrypt.compare(password, superAdmin.password);
        if (!isPasswordValid) {
            res.status(401).json({ error: 'Identifiants invalides' });
            return;
        }

        const token = jwt.sign(
            {
                id: superAdmin.id,
                email: superAdmin.email,
                name: superAdmin.name,
                role: 'SUPER_ADMIN'
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.status(200).json({
            message: 'Connexion réussie',
            token,
            user: {
                id: superAdmin.id,
                email: superAdmin.email,
                name: superAdmin.name,
                role: 'SUPER_ADMIN'
            }
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

/**
 * GET /admin/tenants
 * Returns all tenants with employee counts.
 */
export const getAllTenants = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenants = await prisma.tenant.findMany({
            include: {
                _count: {
                    select: { employees: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({
            count: tenants.length,
            tenants: tenants.map(t => ({
                id: t.id,
                name: t.name,
                createdAt: t.createdAt,
                employeeCount: t._count.employees
            }))
        });
    } catch (error) {
        console.error('Error fetching tenants:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

/**
 * GET /admin/employees
 * Returns all employees across all tenants.
 */
export const getAllEmployees = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.query.tenantId as string | undefined;

        const employees = await prisma.employee.findMany({
            where: tenantId ? { tenantId } : undefined,
            include: {
                tenant: { select: { name: true } }
            },
            orderBy: { name: 'asc' }
        });

        res.status(200).json({
            count: employees.length,
            employees: employees.map(e => ({
                id: e.id,
                name: e.name,
                phoneNumber: e.phoneNumber,
                role: e.role,
                tenant: e.tenant.name,
                tenantId: e.tenantId
            }))
        });
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

/**
 * GET /admin/attendance
 * Returns all attendance records across all tenants.
 */
export const getAllAttendance = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.query.tenantId as string | undefined;
        const period = (req.query.period as string) || 'today';

        // Calculate date range
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
                startDate.setDate(1);
                startDate.setUTCHours(0, 0, 0, 0);
                break;
            case 'all':
                startDate = new Date(0); // Beginning of time
                break;
            case 'today':
            default:
                startDate = new Date(now);
                startDate.setUTCHours(0, 0, 0, 0);
                break;
        }

        const attendances = await prisma.attendance.findMany({
            where: {
                ...(tenantId && { tenantId }),
                checkIn: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                employee: {
                    include: {
                        tenant: { select: { name: true } }
                    }
                }
            },
            orderBy: { checkIn: 'desc' }
        });

        res.status(200).json({
            period,
            count: attendances.length,
            attendances: attendances.map(a => ({
                id: a.id,
                employee: {
                    id: a.employee.id,
                    name: a.employee.name,
                    phoneNumber: a.employee.phoneNumber,
                    role: a.employee.role
                },
                tenant: a.employee.tenant.name,
                tenantId: a.tenantId,
                date: a.checkIn.toLocaleDateString('fr-FR'),
                checkIn: a.checkIn.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                checkOut: a.checkOut?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) || null,
                status: a.status
            }))
        });
    } catch (error) {
        console.error('Error fetching attendance:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

/**
 * GET /admin/stats
 * Returns global platform statistics.
 */
export const getGlobalStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setUTCHours(23, 59, 59, 999);

        const [
            totalTenants,
            totalEmployees,
            totalManagers,
            todayAttendances,
            pendingLeaves
        ] = await Promise.all([
            prisma.tenant.count(),
            prisma.employee.count(),
            prisma.employee.count({ where: { role: 'MANAGER' } }),
            prisma.attendance.count({
                where: {
                    checkIn: { gte: today, lte: endOfDay }
                }
            }),
            prisma.leaveRequest.count({ where: { status: 'PENDING' } })
        ]);

        res.status(200).json({
            totalTenants,
            totalEmployees,
            totalManagers,
            todayAttendances,
            pendingLeaves
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};
