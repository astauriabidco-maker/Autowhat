import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

// Pricing configuration (module-level for reuse)
const PLAN_PRICES = {
    PRO: 29,
    ENTERPRISE: 99
};

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
 * Returns global platform statistics with MRR estimation.
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
            pendingLeaves,
            proTenants,
            enterpriseTenants,
            recentTenants,
            totalMessagesInbound,
            totalMessagesOutbound,
            todayMessagesInbound,
            todayMessagesOutbound
        ] = await Promise.all([
            prisma.tenant.count(),
            prisma.employee.count(),
            prisma.employee.count({ where: { role: 'MANAGER' } }),
            prisma.attendance.count({
                where: {
                    checkIn: { gte: today, lte: endOfDay }
                }
            }),
            prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
            prisma.tenant.count({ where: { plan: 'PRO' } as any }),
            prisma.tenant.count({ where: { plan: 'ENTERPRISE' } as any }),
            prisma.tenant.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: {
                    employees: {
                        where: { role: 'MANAGER' },
                        take: 1,
                        select: { name: true, phoneNumber: true }
                    },
                    _count: { select: { employees: true } }
                }
            }),
            // Message stats - total
            (prisma as any).messageLog.count({ where: { direction: 'INBOUND' } }),
            (prisma as any).messageLog.count({ where: { direction: 'OUTBOUND' } }),
            // Message stats - today
            (prisma as any).messageLog.count({ where: { direction: 'INBOUND', createdAt: { gte: today, lte: endOfDay } } }),
            (prisma as any).messageLog.count({ where: { direction: 'OUTBOUND', createdAt: { gte: today, lte: endOfDay } } })
        ]);

        // Calculate MRR with both plans
        const mrr = (proTenants * PLAN_PRICES.PRO) + (enterpriseTenants * PLAN_PRICES.ENTERPRISE);

        res.status(200).json({
            totalTenants,
            totalEmployees,
            totalManagers,
            todayAttendances,
            pendingLeaves,
            proTenants,
            mrr,
            // WhatsApp Stats
            messages: {
                totalInbound: totalMessagesInbound,
                totalOutbound: totalMessagesOutbound,
                total: totalMessagesInbound + totalMessagesOutbound,
                todayInbound: todayMessagesInbound,
                todayOutbound: todayMessagesOutbound,
                today: todayMessagesInbound + todayMessagesOutbound
            },
            recentTenants: recentTenants.map(t => ({
                id: t.id,
                name: t.name,
                createdAt: t.createdAt,
                plan: (t as any).plan,
                employeeCount: t._count.employees,
                adminName: t.employees[0]?.name || 'N/A',
                adminPhone: t.employees[0]?.phoneNumber || 'N/A'
            }))
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

/**
 * GET /admin/analytics
 * Returns historical analytics data for charts (MRR trend, conversion funnel).
 */
export const getAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
        // Get all tenants with their plan and creation date
        const tenants = await prisma.tenant.findMany({
            select: {
                id: true,
                name: true,
                plan: true,
                createdAt: true,
                trialEndsAt: true,
                _count: { select: { employees: true } }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Generate last 6 months data
        const months = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                month: date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
                date: date
            });
        }

        // Calculate MRR for each month
        const mrrHistory = months.map(({ month, date }) => {
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

            let pro = 0;
            let enterprise = 0;
            let trial = 0;

            tenants.forEach((t: any) => {
                if (new Date(t.createdAt) <= endOfMonth) {
                    if (t.plan === 'PRO') pro++;
                    else if (t.plan === 'ENTERPRISE') enterprise++;
                    else if (t.plan === 'TRIAL') trial++;
                }
            });

            const mrr = (pro * PLAN_PRICES.PRO) + (enterprise * PLAN_PRICES.ENTERPRISE);

            return {
                month,
                mrr,
                pro,
                enterprise,
                trial,
                total: pro + enterprise + trial
            };
        });

        // Current plan counts
        const planDistribution = {
            trial: tenants.filter((t: any) => t.plan === 'TRIAL').length,
            pro: tenants.filter((t: any) => t.plan === 'PRO').length,
            enterprise: tenants.filter((t: any) => t.plan === 'ENTERPRISE').length
        };

        // Conversion funnel
        const totalSignups = tenants.length;
        const converted = planDistribution.pro + planDistribution.enterprise;
        const conversionRate = totalSignups > 0 ? ((converted / totalSignups) * 100).toFixed(1) : '0';

        // Churn: trials that expired without converting
        const expiredTrials = tenants.filter((t: any) => {
            if (t.plan !== 'TRIAL') return false;
            if (!t.trialEndsAt) return false;
            return new Date(t.trialEndsAt) < now;
        }).length;

        res.status(200).json({
            mrrHistory,
            planDistribution,
            funnel: {
                signups: totalSignups,
                activeTrials: planDistribution.trial,
                converted,
                conversionRate: parseFloat(conversionRate),
                expiredTrials
            },
            currentMRR: mrrHistory[mrrHistory.length - 1]?.mrr || 0,
            projectedARR: (mrrHistory[mrrHistory.length - 1]?.mrr || 0) * 12
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des analytics' });
    }
};

/**
 * GET /admin/tenants/list
 * Returns paginated list of tenants with admin info.
 */
export const getTenantsWithDetails = async (req: Request, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const [totalCount, tenants] = await Promise.all([
            prisma.tenant.count(),
            prisma.tenant.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    employees: {
                        where: { role: 'MANAGER' },
                        take: 1,
                        select: {
                            id: true,
                            name: true,
                            phoneNumber: true
                        }
                    },
                    _count: { select: { employees: true } }
                }
            })
        ]);

        const now = new Date();

        res.status(200).json({
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            tenants: tenants.map(t => {
                // Determine status
                let status: 'TRIAL' | 'ACTIVE' | 'EXPIRED' = 'ACTIVE';
                if (t.plan === 'TRIAL') {
                    status = t.trialEndsAt && new Date(t.trialEndsAt) < now ? 'EXPIRED' : 'TRIAL';
                }

                return {
                    id: t.id,
                    name: t.name,
                    createdAt: t.createdAt,
                    plan: t.plan,
                    trialEndsAt: t.trialEndsAt,
                    status,
                    employeeCount: t._count.employees,
                    maxEmployees: t.maxEmployees,
                    admin: t.employees[0] ? {
                        id: t.employees[0].id,
                        name: t.employees[0].name,
                        phone: t.employees[0].phoneNumber
                    } : null
                };
            })
        });
    } catch (error) {
        console.error('Error fetching tenants with details:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

/**
 * POST /admin/tenants/:id/extend-trial
 * Extends trial period by X days.
 */
export const extendTrial = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const { days } = req.body;

        if (!days || isNaN(days) || days < 1 || days > 365) {
            res.status(400).json({ error: 'Nombre de jours invalide (1-365)' });
            return;
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant non trouvé' });
            return;
        }

        // Calculate new trial end date
        const baseDate = tenant.trialEndsAt && new Date(tenant.trialEndsAt) > new Date()
            ? new Date(tenant.trialEndsAt)
            : new Date();

        const newTrialEndsAt = new Date(baseDate);
        newTrialEndsAt.setDate(newTrialEndsAt.getDate() + parseInt(days));

        const updatedTenant = await prisma.tenant.update({
            where: { id },
            data: {
                trialEndsAt: newTrialEndsAt,
                plan: 'TRIAL' // Ensure it's in trial
            }
        });

        console.log(`🎁 Trial extended: ${tenant.name} +${days} days -> ${newTrialEndsAt.toISOString()}`);

        // Log action
        const superAdmin = req.superAdmin;
        if (superAdmin) {
            await logAdminAction(superAdmin.id, 'EXTEND_TRIAL', 'TENANT', tenant.id, tenant.name, {
                days: parseInt(days),
                newTrialEndsAt: newTrialEndsAt.toISOString()
            });
        }

        res.status(200).json({
            message: `Trial étendu de ${days} jours`,
            tenant: {
                id: updatedTenant.id,
                name: updatedTenant.name,
                trialEndsAt: (updatedTenant as any).trialEndsAt
            }
        });
    } catch (error) {
        console.error('Error extending trial:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

/**
 * POST /admin/tenants/:id/impersonate
 * CRITICAL: Generate a token to impersonate a tenant's admin.
 */
export const impersonateTenant = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const superAdmin = req.superAdmin;

        if (!superAdmin) {
            res.status(401).json({ error: 'SuperAdmin non authentifié' });
            return;
        }

        // Find tenant's admin (MANAGER)
        const tenant = await prisma.tenant.findUnique({
            where: { id },
            include: {
                employees: {
                    where: { role: 'MANAGER' },
                    take: 1
                }
            }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant non trouvé' });
            return;
        }

        const admin = tenant.employees[0];
        if (!admin) {
            res.status(404).json({ error: 'Aucun admin trouvé pour ce tenant' });
            return;
        }

        // Generate impersonation token with special flag
        const impersonationToken = jwt.sign(
            {
                userId: admin.id,
                tenantId: tenant.id,
                role: 'MANAGER',
                impersonatedBy: superAdmin.id,
                impersonatedAt: new Date().toISOString()
            },
            JWT_SECRET,
            { expiresIn: '2h' } // Shorter expiry for security
        );

        console.log(`🕵️ IMPERSONATION: SuperAdmin ${superAdmin.email} -> ${tenant.name} (${admin.name})`);

        res.status(200).json({
            message: 'Impersonation token generated',
            token: impersonationToken,
            tenant: {
                id: tenant.id,
                name: tenant.name
            },
            admin: {
                id: admin.id,
                name: admin.name
            }
        });

        // Log action
        await logAdminAction(superAdmin.id, 'IMPERSONATE', 'TENANT', tenant.id, tenant.name, {
            adminId: admin.id,
            adminName: admin.name
        });

    } catch (error) {
        console.error('Error impersonating:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

/**
 * Helper function to log SuperAdmin actions
 */
const logAdminAction = async (
    superAdminId: string,
    action: string,
    targetType: string,
    targetId: string,
    targetName: string | null,
    details: any
) => {
    try {
        await prisma.adminActionLog.create({
            data: {
                superAdminId,
                action,
                targetType,
                targetId,
                targetName,
                details: JSON.stringify(details)
            }
        });
    } catch (error) {
        console.error('Failed to log admin action:', error);
    }
};

/**
 * POST /admin/tenants/:id/change-plan
 * Change tenant's subscription plan
 */
export const changePlan = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const { plan } = req.body;
        const superAdmin = req.superAdmin;

        const validPlans = ['TRIAL', 'PRO', 'ENTERPRISE'];
        if (!plan || !validPlans.includes(plan)) {
            res.status(400).json({ error: 'Plan invalide. Options: TRIAL, PRO, ENTERPRISE' });
            return;
        }

        const tenant = await prisma.tenant.findUnique({ where: { id } });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant non trouvé' });
            return;
        }

        const oldPlan = tenant.plan;

        // Update plan and adjust limits
        const maxEmployees = plan === 'ENTERPRISE' ? 500 : plan === 'PRO' ? 50 : 5;

        const updatedTenant = await prisma.tenant.update({
            where: { id },
            data: {
                plan,
                maxEmployees,
                // Clear trial end date if upgrading to paid plan
                trialEndsAt: plan !== 'TRIAL' ? null : tenant.trialEndsAt
            }
        });

        // Log action
        if (superAdmin) {
            await logAdminAction(superAdmin.id, 'CHANGE_PLAN', 'TENANT', tenant.id, tenant.name, {
                oldPlan,
                newPlan: plan,
                maxEmployees
            });
        }

        res.status(200).json({
            message: `Plan changé de ${oldPlan} à ${plan}`,
            tenant: {
                id: updatedTenant.id,
                name: updatedTenant.name,
                plan: updatedTenant.plan,
                maxEmployees: updatedTenant.maxEmployees
            }
        });
    } catch (error) {
        console.error('Error changing plan:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

/**
 * GET /admin/logs
 * Get SuperAdmin action logs
 */
export const getActionLogs = async (req: Request, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            prisma.adminActionLog.findMany({
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.adminActionLog.count()
        ]);

        res.status(200).json({
            logs: logs.map(log => ({
                ...log,
                details: log.details ? JSON.parse(log.details) : null
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching action logs:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

/**
 * POST /admin/tenants/:id/suspend
 * Suspend or reactivate a tenant
 */
export const suspendTenant = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const { action } = req.body; // 'suspend' or 'reactivate'
        const superAdmin = req.superAdmin;

        if (!action || !['suspend', 'reactivate'].includes(action)) {
            res.status(400).json({ error: 'Action invalide. Options: suspend, reactivate' });
            return;
        }

        const tenant = await prisma.tenant.findUnique({ where: { id } });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant non trouvé' });
            return;
        }

        const newStatus = action === 'suspend' ? 'SUSPENDED' : 'ACTIVE';
        const oldStatus = (tenant as any).status || 'ACTIVE';

        const updatedTenant = await prisma.tenant.update({
            where: { id },
            data: { status: newStatus } as any
        });

        // Log action
        if (superAdmin) {
            await logAdminAction(superAdmin.id, action === 'suspend' ? 'SUSPEND' : 'REACTIVATE', 'TENANT', tenant.id, tenant.name, {
                oldStatus,
                newStatus
            });
        }

        console.log(`🚫 Tenant ${action === 'suspend' ? 'suspended' : 'reactivated'}: ${tenant.name}`);

        res.status(200).json({
            message: action === 'suspend' ? `Client "${tenant.name}" suspendu` : `Client "${tenant.name}" réactivé`,
            tenant: {
                id: (updatedTenant as any).id,
                name: (updatedTenant as any).name,
                status: (updatedTenant as any).status
            }
        });
    } catch (error) {
        console.error('Error suspending tenant:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

/**
 * DELETE /admin/tenants/:id
 * Permanently delete a tenant and all related data
 */
export const deleteTenant = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const superAdmin = req.superAdmin;

        const tenant = await prisma.tenant.findUnique({
            where: { id },
            include: { _count: { select: { employees: true } } }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant non trouvé' });
            return;
        }

        // Delete in order (cascade manually for safety)
        // 1. Delete all attendance records for this tenant's employees
        await prisma.attendance.deleteMany({
            where: { employee: { tenantId: id } }
        });

        // 2. Delete all expenses for this tenant's employees
        await prisma.expense.deleteMany({
            where: { employee: { tenantId: id } }
        });

        // 3. Delete all notifications for this tenant
        await prisma.notification.deleteMany({
            where: { tenantId: id }
        });

        // 4. Delete all employees
        await prisma.employee.deleteMany({
            where: { tenantId: id }
        });

        // 5. Delete all sites
        await prisma.site.deleteMany({
            where: { tenantId: id }
        });

        // 6. Finally delete the tenant
        await prisma.tenant.delete({
            where: { id }
        });

        // Log action
        if (superAdmin) {
            await logAdminAction(superAdmin.id, 'DELETE', 'TENANT', id, tenant.name, {
                employeeCount: tenant._count.employees,
                deletedAt: new Date().toISOString()
            });
        }

        console.log(`🗑️ Tenant deleted: ${tenant.name} (${tenant._count.employees} employees)`);

        res.status(200).json({
            message: `Client "${tenant.name}" supprimé définitivement`,
            deleted: {
                tenantId: id,
                tenantName: tenant.name,
                employeeCount: tenant._count.employees
            }
        });
    } catch (error) {
        console.error('Error deleting tenant:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

/**
 * GET /admin/sessions/active
 * Returns list of active attendance sessions (checkOut is null).
 */
export const getActiveSessions = async (req: Request, res: Response): Promise<void> => {
    try {
        const activeSessions = await prisma.attendance.findMany({
            where: {
                checkOut: null
            },
            include: {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        tenantId: true,
                        tenant: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: { checkIn: 'asc' }
        });

        // Calculate duration for each active session
        const now = new Date();
        const sessionsWithDuration = activeSessions.map(session => {
            const checkIn = new Date(session.checkIn);
            const durationMs = now.getTime() - checkIn.getTime();
            const durationMinutes = Math.floor(durationMs / (1000 * 60));
            const hours = Math.floor(durationMinutes / 60);
            const minutes = durationMinutes % 60;

            return {
                id: session.id,
                checkIn: session.checkIn,
                duration: `${hours}h${minutes.toString().padStart(2, '0')}`,
                durationMinutes,
                employee: {
                    id: session.employee.id,
                    name: session.employee.name,
                    phoneNumber: session.employee.phoneNumber
                },
                tenant: session.employee.tenant
            };
        });

        res.status(200).json({
            count: sessionsWithDuration.length,
            sessions: sessionsWithDuration
        });
    } catch (error) {
        console.error('Error fetching active sessions:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

// ==========================================
// PLATFORM CONFIGURATION ENDPOINTS
// ==========================================

// GET /admin/config
// Returns the platform configuration
export const getConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        let config = await prisma.platformConfig.findUnique({
            where: { id: 1 }
        });

        // Create default config if not exists
        if (!config) {
            config = await prisma.platformConfig.create({
                data: { id: 1 }
            });
        }

        res.status(200).json(config);
    } catch (error: any) {
        console.error('Error fetching config:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération de la configuration' });
    }
};

// PUT /admin/config
// Updates the platform configuration
export const updateConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            platformName,
            supportEmail,
            defaultTrialDays,
            maintenanceMode,
            allowRegistrations,
            termsOfService,
            privacyPolicy,
            legalNotices,
            // Bot WhatsApp Configuration
            botWelcomeText,
            botBtn1Label,
            botBtn2Label,
            whatsappPhoneNumber
        } = req.body;

        const config = await prisma.platformConfig.update({
            where: { id: 1 },
            data: {
                ...(platformName !== undefined && { platformName }),
                ...(supportEmail !== undefined && { supportEmail }),
                ...(defaultTrialDays !== undefined && { defaultTrialDays: parseInt(defaultTrialDays) }),
                ...(maintenanceMode !== undefined && { maintenanceMode }),
                ...(allowRegistrations !== undefined && { allowRegistrations }),
                ...(termsOfService !== undefined && { termsOfService }),
                ...(privacyPolicy !== undefined && { privacyPolicy }),
                ...(legalNotices !== undefined && { legalNotices }),
                // Bot config
                ...(botWelcomeText !== undefined && { botWelcomeText }),
                ...(botBtn1Label !== undefined && { botBtn1Label }),
                ...(botBtn2Label !== undefined && { botBtn2Label }),
                ...(whatsappPhoneNumber !== undefined && { whatsappPhoneNumber })
            }
        });

        // Log the action
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET) as any;
                await logAdminAction(
                    decoded.id,
                    'UPDATE_CONFIG',
                    'PLATFORM',
                    'config',
                    null,
                    { changes: req.body }
                );
            } catch (e) { /* ignore */ }
        }

        console.log('⚙️ Platform config updated:', config);
        res.status(200).json(config);
    } catch (error: any) {
        console.error('Error updating config:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour de la configuration' });
    }
};

// GET /api/config/legal
// Returns legal content for public pages (NO AUTH REQUIRED)
export const getLegalContent = async (req: Request, res: Response): Promise<void> => {
    try {
        let config = await prisma.platformConfig.findUnique({
            where: { id: 1 },
            select: {
                termsOfService: true,
                privacyPolicy: true,
                legalNotices: true
            }
        });

        // Create default config if not exists
        if (!config) {
            await prisma.platformConfig.create({
                data: { id: 1 }
            });
            config = { termsOfService: null, privacyPolicy: null, legalNotices: null };
        }

        res.status(200).json(config);
    } catch (error: any) {
        console.error('Error fetching legal content:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du contenu légal' });
    }
};

// ==========================================
// SUPER ADMIN TEAM MANAGEMENT
// ==========================================

// GET /admin/admins
// Returns list of all SuperAdmins
export const getAdmins = async (req: Request, res: Response): Promise<void> => {
    try {
        const admins = await prisma.superAdmin.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                createdAt: true
            },
            orderBy: { createdAt: 'asc' }
        });

        res.status(200).json(admins);
    } catch (error: any) {
        console.error('Error fetching admins:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des administrateurs' });
    }
};

// POST /admin/admins
// Creates a new SuperAdmin
export const createAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, name, password } = req.body;

        if (!email || !name || !password) {
            res.status(400).json({ error: 'Email, nom et mot de passe requis' });
            return;
        }

        // Check if email already exists
        const existing = await prisma.superAdmin.findUnique({
            where: { email }
        });

        if (existing) {
            res.status(400).json({ error: 'Cet email est déjà utilisé' });
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        const newAdmin = await prisma.superAdmin.create({
            data: {
                email,
                name,
                password: hashedPassword
            },
            select: {
                id: true,
                email: true,
                name: true,
                createdAt: true
            }
        });

        // Log the action
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET) as any;
                await logAdminAction(
                    decoded.id,
                    'CREATE_ADMIN',
                    'SUPERADMIN',
                    newAdmin.id,
                    newAdmin.email,
                    { name: newAdmin.name }
                );
            } catch (e) { /* ignore */ }
        }

        console.log('👤 New SuperAdmin created:', newAdmin.email);
        res.status(201).json(newAdmin);
    } catch (error: any) {
        console.error('Error creating admin:', error);
        res.status(500).json({ error: 'Erreur lors de la création de l\'administrateur' });
    }
};

// ==========================================
// SYSTEM HEALTH CHECK
// ==========================================

// GET /admin/health
// Returns system health status
export const getHealth = async (req: Request, res: Response): Promise<void> => {
    try {
        // Check database connectivity
        let dbConnected = false;
        try {
            await prisma.$queryRaw`SELECT 1`;
            dbConnected = true;
        } catch (e) {
            dbConnected = false;
        }

        // Check environment variables (without exposing values)
        const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;
        const smtpConfigured = !!(process.env.SMTP_HOST || process.env.SENDGRID_API_KEY);
        const whatsappConfigured = !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
        const redisConfigured = !!process.env.REDIS_URL;

        const health = {
            status: dbConnected ? 'healthy' : 'degraded',
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            services: {
                database: {
                    status: dbConnected ? 'connected' : 'disconnected',
                    configured: true
                },
                stripe: {
                    status: stripeConfigured ? 'configured' : 'missing',
                    configured: stripeConfigured
                },
                smtp: {
                    status: smtpConfigured ? 'configured' : 'missing',
                    configured: smtpConfigured
                },
                whatsapp: {
                    status: whatsappConfigured ? 'configured' : 'missing',
                    configured: whatsappConfigured
                },
                redis: {
                    status: redisConfigured ? 'configured' : 'missing',
                    configured: redisConfigured
                }
            },
            timestamp: new Date().toISOString()
        };

        res.status(200).json(health);
    } catch (error: any) {
        console.error('Error checking health:', error);
        res.status(500).json({
            status: 'error',
            error: 'Erreur lors de la vérification du système'
        });
    }
};

// ==========================================
// MANUAL TENANT MANAGEMENT (CRM)
// ==========================================

/**
 * POST /admin/tenants/create
 * Creates a tenant manually with admin user (for offline/phone sales)
 */
export const createTenant = async (req: Request, res: Response): Promise<void> => {
    try {
        const { companyName, adminEmail, adminName, password, plan = 'TRIAL' } = req.body;
        const superAdmin = req.superAdmin;

        if (!companyName || !adminEmail || !adminName || !password) {
            res.status(400).json({ error: 'Tous les champs sont requis: companyName, adminEmail, adminName, password' });
            return;
        }

        // Check if email already exists
        const existingEmployee = await prisma.employee.findFirst({
            where: { phoneNumber: adminEmail }
        });
        if (existingEmployee) {
            res.status(400).json({ error: 'Un utilisateur avec cet email existe déjà' });
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Determine plan limits
        const planLimits: Record<string, { maxEmployees: number; trialDays?: number }> = {
            TRIAL: { maxEmployees: 5, trialDays: 14 },
            PRO: { maxEmployees: 50 },
            ENTERPRISE: { maxEmployees: 500 }
        };
        const limits = planLimits[plan] || planLimits.TRIAL;

        // Create Tenant + Admin in transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create Tenant
            const tenant = await tx.tenant.create({
                data: {
                    name: companyName,
                    plan,
                    status: 'ACTIVE',
                    maxEmployees: limits.maxEmployees,
                    trialEndsAt: limits.trialDays
                        ? new Date(Date.now() + limits.trialDays * 24 * 60 * 60 * 1000)
                        : null
                }
            });

            // Create Admin Employee
            const adminEmployee = await tx.employee.create({
                data: {
                    name: adminName,
                    phoneNumber: adminEmail, // Using email as phone for admin
                    role: 'MANAGER',
                    tenantId: tenant.id,
                    password: hashedPassword
                }
            });

            return { tenant, admin: adminEmployee };
        });

        // Log action
        if (superAdmin) {
            await logAdminAction(
                superAdmin.id,
                'CREATE_TENANT',
                'TENANT',
                result.tenant.id,
                companyName,
                { adminEmail, plan }
            );
        }

        console.log(`🏢 Manual tenant created: ${companyName} (${plan})`);

        res.status(201).json({
            message: 'Client créé avec succès',
            tenant: result.tenant,
            admin: {
                id: result.admin.id,
                name: result.admin.name,
                email: adminEmail
            }
        });
    } catch (error: any) {
        console.error('Error creating tenant:', error);
        res.status(500).json({ error: 'Erreur lors de la création du client' });
    }
};

/**
 * PUT /admin/tenants/:id/plan-override
 * Force a plan without Stripe payment (for manual billing, gifts, etc.)
 */
export const planOverride = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const { planName, maxEmployees, overrideEndDate, reason } = req.body;
        const superAdmin = req.superAdmin;

        if (!planName) {
            res.status(400).json({ error: 'planName requis' });
            return;
        }

        const tenant = await prisma.tenant.findUnique({ where: { id } });
        if (!tenant) {
            res.status(404).json({ error: 'Tenant non trouvé' });
            return;
        }

        const oldPlan = tenant.plan;
        const oldMaxEmployees = tenant.maxEmployees;

        // Update tenant with override
        const updatedTenant = await prisma.tenant.update({
            where: { id },
            data: {
                plan: planName,
                maxEmployees: maxEmployees || (planName === 'ENTERPRISE' ? 500 : planName === 'PRO' ? 50 : 5),
                // Clear trial if upgrading, or set override end date
                trialEndsAt: overrideEndDate ? new Date(overrideEndDate) : null,
                status: 'ACTIVE'
            }
        });

        // Log action
        if (superAdmin) {
            await logAdminAction(
                superAdmin.id,
                'PLAN_OVERRIDE',
                'TENANT',
                id,
                tenant.name,
                {
                    oldPlan,
                    newPlan: planName,
                    oldMaxEmployees,
                    newMaxEmployees: updatedTenant.maxEmployees,
                    overrideEndDate,
                    reason: reason || 'Manual override by SuperAdmin'
                }
            );
        }

        console.log(`⚡ Plan override: ${tenant.name} -> ${planName} (max: ${updatedTenant.maxEmployees})`);

        res.status(200).json({
            message: `Plan forcé: ${oldPlan} → ${planName}`,
            tenant: {
                id: updatedTenant.id,
                name: updatedTenant.name,
                plan: updatedTenant.plan,
                maxEmployees: updatedTenant.maxEmployees,
                status: updatedTenant.status
            }
        });
    } catch (error: any) {
        console.error('Error overriding plan:', error);
        res.status(500).json({ error: 'Erreur lors du changement de plan' });
    }
};

/**
 * GET /admin/tenants/:id/full-details
 * Returns complete tenant details with employees, stats, and invoices
 */
export const getTenantFullDetails = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;

        // Get basic tenant info
        const tenant = await prisma.tenant.findUnique({
            where: { id }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant non trouvé' });
            return;
        }

        // Get employees separately
        const employees = await prisma.employee.findMany({
            where: { tenantId: id },
            select: {
                id: true,
                name: true,
                phoneNumber: true,
                role: true
            },
            orderBy: { name: 'asc' }
        });

        // Get sites separately
        const sites = await prisma.site.findMany({
            where: { tenantId: id },
            select: {
                id: true,
                name: true
            }
        });

        // Get usage stats (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [attendanceCount, activeEmployees, totalEmployees] = await Promise.all([
            prisma.attendance.count({
                where: {
                    employee: { tenantId: id },
                    checkIn: { gte: thirtyDaysAgo }
                }
            }),
            prisma.employee.count({
                where: {
                    tenantId: id,
                    attendances: {
                        some: { checkIn: { gte: thirtyDaysAgo } }
                    }
                }
            }),
            prisma.employee.count({
                where: { tenantId: id }
            })
        ]);

        // Calculate MRR
        const mrr = tenant.plan === 'PRO' ? 29 : tenant.plan === 'ENTERPRISE' ? 99 : 0;

        res.status(200).json({
            tenant: {
                id: tenant.id,
                name: tenant.name,
                plan: tenant.plan,
                status: tenant.status,
                maxEmployees: tenant.maxEmployees,
                trialEndsAt: tenant.trialEndsAt,
                createdAt: tenant.createdAt,
                country: tenant.country,
                legalName: tenant.legalName,
                stripeCustomerId: tenant.stripeCustomerId
            },
            stats: {
                totalEmployees,
                activeEmployees,
                attendanceLast30Days: attendanceCount,
                totalSites: sites.length,
                mrr
            },
            employees,
            sites
        });
    } catch (error: any) {
        console.error('Error fetching tenant full details:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des détails' });
    }
};
