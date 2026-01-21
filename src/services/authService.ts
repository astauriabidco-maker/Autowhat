import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Identifies a user by their phone number.
 * Returns the Employee object including the Tenant.
 * 
 * @param phoneNumber The phone number to search for.
 * @returns Employee with Tenant or null if not found.
 */
export const identifyUser = async (phoneNumber: string) => {
    // Simple cleanup: remove spaces and hyphens to match E.164 loose formatting if needed.
    // Assuming the DB stores standard strict E.164, we might just pass it through.
    // But the prompt asked to handle spaces or dashes.
    const cleanedPhoneNumber = phoneNumber.replace(/[\s-]/g, '');

    const employee = await prisma.employee.findFirst({
        where: {
            phoneNumber: cleanedPhoneNumber,
        },
        include: {
            tenant: true,
        },
    });

    return employee;
};
