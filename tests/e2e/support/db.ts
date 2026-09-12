import bcrypt from 'bcryptjs';
import prisma from '../../../src/lib/prisma';

export const E2E_MANAGER_PHONE = '33699999999';
export const E2E_MANAGER_OTP = '123456';
export const E2E_SUPERADMIN_EMAIL = 'superadmin.e2e@example.test';
export const E2E_SUPERADMIN_PASSWORD = 'ValidPass123!';

function assertE2eDatabase() {
    if (!process.env.DATABASE_URL_TEST || process.env.DATABASE_URL !== process.env.DATABASE_URL_TEST) {
        throw new Error('DATABASE_URL_TEST must be configured and copied to DATABASE_URL before E2E tests.');
    }
}

export async function resetE2eDatabase() {
    assertE2eDatabase();

    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> '_prisma_migrations'
    `;

    if (tables.length === 0) return;

    const quotedTables = tables
        .map(({ tablename }) => `"public"."${tablename.replace(/"/g, '""')}"`)
        .join(', ');

    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`);
}

export async function disconnectE2eDatabase() {
    await prisma.$disconnect();
}

export async function seedE2eTenant(label: string) {
    const tenant = await prisma.tenant.create({
        data: {
            name: `Tenant E2E ${label}`,
            country: 'FR',
            plan: 'PRO',
            maxEmployees: 20,
            workStartTime: '09:00',
            status: 'ACTIVE'
        }
    });

    const site = await prisma.site.create({
        data: {
            name: `Site E2E ${label}`,
            address: `${label} test address`,
            country: 'FR',
            latitude: 48.8566,
            longitude: 2.3522,
            radius: 150,
            gpsMode: 'STRICT',
            tenantId: tenant.id
        }
    });

    const manager = await prisma.employee.create({
        data: {
            name: `Manager E2E ${label}`,
            phoneNumber: E2E_MANAGER_PHONE,
            role: 'MANAGER',
            password: await bcrypt.hash('ValidPass123!', 8),
            tenantId: tenant.id,
            siteId: site.id,
            workProfile: 'MOBILE',
            hasCompletedOnboarding: true
        }
    });

    const employee = await prisma.employee.create({
        data: {
            name: `Employee E2E ${label}`,
            phoneNumber: '33799000001',
            role: 'EMPLOYEE',
            tenantId: tenant.id,
            siteId: site.id,
            workProfile: 'SEDENTARY',
            hasCompletedOnboarding: false
        }
    });

    return { tenant, site, manager, employee };
}

export async function seedE2eSuperAdmin() {
    return prisma.superAdmin.create({
        data: {
            email: E2E_SUPERADMIN_EMAIL,
            password: await bcrypt.hash(E2E_SUPERADMIN_PASSWORD, 8),
            name: 'Super Admin E2E'
        }
    });
}

export async function seedPendingGpsAttendance(label = 'Attendance') {
    const seeded = await seedE2eTenant(label);
    const now = new Date();
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 7, 30, 0));

    const attendance = await prisma.attendance.create({
        data: {
            checkIn: date,
            status: 'PENDING_GPS',
            gpsVerdict: 'PENDING',
            verdictReason: 'Position GPS attendue avant validation définitive du pointage.',
            locationWarning: true,
            tenantId: seeded.tenant.id,
            siteId: seeded.site.id,
            employeeId: seeded.employee.id
        }
    });

    return { ...seeded, attendance };
}
