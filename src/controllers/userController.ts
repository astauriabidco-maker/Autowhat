import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Update current user preferences (language, etc.)
 * PATCH /api/users/me
 */
export const updateCurrentUser = async (req: Request, res: Response): Promise<any> => {
    try {
        const managerId = (req as any).managerId;
        const { language } = req.body;

        const updateData: { language?: string } = {};

        // Validate language
        if (language && ['fr', 'en', 'es'].includes(language)) {
            updateData.language = language;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        const updatedEmployee = await prisma.employee.update({
            where: { id: managerId },
            data: updateData,
            select: {
                id: true,
                name: true,
                language: true
            }
        });

        console.log(`🌐 User ${managerId} updated language to: ${language}`);

        return res.json({
            message: 'Preferences updated',
            user: updatedEmployee
        });
    } catch (error) {
        console.error('Error updating user:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Get current user profile
 * GET /api/users/me
 */
export const getCurrentUser = async (req: Request, res: Response): Promise<any> => {
    try {
        const managerId = (req as any).managerId;

        const employee = await prisma.employee.findUnique({
            where: { id: managerId },
            select: {
                id: true,
                name: true,
                phoneNumber: true,
                role: true,
                language: true,
                tenant: {
                    select: {
                        id: true,
                        name: true,
                        language: true
                    }
                }
            }
        });

        if (!employee) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.json(employee);
    } catch (error) {
        console.error('Error getting user:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
