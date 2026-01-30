/**
 * Landing Page Content Variants Configuration
 * 
 * This file maps country codes, traffic sources, and device types
 * to specific content variants for the landing page.
 */

// ============================================
// HERO SECTION - Background Images
// ============================================
export const HERO_IMAGES: Record<string, string> = {
    // Country-specific images
    'SN': '/images/hero-africa.png',       // Sénégal - African landscape
    'CI': '/images/hero-africa.png',       // Côte d'Ivoire
    'CM': '/images/hero-africa.png',       // Cameroun
    'ML': '/images/hero-africa.png',       // Mali
    'BF': '/images/hero-africa.png',       // Burkina Faso
    'NE': '/images/hero-africa.png',       // Niger
    'TG': '/images/hero-africa.png',       // Togo
    'BJ': '/images/hero-africa.png',       // Bénin
    'GN': '/images/hero-africa.png',       // Guinée

    'CA': '/images/hero-canada.png',       // Canada - Snow/Modern
    'US': '/images/hero-usa.png',          // USA - Professional
    'GB': '/images/hero-france.png',       // UK - Urban (using France for now)

    'FR': '/images/hero-france.png',       // France - Default European
    'DE': '/images/hero-france.png',       // Germany
    'ES': '/images/hero-france.png',       // Spain
    'IT': '/images/hero-france.png',       // Italy

    // Zone-based fallbacks
    'AFRICA_WEST': '/images/hero-africa.png',
    'TIER1_USD': '/images/hero-usa.png',
    'TIER2_EUR': '/images/hero-france.png',

    // Default fallback
    'default': '/images/hero-generic.png'
};

// ============================================
// HERO SECTION - Title Variants (i18n keys)
// ============================================
export const HERO_TITLES: Record<string, { key: string }> = {
    // Traffic source variants
    'linkedin_btp': { key: 'landing.hero.title.btp' },
    'linkedin_cleaning': { key: 'landing.hero.title.cleaning' },
    'linkedin_security': { key: 'landing.hero.title.security' },
    'google_ads': { key: 'landing.hero.title.generic' },
    'facebook': { key: 'landing.hero.title.social' },

    // Direct / default
    'default': { key: 'landing.hero.title' }
};

// ============================================
// HERO SECTION - Subtitle Variants
// ============================================
export const HERO_SUBTITLES: Record<string, { key: string }> = {
    'linkedin_btp': { key: 'landing.hero.subtitle.btp' },
    'linkedin_cleaning': { key: 'landing.hero.subtitle.cleaning' },
    'linkedin_security': { key: 'landing.hero.subtitle.security' },
    'default': { key: 'landing.hero.subtitle1' }
};

// ============================================
// CTA Button Variants
// ============================================
export const CTA_VARIANTS: Record<string, { key: string; color?: string }> = {
    'linkedin_btp': { key: 'landing.hero.cta.btp', color: '#f59e0b' },
    'linkedin_cleaning': { key: 'landing.hero.cta.cleaning', color: '#10b981' },
    'default': { key: 'landing.hero.cta' }
};

// ============================================
// TESTIMONIALS - Country-tagged testimonials
// ============================================
export interface Testimonial {
    id: string;
    name: string;
    role: string;
    company: string;
    avatar?: string;
    quote: string;
    countryCode: string;
    sector?: 'btp' | 'cleaning' | 'security' | 'retail';
    rating: number;
}

export const TESTIMONIALS: Testimonial[] = [
    // 🇫🇷 France
    {
        id: 'fr-1',
        name: 'Marie Dupont',
        role: 'Responsable RH',
        company: 'BTP Construct',
        quote: "WhatsPoint a transformé notre gestion des équipes terrain. Plus de feuilles de temps perdues !",
        countryCode: 'FR',
        sector: 'btp',
        rating: 5
    },
    {
        id: 'fr-2',
        name: 'Jean-Pierre Martin',
        role: 'Directeur Opérations',
        company: 'CleanPro Services',
        quote: "Nos agents de nettoyage adorent la simplicité. Un message WhatsApp et c'est enregistré.",
        countryCode: 'FR',
        sector: 'cleaning',
        rating: 5
    },
    {
        id: 'fr-3',
        name: 'Sophie Bernard',
        role: 'Chef de Projet',
        company: 'SecuriGard',
        quote: "Le suivi des vacations est devenu un jeu d'enfant. Gain de temps énorme.",
        countryCode: 'FR',
        sector: 'security',
        rating: 4
    },

    // 🇸🇳 Sénégal
    {
        id: 'sn-1',
        name: 'Amadou Diallo',
        role: 'Gérant',
        company: 'Dakar Construction',
        quote: "Même sans smartphone dernier cri, nos ouvriers pointent facilement via WhatsApp.",
        countryCode: 'SN',
        sector: 'btp',
        rating: 5
    },
    {
        id: 'sn-2',
        name: 'Fatou Ndiaye',
        role: 'DRH',
        company: 'Sénégal Services',
        quote: "La solution parfaite pour gérer nos équipes sur tout le territoire. Simple et efficace.",
        countryCode: 'SN',
        sector: 'cleaning',
        rating: 5
    },

    // 🇨🇮 Côte d'Ivoire
    {
        id: 'ci-1',
        name: 'Kouadio Yao',
        role: 'Directeur Général',
        company: 'Abidjan Pro Clean',
        quote: "Notre productivité a augmenté de 30% depuis qu'on utilise WhatsPoint.",
        countryCode: 'CI',
        sector: 'cleaning',
        rating: 5
    },

    // 🇨🇲 Cameroun
    {
        id: 'cm-1',
        name: 'Paul Njoya',
        role: 'Chef de Chantier',
        company: 'Douala BTP',
        quote: "Fini les appels interminables pour vérifier qui est sur site. Tout est dans l'application.",
        countryCode: 'CM',
        sector: 'btp',
        rating: 4
    },

    // 🇨🇦 Canada
    {
        id: 'ca-1',
        name: 'Marc Tremblay',
        role: 'Operations Manager',
        company: 'Montreal Facilities',
        quote: "Even in harsh Canadian winters, our team checks in seamlessly via WhatsApp.",
        countryCode: 'CA',
        sector: 'cleaning',
        rating: 5
    },

    // 🇺🇸 USA
    {
        id: 'us-1',
        name: 'John Smith',
        role: 'HR Director',
        company: 'BuildRight Inc.',
        quote: "The ROI is incredible. We saved 15 hours per week on attendance management.",
        countryCode: 'US',
        sector: 'btp',
        rating: 5
    },

    // 🇬🇧 UK
    {
        id: 'gb-1',
        name: 'James Wilson',
        role: 'Site Manager',
        company: 'London Security Ltd',
        quote: "Brilliant solution for managing our security guards across multiple locations.",
        countryCode: 'GB',
        sector: 'security',
        rating: 5
    }
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the appropriate hero image for a country/zone
 */
export function getHeroImage(countryCode: string, zone?: string): string {
    // Try country-specific first
    if (HERO_IMAGES[countryCode]) {
        return HERO_IMAGES[countryCode];
    }
    // Try zone-based
    if (zone && HERO_IMAGES[zone]) {
        return HERO_IMAGES[zone];
    }
    // Default
    return HERO_IMAGES.default;
}

/**
 * Get the appropriate hero title key for a traffic source
 */
export function getHeroTitleKey(trafficSource: string | null): string {
    if (trafficSource && HERO_TITLES[trafficSource]) {
        return HERO_TITLES[trafficSource].key;
    }
    return HERO_TITLES.default.key;
}

/**
 * Get testimonials filtered and sorted by relevance to visitor's country
 */
export function getRelevantTestimonials(
    countryCode: string,
    sector?: string,
    maxCount: number = 3
): Testimonial[] {
    // Clone and sort by relevance
    const sorted = [...TESTIMONIALS].sort((a, b) => {
        // Exact country match = highest priority
        const aCountryMatch = a.countryCode === countryCode ? 100 : 0;
        const bCountryMatch = b.countryCode === countryCode ? 100 : 0;

        // Sector match = medium priority
        const aSectorMatch = sector && a.sector === sector ? 50 : 0;
        const bSectorMatch = sector && b.sector === sector ? 50 : 0;

        // Rating as tiebreaker
        const aScore = aCountryMatch + aSectorMatch + a.rating;
        const bScore = bCountryMatch + bSectorMatch + b.rating;

        return bScore - aScore;
    });

    return sorted.slice(0, maxCount);
}

/**
 * Get African zone country codes
 */
export const AFRICAN_COUNTRIES = ['SN', 'CI', 'CM', 'ML', 'BF', 'NE', 'TG', 'BJ', 'GN'];

/**
 * Check if a country is in the African zone
 */
export function isAfricanCountry(countryCode: string): boolean {
    return AFRICAN_COUNTRIES.includes(countryCode);
}
