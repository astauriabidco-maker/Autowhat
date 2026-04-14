import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const password = await bcrypt.hash('manager123', 10);
    
    // Find or create Tenant
    let tenant = await prisma.tenant.findFirst({
        where: { name: "Demo IA Company" }
    });

    if (!tenant) {
        tenant = await prisma.tenant.create({
            data: {
                name: "Demo IA Company",
                industry: "TECH",
            }
        });
    }

    // Find or create Manager
    let manager = await prisma.employee.findFirst({
        where: { phoneNumber: "33612345678" }
    });

    if (!manager) {
        manager = await prisma.employee.create({
            data: {
                phoneNumber: "33612345678",
                password: password,
                name: "Jean Manager",
                role: "MANAGER",
                tenantId: tenant.id
            }
        });
    } else {
        await prisma.employee.update({
            where: { id: manager.id },
            data: { password: password, role: "MANAGER" }
        });
    }

    console.log('Manager Account Ready:');
    console.log('Phone: 33612345678');
    console.log('Password: manager123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
