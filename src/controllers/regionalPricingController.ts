/**
 * Regional Pricing Controller - Gestion des prix par zone géographique
 * SuperAdmin only
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Liste des pays/zones disponibles
const AVAILABLE_REGIONS = [
    { code: 'FR', name: 'France', currency: 'EUR', flag: '🇫🇷' },
    { code: 'DE', name: 'Allemagne', currency: 'EUR', flag: '🇩🇪' },
    { code: 'ES', name: 'Espagne', currency: 'EUR', flag: '🇪🇸' },
    { code: 'IT', name: 'Italie', currency: 'EUR', flag: '🇮🇹' },
    { code: 'BE', name: 'Belgique', currency: 'EUR', flag: '🇧🇪' },
    { code: 'CH', name: 'Suisse', currency: 'EUR', flag: '🇨🇭' },
    { code: 'US', name: 'États-Unis', currency: 'USD', flag: '🇺🇸' },
    { code: 'CA', name: 'Canada', currency: 'USD', flag: '🇨🇦' },
    { code: 'GB', name: 'Royaume-Uni', currency: 'USD', flag: '🇬🇧' },
    { code: 'AU', name: 'Australie', currency: 'USD', flag: '🇦🇺' },
    { code: 'AFRICA_WEST', name: 'Afrique de l\'Ouest (Zone CFA)', currency: 'XOF', flag: '🌍' },
    { code: 'DEFAULT', name: 'Par défaut (Reste du monde)', currency: 'USD', flag: '🌐' }
];

/**
 * GET /admin/pricing/matrix
 * Retourne la matrice complète : plans × régions
 */
export const getPricingMatrix = async (_req: Request, res: Response): Promise<void> => {
    try {
        // Récupérer tous les plans avec leurs prix régionaux
        const plans = await prisma.subscriptionPlan.findMany({
            where: { isActive: true },
            include: {
                regionalPricing: true
            },
            orderBy: { sortOrder: 'asc' }
        });

        // Construire la matrice
        const matrix = plans.map(plan => {
            const pricingByRegion: Record<string, {
                price: number;
                currency: string;
                stripePriceId: string;
                regionalPricingId: string | null;
            }> = {};

            // Prix par défaut du plan
            pricingByRegion['BASE'] = {
                price: plan.price,
                currency: plan.currency,
                stripePriceId: plan.stripePriceId,
                regionalPricingId: null
            };

            // Ajouter les prix régionaux existants
            for (const rp of plan.regionalPricing) {
                pricingByRegion[rp.countryCode] = {
                    price: rp.price,
                    currency: rp.currency,
                    stripePriceId: rp.stripePriceId,
                    regionalPricingId: rp.id
                };
            }

            return {
                planId: plan.id,
                planName: plan.name,
                maxEmployees: plan.maxEmployees,
                isPopular: plan.isPopular,
                pricing: pricingByRegion
            };
        });

        res.json({
            regions: AVAILABLE_REGIONS,
            matrix
        });

    } catch (error) {
        console.error('❌ Erreur getPricingMatrix:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * PUT /admin/pricing/regional
 * Créer ou mettre à jour un prix régional
 */
export const upsertRegionalPricing = async (req: Request, res: Response): Promise<void> => {
    try {
        const { planId, countryCode, price, currency, stripePriceId } = req.body;

        // Validation
        if (!planId || !countryCode || price === undefined || !currency || !stripePriceId) {
            res.status(400).json({ error: 'Tous les champs sont requis' });
            return;
        }

        // Vérifier que le plan existe
        const plan = await prisma.subscriptionPlan.findUnique({
            where: { id: planId }
        });

        if (!plan) {
            res.status(404).json({ error: 'Plan non trouvé' });
            return;
        }

        // Upsert : créer ou mettre à jour
        const regionalPricing = await prisma.regionalPricing.upsert({
            where: {
                planId_countryCode: { planId, countryCode }
            },
            create: {
                planId,
                countryCode,
                price: parseFloat(price),
                currency,
                stripePriceId,
                isActive: true
            },
            update: {
                price: parseFloat(price),
                currency,
                stripePriceId,
                isActive: true
            }
        });

        console.log(`💰 Prix régional mis à jour: ${plan.name} / ${countryCode} = ${price} ${currency}`);

        res.json({ success: true, regionalPricing });

    } catch (error) {
        console.error('❌ Erreur upsertRegionalPricing:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * DELETE /admin/pricing/regional/:id
 * Supprimer un prix régional
 */
export const deleteRegionalPricing = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;

        const existing = await prisma.regionalPricing.findUnique({
            where: { id }
        });

        if (!existing) {
            res.status(404).json({ error: 'Prix régional non trouvé' });
            return;
        }

        await prisma.regionalPricing.delete({
            where: { id }
        });

        console.log(`🗑️ Prix régional supprimé: ${id}`);

        res.json({ success: true });

    } catch (error) {
        console.error('❌ Erreur deleteRegionalPricing:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * GET /admin/pricing/regions
 * Retourne la liste des régions disponibles
 */
export const getAvailableRegions = async (_req: Request, res: Response): Promise<void> => {
    res.json({ regions: AVAILABLE_REGIONS });
};
