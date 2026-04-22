const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedTestData() {
    console.log('🧪 [Seed] Checking for Test Data...');

    const TEST_TENANT_ID = 'test-tenant-id';
    const TEST_MANAGER_PHONE = '33699999999';

    try {
        const hashedPassword = await bcrypt.hash('admin123', 10);

        // 1. Create Tenant
        const tenant = await prisma.tenant.upsert({
            where: { id: TEST_TENANT_ID },
            update: {},
            create: {
                id: TEST_TENANT_ID,
                name: 'Acme Corp (Test)',
                country: 'FR',
                industry: 'BTP',
                plan: 'TRIAL',
                trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            }
        });

        // 2. Create Manager
        // Correct upsert for composite unique constraint [phoneNumber, tenantId]
        await prisma.employee.upsert({
            where: { 
                phoneNumber_tenantId: {
                    phoneNumber: TEST_MANAGER_PHONE,
                    tenantId: TEST_TENANT_ID
                }
            },
            update: {
                role: 'MANAGER',
                password: hashedPassword
            },
            create: {
                name: 'Test Manager',
                phoneNumber: TEST_MANAGER_PHONE,
                role: 'MANAGER',
                password: hashedPassword,
                tenantId: TEST_TENANT_ID
            }
        });

        // 3. Create a Site
        await prisma.site.upsert({
            where: { id: 'test-site-id' },
            update: {},
            create: {
                id: 'test-site-id',
                name: 'Chantier Rivoli',
                tenantId: TEST_TENANT_ID
            }
        });

        // 4. Create some Employees
        const employeesData = [
            { name: 'Alice Ouvrier', phone: '33600000001' },
            { name: 'Bob Technicien', phone: '33600000002' }
        ];

        for (const emp of employeesData) {
            await prisma.employee.upsert({
                where: { 
                    phoneNumber_tenantId: {
                        phoneNumber: emp.phone,
                        tenantId: TEST_TENANT_ID
                    }
                },
                update: {},
                create: {
                    name: emp.name,
                    phoneNumber: emp.phone,
                    role: 'EMPLOYEE',
                    tenantId: TEST_TENANT_ID
                }
            });
        }

        console.log('✅ [Seed] Test Data ready:');
        console.log(`   Tenant: Acme Corp (Test)`);
        console.log(`   Manager Phone: ${TEST_MANAGER_PHONE}`);
        console.log(`   OTP Bypass Code: 123456`);
        
    } catch (error) {
        console.error('❌ [Seed] Test Data creation failed:', error);
        // We log the error but don't crash the script to allow app to start
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

seedTestData();
