import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function syncDirectory() {
    console.log("🚀 Lancement de la synchronisation Annuaire KPaie -> WhatsPoint");
    
    // In a real scenario, we would use the Tenant config to get the KPaie API URL
    // Here we use the local Dev KPaie URL
    const kpaieApiUrl = "http://localhost:5010/api/collaborateur"; // Supposing there's an endpoint
    
    // Pour la démo ou si l'API n'est pas ouverte, on simule l'extraction de KPaie
    // avec 3 collaborateurs clés
    const collaborateursExtract = [
        { id: "MAT-001", nom: "DUBOIS", prenom: "Laura", telephone: "+33611223344", role: "EMPLOYEE" },
        { id: "MAT-042", nom: "BENALI", prenom: "Karim", telephone: "+33655443322", role: "EMPLOYEE" },
        { id: "MAT-089", nom: "MARTIN", prenom: "Sophie", telephone: "+33699887766", role: "MANAGER" }
    ];

    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
        console.error("❌ Aucun Tenant trouvé dans WhatsPoint !");
        return;
    }

    let synced = 0;

    for (const collab of collaborateursExtract) {
        if (!collab.telephone) continue;

        const phone = collab.telephone.replace('+', '');
        
        await prisma.employee.upsert({
            where: { phoneNumber: phone },
            update: {
                name: `${collab.prenom} ${collab.nom}`,
                role: collab.role as any
            },
            create: {
                phoneNumber: phone,
                name: `${collab.prenom} ${collab.nom}`,
                role: collab.role as any,
                tenantId: tenant.id,
                isActive: true
            }
        });
        
        synced++;
        console.log(`✅ Synchronisé : ${collab.prenom} ${collab.nom} (${collab.telephone})`);
    }

    console.log(`🎉 Terminé ! ${synced} collaborateurs importés et prêts à utiliser WhatsPoint.`);
}

syncDirectory()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
