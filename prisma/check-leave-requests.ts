import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLeaveRequests() {
    const requests = await prisma.leaveRequest.findMany({
        include: { employee: true }
    });

    console.log('📋 Leave Requests in DB:');
    console.log('------------------------');

    if (requests.length === 0) {
        console.log('No leave requests found');
    } else {
        requests.forEach((r) => {
            console.log(`  ID: ${r.id.slice(0, 8)}`);
            console.log(`  Status: ${r.status}`);
            console.log(`  Employee: ${r.employee.name}`);
            console.log(`  Date: ${r.startDate.toLocaleDateString('fr-FR')}`);
            console.log(`  TenantId: ${r.tenantId.slice(0, 8)}`);
            console.log('  ---');
        });
    }

    await prisma.$disconnect();
}

checkLeaveRequests();
