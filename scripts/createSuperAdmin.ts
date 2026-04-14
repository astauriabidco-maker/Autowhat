import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding SuperAdmin...');

    const email = 'admin@whatspoint.com';
    const password = 'superadmin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const superAdmin = await prisma.superAdmin.upsert({
        where: { email },
        update: {
            password: hashedPassword,
        },
        create: {
            email,
            password: hashedPassword,
            name: 'WhatsPoint SuperAdmin',
        },
    });

    console.log('✅ SuperAdmin created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
