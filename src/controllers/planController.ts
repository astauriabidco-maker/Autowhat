/**
 * Plan Controller
 * Manages subscription plans from database for dynamic pricing.
 */
import { Request, Response } from 'express';
import prisma from '../lib/prisma';


/**
 * GET /api/plans
 * Public endpoint - Returns only active plans for frontend display
 */
export const getPublicPlans = async (req: Request, res: Response): Promise<void> => {
    try {
        const plans = await prisma.subscriptionPlan.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            select: {
                id: true,
                stripePriceId: true,
                name: true,
                description: true,
                price: true,
                currency: true,
                maxEmployees: true,
                features: true,
                isPopular: true,
                sortOrder: true
            }
        });

        // Parse features from string to array for frontend
        const parsedPlans = plans.map(plan => ({
            ...plan,
            features: parseFeatures(plan.features)
        }));

        res.status(200).json(parsedPlans);
    } catch (error: any) {
        console.error('Error fetching public plans:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des plans' });
    }
};

/**
 * GET /admin/plans
 * SuperAdmin endpoint - Returns all plans including inactive
 */
export const getAllPlans = async (req: Request, res: Response): Promise<void> => {
    try {
        const plans = await prisma.subscriptionPlan.findMany({
            orderBy: { sortOrder: 'asc' }
        });

        res.status(200).json(plans);
    } catch (error: any) {
        console.error('Error fetching all plans:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des plans' });
    }
};

/**
 * GET /admin/plans/:id
 * SuperAdmin endpoint - Returns a single plan
 */
export const getPlanById = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;

        const plan = await prisma.subscriptionPlan.findUnique({
            where: { id }
        });

        if (!plan) {
            res.status(404).json({ error: 'Plan non trouvé' });
            return;
        }

        res.status(200).json(plan);
    } catch (error: any) {
        console.error('Error fetching plan:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du plan' });
    }
};

/**
 * POST /admin/plans
 * SuperAdmin endpoint - Create a new plan
 */
export const createPlan = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            stripePriceId,
            name,
            description,
            price,
            currency,
            maxEmployees,
            features,
            isPopular,
            isActive,
            sortOrder
        } = req.body;

        // Validation
        if (!stripePriceId || !name || price === undefined || !maxEmployees) {
            res.status(400).json({ error: 'stripePriceId, name, price et maxEmployees sont requis' });
            return;
        }

        // Check if stripePriceId already exists
        const existing = await prisma.subscriptionPlan.findUnique({
            where: { stripePriceId }
        });

        if (existing) {
            res.status(400).json({ error: 'Un plan avec cet ID Stripe existe déjà' });
            return;
        }

        const plan = await prisma.subscriptionPlan.create({
            data: {
                stripePriceId,
                name,
                description: description || null,
                price: parseFloat(price),
                currency: currency || 'EUR',
                maxEmployees: parseInt(maxEmployees),
                features: Array.isArray(features) ? features.join(',') : (features || ''),
                isPopular: isPopular ?? false,
                isActive: isActive ?? true,
                sortOrder: sortOrder ?? 0
            }
        });

        console.log(`📦 New plan created: ${name} (${stripePriceId})`);
        res.status(201).json(plan);
    } catch (error: any) {
        console.error('Error creating plan:', error);
        res.status(500).json({ error: 'Erreur lors de la création du plan' });
    }
};

/**
 * PUT /admin/plans/:id
 * SuperAdmin endpoint - Update plan (limited fields)
 * Note: stripePriceId and price should NOT be modified (Stripe constraint)
 */
export const updatePlan = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const {
            name,
            description,
            maxEmployees,
            features,
            isPopular,
            isActive,
            sortOrder
        } = req.body;

        // Check plan exists
        const existing = await prisma.subscriptionPlan.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: 'Plan non trouvé' });
            return;
        }

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (maxEmployees !== undefined) updateData.maxEmployees = parseInt(maxEmployees);
        if (features !== undefined) {
            updateData.features = Array.isArray(features) ? features.join(',') : features;
        }
        if (isPopular !== undefined) updateData.isPopular = isPopular;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

        const plan = await prisma.subscriptionPlan.update({
            where: { id },
            data: updateData
        });

        console.log(`📦 Plan updated: ${plan.name}`);
        res.status(200).json(plan);
    } catch (error: any) {
        console.error('Error updating plan:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du plan' });
    }
};

/**
 * DELETE /admin/plans/:id
 * SuperAdmin endpoint - Delete a plan (prefer using isActive=false instead)
 */
export const deletePlan = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;

        await prisma.subscriptionPlan.delete({ where: { id } });

        console.log(`🗑️ Plan deleted: ${id}`);
        res.status(200).json({ success: true, message: 'Plan supprimé' });
    } catch (error: any) {
        console.error('Error deleting plan:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression du plan' });
    }
};

/**
 * Helper to parse features string to array
 */
function parseFeatures(features: string): string[] {
    if (!features) return [];
    // Try JSON parse first
    try {
        const parsed = JSON.parse(features);
        if (Array.isArray(parsed)) return parsed;
    } catch {
        // Not JSON, split by comma
    }
    return features.split(',').map(f => f.trim()).filter(Boolean);
}
