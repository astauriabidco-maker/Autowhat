import { Prisma } from '@prisma/client';
import { dispatchWebhook, WEBHOOK_EVENTS } from './webhookService';
import prisma from '../lib/prisma';
import { absoluteSignedUploadUrlIfNeeded } from '../utils/signedFileUrl';


// Expense categories
export const EXPENSE_CATEGORIES = {
    REPAS: '🍔 Repas',
    ESSENCE: '⛽ Essence',
    HOTEL: '🏨 Hôtel',
    MATERIEL: '🛠️ Matériel'
};

function getBackendBaseUrl(): string {
    return process.env.BACKEND_URL || process.env.BASE_URL || process.env.APP_URL || 'http://localhost:3000';
}

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
    category: string,
    merchant?: string | null,
    tva?: number | null
) {
    // Create expense
    const expense = await prisma.expense.create({
        data: {
            photoUrl,
            amount,
            tva,
            merchant,
            category,
            status: 'PENDING',
            employeeId,
            tenantId
        },
        include: {
            employee: {
                select: {
                    name: true,
                    phoneNumber: true
                }
            }
        }
    });

    // Dispatch webhook (Bridge Strategy)
    await dispatchWebhook(WEBHOOK_EVENTS.EXPENSE_SUBMITTED, {
        expenseId: expense.id,
        amount: expense.amount,
        tva: expense.tva,
        merchant: expense.merchant,
        category: expense.category,
        employeeId: expense.employeeId,
        employeeName: expense.employee.name,
        employeePhone: expense.employee.phoneNumber,
        photoUrl: absoluteSignedUploadUrlIfNeeded(getBackendBaseUrl(), expense.photoUrl, 60 * 60),
        status: expense.status
    }, tenantId);

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
