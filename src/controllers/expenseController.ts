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
            `${statusEmoji} Votre note de frais de *${expense.amount.toFixed(2)} €* a été *${statusText}* par votre manager.`
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
