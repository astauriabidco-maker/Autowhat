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

    // 4. Create test employee (DEXXYS SERVICES)
    await prisma.employee.create({
        data: {
            name: 'DEXXYS SERVICES',
            phoneNumber: '+33661500263',
            role: 'EMPLOYEE',
            tenantId: tenant1.id,
        },
    });

    console.log('✅ Created employees for each tenant.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
