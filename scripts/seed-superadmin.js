const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedSuperAdmin() {
    console.log('🔐 [Seed] Checking for Super Admin...');

    try {
        const hashedPassword = await bcrypt.hash('superadmin123', 10);

        const superAdmin = await prisma.superAdmin.upsert({
            where: { email: 'admin@whatspoint.app' },
            update: {},
            create: {
                email: 'admin@whatspoint.app',
                password: hashedPassword,
                name: 'Super Admin'
            }
        });

        console.log('✅ [Seed] Super Admin ready:');
        console.log(`   Email: admin@whatspoint.app`);
        console.log(`   Password: superadmin123`);
        
    } catch (error) {
        console.error('❌ [Seed] Super Admin creation failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

seedSuperAdmin();
