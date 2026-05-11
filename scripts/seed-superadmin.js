const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedSuperAdmin() {
    console.log('🔐 [Seed] Checking for Super Admin...');

    try {
        const email = process.env.SUPER_ADMIN_EMAIL;
        const password = process.env.SUPER_ADMIN_PASSWORD;
        const name = process.env.SUPER_ADMIN_NAME || 'Super Admin';

        if (!email || !password) {
            throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required');
        }

        if (password.length < 12) {
            throw new Error('SUPER_ADMIN_PASSWORD must be at least 12 characters long');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const superAdmin = await prisma.superAdmin.upsert({
            where: { email },
            update: {},
            create: {
                email,
                password: hashedPassword,
                name
            }
        });

        console.log(`✅ [Seed] Super Admin ready: ${superAdmin.email}`);
        
    } catch (error) {
        console.error('❌ [Seed] Super Admin creation failed:', error);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

seedSuperAdmin();
