import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TERMS = `**CONDITIONS GÉNÉRALES DE VENTE ET D'UTILISATION (CGV/CGU)**

**1. OBJET**
Les présentes CGV/CGU définissent les conditions dans lesquelles WhatsPoint met à disposition des entreprises clientes (le "Client") un logiciel en mode SaaS permettant le pointage horaire et la gestion des interventions via WhatsApp.

**2. DESCRIPTION DU SERVICE**
WhatsPoint fournit :
- Une interface "Manager" Web d'administration.
- Une intégration WhatsApp (via Numéro Partagé ou Marque Blanche).
- Un stockage sécurisé des données de planification et de présence.

**3. ACCÈS ET DISPONIBILITÉ**
WhatsPoint s'efforce de maintenir un accès 24/7 au service (SLA 99.9%). Des interruptions pour maintenance peuvent avoir lieu sans ouvrir droit à indemnité. L'outil dépend de l'API Meta/WhatsApp ; WhatsPoint ne peut être tenu responsable des pannes du réseau Meta.

**4. OBLIGATIONS DU CLIENT**
Le Client est seul responsable des plannings, des numéros de téléphone déclarés, et du consentement de ses salariés à utiliser WhatsApp dans un cadre strictement professionnel.

**5. CONDITIONS FINANCIÈRES**
Le Service est facturé mensuellement à l'avance. Le paiement vaut acceptation sans réserve. En cas de défaut de paiement, WhatsPoint suspendra l'accès à la plateforme sous 24h.

**6. RÉSILIATION**
Le Client peut résilier son abonnement à tout moment via l'interface. La résiliation prendra effet à la fin de la période facturée en cours.

**7. DROIT APPLICABLE**
Tout litige relève des tribunaux compétents du siège social de WhatsPoint.
`;

const PRIVACY = `**POLITIQUE DE CONFIDENTIALITÉ ET RGPD**

**1. LE RÔLE DE WHATSPOINT (SOUS-TRAITANT)**
Dans le cadre de l'utilisation du service, le Client agit en tant que Responsable de Traitement et WhatsPoint en tant que Sous-traitant au sens du RGPD. WhatsPoint ne traite les données personnelles des salariés du Client que sur instruction stricte de ce dernier.

**2. DONNÉES COLLECTÉES**
- Numéros de téléphone des salariés.
- Prénom / Nom de l'employé.
- Données temporelles (Heures d'arrivée, de départ).
- Localisation GPS (si option activée par le Client).
- Photographies (Pièces jointes tickets ou pointage).

**3. FINALITÉ DU TRAITEMENT**
La collecte a pour seule finalité la bonne exécution des contrats de travail (suivi des heures, paie) et l'exécution d'interventions par le Client.

**4. MESURES DE SÉCURITÉ**
WhatsPoint utilise un hébergement européen.
Le client dispose d'une fonction « Mode Furtif » anonymisant les identités avant la transmission via les serveurs de Meta (WhatsApp). 

**5. DURÉE DE RÉTENTION**
Les données sont conservées pour une durée standard d'un an (365 jours), paramétrable par le Client dans la section « Privacy Shield ». Passé ce délai, elles sont purgées automatiquement chaque nuit.

**6. SOUS-TRAITANTS ULTÉRIEURS**
- Hetzner (Hébergement France/Allemagne)
- Meta Platforms Inc (Service WhatsApp Cloud API)
- Twilio Inc. (Provisioning des numéros SMS)
`;

const NOTICES = `**MENTIONS LÉGALES**

**Éditeur du Service :**
Le service WhatsPoint est édité par la société [VOTRE SOCIÉTÉ], [Forme Juridique ex: SASU] au capital de [MONTANT] euros.
**SIRET :** [VOTRE SIRET]
**Siège social :** [VOTRE ADRESSE]
**Directeur de la publication :** [VOTRE NOM]
**Contact :** support@[VOTREDOMAINE].com

**Hébergement :**
Le site intellectuel et les données sont hébergés par :
Hetzner Online GmbH
Industriestr. 25, 91710 Gunzenhausen, Allemagne
(Serveurs physiques localisés en Union Européenne).

**Propriété Intellectuelle :**
Toute reproduction totale ou partielle du design, des textes ou du code source est interdite sans autorisation préalable expresse de [VOTRE SOCIÉTÉ].
`;

async function seedLegal() {
    console.log("📝 Generating Official Legal Documents (B2B SaaS)...");
    
    // Check if PlatformConfig exists
    const configCount = await prisma.platformConfig.count();
    
    if (configCount === 0) {
        await prisma.platformConfig.create({
            data: {
                termsOfService: TERMS,
                privacyPolicy: PRIVACY,
                legalNotices: NOTICES,
                contactEmail: 'contact@votre-entreprise.com',
                supportUrl: 'https://votre-domaine.com/support'
            }
        });
    } else {
        const config = await prisma.platformConfig.findFirst();
        await prisma.platformConfig.update({
            where: { id: config!.id },
            data: {
                termsOfService: TERMS,
                privacyPolicy: PRIVACY,
                legalNotices: NOTICES
            }
        });
    }
    
    console.log("✅ Documents successfully injected into the Database !");
}

seedLegal()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
