import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔧 Seeding Platform Configuration...');

    // Upsert ensures row with ID 1 exists
    const config = await prisma.platformConfig.upsert({
        where: { id: 1 },
        update: {}, // Don't update if exists
        create: {
            id: 1,
            platformName: 'WhatsPoint',
            supportEmail: 'support@whatspoint.app',
            defaultTrialDays: 14,
            maintenanceMode: false,
            allowRegistrations: true,
            botWelcomeText:
                "WhatsPoint transforme WhatsApp en pointage, planning et demandes terrain pour vos équipes.\n\n" +
                "Vous pouvez créer votre espace, voir une démo ou simplement répondre à ce message pour parler à Astauria.",
            botBtn1Label: 'Créer un espace',
            botBtn2Label: 'Voir une démo'
        }
    });

    console.log('✅ Platform Config initialized:', config);
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
