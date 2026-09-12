import { Request, Response } from 'express';
import Stripe from 'stripe';
import prisma from '../lib/prisma';
import { provisionDedicatedNumber } from '../services/numberAllocationService';
import { hashLogIdentifier, logWebhookEvent, sanitizeError } from '../utils/safeWebhookLogger';


// Initialize Stripe only if key is configured
const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : null;

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function getStripeObjectId(value: string | { id?: string } | null | undefined): string | null {
    if (!value) {
        return null;
    }

    return typeof value === 'string' ? value : value.id ?? null;
}

/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events (signature verified)
 * 
 * ⚠️ IMPORTANT: This endpoint must receive RAW body, not JSON parsed
 */
export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers['stripe-signature'] as string;

    if (!stripe) {
        logWebhookEvent('error', 'stripe.not_configured');
        res.status(500).json({ error: 'Stripe not configured' });
        return;
    }

    if (!WEBHOOK_SECRET) {
        logWebhookEvent('error', 'stripe.secret_missing');
        res.status(500).json({ error: 'Webhook secret not configured' });
        return;
    }

    let event: Stripe.Event;

    try {
        // Verify signature
        event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
    } catch (err: any) {
        logWebhookEvent('warn', 'stripe.signature_invalid', {
            error: sanitizeError(err),
            hasSignature: Boolean(sig)
        });
        res.status(400).json({ error: `Webhook Error: ${err.message}` });
        return;
    }

    logWebhookEvent('info', 'stripe.received', {
        eventType: event.type,
        eventIdHash: hashLogIdentifier(event.id)
    });

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                await handleCheckoutCompleted(session);
                break;
            }

            case 'customer.subscription.created':
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

            case 'invoice.paid': {
                const invoice = event.data.object as Stripe.Invoice;
                await handlePaymentSucceeded(invoice);
                break;
            }

            default:
                logWebhookEvent('info', 'stripe.unhandled_event', { eventType: event.type });
        }

        res.status(200).json({ received: true });

    } catch (error: any) {
        logWebhookEvent('error', 'stripe.handler_failed', { error: sanitizeError(error) });
        res.status(500).json({ error: 'Webhook handler failed' });
    }
};

/**
 * Handle checkout.session.completed
 * Initial subscription setup using metadata from checkout
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const tenantId = session.metadata?.tenantId;
    const planName = session.metadata?.planName;
    const planLimit = session.metadata?.planLimit;

    if (!tenantId) {
        logWebhookEvent('error', 'stripe.checkout_missing_tenant');
        return;
    }

    const customerId = getStripeObjectId(session.customer as any);
    const subscriptionId = getStripeObjectId(session.subscription as any);

    // Use metadata from checkout for initial setup
    const limit = planLimit ? parseInt(planLimit) : 1000;

    await (prisma.tenant.update as any)({
        where: { id: tenantId },
        data: {
            plan: planName || 'PRO',
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            subscriptionStatus: 'active',
            maxEmployees: limit,
            trialEndsAt: null  // Clear trial
        }
    });

    if (customerId && stripe && (stripe as any).customers?.update) {
        try {
            await (stripe as any).customers.update(customerId, {
                metadata: {
                    tenantId,
                    planName: planName || 'PRO'
                }
            });
        } catch (error: any) {
            logWebhookEvent('warn', 'stripe.customer_metadata_update_failed', {
                tenantId,
                customerIdHash: hashLogIdentifier(customerId),
                error: sanitizeError(error)
            });
        }
    }

    logWebhookEvent('info', 'stripe.checkout_completed', {
        tenantId,
        planName: planName || 'PRO',
        maxEmployees: limit,
        customerIdHash: hashLogIdentifier(customerId),
        subscriptionIdHash: hashLogIdentifier(subscriptionId)
    });
}

/**
 * Handle customer.subscription.created / customer.subscription.updated
 * Intelligently sync subscription status and plan limits using DB
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = subscription.metadata?.tenantId;

    // Extract price ID from subscription items
    const priceId = subscription.items.data[0]?.price?.id;

    // Find plan from database instead of static config
    const plan = priceId
        ? await (prisma as any).subscriptionPlan.findUnique({ where: { stripePriceId: priceId } })
        : null;

    // Find tenant
    let tenant: any;
    if (tenantId) {
        tenant = await (prisma.tenant.findUnique as any)({ where: { id: tenantId } });
    } else {
        // Fallback: find by subscription ID
        tenant = await (prisma.tenant.findFirst as any)({
            where: { stripeSubscriptionId: subscription.id }
        });
    }

    if (!tenant) {
        logWebhookEvent('error', 'stripe.subscription_tenant_not_found', {
            subscriptionIdHash: hashLogIdentifier(subscription.id),
            hasMetadataTenantId: Boolean(tenantId)
        });
        return;
    }

    // Build update data
    const updateData: any = {
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status
    };

    // Only update plan and limits on successful active/trialing status
    if (subscription.status === 'active' || subscription.status === 'trialing') {
        let finalPlanName = '';

        if (plan) {
            updateData.plan = plan.name;
            updateData.maxEmployees = plan.maxEmployees;
            updateData.trialEndsAt = null;
            finalPlanName = plan.name;
        } else if (subscription.metadata?.planName) {
            // Fallback to metadata
            updateData.plan = subscription.metadata.planName;
            finalPlanName = subscription.metadata.planName;
            if (subscription.metadata.planLimit) {
                updateData.maxEmployees = parseInt(subscription.metadata.planLimit);
            }
        }

        // ------------------------------------------------------------------
        // SOLOPRENEUR AUTOMATION: DYNAMIC NUMBER PROVISIONING ON UPGRADE
        // Si le client passe sur un plan Enterprise, on lui achète un numéro !
        // ------------------------------------------------------------------
        if (finalPlanName === 'ENTERPRISE') {
            // We run this asynchronously without awaiting to ensure we return 200 to Stripe quickly (avoiding timeouts)
            provisionDedicatedNumber(tenant.id, 'FR').catch((err: any) => logWebhookEvent('error', 'stripe.dynamic_number_provision_failed', {
                tenantId: tenant.id,
                error: sanitizeError(err)
            }));
        }
    }

    await (prisma.tenant.update as any)({
        where: { id: tenant.id },
        data: updateData
    });

    logWebhookEvent('info', 'stripe.subscription_updated', {
        tenantId: tenant.id,
        subscriptionIdHash: hashLogIdentifier(subscription.id),
        status: subscription.status,
        planName: plan?.name,
        maxEmployees: plan?.maxEmployees
    });
}

/**
 * Handle customer.subscription.deleted
 * Downgrade tenant to TRIAL with limited employees
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    // Find tenant by subscription ID
    const tenant = await (prisma.tenant.findFirst as any)({
        where: { stripeSubscriptionId: subscription.id }
    });

    if (!tenant) {
        logWebhookEvent('error', 'stripe.subscription_delete_tenant_not_found', {
            subscriptionIdHash: hashLogIdentifier(subscription.id)
        });
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

    logWebhookEvent('warn', 'stripe.subscription_deleted', {
        tenantId: tenant.id,
        subscriptionIdHash: hashLogIdentifier(subscription.id),
        nextPlan: 'TRIAL'
    });
}

/**
 * Handle invoice.payment_failed
 * AUTOMATISATION SOLOPRENEUR : Coupure d'accès instantanée (No Touch Sales)
 */
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;

    // Find tenant by customer ID
    let tenant;
    try {
        tenant = await (prisma.tenant as any).findFirst({
            where: { stripeCustomerId: customerId }
        });
    } catch (e) {
        // Fallback for Prisma types
        tenant = await (prisma as any).tenant.findFirst({ where: { stripeCustomerId: customerId } });
    }

    if (!tenant) {
        logWebhookEvent('error', 'stripe.payment_failed_tenant_not_found', {
            customerIdHash: hashLogIdentifier(customerId)
        });
        return;
    }

    // Suspend immediately and set to past_due
    await (prisma as any).tenant.update({
        where: { id: tenant.id },
        data: {
            subscriptionStatus: 'past_due',
            status: 'SUSPENDED' // Coupe l'API WhatsApp et passe l'UI en Lecture Seule
        }
    });

    const paymentUrl = invoice.hosted_invoice_url;

    logWebhookEvent('warn', 'stripe.payment_failed', {
        tenantId: tenant.id,
        customerIdHash: hashLogIdentifier(customerId),
        hasHostedInvoiceUrl: Boolean(paymentUrl),
        nextStatus: 'SUSPENDED'
    });

    // Ici on intègrerait SendGrid/Postmark :
    // await sendEmail(tenant.adminEmail, "Paiement échoué - Action requise", `Veuillez régler votre facture pour réactiver vos services : ${paymentUrl}`);
}

/**
 * Handle invoice.paid
 * AUTOMATISATION SOLOPRENEUR : Réactivation à la microseconde près
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;

    let tenant;
    try {
        tenant = await (prisma.tenant as any).findFirst({
            where: { stripeCustomerId: customerId }
        });
    } catch (e) {
        tenant = await (prisma as any).tenant.findFirst({ where: { stripeCustomerId: customerId } });
    }

    if (!tenant) return;

    // Reactivate account seamlessly
    await (prisma as any).tenant.update({
        where: { id: tenant.id },
        data: {
            subscriptionStatus: 'active',
            status: 'ACTIVE'
        }
    });

    logWebhookEvent('info', 'stripe.payment_succeeded', {
        tenantId: tenant.id,
        customerIdHash: hashLogIdentifier(customerId),
        nextStatus: 'ACTIVE'
    });
}

export const __stripeWebhookTestables = {
    handleCheckoutCompleted,
    handleSubscriptionUpdated,
    handleSubscriptionDeleted,
    handlePaymentFailed,
    handlePaymentSucceeded
};
