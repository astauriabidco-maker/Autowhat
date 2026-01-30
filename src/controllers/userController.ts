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

/**
 * Get onboarding status for current user
 * GET /api/user/onboarding-status
 */
export const getOnboardingStatus = async (req: Request, res: Response): Promise<any> => {
    try {
        const managerId = (req as any).managerId;

        const employee = await prisma.employee.findUnique({
            where: { id: managerId },
            select: {
                id: true,
                role: true,
                hasCompletedOnboarding: true,
                tenant: {
                    select: {
                        id: true,
                        name: true,
                        _count: { select: { sites: true, employees: true } }
                    }
                }
            }
        });

        if (!employee) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Only managers need onboarding
        const needsOnboarding = employee.role === 'MANAGER' && !employee.hasCompletedOnboarding;

        return res.json({
            hasCompletedOnboarding: employee.hasCompletedOnboarding,
            needsOnboarding,
            tenantStats: {
                sites: employee.tenant._count.sites,
                employees: employee.tenant._count.employees
            }
        });
    } catch (error) {
        console.error('Error getting onboarding status:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Mark onboarding as complete
 * POST /api/user/complete-onboarding
 */
export const completeOnboarding = async (req: Request, res: Response): Promise<any> => {
    try {
        const managerId = (req as any).managerId;

        await prisma.employee.update({
            where: { id: managerId },
            data: { hasCompletedOnboarding: true }
        });

        console.log(`✅ Onboarding completed for manager: ${managerId}`);

        return res.json({
            success: true,
            message: 'Onboarding completed successfully'
        });
    } catch (error) {
        console.error('Error completing onboarding:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
