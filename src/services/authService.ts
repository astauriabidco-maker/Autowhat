import prisma from '../lib/prisma';


/**
 * Identifies a user by their phone number.
 * Returns the Employee object including the Tenant and state fields.
 * 
 * @param phoneNumber The phone number to search for.
 * @returns Employee with Tenant or null if not found.
 */
export const identifyUser = async (phoneNumber: string) => {
    // Simple cleanup: remove spaces and hyphens to match E.164 loose formatting if needed.
    // Assuming the DB stores standard strict E.164, we might just pass it through.
    // But the prompt asked to handle spaces or dashes.
    const cleanedPhoneNumber = phoneNumber.replace(/[\s-]/g, '');

    const withoutPlus = cleanedPhoneNumber.replace(/^\+/, '');

    const employee = await prisma.employee.findFirst({
        where: {
            role: { not: 'ARCHIVED' },
            OR: [
                { phoneNumber: cleanedPhoneNumber },
                { phoneNumber: withoutPlus },
                { phoneNumber: `+${withoutPlus}` },
                { phoneNumber: { endsWith: withoutPlus.slice(-9) } }
            ]
        },
        include: {
            tenant: true,
        },
    });

    return employee;
};
