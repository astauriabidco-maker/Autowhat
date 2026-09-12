import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
    tenant: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn()
    },
    subscriptionPlan: {
        findUnique: vi.fn()
    }
}));

const constructEventMock = vi.hoisted(() => vi.fn());
const provisionDedicatedNumberMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/lib/prisma', () => ({
    default: prismaMock
}));

vi.mock('stripe', () => ({
    default: vi.fn(function StripeMock() {
        return {
            webhooks: {
                constructEvent: constructEventMock
            }
        };
    })
}));

vi.mock('../../src/services/numberAllocationService', () => ({
    provisionDedicatedNumber: provisionDedicatedNumberMock
}));

function createResponse() {
    const res = {
        statusCode: 200,
        body: undefined as unknown,
        status: vi.fn((statusCode: number) => {
            res.statusCode = statusCode;
            return res;
        }),
        json: vi.fn((body: unknown) => {
            res.body = body;
            return res;
        })
    };

    return res as unknown as Response & {
        statusCode: number;
        body: unknown;
        status: ReturnType<typeof vi.fn>;
        json: ReturnType<typeof vi.fn>;
    };
}

function createRequest(body: Buffer, signature = 'stripe-signature') {
    return {
        body,
        headers: {
            'stripe-signature': signature
        }
    } as unknown as Request;
}

async function importWebhookStripe() {
    vi.resetModules();
    return import('../../src/controllers/webhookStripe');
}

describe('webhookStripe.handleWebhook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_mock');
        vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_mock');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('rejects an invalid Stripe signature', async () => {
        constructEventMock.mockImplementation(() => {
            throw new Error('No signatures found matching the expected signature for payload');
        });
        const { handleWebhook } = await importWebhookStripe();
        const res = createResponse();

        await handleWebhook(createRequest(Buffer.from('{}'), 'invalid-signature'), res);

        expect(constructEventMock).toHaveBeenCalledWith(Buffer.from('{}'), 'invalid-signature', 'whsec_mock');
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Webhook Error: No signatures found matching the expected signature for payload'
        });
        expect(prismaMock.tenant.update).not.toHaveBeenCalled();
    });

    it('accepts a valid Stripe signature and dispatches checkout completion', async () => {
        constructEventMock.mockReturnValue({
            type: 'checkout.session.completed',
            data: {
                object: {
                    metadata: {
                        tenantId: 'tenant-a',
                        planName: 'PRO',
                        planLimit: '25'
                    },
                    customer: 'cus_123',
                    subscription: 'sub_123'
                }
            }
        });
        const { handleWebhook } = await importWebhookStripe();
        const res = createResponse();

        await handleWebhook(createRequest(Buffer.from('{"ok":true}'), 'valid-signature'), res);

        expect(constructEventMock).toHaveBeenCalledWith(Buffer.from('{"ok":true}'), 'valid-signature', 'whsec_mock');
        expect(prismaMock.tenant.update).toHaveBeenCalledWith({
            where: { id: 'tenant-a' },
            data: {
                plan: 'PRO',
                stripeCustomerId: 'cus_123',
                stripeSubscriptionId: 'sub_123',
                subscriptionStatus: 'active',
                maxEmployees: 25,
                trialEndsAt: null
            }
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ received: true });
    });
});

describe('webhookStripe subscription handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_mock');
        vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_mock');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('syncs an active subscription from Stripe price metadata and provisions enterprise numbers asynchronously', async () => {
        prismaMock.subscriptionPlan.findUnique.mockResolvedValue({
            name: 'ENTERPRISE',
            maxEmployees: 250
        });
        prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-enterprise' });
        provisionDedicatedNumberMock.mockResolvedValue(undefined);
        const { __stripeWebhookTestables } = await importWebhookStripe();

        await __stripeWebhookTestables.handleSubscriptionUpdated({
            id: 'sub_enterprise',
            status: 'active',
            metadata: {
                tenantId: 'tenant-enterprise'
            },
            items: {
                data: [
                    {
                        price: {
                            id: 'price_enterprise'
                        }
                    }
                ]
            }
        } as any);

        expect(prismaMock.subscriptionPlan.findUnique).toHaveBeenCalledWith({
            where: { stripePriceId: 'price_enterprise' }
        });
        expect(prismaMock.tenant.update).toHaveBeenCalledWith({
            where: { id: 'tenant-enterprise' },
            data: {
                stripeSubscriptionId: 'sub_enterprise',
                subscriptionStatus: 'active',
                plan: 'ENTERPRISE',
                maxEmployees: 250,
                trialEndsAt: null
            }
        });
        expect(provisionDedicatedNumberMock).toHaveBeenCalledWith('tenant-enterprise', 'FR');
    });

    it('falls back to subscription metadata when no subscription plan matches the Stripe price', async () => {
        prismaMock.subscriptionPlan.findUnique.mockResolvedValue(null);
        prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-metadata' });
        const { __stripeWebhookTestables } = await importWebhookStripe();

        await __stripeWebhookTestables.handleSubscriptionUpdated({
            id: 'sub_metadata',
            status: 'trialing',
            metadata: {
                tenantId: 'tenant-metadata',
                planName: 'BUSINESS',
                planLimit: '75'
            },
            items: {
                data: [
                    {
                        price: {
                            id: 'price_unknown'
                        }
                    }
                ]
            }
        } as any);

        expect(prismaMock.tenant.update).toHaveBeenCalledWith({
            where: { id: 'tenant-metadata' },
            data: {
                stripeSubscriptionId: 'sub_metadata',
                subscriptionStatus: 'trialing',
                plan: 'BUSINESS',
                maxEmployees: 75
            }
        });
        expect(provisionDedicatedNumberMock).not.toHaveBeenCalled();
    });

    it('downgrades a tenant when a subscription is deleted', async () => {
        prismaMock.tenant.findFirst.mockResolvedValue({ id: 'tenant-canceled' });
        const { __stripeWebhookTestables } = await importWebhookStripe();

        await __stripeWebhookTestables.handleSubscriptionDeleted({
            id: 'sub_canceled'
        } as any);

        expect(prismaMock.tenant.findFirst).toHaveBeenCalledWith({
            where: { stripeSubscriptionId: 'sub_canceled' }
        });
        expect(prismaMock.tenant.update).toHaveBeenCalledWith({
            where: { id: 'tenant-canceled' },
            data: {
                plan: 'TRIAL',
                subscriptionStatus: 'canceled',
                stripeSubscriptionId: null,
                maxEmployees: 5
            }
        });
    });
});

describe('webhookStripe invoice payment handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_mock');
        vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_mock');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('suspends a tenant when invoice payment fails', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        prismaMock.tenant.findFirst.mockResolvedValue({ id: 'tenant-past-due' });
        const { __stripeWebhookTestables } = await importWebhookStripe();

        await __stripeWebhookTestables.handlePaymentFailed({
            customer: 'cus_past_due',
            hosted_invoice_url: 'https://billing.stripe.test/invoice'
        } as any);

        expect(prismaMock.tenant.findFirst).toHaveBeenCalledWith({
            where: { stripeCustomerId: 'cus_past_due' }
        });
        expect(prismaMock.tenant.update).toHaveBeenCalledWith({
            where: { id: 'tenant-past-due' },
            data: {
                subscriptionStatus: 'past_due',
                status: 'SUSPENDED'
            }
        });
        const serializedLogs = warnSpy.mock.calls.map(call => String(call[0])).join('\n');
        expect(serializedLogs).toContain('stripe.payment_failed');
        expect(serializedLogs).not.toContain('https://billing.stripe.test/invoice');
        expect(serializedLogs).not.toContain('cus_past_due');
    });

    it('reactivates a tenant when invoice payment succeeds', async () => {
        prismaMock.tenant.findFirst.mockResolvedValue({ id: 'tenant-active' });
        const { __stripeWebhookTestables } = await importWebhookStripe();

        await __stripeWebhookTestables.handlePaymentSucceeded({
            customer: 'cus_active'
        } as any);

        expect(prismaMock.tenant.findFirst).toHaveBeenCalledWith({
            where: { stripeCustomerId: 'cus_active' }
        });
        expect(prismaMock.tenant.update).toHaveBeenCalledWith({
            where: { id: 'tenant-active' },
            data: {
                subscriptionStatus: 'active',
                status: 'ACTIVE'
            }
        });
    });
});
