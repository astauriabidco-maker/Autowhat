/**
 * Number Pool Controller
 * SuperAdmin endpoints for managing the system phone number pool.
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getNumberPoolStats } from '../services/numberAllocationService';

const prisma = new PrismaClient();

/**
 * GET /admin/number-pool
 * List all system phone numbers with stats
 */
export const listNumbers = async (req: Request, res: Response): Promise<void> => {
    try {
        const numbers = await prisma.systemPhoneNumber.findMany({
            include: {
                _count: {
                    select: { tenants: true }
                }
            },
            orderBy: [
                { countryCode: 'asc' },
                { tenantCount: 'desc' }
            ]
        });

        // Get pool-wide stats
        const stats = await getNumberPoolStats();

        res.status(200).json({
            success: true,
            numbers: numbers.map(num => ({
                id: num.id,
                phoneNumberId: num.phoneNumberId,
                displayNumber: num.displayNumber,
                countryCode: num.countryCode,
                wabaId: num.wabaId,
                isActive: num.isActive,
                tenantCount: num.tenantCount,
                actualTenantCount: num._count.tenants,
                createdAt: num.createdAt,
                // Mask token for security
                hasToken: !!num.accessToken
            })),
            stats
        });
    } catch (error) {
        console.error('Error listing number pool:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du pool' });
    }
};

/**
 * POST /admin/number-pool
 * Add a new system phone number to the pool
 */
export const addNumber = async (req: Request, res: Response): Promise<void> => {
    try {
        const { phoneNumberId, displayNumber, countryCode, accessToken, wabaId } = req.body;

        // Validation
        if (!phoneNumberId || !displayNumber || !countryCode || !accessToken || !wabaId) {
            res.status(400).json({ error: 'Tous les champs sont requis' });
            return;
        }

        // Check for duplicate phoneNumberId
        const existing = await prisma.systemPhoneNumber.findUnique({
            where: { phoneNumberId }
        });

        if (existing) {
            res.status(409).json({ error: 'Ce numéro existe déjà dans le pool' });
            return;
        }

        // Create new system number
        const newNumber = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId,
                displayNumber,
                countryCode: countryCode.toUpperCase(),
                accessToken,
                wabaId,
                isActive: true,
                tenantCount: 0
            }
        });

        console.log(`📞 Added system number to pool: ${displayNumber} (${countryCode})`);

        res.status(201).json({
            success: true,
            message: 'Numéro ajouté au pool avec succès',
            number: {
                id: newNumber.id,
                phoneNumberId: newNumber.phoneNumberId,
                displayNumber: newNumber.displayNumber,
                countryCode: newNumber.countryCode,
                wabaId: newNumber.wabaId,
                isActive: newNumber.isActive
            }
        });
    } catch (error) {
        console.error('Error adding number to pool:', error);
        res.status(500).json({ error: 'Erreur lors de l\'ajout du numéro' });
    }
};

/**
 * PUT /admin/number-pool/:id
 * Update a system phone number (toggle active, update token, etc.)
 */
export const updateNumber = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const { displayNumber, countryCode, accessToken, wabaId, isActive } = req.body;

        const existing = await prisma.systemPhoneNumber.findUnique({
            where: { id }
        });

        if (!existing) {
            res.status(404).json({ error: 'Numéro non trouvé' });
            return;
        }

        // Build update data (only include provided fields)
        const updateData: Record<string, any> = {};
        if (displayNumber !== undefined) updateData.displayNumber = displayNumber;
        if (countryCode !== undefined) updateData.countryCode = countryCode.toUpperCase();
        if (accessToken !== undefined) updateData.accessToken = accessToken;
        if (wabaId !== undefined) updateData.wabaId = wabaId;
        if (isActive !== undefined) updateData.isActive = isActive;

        const updated = await prisma.systemPhoneNumber.update({
            where: { id },
            data: updateData
        });

        console.log(`📞 Updated system number: ${updated.displayNumber} (active: ${updated.isActive})`);

        res.status(200).json({
            success: true,
            message: 'Numéro mis à jour',
            number: {
                id: updated.id,
                phoneNumberId: updated.phoneNumberId,
                displayNumber: updated.displayNumber,
                countryCode: updated.countryCode,
                wabaId: updated.wabaId,
                isActive: updated.isActive,
                tenantCount: updated.tenantCount
            }
        });
    } catch (error) {
        console.error('Error updating number:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du numéro' });
    }
};

/**
 * DELETE /admin/number-pool/:id
 * Remove a system phone number from the pool
 * Note: Will fail if tenants are still assigned to this number
 */
export const deleteNumber = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;

        const existing = await prisma.systemPhoneNumber.findUnique({
            where: { id },
            include: { _count: { select: { tenants: true } } }
        });

        if (!existing) {
            res.status(404).json({ error: 'Numéro non trouvé' });
            return;
        }

        // Check if tenants are still assigned
        if (existing._count.tenants > 0) {
            res.status(400).json({
                error: `Impossible de supprimer : ${existing._count.tenants} client(s) sont encore assignés à ce numéro. Réassignez-les d'abord.`
            });
            return;
        }

        await prisma.systemPhoneNumber.delete({
            where: { id }
        });

        console.log(`📞 Deleted system number from pool: ${existing.displayNumber}`);

        res.status(200).json({
            success: true,
            message: 'Numéro supprimé du pool'
        });
    } catch (error) {
        console.error('Error deleting number:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression du numéro' });
    }
};

/**
 * GET /admin/number-pool/:id/tenants
 * List all tenants assigned to a specific number
 */
export const getNumberTenants = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;

        const number = await prisma.systemPhoneNumber.findUnique({
            where: { id },
            include: {
                tenants: {
                    select: {
                        id: true,
                        name: true,
                        country: true,
                        plan: true,
                        createdAt: true
                    }
                }
            }
        });

        if (!number) {
            res.status(404).json({ error: 'Numéro non trouvé' });
            return;
        }

        res.status(200).json({
            success: true,
            number: {
                id: number.id,
                displayNumber: number.displayNumber,
                countryCode: number.countryCode
            },
            tenants: number.tenants
        });
    } catch (error) {
        console.error('Error fetching number tenants:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des clients' });
    }
};

/**
 * GET /admin/number-pool/stats
 * Get pool-wide statistics
 */
export const getPoolStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const stats = await getNumberPoolStats();
        res.status(200).json({ success: true, ...stats });
    } catch (error) {
        console.error('Error fetching pool stats:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
    }
};
