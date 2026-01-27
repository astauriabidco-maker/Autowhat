import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedSuperAdmin() {
    console.log('🔐 Creating Super Admin...');

    const hashedPassword = await bcrypt.hash('superadmin123', 10);

    const superAdmin = await prisma.superAdmin.upsert({
        where: { email: 'admin@autowhats.com' },
        update: {},
        create: {
            email: 'admin@autowhats.com',
            password: hashedPassword,
            name: 'Super Admin'
        }
    });

    console.log('✅ Super Admin created:');
    console.log(`   Email: admin@autowhats.com`);
    console.log(`   Password: superadmin123`);
    console.log(`   ID: ${superAdmin.id}`);

    await prisma.$disconnect();
}

seedSuperAdmin().catch((e) => {
    console.error(e);
    process.exit(1);
});
