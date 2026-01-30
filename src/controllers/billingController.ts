import { Request, Response } from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Initialize Stripe only if key is configured
const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : null;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5174';

/**
 * POST /api/billing/checkout
 * Creates a Stripe Checkout Session for subscription
 * Accepts { priceId } in body to select plan
 */
export const createCheckout = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = (req as any).tenantId;
        const { priceId } = req.body;

        if (!stripe) {
            res.status(500).json({ error: 'Stripe non configuré (STRIPE_SECRET_KEY manquant)' });
            return;
        }

        // Validate priceId
        if (!priceId) {
            res.status(400).json({ error: 'priceId requis' });
            return;
        }

        // Find plan from database by stripePriceId
        const plan = await (prisma as any).subscriptionPlan.findUnique({
            where: { stripePriceId: priceId }
        });

        if (!plan || !plan.isActive) {
            res.status(400).json({ error: 'Plan invalide ou inactif' });
            return;
        }

        // Get tenant info
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                id: true,
                name: true,
                plan: true
            }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant non trouvé' });
            return;
        }

        // Check if already on this exact plan
        if (tenant.plan === plan.name) {
            res.status(400).json({ error: `Vous êtes déjà sur le plan ${plan.name}` });
            return;
        }

        // Create checkout session with plan info in metadata
        const sessionParams: Stripe.Checkout.SessionCreateParams = {
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1
                }
            ],
            success_url: `${FRONTEND_URL}/billing?success=true`,
            cancel_url: `${FRONTEND_URL}/billing?canceled=true`,
            metadata: {
                tenantId: tenantId,
                planName: plan.name,
                planLimit: plan.limit.toString()
            },
            subscription_data: {
                metadata: {
                    tenantId: tenantId,
                    planName: plan.name,
                    planLimit: plan.limit.toString()
                }
            }
        };

        const session = await stripe.checkout.sessions.create(sessionParams);

        console.log(`💳 Checkout session created for tenant ${tenantId} - Plan: ${plan.name}`);

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
            select: { id: true, name: true }
        });

        if (!tenant) {
            res.status(400).json({ error: 'Aucun abonnement Stripe trouvé' });
            return;
        }

        // Search for customer by tenant metadata
        const customers = await stripe.customers.search({
            query: `metadata['tenantId']:'${tenantId}'`,
            limit: 1
        });

        if (customers.data.length === 0) {
            res.status(400).json({ error: 'Aucun abonnement Stripe trouvé' });
            return;
        }

        const stripeCustomerId = customers.data[0].id;

        // Create portal session
        const session = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
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
                id: true,
                name: true,
                country: true
            }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant non trouvé' });
            return;
        }

        res.status(200).json({
            plan: 'TRIAL', // Default - would come from subscription data
            status: 'active',
            trialEndsAt: null,
            subscriptionStatus: null,
            maxEmployees: 10
        });

    } catch (error: any) {
        console.error('Status error:', error);
        res.status(500).json({ error: 'Erreur interne' });
    }
};

/**
 * GET /api/billing/invoices
 * Returns list of invoices for the authenticated tenant
 */
export const getInvoices = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = (req as any).tenantId;

        if (!stripe) {
            res.status(200).json([]); // Return empty if Stripe not configured
            return;
        }

        // Get tenant's Stripe customer ID
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { id: true, name: true }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant non trouvé' });
            return;
        }

        // For now, we need to find the customer by metadata or stored ID
        // Since stripeCustomerId might not be in schema, we'll search by metadata
        const customers = await stripe.customers.search({
            query: `metadata['tenantId']:'${tenantId}'`,
            limit: 1
        });

        if (customers.data.length === 0) {
            res.status(200).json([]);
            return;
        }

        const stripeCustomerId = customers.data[0].id;

        // Fetch invoices from Stripe
        const invoices = await stripe.invoices.list({
            customer: stripeCustomerId,
            limit: 12
        });

        // Transform to simplified format
        const simplifiedInvoices = invoices.data.map(invoice => ({
            id: invoice.id,
            number: invoice.number,
            date: invoice.created,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: invoice.status,
            pdf_url: invoice.invoice_pdf
        }));

        res.status(200).json(simplifiedInvoices);

    } catch (error: any) {
        console.error('Invoices error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des factures' });
    }
};

/**
 * GET /admin/tenants/:id/invoices
 * Returns list of invoices for a specific tenant (SuperAdmin only)
 */
export const getTenantInvoices = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.params.id as string;

        if (!stripe) {
            res.status(200).json([]);
            return;
        }

        // Verify tenant exists
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { id: true, name: true }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant non trouvé' });
            return;
        }

        // Search for customer by tenant metadata
        const customers = await stripe.customers.search({
            query: `metadata['tenantId']:'${tenantId}'`,
            limit: 1
        });

        if (customers.data.length === 0) {
            res.status(200).json([]);
            return;
        }

        const stripeCustomerId = customers.data[0].id;

        // Fetch invoices
        const invoices = await stripe.invoices.list({
            customer: stripeCustomerId,
            limit: 24 // SuperAdmin gets more history
        });

        const simplifiedInvoices = invoices.data.map(invoice => ({
            id: invoice.id,
            number: invoice.number,
            date: invoice.created,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: invoice.status,
            pdf_url: invoice.invoice_pdf,
            description: invoice.description
        }));

        res.status(200).json(simplifiedInvoices);

    } catch (error: any) {
        console.error('Tenant invoices error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des factures' });
    }
};

