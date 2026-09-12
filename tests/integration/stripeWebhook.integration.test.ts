import prisma from '../../src/lib/prisma';
import {
    describeIntegration,
    disconnectTestDatabase,
    resetTestDatabase,
    seedTenantGraph
} from './helpers/db';

describeIntegration('Stripe webhook persistence integration', () => {
    afterAll(disconnectTestDatabase);

    beforeEach(async () => {
        await resetTestDatabase();
    });

    it('persists checkout completion billing fields on the tenant', async () => {
        const seeded = await seedTenantGraph('StripeCheckout');
        const { __stripeWebhookTestables } = await import('../../src/controllers/webhookStripe');

        await __stripeWebhookTestables.handleCheckoutCompleted({
            metadata: {
                tenantId: seeded.tenant.id,
                planName: 'PRO',
                planLimit: '35'
            },
            customer: 'cus_checkout_real_db',
            subscription: 'sub_checkout_real_db'
        } as any);

        const tenant = await prisma.tenant.findUniqueOrThrow({
            where: { id: seeded.tenant.id }
        });

        expect(tenant).toMatchObject({
            plan: 'PRO',
            stripeCustomerId: 'cus_checkout_real_db',
            stripeSubscriptionId: 'sub_checkout_real_db',
            subscriptionStatus: 'active',
            maxEmployees: 35,
            trialEndsAt: null
        });
    });

    it('syncs active subscription status and limits from a stored Stripe price', async () => {
        const seeded = await seedTenantGraph('StripeSubscription');
        await prisma.subscriptionPlan.create({
            data: {
                stripePriceId: 'price_real_db_pro',
                name: 'PRO',
                description: 'Integration test plan',
                price: 49,
                currency: 'EUR',
                maxEmployees: 42,
                features: 'attendance,gps'
            }
        });
        const { __stripeWebhookTestables } = await import('../../src/controllers/webhookStripe');

        await __stripeWebhookTestables.handleSubscriptionUpdated({
            id: 'sub_real_db_pro',
            status: 'active',
            metadata: {
                tenantId: seeded.tenant.id
            },
            items: {
                data: [
                    {
                        price: {
                            id: 'price_real_db_pro'
                        }
                    }
                ]
            }
        } as any);

        const tenant = await prisma.tenant.findUniqueOrThrow({
            where: { id: seeded.tenant.id }
        });

        expect(tenant).toMatchObject({
            plan: 'PRO',
            stripeSubscriptionId: 'sub_real_db_pro',
            subscriptionStatus: 'active',
            maxEmployees: 42,
            trialEndsAt: null
        });
    });

    it('suspends and reactivates tenants from invoice payment events', async () => {
        const seeded = await seedTenantGraph('StripeInvoices');
        await prisma.tenant.update({
            where: { id: seeded.tenant.id },
            data: {
                stripeCustomerId: 'cus_invoice_real_db',
                subscriptionStatus: 'active',
                status: 'ACTIVE'
            }
        });
        const { __stripeWebhookTestables } = await import('../../src/controllers/webhookStripe');

        await __stripeWebhookTestables.handlePaymentFailed({
            customer: 'cus_invoice_real_db',
            hosted_invoice_url: 'https://billing.stripe.test/invoice'
        } as any);

        const suspended = await prisma.tenant.findUniqueOrThrow({
            where: { id: seeded.tenant.id }
        });
        expect(suspended).toMatchObject({
            subscriptionStatus: 'past_due',
            status: 'SUSPENDED'
        });

        await __stripeWebhookTestables.handlePaymentSucceeded({
            customer: 'cus_invoice_real_db'
        } as any);

        const reactivated = await prisma.tenant.findUniqueOrThrow({
            where: { id: seeded.tenant.id }
        });
        expect(reactivated).toMatchObject({
            subscriptionStatus: 'active',
            status: 'ACTIVE'
        });
    });
});
