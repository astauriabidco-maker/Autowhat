import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
    tenant: {
        findUnique: vi.fn()
    },
    subscriptionPlan: {
        findUnique: vi.fn()
    }
}));

const stripeMocks = vi.hoisted(() => ({
    checkoutSessionsCreate: vi.fn(),
    customersSearch: vi.fn(),
    portalSessionsCreate: vi.fn(),
    invoicesList: vi.fn()
}));

vi.mock('../../src/lib/prisma', () => ({
    default: prismaMock
}));

vi.mock('stripe', () => ({
    default: vi.fn(function StripeMock() {
        return {
            checkout: {
                sessions: {
                    create: stripeMocks.checkoutSessionsCreate
                }
            },
            customers: {
                search: stripeMocks.customersSearch
            },
            billingPortal: {
                sessions: {
                    create: stripeMocks.portalSessionsCreate
                }
            },
            invoices: {
                list: stripeMocks.invoicesList
            }
        };
    })
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

function createManagerRequest(overrides: Partial<Request> = {}) {
    return {
        user: {
            tenantId: 'tenant-billing'
        },
        body: {},
        params: {},
        ...overrides
    } as unknown as Request;
}

async function importBillingController() {
    vi.resetModules();
    return import('../../src/controllers/billingController');
}

describe('billingController.createCheckout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_billing');
        vi.stubEnv('FRONTEND_URL', 'https://app.whatspoint.test');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('creates a subscription checkout using SubscriptionPlan.maxEmployees metadata', async () => {
        prismaMock.subscriptionPlan.findUnique.mockResolvedValue({
            name: 'PRO',
            isActive: true,
            maxEmployees: 25
        });
        prismaMock.tenant.findUnique.mockResolvedValue({
            id: 'tenant-billing',
            name: 'Billing Tenant',
            plan: 'TRIAL',
            stripeCustomerId: 'cus_existing',
            subscriptionStatus: null
        });
        stripeMocks.checkoutSessionsCreate.mockResolvedValue({
            url: 'https://checkout.stripe.test/session'
        });
        const { createCheckout } = await importBillingController();
        const res = createResponse();

        await createCheckout(createManagerRequest({ body: { priceId: 'price_pro' } }), res);

        expect(prismaMock.subscriptionPlan.findUnique).toHaveBeenCalledWith({
            where: { stripePriceId: 'price_pro' }
        });
        expect(stripeMocks.checkoutSessionsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                customer: 'cus_existing',
                client_reference_id: 'tenant-billing',
                metadata: {
                    tenantId: 'tenant-billing',
                    planName: 'PRO',
                    planLimit: '25'
                },
                subscription_data: {
                    metadata: {
                        tenantId: 'tenant-billing',
                        planName: 'PRO',
                        planLimit: '25'
                    }
                }
            })
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ url: 'https://checkout.stripe.test/session' });
    });
});

describe('billingController customer lookup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_billing');
        vi.stubEnv('FRONTEND_URL', 'https://app.whatspoint.test');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('creates portal sessions from the stored Stripe customer id without metadata search', async () => {
        prismaMock.tenant.findUnique.mockResolvedValue({
            id: 'tenant-billing',
            name: 'Billing Tenant',
            stripeCustomerId: 'cus_stored'
        });
        stripeMocks.portalSessionsCreate.mockResolvedValue({
            url: 'https://billing.stripe.test/portal'
        });
        const { createPortal } = await importBillingController();
        const res = createResponse();

        await createPortal(createManagerRequest(), res);

        expect(stripeMocks.customersSearch).not.toHaveBeenCalled();
        expect(stripeMocks.portalSessionsCreate).toHaveBeenCalledWith({
            customer: 'cus_stored',
            return_url: 'https://app.whatspoint.test/settings'
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ url: 'https://billing.stripe.test/portal' });
    });

    it('lists invoices from the stored Stripe customer id', async () => {
        prismaMock.tenant.findUnique.mockResolvedValue({
            id: 'tenant-billing',
            name: 'Billing Tenant',
            stripeCustomerId: 'cus_invoice'
        });
        stripeMocks.invoicesList.mockResolvedValue({
            data: [
                {
                    id: 'in_123',
                    number: 'INV-001',
                    created: 1770000000,
                    amount_paid: 4900,
                    currency: 'eur',
                    status: 'paid',
                    invoice_pdf: 'https://billing.stripe.test/invoice.pdf'
                }
            ]
        });
        const { getInvoices } = await importBillingController();
        const res = createResponse();

        await getInvoices(createManagerRequest(), res);

        expect(stripeMocks.customersSearch).not.toHaveBeenCalled();
        expect(stripeMocks.invoicesList).toHaveBeenCalledWith({
            customer: 'cus_invoice',
            limit: 12
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith([
            {
                id: 'in_123',
                number: 'INV-001',
                date: 1770000000,
                amount: 4900,
                currency: 'eur',
                status: 'paid',
                pdf_url: 'https://billing.stripe.test/invoice.pdf'
            }
        ]);
    });
});
