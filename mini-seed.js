
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const password = 'superadmin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const superAdmin = await prisma.superAdmin.upsert({
        where: { email: 'admin@autowhats.com' },
        update: { password: hashedPassword },
        create: {
            email: 'admin@autowhats.com',
            password: hashedPassword,
            name: 'Super Admin'
        }
    });

    console.log('Super Admin seeded successfully');
    console.log('Email: admin@autowhats.com');
    console.log('Password: superadmin123');

    await prisma.$disconnect();
}

main().catch(console.error);
