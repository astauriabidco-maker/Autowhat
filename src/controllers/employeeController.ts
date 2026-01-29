import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const prisma = new PrismaClient();

/**
 * GET /api/employees
 * Returns list of employees with lastActivity and status.
 */
export const getEmployees = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
            res.status(401).json({ error: 'Non autorisé - tenantId manquant' });
            return;
        }

        const employees = await prisma.employee.findMany({
            where: { tenantId },
            include: {
                attendances: {
                    orderBy: { checkIn: 'desc' },
                    take: 1,
                    select: { checkIn: true, checkOut: true }
                }
            }
        });

        const formattedEmployees = employees.map(emp => {
            const lastAttendance = emp.attendances[0];
            const lastActivityDate = lastAttendance
                ? (lastAttendance.checkOut || lastAttendance.checkIn)
                : null;

            // Determine status
            let status: 'ACTIVE' | 'ARCHIVED' | 'NEVER_CONNECTED' = 'ACTIVE';
            if (emp.role === 'ARCHIVED') {
                status = 'ARCHIVED';
            } else if (!lastAttendance) {
                status = 'NEVER_CONNECTED';
            }

            return {
                id: emp.id,
                name: emp.name || 'Sans nom',
                phoneNumber: emp.phoneNumber,
                role: emp.role,
                position: emp.role === 'MANAGER' ? 'Manager' : 'Employé',
                status,
                lastActivity: lastActivityDate,
                lastActivityFormatted: lastActivityDate
                    ? formatDistanceToNow(new Date(lastActivityDate), { addSuffix: true, locale: fr })
                    : 'Jamais'
            };
        });

        res.status(200).json({ employees: formattedEmployees });
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

/**
 * POST /api/employees
 * Creates a new employee.
 */
export const createEmployee = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
            res.status(401).json({ error: 'Non autorisé - tenantId manquant' });
            return;
        }

        // === SaaS CHECKS: Trial & Quota ===
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { plan: true, trialEndsAt: true, maxEmployees: true }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant non trouvé' });
            return;
        }

        // Check 1: Trial Expiration
        if (tenant.plan === 'TRIAL' && tenant.trialEndsAt && new Date() > tenant.trialEndsAt) {
            res.status(403).json({
                error: 'Période d\'essai terminée. Veuillez passer à la version Pro.',
                code: 'TRIAL_EXPIRED'
            });
            return;
        }

        // Check 2: Employee Quota
        const currentCount = await prisma.employee.count({
            where: {
                tenantId,
                role: { not: 'ARCHIVED' }  // Only count active employees
            }
        });

        if (currentCount >= tenant.maxEmployees) {
            res.status(403).json({
                error: `Limite atteinte (${currentCount}/${tenant.maxEmployees}). Passez à la version Pro pour ajouter plus d'employés.`,
                code: 'QUOTA_EXCEEDED',
                current: currentCount,
                max: tenant.maxEmployees
            });
            return;
        }

        // === END SaaS CHECKS ===

        const { name, phoneNumber, role, position, workProfile, siteId, language } = req.body;

        if (!name || !phoneNumber) {
            res.status(400).json({ error: 'Nom et numéro de téléphone requis' });
            return;
        }

        // Clean phone number (remove spaces, dashes, + prefix)
        const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');

        // Check if employee already exists with this phone
        const existing = await prisma.employee.findFirst({
            where: { phoneNumber: cleanPhone, tenantId }
        });

        if (existing) {
            res.status(409).json({ error: 'Un employé avec ce numéro existe déjà' });
            return;
        }

        const employee = await prisma.employee.create({
            data: {
                name,
                phoneNumber: cleanPhone,
                role: role || 'EMPLOYEE',
                workProfile: workProfile || 'MOBILE', // Default: Mobile (no GPS restriction)
                siteId: siteId || null,
                language: language || 'fr', // Default: French
                tenantId
            }
        });

        res.status(201).json({
            success: true,
            message: 'Employé créé avec succès',
            employee: {
                id: employee.id,
                name: employee.name,
                phoneNumber: employee.phoneNumber,
                role: employee.role,
                position: position || 'Employé',
                status: 'NEVER_CONNECTED',
                lastActivityFormatted: 'Jamais'
            }
        });
    } catch (error) {
        console.error('Error creating employee:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

/**
 * PATCH /api/employees/:id
 * Updates an employee (name, role, archive status).
 */
export const updateEmployee = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const { id } = req.params;
        const { name, role, archived } = req.body;

        if (!tenantId) {
            res.status(401).json({ error: 'Non autorisé - tenantId manquant' });
            return;
        }

        const employeeId = id as string;

        // Verify employee belongs to this tenant
        const employee = await prisma.employee.findFirst({
            where: { id: employeeId, tenantId }
        });

        if (!employee) {
            res.status(404).json({ error: 'Employé non trouvé' });
            return;
        }

        const updateData: { name?: string; role?: string } = {};
        if (name) updateData.name = name;
        if (role) updateData.role = role;
        if (archived !== undefined) {
            updateData.role = archived ? 'ARCHIVED' : 'EMPLOYEE';
        }

        const updated = await prisma.employee.update({
            where: { id: employeeId },
            data: updateData
        });

        res.status(200).json({
            success: true,
            message: archived ? 'Employé archivé' : 'Employé mis à jour',
            employee: updated
        });
    } catch (error) {
        console.error('Error updating employee:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

/**
 * DELETE /api/employees/:id
 * Soft delete = archive the employee.
 */
export const deleteEmployee = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const { id } = req.params;

        if (!tenantId) {
            res.status(401).json({ error: 'Non autorisé - tenantId manquant' });
            return;
        }

        const employeeId = id as string;

        // Verify employee belongs to this tenant
        const employee = await prisma.employee.findFirst({
            where: { id: employeeId, tenantId }
        });

        if (!employee) {
            res.status(404).json({ error: 'Employé non trouvé' });
            return;
        }

        // Soft delete: archive instead of hard delete
        await prisma.employee.update({
            where: { id: employeeId },
            data: { role: 'ARCHIVED' }
        });

        res.status(200).json({
            success: true,
            message: 'Employé archivé avec succès'
        });
    } catch (error) {
        console.error('Error deleting employee:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};
