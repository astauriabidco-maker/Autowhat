import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Expense categories
export const EXPENSE_CATEGORIES = {
    REPAS: '🍔 Repas',
    ESSENCE: '⛽ Essence',
    HOTEL: '🏨 Hôtel',
    MATERIEL: '🛠️ Matériel'
};

/**
 * Update employee's conversation state and temporary data
 */
export async function setConversationState(
    employeeId: string,
    state: string | null,
    tempData?: any
) {
    await prisma.employee.update({
        where: { id: employeeId },
        data: {
            conversationState: state,
            tempExpenseData: tempData ?? undefined
        }
    });
}

/**
 * Update only the temporary expense data (append to existing)
 */
export async function updateTempExpenseData(
    employeeId: string,
    updates: Record<string, any>
) {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { tempExpenseData: true }
    });

    const currentData = (employee?.tempExpenseData as Record<string, any>) || {};
    const newData = { ...currentData, ...updates };

    await prisma.employee.update({
        where: { id: employeeId },
        data: { tempExpenseData: newData }
    });

    return newData;
}

/**
 * Create the final expense record and reset conversation state
 */
export async function createExpense(
    employeeId: string,
    tenantId: string,
    photoUrl: string,
    amount: number,
    category: string
) {
    // Create expense
    const expense = await prisma.expense.create({
        data: {
            photoUrl,
            amount,
            category,
            status: 'PENDING',
            employeeId,
            tenantId
        }
    });

    // Reset employee conversation state - use Prisma.DbNull for JSON fields
    await prisma.employee.update({
        where: { id: employeeId },
        data: {
            conversationState: null,
            tempExpenseData: Prisma.DbNull
        }
    });

    return expense;
}

/**
 * Get all expenses for an employee
 */
export async function getEmployeeExpenses(employeeId: string, tenantId: string) {
    return prisma.expense.findMany({
        where: {
            employeeId,
            tenantId
        },
        orderBy: { date: 'desc' }
    });
}

/**
 * Handle manager approval/rejection of expense
 */
export async function handleExpenseResponse(
    expenseId: string,
    tenantId: string,
    approved: boolean
) {
    const expense = await prisma.expense.findFirst({
        where: { id: expenseId, tenantId },
        include: { employee: true }
    });

    if (!expense) {
        return { success: false, message: 'Note de frais non trouvée.' };
    }

    if (expense.status !== 'PENDING') {
        return { success: false, message: 'Cette note de frais a déjà été traitée.' };
    }

    const newStatus = approved ? 'APPROVED' : 'REJECTED';

    await prisma.expense.update({
        where: { id: expenseId },
        data: { status: newStatus }
    });

    return {
        success: true,
        status: newStatus,
        expense,
        employeePhoneNumber: expense.employee.phoneNumber
    };
}
