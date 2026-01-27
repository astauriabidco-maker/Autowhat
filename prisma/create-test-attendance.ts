import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestAttendance() {
    // Get employees from both tenants
    const acmeEmployee = await prisma.employee.findFirst({ where: { name: 'Alice Acme' } });
    const starkEmployee = await prisma.employee.findFirst({ where: { name: 'Tony Stark' } });
    const dexxysEmployee = await prisma.employee.findFirst({ where: { name: 'DEXXYS SERVICES' } });

    if (!acmeEmployee || !starkEmployee) {
        console.log('Employees not found');
        return;
    }

    // Create attendance for Acme employees
    await prisma.attendance.create({
        data: {
            checkIn: new Date(),
            status: 'PRESENT',
            employeeId: acmeEmployee.id,
            tenantId: acmeEmployee.tenantId,
        }
    });
    console.log('✅ Created attendance for Alice Acme (Acme Corp)');

    if (dexxysEmployee) {
        await prisma.attendance.create({
            data: {
                checkIn: new Date(),
                status: 'PRESENT',
                employeeId: dexxysEmployee.id,
                tenantId: dexxysEmployee.tenantId,
            }
        });
        console.log('✅ Created attendance for DEXXYS SERVICES (Acme Corp)');
    }

    // Create attendance for Stark employee
    await prisma.attendance.create({
        data: {
            checkIn: new Date(),
            status: 'PRESENT',
            employeeId: starkEmployee.id,
            tenantId: starkEmployee.tenantId,
        }
    });
    console.log('✅ Created attendance for Tony Stark (Stark Industries)');

    console.log('\n📊 Summary:');
    console.log('- Acme Corp: 2 attendances');
    console.log('- Stark Industries: 1 attendance');

    await prisma.$disconnect();
}

createTestAttendance();
