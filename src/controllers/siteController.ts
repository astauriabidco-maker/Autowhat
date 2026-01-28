import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/sites
 * Liste tous les sites du tenant
 */
export const getSites = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).tenantId;

        const sites = await prisma.site.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                address: true,
                latitude: true,
                longitude: true
            }
        });

        res.json({ sites });
    } catch (error) {
        console.error('getSites error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * POST /api/sites
 * Créer un nouveau site pour le tenant
 */
export const createSite = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).tenantId;
        const { name, address, latitude, longitude } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Le nom du site est requis' });
        }

        const site = await prisma.site.create({
            data: {
                name,
                address,
                latitude,
                longitude,
                tenantId
            }
        });

        res.status(201).json({ site });
    } catch (error) {
        console.error('createSite error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * PUT /api/sites/:id
 * Modifier un site
 */
export const updateSite = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).tenantId;
        const id = req.params.id as string;
        const { name, address, latitude, longitude, radius } = req.body;

        // Vérifier que le site appartient au tenant
        const existingSite = await prisma.site.findFirst({
            where: { id, tenantId }
        });

        if (!existingSite) {
            return res.status(404).json({ error: 'Site non trouvé' });
        }

        const site = await prisma.site.update({
            where: { id },
            data: {
                name,
                address,
                latitude,
                longitude,
                radius: radius ? parseInt(radius) : existingSite.radius
            }
        });

        res.json({ site });
    } catch (error) {
        console.error('updateSite error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * DELETE /api/sites/:id
 * Supprimer un site
 */
export const deleteSite = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).tenantId;
        const id = req.params.id as string;

        // Vérifier que le site appartient au tenant
        const existingSite = await prisma.site.findFirst({
            where: { id, tenantId }
        });

        if (!existingSite) {
            return res.status(404).json({ error: 'Site non trouvé' });
        }

        await prisma.site.delete({ where: { id } });

        res.json({ success: true });
    } catch (error) {
        console.error('deleteSite error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};
