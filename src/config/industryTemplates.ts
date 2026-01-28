/**
 * Industry Templates - Default configurations for each sector
 * Used when tenant doesn't have custom vocabulary or config
 */

export type Industry = 'BTP' | 'RETAIL' | 'CLEANING' | 'SECURITY' | 'OFFICE' | 'GENERIC';

export interface VocabularyConfig {
    workplace: string;        // Lieu de travail
    action_in: string;        // Action d'arrivée
    action_out: string;       // Action de départ
    greeting: string;         // Salutation matin
    goodbye: string;          // Salutation départ
    manager: string;          // Titre du manager
    employee: string;         // Titre de l'employé
    attendance: string;       // Nom du pointage
}

export interface FeatureConfig {
    enableGps: boolean;
    enablePhotos: boolean;
    enableExpenses: boolean;
    enableDocuments: boolean;
    enableLeaveRequests: boolean;
}

export interface IndustryTemplate {
    vocabulary: VocabularyConfig;
    config: FeatureConfig;
}

export const TEMPLATES: Record<Industry, IndustryTemplate> = {
    BTP: {
        vocabulary: {
            workplace: 'Chantier',
            action_in: 'Arrivée chantier',
            action_out: 'Fin de chantier',
            greeting: 'Bonne journée sur le chantier !',
            goodbye: 'Bonne fin de journée !',
            manager: 'Chef de chantier',
            employee: 'Ouvrier',
            attendance: 'Pointage'
        },
        config: {
            enableGps: true,
            enablePhotos: true,
            enableExpenses: true,
            enableDocuments: true,
            enableLeaveRequests: true
        }
    },
    RETAIL: {
        vocabulary: {
            workplace: 'Magasin',
            action_in: 'Prise de poste',
            action_out: 'Fin de service',
            greeting: 'Bonne journée en boutique !',
            goodbye: 'À demain !',
            manager: 'Responsable magasin',
            employee: 'Vendeur',
            attendance: 'Pointage'
        },
        config: {
            enableGps: false,
            enablePhotos: false,
            enableExpenses: true,
            enableDocuments: true,
            enableLeaveRequests: true
        }
    },
    CLEANING: {
        vocabulary: {
            workplace: 'Site',
            action_in: 'Début intervention',
            action_out: 'Fin intervention',
            greeting: 'Bonne intervention !',
            goodbye: 'Intervention terminée !',
            manager: 'Chef d\'équipe',
            employee: 'Agent',
            attendance: 'Pointage'
        },
        config: {
            enableGps: true,
            enablePhotos: true,
            enableExpenses: false,
            enableDocuments: true,
            enableLeaveRequests: true
        }
    },
    SECURITY: {
        vocabulary: {
            workplace: 'Poste',
            action_in: 'Prise de poste',
            action_out: 'Fin de vacation',
            greeting: 'Bonne vacation !',
            goodbye: 'Relève effectuée !',
            manager: 'Chef de site',
            employee: 'Agent de sécurité',
            attendance: 'Pointage'
        },
        config: {
            enableGps: true,
            enablePhotos: true,
            enableExpenses: false,
            enableDocuments: true,
            enableLeaveRequests: true
        }
    },
    OFFICE: {
        vocabulary: {
            workplace: 'Bureau',
            action_in: 'Bonjour',
            action_out: 'Bonne soirée',
            greeting: 'Bonne journée au bureau !',
            goodbye: 'À demain !',
            manager: 'Responsable',
            employee: 'Collaborateur',
            attendance: 'Présence'
        },
        config: {
            enableGps: false,
            enablePhotos: false,
            enableExpenses: true,
            enableDocuments: true,
            enableLeaveRequests: true
        }
    },
    GENERIC: {
        vocabulary: {
            workplace: 'Travail',
            action_in: 'Arrivée',
            action_out: 'Départ',
            greeting: 'Bonne journée !',
            goodbye: 'À bientôt !',
            manager: 'Manager',
            employee: 'Employé',
            attendance: 'Pointage'
        },
        config: {
            enableGps: true,
            enablePhotos: false,
            enableExpenses: true,
            enableDocuments: true,
            enableLeaveRequests: true
        }
    }
};

/**
 * Get default template for an industry
 */
export function getTemplate(industry: string): IndustryTemplate {
    return TEMPLATES[industry as Industry] || TEMPLATES.GENERIC;
}
