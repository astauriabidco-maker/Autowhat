import request from 'supertest';
import { beforeEach, expect, vi } from 'vitest';
import prisma from '../../src/lib/prisma';
import {
    describeIntegration,
    disconnectTestDatabase,
    resetTestDatabase,
    seedTenantGraph
} from './helpers/db';

const stripeMocks = vi.hoisted(() => ({
    constructEvent: vi.fn()
}));

vi.mock('stripe', () => ({
    default: vi.fn(function StripeMock() {
        return {
            webhooks: {
                constructEvent: stripeMocks.constructEvent
            }
        };
    })
}));

async function expectStripeEvent(raw: string, status: number, signature = 'valid-route-signature') {
    const { createApp } = await import('../../src/app');

    const response = await request(createApp())
        .post('/api/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', signature)
        .send(raw)
        .expect(status);

    return response;
}

describeIntegration('Stripe webhook route integration', () => {
    afterAll(disconnectTestDatabase);

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_route');
        vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_route');
        vi.resetModules();
        await resetTestDatabase();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('verifies the raw request body and persists a checkout completion through the Express route', async () => {
        const seeded = await seedTenantGraph('StripeRouteCheckout');
        const raw = JSON.stringify({ event: 'checkout.session.completed' });
        stripeMocks.constructEvent.mockReturnValue({
            type: 'checkout.session.completed',
            data: {
                object: {
                    metadata: {
                        tenantId: seeded.tenant.id,
                        planName: 'PRO',
                        planLimit: '55'
                    },
                    customer: 'cus_route_checkout',
                    subscription: 'sub_route_checkout'
                }
            }
        });
        const response = await expectStripeEvent(raw, 200);
        expect(response.body).toEqual({ received: true });

        expect(stripeMocks.constructEvent).toHaveBeenCalledWith(
            Buffer.from(raw),
            'valid-route-signature',
            'whsec_route'
        );

        const tenant = await prisma.tenant.findUniqueOrThrow({
            where: { id: seeded.tenant.id }
        });

        expect(tenant).toMatchObject({
            plan: 'PRO',
            stripeCustomerId: 'cus_route_checkout',
            stripeSubscriptionId: 'sub_route_checkout',
            subscriptionStatus: 'active',
            maxEmployees: 55
        });
    });

    it('rejects invalid Stripe signatures before mutating tenant billing state', async () => {
        const seeded = await seedTenantGraph('StripeRouteInvalid');
        await prisma.tenant.update({
            where: { id: seeded.tenant.id },
            data: {
                stripeCustomerId: 'cus_before_invalid',
                subscriptionStatus: 'active'
            }
        });
        stripeMocks.constructEvent.mockImplementation(() => {
            throw new Error('No signatures found matching the expected signature for payload');
        });
        await expectStripeEvent('{"event":"bad"}', 400, 'invalid-route-signature');

        const tenant = await prisma.tenant.findUniqueOrThrow({
            where: { id: seeded.tenant.id }
        });

        expect(tenant).toMatchObject({
            stripeCustomerId: 'cus_before_invalid',
            subscriptionStatus: 'active'
        });
    });

    it('syncs subscription updates through the Express route using a stored Stripe price', async () => {
        const seeded = await seedTenantGraph('StripeRouteSubscriptionUpdate');
        await prisma.subscriptionPlan.create({
            data: {
                stripePriceId: 'price_route_pro',
                name: 'PRO',
                description: 'Route integration plan',
                price: 49,
                currency: 'EUR',
                maxEmployees: 64,
                features: 'attendance,gps'
            }
        });
        const raw = JSON.stringify({ event: 'customer.subscription.updated' });
        stripeMocks.constructEvent.mockReturnValue({
            type: 'customer.subscription.updated',
            data: {
                object: {
                    id: 'sub_route_updated',
                    status: 'active',
                    metadata: {
                        tenantId: seeded.tenant.id
                    },
                    items: {
                        data: [
                            {
                                price: {
                                    id: 'price_route_pro'
                                }
                            }
                        ]
                    }
                }
            }
        });

        const response = await expectStripeEvent(raw, 200);
        expect(response.body).toEqual({ received: true });

        expect(stripeMocks.constructEvent).toHaveBeenCalledWith(
            Buffer.from(raw),
            'valid-route-signature',
            'whsec_route'
        );

        const tenant = await prisma.tenant.findUniqueOrThrow({
            where: { id: seeded.tenant.id }
        });

        expect(tenant).toMatchObject({
            plan: 'PRO',
            stripeSubscriptionId: 'sub_route_updated',
            subscriptionStatus: 'active',
            maxEmployees: 64,
            trialEndsAt: null
        });
    });

    it('downgrades a tenant when a subscription deletion reaches the Express route', async () => {
        const seeded = await seedTenantGraph('StripeRouteSubscriptionDeleted');
        await prisma.tenant.update({
            where: { id: seeded.tenant.id },
            data: {
                plan: 'PRO',
                stripeSubscriptionId: 'sub_route_deleted',
                subscriptionStatus: 'active',
                maxEmployees: 64
            }
        });
        stripeMocks.constructEvent.mockReturnValue({
            type: 'customer.subscription.deleted',
            data: {
                object: {
                    id: 'sub_route_deleted'
                }
            }
        });

        const response = await expectStripeEvent(JSON.stringify({ event: 'customer.subscription.deleted' }), 200);
        expect(response.body).toEqual({ received: true });

        const tenant = await prisma.tenant.findUniqueOrThrow({
            where: { id: seeded.tenant.id }
        });

        expect(tenant).toMatchObject({
            plan: 'TRIAL',
            stripeSubscriptionId: null,
            subscriptionStatus: 'canceled',
            maxEmployees: 5
        });
    });

    it('suspends and reactivates a tenant from invoice events through the Express route', async () => {
        const seeded = await seedTenantGraph('StripeRouteInvoices');
        await prisma.tenant.update({
            where: { id: seeded.tenant.id },
            data: {
                stripeCustomerId: 'cus_route_invoice',
                subscriptionStatus: 'active',
                status: 'ACTIVE'
            }
        });

        stripeMocks.constructEvent.mockReturnValueOnce({
            type: 'invoice.payment_failed',
            data: {
                object: {
                    customer: 'cus_route_invoice',
                    hosted_invoice_url: 'https://billing.stripe.test/route-invoice'
                }
            }
        });

        const failedPaymentResponse = await expectStripeEvent(JSON.stringify({ event: 'invoice.payment_failed' }), 200);
        expect(failedPaymentResponse.body).toEqual({ received: true });

        const suspended = await prisma.tenant.findUniqueOrThrow({
            where: { id: seeded.tenant.id }
        });

        expect(suspended).toMatchObject({
            subscriptionStatus: 'past_due',
            status: 'SUSPENDED'
        });

        stripeMocks.constructEvent.mockReturnValueOnce({
            type: 'invoice.paid',
            data: {
                object: {
                    customer: 'cus_route_invoice'
                }
            }
        });

        const paidInvoiceResponse = await expectStripeEvent(JSON.stringify({ event: 'invoice.paid' }), 200);
        expect(paidInvoiceResponse.body).toEqual({ received: true });

        const reactivated = await prisma.tenant.findUniqueOrThrow({
            where: { id: seeded.tenant.id }
        });

        expect(reactivated).toMatchObject({
            subscriptionStatus: 'active',
            status: 'ACTIVE'
        });
    });
});
