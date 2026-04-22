const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedTestData() {
    console.log('🧪 [Seed] Checking for Test Data...');

    try {
        const hashedPassword = await bcrypt.hash('admin123', 10);

        // 1. Create Tenant
        const tenant = await prisma.tenant.upsert({
            where: { id: 'test-tenant-id' }, // We use a fixed ID for the test tenant to make it upsertable
            update: {},
            create: {
                id: 'test-tenant-id',
                name: 'Acme Corp (Test)',
                country: 'FR',
                industry: 'BTP',
                plan: 'TRIAL',
                trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
            }
        });

        // 2. Create Manager
        const manager = await prisma.employee.upsert({
            where: { phoneNumber: '33699999999' },
            update: {
                tenantId: tenant.id,
                role: 'MANAGER',
                password: hashedPassword
            },
            create: {
                name: 'Test Manager',
                phoneNumber: '33699999999',
                role: 'MANAGER',
                password: hashedPassword,
                tenantId: tenant.id
            }
        });

        // 3. Create a Site
        await prisma.site.upsert({
            where: { id: 'test-site-id' },
            update: {},
            create: {
                id: 'test-site-id',
                name: 'Chantier Rivoli',
                tenantId: tenant.id
            }
        });

        // 4. Create some Employees
        const employeesData = [
            { name: 'Alice Ouvrier', phone: '33600000001' },
            { name: 'Bob Technicien', phone: '33600000002' }
        ];

        for (const emp of employeesData) {
            await prisma.employee.upsert({
                where: { phoneNumber: emp.phone },
                update: { tenantId: tenant.id },
                create: {
                    name: emp.name,
                    phoneNumber: emp.phone,
                    role: 'EMPLOYEE',
                    tenantId: tenant.id
                }
            });
        }

        console.log('✅ [Seed] Test Data ready:');
        console.log(`   Tenant: Acme Corp (Test)`);
        console.log(`   Manager Phone: 33699999999`);
        console.log(`   Password: admin123`);
        
    } catch (error) {
        console.error('❌ [Seed] Test Data creation failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

seedTestData();
