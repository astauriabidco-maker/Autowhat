import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendMessage } from '../services/whatsappService';
import { EXPENSE_CATEGORIES } from '../services/expenseService';

const prisma = new PrismaClient();

/**
 * Get all expenses for the manager's tenant
 * GET /api/expenses
 */
export const getExpenses = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = (req as any).user?.tenantId;

        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const expenses = await prisma.expense.findMany({
            where: { tenantId },
            include: {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true
                    }
                }
            },
            orderBy: { date: 'desc' }
        });

        // Format response with readable date and category
        const formatted = expenses.map(exp => ({
            id: exp.id,
            date: new Date(exp.date).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
            amount: exp.amount,
            category: exp.category,
            categoryLabel: EXPENSE_CATEGORIES[exp.category as keyof typeof EXPENSE_CATEGORIES] || exp.category,
            photoUrl: exp.photoUrl,
            status: exp.status,
            employee: {
                id: exp.employee.id,
                name: exp.employee.name || 'Employé',
                phoneNumber: exp.employee.phoneNumber
            }
        }));

        return res.json({
            count: formatted.length,
            expenses: formatted
        });
    } catch (error) {
        console.error('❌ Error fetching expenses:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * Update expense status (approve/reject)
 * PATCH /api/expenses/:id/status
 */
export const updateExpenseStatus = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = (req as any).user?.tenantId;
        const { id } = req.params;
        const { status } = req.body;

        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ error: 'Statut invalide. Utilisez APPROVED ou REJECTED.' });
        }

        // Find expense with tenant isolation
        const expense = await prisma.expense.findFirst({
            where: { id: id as string, tenantId },
            include: { employee: true }
        });

        if (!expense) {
            return res.status(404).json({ error: 'Note de frais non trouvée' });
        }

        if (expense.status !== 'PENDING') {
            return res.status(400).json({ error: 'Cette note de frais a déjà été traitée' });
        }

        // Update status
        const updated = await prisma.expense.update({
            where: { id: id as string },
            data: { status }
        });

        // Send WhatsApp notification to employee
        const employeePhone = expense.employee.phoneNumber.replace('+', '');
        const statusEmoji = status === 'APPROVED' ? '✅' : '❌';
        const statusText = status === 'APPROVED' ? 'approuvée' : 'refusée';

        await sendMessage(
            employeePhone,
            `${statusEmoji} Votre note de frais de *${(expense.amount || 0).toFixed(2)} €* a été *${statusText}* par votre manager.`
        );

        console.log(`✅ Expense ${id} updated to ${status}, notification sent to ${employeePhone}`);

        return res.json({
            success: true,
            expense: {
                id: updated.id,
                status: updated.status
            }
        });
    } catch (error) {
        console.error('❌ Error updating expense:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * Update expense amount and category
 * PUT /api/expenses/:id
 */
export const updateExpense = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = (req as any).user?.tenantId;
        const id = req.params.id as string;
        const { amount, category } = req.body;

        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const expense = await prisma.expense.findFirst({
            where: { id, tenantId }
        });

        if (!expense) {
            return res.status(404).json({ error: 'Note de frais non trouvée' });
        }

        const updated = await prisma.expense.update({
            where: { id },
            data: {
                amount: amount !== undefined ? parseFloat(amount) : expense.amount,
                category: category || expense.category
            }
        });

        return res.json({ success: true, expense: updated });
    } catch (error) {
        console.error('❌ Error updating expense:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * Export expenses to CSV
 * GET /api/expenses/export
 */
export const exportExpenses = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const { month, year } = req.query;
        const now = new Date();
        const targetMonth = month ? Number(month) : now.getMonth() + 1;
        const targetYear = year ? Number(year) : now.getFullYear();

        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

        const expenses = await prisma.expense.findMany({
            where: {
                tenantId,
                status: 'APPROVED',
                date: { gte: startDate, lte: endDate }
            },
            include: {
                employee: { select: { name: true } }
            },
            orderBy: { date: 'asc' }
        });

        const csvHeader = 'Date;Employé;Catégorie;Montant;Devise;Description\n';
        const csvRows = expenses.map(e => {
            const date = new Date(e.date).toLocaleDateString('fr-FR');
            const name = e.employee?.name || 'Inconnu';
            const amount = e.amount?.toFixed(2) || '0.00';
            const description = (e.description || '').replace(/;/g, ',');
            return `${date};${name};${e.category};${amount};${e.currency};${description}`;
        }).join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="notes_frais_${targetYear}_${String(targetMonth).padStart(2, '0')}.csv"`);
        return res.send('\ufeff' + csvHeader + csvRows);
    } catch (error) {
        console.error('❌ Error exporting expenses:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * Get expense statistics
 * GET /api/expenses/stats
 */
export const getExpenseStats = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const [pending, approved, rejected, monthlyTotal] = await Promise.all([
            prisma.expense.count({ where: { tenantId, status: 'PENDING' } }),
            prisma.expense.count({
                where: { tenantId, status: 'APPROVED', date: { gte: startOfMonth, lte: endOfMonth } }
            }),
            prisma.expense.count({
                where: { tenantId, status: 'REJECTED', date: { gte: startOfMonth, lte: endOfMonth } }
            }),
            prisma.expense.aggregate({
                where: { tenantId, status: 'APPROVED', date: { gte: startOfMonth, lte: endOfMonth } },
                _sum: { amount: true }
            })
        ]);

        return res.json({
            pending,
            approved,
            rejected,
            monthlyTotal: monthlyTotal._sum.amount || 0
        });
    } catch (error) {
        console.error('❌ Error fetching expense stats:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

// ================================
// SUPERADMIN ENDPOINTS
// ================================

/**
 * Get all expenses across all tenants (SuperAdmin)
 * GET /superadmin/expenses
 */
export const getSuperAdminExpenses = async (req: Request, res: Response): Promise<any> => {
    try {
        const { tenantId, status, limit = '50', offset = '0' } = req.query;

        const where: any = {};
        if (tenantId) where.tenantId = tenantId as string;
        if (status && status !== 'all') where.status = status as string;

        const expenses = await prisma.expense.findMany({
            where,
            include: {
                employee: true,
                tenant: true
            },
            orderBy: { date: 'desc' },
            take: parseInt(limit as string),
            skip: parseInt(offset as string)
        });

        const total = await prisma.expense.count({ where });

        return res.json({
            expenses: expenses.map((e: any) => ({
                id: e.id,
                date: e.date,
                amount: e.amount,
                category: e.category,
                description: e.description,
                photoUrl: e.photoUrl,
                status: e.status,
                currency: e.currency,
                employee: e.employee ? {
                    id: e.employee.id,
                    name: e.employee.name,
                    phoneNumber: e.employee.phoneNumber
                } : null,
                tenant: e.tenant ? {
                    id: e.tenant.id,
                    companyName: e.tenant.companyName
                } : null
            })),
            total,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string)
        });
    } catch (error) {
        console.error('❌ Error fetching SuperAdmin expenses:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * Get global expense statistics (SuperAdmin)
 * GET /superadmin/expenses/stats
 */
export const getSuperAdminExpenseStats = async (req: Request, res: Response): Promise<any> => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const [pending, approved, rejected, monthlyTotal, tenantsWithExpenses] = await Promise.all([
            prisma.expense.count({ where: { status: 'PENDING' } }),
            prisma.expense.count({
                where: { status: 'APPROVED', date: { gte: startOfMonth, lte: endOfMonth } }
            }),
            prisma.expense.count({
                where: { status: 'REJECTED', date: { gte: startOfMonth, lte: endOfMonth } }
            }),
            prisma.expense.aggregate({
                where: { status: 'APPROVED', date: { gte: startOfMonth, lte: endOfMonth } },
                _sum: { amount: true }
            }),
            prisma.expense.groupBy({
                by: ['tenantId'],
                _count: { id: true }
            })
        ]);

        return res.json({
            pending,
            approved,
            rejected,
            monthlyTotal: monthlyTotal._sum.amount || 0,
            tenantsCount: tenantsWithExpenses.length
        });
    } catch (error) {
        console.error('❌ Error fetching SuperAdmin expense stats:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};
