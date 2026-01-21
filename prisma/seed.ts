import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

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

    // 2. Create Employees
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
            tenantId: tenant2.id,
        },
    });

    console.log('Created employees for each tenant.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
