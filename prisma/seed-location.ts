import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding location for Acme Corp...');

    // Tour Eiffel coordinates
    const latitude = 48.8584;
    const longitude = 2.2945;

    const tenant = await prisma.tenant.findFirst({
        where: { name: 'Acme Corp' }
    });

    if (tenant) {
        await prisma.tenant.update({
            where: { id: tenant.id },
            data: {
                defaultLatitude: latitude,
                defaultLongitude: longitude
            }
        });
        console.log(`✅ Updated Acme Corp with coordinates: ${latitude}, ${longitude}`);
    } else {
        console.log('❌ Tenant "Acme Corp" not found.');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
