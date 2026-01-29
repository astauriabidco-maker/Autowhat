import { Request, Response } from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Initialize Stripe only if key is configured
const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : null;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5174';
const PRICE_ID = process.env.STRIPE_PRICE_ID;

/**
 * POST /api/billing/checkout
 * Creates a Stripe Checkout Session for subscription
 */
export const createCheckout = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = (req as any).tenantId;

        if (!stripe) {
            res.status(500).json({ error: 'Stripe non configuré (STRIPE_SECRET_KEY manquant)' });
            return;
        }

        if (!PRICE_ID) {
            res.status(500).json({ error: 'STRIPE_PRICE_ID non configuré' });
            return;
        }

        // Get tenant info
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                id: true,
                name: true,
                stripeCustomerId: true,
                plan: true
            }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant non trouvé' });
            return;
        }

        if ((tenant as any).plan === 'PRO') {
            res.status(400).json({ error: 'Vous êtes déjà abonné Pro' });
            return;
        }

        // Create checkout session
        const sessionParams: Stripe.Checkout.SessionCreateParams = {
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: PRICE_ID,
                    quantity: 1
                }
            ],
            success_url: `${FRONTEND_URL}/settings?success=true`,
            cancel_url: `${FRONTEND_URL}/settings?canceled=true`,
            metadata: {
                tenantId: tenantId
            },
            subscription_data: {
                metadata: {
                    tenantId: tenantId
                }
            }
        };

        // If tenant already has a Stripe customer, reuse it
        if ((tenant as any).stripeCustomerId) {
            sessionParams.customer = (tenant as any).stripeCustomerId;
        } else {
            sessionParams.customer_email = undefined; // Will be collected in Checkout
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

        console.log(`💳 Checkout session created for tenant ${tenantId}`);

        res.status(200).json({ url: session.url });

    } catch (error: any) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: error.message || 'Erreur lors de la création de la session' });
    }
};

/**
 * POST /api/billing/portal
 * Creates a Stripe Customer Portal session for managing subscription
 */
export const createPortal = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = (req as any).tenantId;

        if (!stripe) {
            res.status(500).json({ error: 'Stripe non configuré' });
            return;
        }

        // Get tenant with Stripe customer ID
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { stripeCustomerId: true }
        });

        if (!tenant || !(tenant as any).stripeCustomerId) {
            res.status(400).json({ error: 'Aucun abonnement Stripe trouvé' });
            return;
        }

        // Create portal session
        const session = await stripe.billingPortal.sessions.create({
            customer: (tenant as any).stripeCustomerId,
            return_url: `${FRONTEND_URL}/settings`
        });

        console.log(`🔧 Portal session created for tenant ${tenantId}`);

        res.status(200).json({ url: session.url });

    } catch (error: any) {
        console.error('Portal error:', error);
        res.status(500).json({ error: error.message || 'Erreur lors de la création du portail' });
    }
};

/**
 * GET /api/billing/status
 * Returns current subscription status
 */
export const getStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = (req as any).tenantId;

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                plan: true,
                status: true,
                trialEndsAt: true,
                subscriptionStatus: true,
                maxEmployees: true
            }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant non trouvé' });
            return;
        }

        res.status(200).json({
            plan: (tenant as any).plan || 'TRIAL',
            status: tenant.status,
            trialEndsAt: (tenant as any).trialEndsAt,
            subscriptionStatus: (tenant as any).subscriptionStatus,
            maxEmployees: (tenant as any).maxEmployees
        });

    } catch (error: any) {
        console.error('Status error:', error);
        res.status(500).json({ error: 'Erreur interne' });
    }
};
