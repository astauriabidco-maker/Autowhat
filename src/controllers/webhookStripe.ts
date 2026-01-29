import { Request, Response } from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Initialize Stripe only if key is configured
const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : null;

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events (signature verified)
 * 
 * ⚠️ IMPORTANT: This endpoint must receive RAW body, not JSON parsed
 */
export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers['stripe-signature'] as string;

    if (!stripe) {
        console.error('❌ Stripe not configured');
        res.status(500).json({ error: 'Stripe not configured' });
        return;
    }

    if (!WEBHOOK_SECRET) {
        console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
        res.status(500).json({ error: 'Webhook secret not configured' });
        return;
    }

    let event: Stripe.Event;

    try {
        // Verify signature
        event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
    } catch (err: any) {
        console.error(`⚠️ Webhook signature verification failed:`, err.message);
        res.status(400).json({ error: `Webhook Error: ${err.message}` });
        return;
    }

    console.log(`📩 Stripe webhook received: ${event.type}`);

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                await handleCheckoutCompleted(session);
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionUpdated(subscription);
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionDeleted(subscription);
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                await handlePaymentFailed(invoice);
                break;
            }

            default:
                console.log(`ℹ️ Unhandled event type: ${event.type}`);
        }

        res.status(200).json({ received: true });

    } catch (error: any) {
        console.error(`❌ Webhook handler error:`, error);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
};

/**
 * Handle checkout.session.completed
 * Upgrade tenant to PRO plan
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const tenantId = session.metadata?.tenantId;

    if (!tenantId) {
        console.error('❌ No tenantId in checkout session metadata');
        return;
    }

    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    // Update tenant with Stripe info and upgrade to PRO
    await (prisma.tenant.update as any)({
        where: { id: tenantId },
        data: {
            plan: 'PRO',
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            subscriptionStatus: 'active',
            maxEmployees: 1000, // PRO limit
            trialEndsAt: null  // Clear trial
        }
    });

    console.log(`✅ Tenant ${tenantId} upgraded to PRO (Customer: ${customerId})`);
}

/**
 * Handle customer.subscription.updated
 * Sync subscription status
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = subscription.metadata?.tenantId;

    if (!tenantId) {
        // Try to find by stripeSubscriptionId
        const tenant = await (prisma.tenant.findFirst as any)({
            where: { stripeSubscriptionId: subscription.id }
        });

        if (!tenant) {
            console.error('❌ Cannot find tenant for subscription update');
            return;
        }

        await (prisma.tenant.update as any)({
            where: { id: tenant.id },
            data: {
                subscriptionStatus: subscription.status
            }
        });

        console.log(`🔄 Subscription status updated for tenant ${tenant.id}: ${subscription.status}`);
        return;
    }

    await (prisma.tenant.update as any)({
        where: { id: tenantId },
        data: {
            subscriptionStatus: subscription.status
        }
    });

    console.log(`🔄 Subscription status updated for tenant ${tenantId}: ${subscription.status}`);
}

/**
 * Handle customer.subscription.deleted
 * Downgrade tenant to FREE/TRIAL
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    // Find tenant by subscription ID
    const tenant = await (prisma.tenant.findFirst as any)({
        where: { stripeSubscriptionId: subscription.id }
    });

    if (!tenant) {
        console.error('❌ Cannot find tenant for subscription deletion');
        return;
    }

    // Downgrade to TRIAL with limited employees
    await (prisma.tenant.update as any)({
        where: { id: tenant.id },
        data: {
            plan: 'TRIAL',
            subscriptionStatus: 'canceled',
            stripeSubscriptionId: null,
            maxEmployees: 5
        }
    });

    console.log(`⚠️ Tenant ${tenant.id} downgraded to TRIAL (subscription canceled)`);
}

/**
 * Handle invoice.payment_failed
 * Log failed payment (could also notify or suspend)
 */
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;

    // Find tenant by customer ID
    const tenant = await (prisma.tenant.findFirst as any)({
        where: { stripeCustomerId: customerId }
    });

    if (!tenant) {
        console.error('❌ Cannot find tenant for failed payment');
        return;
    }

    // Update subscription status
    await (prisma.tenant.update as any)({
        where: { id: tenant.id },
        data: {
            subscriptionStatus: 'past_due'
        }
    });

    console.log(`💳 Payment failed for tenant ${tenant.id} - status: past_due`);

    // TODO: Send notification to tenant admin
}
