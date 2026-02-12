
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function checkSuperAdmin() {
    console.log('Using DATABASE_URL:', process.env.DATABASE_URL);
    try {
        const admin = await prisma.superAdmin.findUnique({
            where: { email: 'admin@autowhats.com' }
        });

        if (admin) {
            console.log('✅ Super Admin found in DB');
            console.log('Email:', admin.email);
        } else {
            console.log('❌ Super Admin NOT found in DB');
        }

        const allAdmins = await prisma.superAdmin.findMany();
        console.log('Total SuperAdmins:', allAdmins.length);
        allAdmins.forEach(a => console.log(' -', a.email));
    } catch (err) {
        console.error('❌ Error connecting to DB:', err);
    } finally {
        await prisma.$disconnect();
    }
}

checkSuperAdmin();
