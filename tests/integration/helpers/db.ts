import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config({ path: '.env.test' });

if (process.env.DATABASE_URL_TEST) {
    process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}

import prisma from '../../../src/lib/prisma';

export const integrationDbConfigured = Boolean(process.env.DATABASE_URL_TEST);
export const describeIntegration = integrationDbConfigured ? describe : describe.skip;

export type SeededTenantGraph = Awaited<ReturnType<typeof seedTenantGraph>>;

function assertIntegrationDatabase() {
    if (!process.env.DATABASE_URL_TEST || process.env.DATABASE_URL !== process.env.DATABASE_URL_TEST) {
        throw new Error('DATABASE_URL_TEST must be set and copied to DATABASE_URL before running integration DB tests.');
    }
}

export async function resetTestDatabase() {
    assertIntegrationDatabase();

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

export async function disconnectTestDatabase() {
    await prisma.$disconnect();
}

export function managerToken(manager: { id: string; tenantId: string; role: string }) {
    return jwt.sign(
        {
            userId: manager.id,
            tenantId: manager.tenantId,
            role: manager.role
        },
        process.env.JWT_SECRET || 'test-jwt-secret-change-me',
        { expiresIn: '1h' }
    );
}

function numericSuffix(label: string, offset: number) {
    const hash = [...label].reduce((acc, char) => acc + char.charCodeAt(0), offset);
    return String(hash % 10000000).padStart(7, '0');
}

export async function seedTenantGraph(label: string) {
    const managerPhoneSuffix = numericSuffix(label, 1000);
    const employeePhoneSuffix = numericSuffix(label, 2000);
    const tenant = await prisma.tenant.create({
        data: {
            name: `Tenant ${label}`,
            country: 'FR',
            plan: 'PRO',
            maxEmployees: 20,
            workStartTime: '09:00'
        }
    });

    const site = await prisma.site.create({
        data: {
            name: `Site ${label}`,
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
            name: `Manager ${label}`,
            phoneNumber: `33610${managerPhoneSuffix}`,
            role: 'MANAGER',
            password: await bcrypt.hash('ValidPass123!', 8),
            tenantId: tenant.id,
            siteId: site.id,
            workProfile: 'MOBILE'
        }
    });

    const employee = await prisma.employee.create({
        data: {
            name: `Employee ${label}`,
            phoneNumber: `33710${employeePhoneSuffix}`,
            role: 'EMPLOYEE',
            tenantId: tenant.id,
            siteId: site.id,
            workProfile: 'SEDENTARY'
        }
    });

    return {
        tenant,
        site,
        manager,
        employee,
        token: managerToken(manager)
    };
}
