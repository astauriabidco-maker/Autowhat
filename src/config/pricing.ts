/**
 * Pricing Configuration
 * Defines SaaS plans with Stripe price IDs and limits
 * Price IDs can be configured via SuperAdmin > Integrations > Stripe
 */

import { getProviderConfig } from '../services/configService';

export interface Plan {
    id: string | undefined;
    name: string;
    limit: number;
    price: number;
    features: string[];
}

// Static plan definitions (limits and features)
const PLAN_DEFINITIONS: Record<string, Omit<Plan, 'id'>> = {
    SMALL: {
        name: 'Small',
        limit: 5,
        price: 29,
        features: [
            'Jusqu\'à 5 employés',
            'Pointage WhatsApp illimité',
            'Notes de frais',
            'Tableau de bord',
            'Support email'
        ]
    },
    MEDIUM: {
        name: 'Medium',
        limit: 20,
        price: 99,
        features: [
            'Jusqu\'à 20 employés',
            'Pointage WhatsApp illimité',
            'Notes de frais',
            'Tableau de bord avancé',
            'Multi-sites',
            'Export Excel/PDF',
            'Support prioritaire'
        ]
    },
    LARGE: {
        name: 'Large',
        limit: 50,
        price: 199,
        features: [
            'Jusqu\'à 50 employés',
            'Pointage WhatsApp illimité',
            'Notes de frais',
            'Tableau de bord avancé',
            'Multi-sites illimités',
            'Export Excel/PDF',
            'Webhooks & API',
            'Support dédié',
            'Onboarding personnalisé'
        ]
    }
};

// Cache for loaded plans (to avoid repeated DB queries)
let cachedPlans: Record<string, Plan> | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Load plans with Stripe price IDs from database
 * Falls back to environment variables if not configured
 */
export async function loadPlans(): Promise<Record<string, Plan>> {
    // Check cache validity
    if (cachedPlans && Date.now() - cacheTime < CACHE_TTL) {
        return cachedPlans;
    }

    try {
        const stripeConfig = await getProviderConfig('STRIPE');

        cachedPlans = {
            SMALL: {
                ...PLAN_DEFINITIONS.SMALL,
                id: stripeConfig.PRICE_SMALL || process.env.STRIPE_PRICE_SMALL
            },
            MEDIUM: {
                ...PLAN_DEFINITIONS.MEDIUM,
                id: stripeConfig.PRICE_MEDIUM || process.env.STRIPE_PRICE_MEDIUM
            },
            LARGE: {
                ...PLAN_DEFINITIONS.LARGE,
                id: stripeConfig.PRICE_LARGE || process.env.STRIPE_PRICE_LARGE
            }
        };

        cacheTime = Date.now();
        return cachedPlans;
    } catch (error) {
        // Fallback to env vars if DB query fails
        console.warn('Could not load Stripe config from DB, using env vars');
        return {
            SMALL: { ...PLAN_DEFINITIONS.SMALL, id: process.env.STRIPE_PRICE_SMALL },
            MEDIUM: { ...PLAN_DEFINITIONS.MEDIUM, id: process.env.STRIPE_PRICE_MEDIUM },
            LARGE: { ...PLAN_DEFINITIONS.LARGE, id: process.env.STRIPE_PRICE_LARGE }
        };
    }
}

/**
 * Get all plans as array (async version for API)
 */
export async function getAllPlansAsync(): Promise<Plan[]> {
    const plans = await loadPlans();
    return Object.values(plans);
}

/**
 * Get all plans SYNCHRONOUSLY (for immediate use)
 * Uses cached data or env vars, does NOT fetch from DB
 */
export function getAllPlans(): Plan[] {
    if (cachedPlans) {
        return Object.values(cachedPlans);
    }
    // Fallback to env vars for sync access
    return [
        { ...PLAN_DEFINITIONS.SMALL, id: process.env.STRIPE_PRICE_SMALL },
        { ...PLAN_DEFINITIONS.MEDIUM, id: process.env.STRIPE_PRICE_MEDIUM },
        { ...PLAN_DEFINITIONS.LARGE, id: process.env.STRIPE_PRICE_LARGE }
    ];
}

/**
 * Find a plan by its Stripe Price ID (async)
 */
export async function getPlanByPriceIdAsync(priceId: string): Promise<Plan | undefined> {
    const plans = await loadPlans();
    return Object.values(plans).find(plan => plan.id === priceId);
}

/**
 * Find a plan by its Stripe Price ID (sync - uses cache)
 */
export function getPlanByPriceId(priceId: string): Plan | undefined {
    const plans = cachedPlans || {
        SMALL: { ...PLAN_DEFINITIONS.SMALL, id: process.env.STRIPE_PRICE_SMALL },
        MEDIUM: { ...PLAN_DEFINITIONS.MEDIUM, id: process.env.STRIPE_PRICE_MEDIUM },
        LARGE: { ...PLAN_DEFINITIONS.LARGE, id: process.env.STRIPE_PRICE_LARGE }
    };
    return Object.values(plans).find(plan => plan.id === priceId);
}

/**
 * Find a plan by its name
 */
export function getPlanByName(name: string): Plan | undefined {
    const key = name.toUpperCase();
    const plans = cachedPlans || {
        SMALL: { ...PLAN_DEFINITIONS.SMALL, id: process.env.STRIPE_PRICE_SMALL },
        MEDIUM: { ...PLAN_DEFINITIONS.MEDIUM, id: process.env.STRIPE_PRICE_MEDIUM },
        LARGE: { ...PLAN_DEFINITIONS.LARGE, id: process.env.STRIPE_PRICE_LARGE }
    };
    return plans[key] || Object.values(plans).find(plan =>
        plan.name.toUpperCase() === key
    );
}

/**
 * Clear cache (call after updating config)
 */
export function clearPlanCache(): void {
    cachedPlans = null;
    cacheTime = 0;
}
