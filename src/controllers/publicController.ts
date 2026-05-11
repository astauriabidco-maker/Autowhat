/**
 * Public Controller - Endpoints publics sans authentification
 * Utilisé pour la Landing Page et les offres géolocalisées
 */

import { Request, Response } from 'express';
import axios from 'axios';
import prisma from '../lib/prisma';


// Zone mapping : pays → zone tarifaire
const ZONE_MAPPING: Record<string, string> = {
    // Tier 1 - USD Premium
    'US': 'TIER1_USD',
    'CA': 'TIER1_USD',
    'GB': 'TIER1_USD',
    'AU': 'TIER1_USD',

    // Tier 2 - EUR Standard
    'FR': 'TIER2_EUR',
    'DE': 'TIER2_EUR',
    'ES': 'TIER2_EUR',
    'IT': 'TIER2_EUR',
    'BE': 'TIER2_EUR',
    'CH': 'TIER2_EUR',
    'NL': 'TIER2_EUR',
    'PT': 'TIER2_EUR',
    'AT': 'TIER2_EUR',
    'LU': 'TIER2_EUR',

    // Tier 3 - Afrique Francophone (XOF)
    'SN': 'AFRICA_WEST',
    'CI': 'AFRICA_WEST',
    'CM': 'AFRICA_WEST',
    'ML': 'AFRICA_WEST',
    'BF': 'AFRICA_WEST',
    'NE': 'AFRICA_WEST',
    'TG': 'AFRICA_WEST',
    'BJ': 'AFRICA_WEST',
    'GN': 'AFRICA_WEST'
};

// Currency mapping par zone
const ZONE_CURRENCY: Record<string, string> = {
    'TIER1_USD': 'USD',
    'TIER2_EUR': 'EUR',
    'AFRICA_WEST': 'XOF'
};

/**
 * Détecte le pays du visiteur via son IP
 */
async function detectCountryFromIP(ip: string): Promise<string> {
    try {
        // Nettoyer l'IP (peut contenir plusieurs IPs avec proxies)
        const cleanIP = ip.split(',')[0].trim();

        // Ignorer les IPs locales
        if (cleanIP === '127.0.0.1' || cleanIP === '::1' || cleanIP.startsWith('192.168.') || cleanIP.startsWith('10.')) {
            console.log('🌍 IP locale détectée, fallback sur FR');
            return 'FR';
        }

        // Appeler l'API ipapi.co (gratuit, 1000 req/jour)
        const response = await axios.get(`https://ipapi.co/${cleanIP}/json/`, {
            timeout: 3000
        });

        if (response.data && response.data.country_code) {
            console.log(`🌍 Pays détecté: ${response.data.country_code} pour IP ${cleanIP}`);
            return response.data.country_code;
        }
    } catch (error) {
        console.error('❌ Erreur détection GeoIP:', error);
    }

    // Fallback sur France
    return 'FR';
}

/**
 * GET /api/public/offer
 * Retourne les plans avec prix adaptés au pays du visiteur
 */
export const getOffer = async (req: Request, res: Response): Promise<void> => {
    try {
        // 1. Détecter le pays
        const forwardedFor = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '';
        const countryCode = await detectCountryFromIP(forwardedFor);

        // 2. Déterminer la zone et devise
        const zone = ZONE_MAPPING[countryCode] || 'TIER2_EUR';
        const currency = ZONE_CURRENCY[zone] || 'EUR';

        // 3. Récupérer les plans actifs avec leurs prix régionaux
        const plans = await prisma.subscriptionPlan.findMany({
            where: { isActive: true },
            include: {
                regionalPricing: {
                    where: { isActive: true }
                }
            },
            orderBy: { sortOrder: 'asc' }
        });

        // 4. Pour chaque plan, sélectionner le bon prix
        const localizedPlans = plans.map(plan => {
            // Chercher un prix spécifique au pays
            let regionalPrice = plan.regionalPricing.find(rp => rp.countryCode === countryCode);

            // Sinon, chercher un prix de zone
            if (!regionalPrice) {
                regionalPrice = plan.regionalPricing.find(rp => rp.countryCode === zone);
            }

            // Sinon, chercher un prix DEFAULT
            if (!regionalPrice) {
                regionalPrice = plan.regionalPricing.find(rp => rp.countryCode === 'DEFAULT');
            }

            // Parser les features
            let features: string[] = [];
            try {
                features = JSON.parse(plan.features);
            } catch {
                features = plan.features.split(',').map(f => f.trim());
            }

            // Si prix régional trouvé, l'utiliser
            if (regionalPrice) {
                return {
                    id: plan.id,
                    name: plan.name,
                    description: plan.description,
                    price: regionalPrice.price,
                    currency: regionalPrice.currency,
                    stripePriceId: regionalPrice.stripePriceId,
                    maxEmployees: plan.maxEmployees,
                    features,
                    isPopular: plan.isPopular,
                    sortOrder: plan.sortOrder
                };
            }

            // Fallback sur le prix par défaut du plan
            return {
                id: plan.id,
                name: plan.name,
                description: plan.description,
                price: plan.price,
                currency: plan.currency,
                stripePriceId: plan.stripePriceId,
                maxEmployees: plan.maxEmployees,
                features,
                isPopular: plan.isPopular,
                sortOrder: plan.sortOrder
            };
        });

        // 5. Retourner avec métadonnées
        res.json({
            country: countryCode,
            zone,
            currency,
            plans: localizedPlans
        });

    } catch (error) {
        console.error('❌ Erreur getOffer:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * GET /api/public/countries
 * Retourne la liste des pays supportés avec leurs devises
 */
export const getSupportedCountries = async (_req: Request, res: Response): Promise<void> => {
    const countries = Object.entries(ZONE_MAPPING).map(([code, zone]) => ({
        code,
        zone,
        currency: ZONE_CURRENCY[zone] || 'EUR'
    }));

    res.json({ countries });
};
