/**
 * SuperAdmin Seed Script
 * Creates or updates a SuperAdmin account
 * 
 * Usage: npx ts-node prisma/seed-admin.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ========================================
// CONFIGURE YOUR SUPER ADMIN HERE
// ========================================
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@antigravity.io';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperSecure123!';
const SUPER_ADMIN_NAME = 'SuperAdmin';
// ========================================

async function main() {
    console.log('🔐 SuperAdmin Seed Script\n');

    // Check if SuperAdmin already exists
    const existing = await prisma.superAdmin.findUnique({
        where: { email: SUPER_ADMIN_EMAIL }
    });

    if (existing) {
        console.log(`⚠️  SuperAdmin already exists: ${existing.email}`);
        console.log('   To reset password, delete the account first or update manually.\n');

        // Update password if env variable is set
        if (process.env.RESET_PASSWORD === 'true') {
            const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);
            await prisma.superAdmin.update({
                where: { id: existing.id },
                data: { password: hashedPassword }
            });
            console.log('✅ Password has been reset!\n');
        }
        return;
    }

    // Create new SuperAdmin
    const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);

    const superAdmin = await prisma.superAdmin.create({
        data: {
            email: SUPER_ADMIN_EMAIL,
            password: hashedPassword,
            name: SUPER_ADMIN_NAME
        }
    });

    console.log('✅ SuperAdmin created successfully!\n');
    console.log('   📧 Email:', superAdmin.email);
    console.log('   🔑 Password:', SUPER_ADMIN_PASSWORD);
    console.log('   👤 Name:', superAdmin.name);
    console.log('\n⚠️  IMPORTANT: Change this password in production!\n');
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
