import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    // Hash password for managers
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // 1. Create Tenants
    const tenant1 = await prisma.tenant.create({
        data: {
            name: 'Acme Corp',
        },
    });

    const tenant2 = await prisma.tenant.create({
        data: {
            name: 'Stark Industries',
        },
    });

    console.log(`Created tenants: ${tenant1.name}, ${tenant2.name}`);

    // 2. Create Manager for Acme Corp (with hashed password)
    await prisma.employee.create({
        data: {
            name: 'Manager Acme',
            phoneNumber: '+33699999999',
            role: 'MANAGER',
            password: hashedPassword,
            tenantId: tenant1.id,
        },
    });
    console.log('✅ Created Manager for Acme Corp: +33699999999 / admin123');

    // 3. Create regular employees
    await prisma.employee.create({
        data: {
            name: 'Alice Acme',
            phoneNumber: '+33600000001',
            role: 'EMPLOYEE',
            tenantId: tenant1.id,
        },
    });

    await prisma.employee.create({
        data: {
            name: 'Tony Stark',
            phoneNumber: '+33600000002',
            role: 'MANAGER',
            password: hashedPassword,
            tenantId: tenant2.id,
        },
    });

    await prisma.employee.create({
        data: {
            name: 'DEXXYS SERVICES',
            phoneNumber: '+33661500263',
            role: 'EMPLOYEE',
            tenantId: tenant1.id,
        },
    });

    console.log('✅ Created employees for each tenant.');

    // 5. Seed Subscription Plans (only if not already exist)
    const existingPlans = await prisma.subscriptionPlan.count();
    if (existingPlans === 0) {
        await prisma.subscriptionPlan.createMany({
            data: [
                {
                    stripePriceId: process.env.STRIPE_PRICE_SMALL || 'price_small_placeholder',
                    name: 'Small',
                    description: 'Idéal pour les petites équipes',
                    price: 29.00,
                    currency: 'EUR',
                    maxEmployees: 5,
                    features: "Jusqu'à 5 employés,Pointage WhatsApp illimité,Notes de frais,Tableau de bord,Support email",
                    isPopular: false,
                    isActive: true,
                    sortOrder: 1
                },
                {
                    stripePriceId: process.env.STRIPE_PRICE_MEDIUM || 'price_medium_placeholder',
                    name: 'Medium',
                    description: 'Pour les PME en croissance',
                    price: 99.00,
                    currency: 'EUR',
                    maxEmployees: 20,
                    features: "Jusqu'à 20 employés,Pointage WhatsApp illimité,Notes de frais,Tableau de bord avancé,Multi-sites,Export Excel/PDF,Support prioritaire",
                    isPopular: true,
                    isActive: true,
                    sortOrder: 2
                },
                {
                    stripePriceId: process.env.STRIPE_PRICE_LARGE || 'price_large_placeholder',
                    name: 'Large',
                    description: 'Solution complète pour grandes structures',
                    price: 199.00,
                    currency: 'EUR',
                    maxEmployees: 50,
                    features: "Jusqu'à 50 employés,Pointage WhatsApp illimité,Notes de frais,Tableau de bord avancé,Multi-sites illimités,Export Excel/PDF,Webhooks & API,Support dédié,Onboarding personnalisé",
                    isPopular: false,
                    isActive: true,
                    sortOrder: 3
                }
            ]
        });
        console.log('✅ Created default subscription plans: Small, Medium, Large');
    } else {
        console.log('ℹ️ Subscription plans already exist, skipping seed.');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
