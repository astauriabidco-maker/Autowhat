import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import axios from 'axios';
import {
    MessageCircle,
    Check,
    Users,
    Globe,
    ChevronDown
} from 'lucide-react';
import { VisitorProvider, useVisitor } from '../context/VisitorContext';
import HeroSection from '../components/landing/HeroSection';
import Testimonials from '../components/landing/Testimonials';
import TrustSection from '../components/landing/TrustSection';
import FeaturesGrid from '../components/landing/FeaturesGrid';
import EnterpriseSection from '../components/landing/EnterpriseSection';
import SectorsSection from '../components/landing/SectorsSection';
import IntegrationsSection from '../components/landing/IntegrationsSection';
import OperationsSection from '../components/landing/OperationsSection';

interface Plan {
    id: string;
    stripePriceId: string;
    name: string;
    description: string | null;
    price: number;
    currency: string;
    maxEmployees: number;
    features: string[];
    isPopular: boolean;
    sortOrder: number;
}

// Currency symbols
const CURRENCY_SYMBOLS: Record<string, string> = {
    'EUR': '€',
    'USD': '$',
    'XOF': 'FCFA',
    'GBP': '£',
    'CHF': 'CHF'
};

// Language flags
const LANG_FLAGS: Record<string, string> = {
    'fr': '🇫🇷',
    'en': '🇬🇧',
    'es': '🇪🇸'
};

// Inner component that uses VisitorContext
function LandingContent() {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { countryCode, currency, deviceType } = useVisitor();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [showLangMenu, setShowLangMenu] = useState(false);

    const isMobile = deviceType === 'mobile';

    useEffect(() => {
        // Fetch geo-localized offer
        axios.get('/api/public/offer')
            .then(res => {
                if (res.data.plans && res.data.plans.length > 0) {
                    setPlans(res.data.plans);
                } else {
                    // Fallback plans if DB is empty
                    setPlans([
                        {
                            id: 'plan_1', stripePriceId: '', name: 'Starter', description: 'Idéal pour les petites équipes.',
                            price: 49, currency: res.data.currency || 'EUR', maxEmployees: 10,
                            features: ['Pointage WhatsApp', 'GPS Automatisé', 'Consultation planning', 'Support Email'],
                            isPopular: false, sortOrder: 1
                        },
                        {
                            id: 'plan_2', stripePriceId: '', name: 'Pro', description: 'Pour les PME en pleine croissance.',
                            price: 99, currency: res.data.currency || 'EUR', maxEmployees: 50,
                            features: ['Pointage WhatsApp', 'Planning consultable', 'Transmission RH/paie', 'Support Stratégique WhatsApp'],
                            isPopular: true, sortOrder: 2
                        },
                        {
                            id: 'plan_3', stripePriceId: '', name: 'Enterprise', description: 'Pour les grands volumes.',
                            price: 199, currency: res.data.currency || 'EUR', maxEmployees: 200,
                            features: ['Toutes les fonctions Pro', 'Multi-Managers', 'Accès API', 'SLA Garanti'],
                            isPopular: false, sortOrder: 3
                        }
                    ]);
                }
            })
            .catch(err => {
                console.error('Error fetching offer:', err);
                axios.get('/api/plans')
                    .then(res => {
                        if (res.data && res.data.length > 0) {
                            setPlans(res.data);
                        }
                    })
                    .catch(console.error);
            })
            .finally(() => setLoadingPlans(false));
    }, []);

    const formatPrice = (price: number, curr: string) => {
        const symbol = CURRENCY_SYMBOLS[curr] || curr;
        if (curr === 'XOF') {
            return `${price.toLocaleString()} ${symbol}`;
        }
        return `${price}${symbol}`;
    };

    const changeLanguage = (lang: string) => {
        i18n.changeLanguage(lang);
        setShowLangMenu(false);
    };

    return (
        <div style={{ minHeight: '100vh', background: '#ffffff' }}>
            {/* Navbar */}
            <nav style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: isMobile ? '1rem 4%' : '1.5rem 5%',
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                zIndex: 100,
                borderBottom: '1px solid rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MessageCircle size={28} color="#3b82f6" />
                    <span style={{ color: '#0f172a', fontWeight: 800, fontSize: '1.25rem' }}>
                        WhatsPoint
                    </span>
                </div>

                {/* Desktop navigation */}
                {!isMobile && (
                    <div style={{ display: 'flex', gap: '2.5rem' }}>
                        <a href="#features" style={{ color: '#475569', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500 }}>
                            {t('landing.nav.features')}
                        </a>
                        <a href="#operations" style={{ color: '#475569', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500 }}>
                            {t('landing.nav.operations', 'Opérations')}
                        </a>
                        <a href="#sectors" style={{ color: '#475569', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500 }}>
                            {t('landing.nav.sectors')}
                        </a>
                        <a href="#testimonials" style={{ color: '#475569', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500 }}>
                            {t('landing.nav.testimonials')}
                        </a>
                        <a href="#pricing" style={{ color: '#475569', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500 }}>
                            {t('landing.nav.pricing')}
                        </a>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {/* Language Selector */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowLangMenu(!showLangMenu)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem 0.75rem',
                                background: 'rgba(0,0,0,0.05)',
                                border: '1px solid rgba(0,0,0,0.05)',
                                borderRadius: '0.5rem',
                                color: '#334155',
                                cursor: 'pointer',
                                fontSize: '0.9rem'
                            }}
                        >
                            <Globe size={16} />
                            <span>{LANG_FLAGS[i18n.language] || '🌐'}</span>
                            <ChevronDown size={14} />
                        </button>
                        {showLangMenu && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '0.5rem',
                                background: '#ffffff',
                                borderRadius: '0.5rem',
                                border: '1px solid rgba(0,0,0,0.1)',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                overflow: 'hidden',
                                minWidth: '120px'
                            }}>
                                {Object.entries(LANG_FLAGS).map(([lang, flag]) => (
                                    <button
                                        key={lang}
                                        onClick={() => changeLanguage(lang)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            width: '100%',
                                            padding: '0.75rem 1rem',
                                            background: i18n.language === lang ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                            border: 'none',
                                            color: '#334155',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            textAlign: 'left'
                                        }}
                                    >
                                        <span>{flag}</span>
                                        <span>{t(`languages.${lang}`)}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {!isMobile && (
                        <button
                            onClick={() => navigate('/login')}
                            style={{
                                padding: '0.6rem 1.25rem',
                                background: 'transparent',
                                border: '1px solid #e2e8f0',
                                borderRadius: '0.5rem',
                                color: '#475569',
                                cursor: 'pointer',
                                fontWeight: 500,
                                fontSize: '0.9rem'
                            }}
                        >
                            {t('common.login')}
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/onboarding')}
                        style={{
                            padding: isMobile ? '0.75rem 1rem' : '0.6rem 1.5rem',
                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            border: 'none',
                            borderRadius: '0.5rem',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {isMobile ? 'Créer' : 'Créer mon espace'}
                    </button>
                </div>
            </nav>

            {/* Hero Section - Dynamic based on visitor context */}
            <HeroSection />

            {/* Social Proof Section - Trust by */}
            <section style={{ padding: isMobile ? '1.1rem 4%' : '1.1rem 5%', background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
                        Une plateforme terrain qui couvre les workflows essentiels
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? '1rem' : '2.25rem', flexWrap: 'wrap', opacity: 0.5, filter: 'grayscale(100%)' }}>
                        {['Pointage', 'Présences', 'Plannings', 'Justificatifs', 'Documents', 'Exports'].map(module => (
                            <span key={module} style={{ fontSize: isMobile ? '0.95rem' : '1.15rem', fontWeight: 850, color: '#475569', letterSpacing: 0 }}>{module}</span>
                        ))}
                    </div>
                </div>
            </section>

            {/* Tech Integrations Section (Payroll & Accounting) */}
            <IntegrationsSection />

            {/* Trust Section - Privacy Shield */}
            <TrustSection />

            {/* Pocket HR Suite - Bento Grid */}
            <section id="features">
                <FeaturesGrid />
            </section>

            {/* Operations / Field Service Section */}
            <OperationsSection />

            {/* Sectors / Industries Section */}
            <SectorsSection />

            {/* Enterprise Section - Scale Features */}
            <EnterpriseSection />

            {/* Testimonials Section - Dynamic based on visitor country */}
            <section id="testimonials">
                <Testimonials />
            </section>

            {/* Pricing Section */}
            <section id="pricing" style={{
                padding: isMobile ? '2.5rem 4%' : '3.75rem 5%',
                background: '#f8fafc'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <motion.div
                        initial={{ y: 24 }}
                        whileInView={{ y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        style={{ textAlign: 'center', marginBottom: '2rem' }}
                    >
                        <h2 style={{ color: '#0f172a', fontSize: isMobile ? '1.75rem' : '2.5rem', fontWeight: 800, marginBottom: '1rem' }}>
                            {t('landing.pricing.title')}
                        </h2>
                        <p style={{ color: '#64748b', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
                            {t('landing.pricing.subtitle')}
                        </p>
                        {countryCode && (
                            <p style={{ color: '#3b82f6', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                📍 {countryCode} • {currency}
                            </p>
                        )}
                    </motion.div>

                    {loadingPlans ? (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                            gap: isMobile ? '1.25rem' : '1.5rem',
                            alignItems: 'stretch'
                        }}>
                            {[1, 2, 3].map((i) => (
                                <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '1.5rem', padding: '2rem 1.75rem', height: '360px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
                                    <div style={{ width: '40%', height: '24px', background: '#e2e8f0', borderRadius: '0.5rem', marginBottom: '1rem' }} />
                                    <div style={{ width: '70%', height: '16px', background: '#e2e8f0', borderRadius: '0.5rem', marginBottom: '2rem' }} />
                                    <div style={{ width: '60%', height: '48px', background: '#e2e8f0', borderRadius: '0.5rem', marginBottom: '2rem' }} />
                                    <div style={{ width: '100%', height: '16px', background: '#e2e8f0', borderRadius: '0.5rem', marginBottom: '1rem' }} />
                                    <div style={{ width: '100%', height: '16px', background: '#e2e8f0', borderRadius: '0.5rem', marginBottom: '1rem' }} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : `repeat(${Math.min(plans.length, 3)}, 1fr)`,
                            gap: isMobile ? '1.25rem' : '1.5rem',
                            alignItems: 'stretch'
                        }}>
                            {plans.map((plan, idx) => (
                                <motion.div
                                    key={plan.id}
                                    initial={{ y: 22 }}
                                    whileInView={{ y: 0 }}
                                    transition={{ duration: 0.6, delay: idx * 0.1 }}
                                    viewport={{ once: true }}
                                    style={{
                                        background: plan.isPopular
                                            ? 'white'
                                            : '#f8fafc',
                                        border: plan.isPopular
                                            ? '2px solid #3b82f6'
                                            : '1px solid #e2e8f0',
                                        boxShadow: plan.isPopular ? '0 20px 40px -15px rgba(59, 130, 246, 0.2)' : 'none',
                                        borderRadius: '1.5rem',
                                        padding: isMobile ? '2rem 1.5rem' : '2rem 1.75rem',
                                        position: 'relative',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}
                                >
                                    {/* Popular badge */}
                                    {plan.isPopular && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '-12px',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                            padding: '0.4rem 1.25rem',
                                            borderRadius: '2rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.35rem'
                                        }}>
                                            <span style={{ color: 'white', fontSize: '0.75rem', fontWeight: 600 }}>
                                                {t('landing.pricing.recommended')}
                                            </span>
                                        </div>
                                    )}

                                    {/* Plan name */}
                                    <h3 style={{
                                        color: '#0f172a',
                                        fontSize: '1.5rem',
                                        fontWeight: 800,
                                        marginBottom: '0.5rem',
                                        marginTop: plan.isPopular ? '0.5rem' : 0
                                    }}>
                                        {plan.name}
                                    </h3>

                                    {/* Description */}
                                    {plan.description && (
                                        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                            {plan.description}
                                        </p>
                                    )}

                                    {/* Price - Dynamic */}
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <span style={{ color: '#0f172a', fontSize: isMobile ? '2rem' : '3.2rem', fontWeight: 800, letterSpacing: 0 }}>
                                            {formatPrice(plan.price, plan.currency)}
                                        </span>
                                        <span style={{ color: '#64748b', fontSize: '1rem', fontWeight: 500 }}>
                                            {t('landing.pricing.perMonth')}
                                        </span>
                                    </div>

                                    {/* Employee limit */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.75rem 1rem',
                                        background: 'rgba(59, 130, 246, 0.1)',
                                        borderRadius: '0.75rem',
                                        marginBottom: '1.5rem'
                                    }}>
                                        <Users size={18} color="#3b82f6" />
                                        <span style={{ color: '#93c5fd', fontWeight: 600 }}>
                                            {t('landing.pricing.upToEmployees', { count: plan.maxEmployees })}
                                        </span>
                                    </div>

                                    {/* Features */}
                                    <ul style={{
                                        listStyle: 'none',
                                        padding: 0,
                                        margin: 0,
                                        marginBottom: '2rem',
                                        flex: 1
                                    }}>
                                        {plan.features.map((feature, fIdx) => (
                                            <li key={fIdx} style={{
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: '0.75rem',
                                                marginBottom: '0.75rem'
                                            }}>
                                                <Check size={18} color="#22c55e" style={{ flexShrink: 0, marginTop: '2px' }} />
                                                <span style={{ color: '#475569', fontSize: '0.95rem', fontWeight: 500 }}>
                                                    {feature}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>

                                    {/* CTA button */}
                                    <button
                                        onClick={() => navigate('/onboarding')}
                                        style={{
                                            width: '100%',
                                            padding: '1rem',
                                            background: plan.isPopular
                                                ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                                                : '#f1f5f9',
                                            border: plan.isPopular ? 'none' : '1px solid #e2e8f0',
                                            borderRadius: '0.75rem',
                                            color: plan.isPopular ? 'white' : '#0f172a',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            fontSize: '1rem',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        Sélectionner
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    )}

                    {/* Product scope clarification */}
                    <motion.div
                        initial={{ y: 24 }}
                        whileInView={{ y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        viewport={{ once: true }}
                        style={{ marginTop: isMobile ? '3rem' : '3.5rem' }}
                    >
                        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <h3 style={{ color: '#0f172a', fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                                Un socle simple, des extensions utiles
                            </h3>
                            <p style={{ color: '#64748b', fontSize: '1.1rem' }}>
                                Commencez par présence + planning. Ajoutez ensuite les demandes et documents qui comptent pour votre organisation.
                            </p>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                            gap: isMobile ? '1.25rem' : '1.5rem',
                            maxWidth: '900px',
                            margin: '0 auto'
                        }}>
                            <div style={{
                                background: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '1.5rem',
                                padding: isMobile ? '1.75rem' : '2rem',
                                borderTop: '4px solid #ea580c',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                                    <div style={{ padding: '0.75rem', background: '#ffedd5', borderRadius: '1rem' }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                                    </div>
                                    <h4 style={{ color: '#0f172a', fontSize: '1.35rem', fontWeight: 800 }}>Socle présence</h4>
                                </div>
                                <p style={{ color: '#475569', fontSize: '1rem', marginBottom: '2rem', lineHeight: 1.6 }}>
                                    Pointage arrivée/départ, prise de service, site, GPS, historique et consultation du planning par WhatsApp.
                                </p>
                                <div style={{ color: '#0f172a', fontSize: '2rem', fontWeight: 800 }}>
                                    Présence <span style={{ color: '#64748b', fontSize: '1.1rem', fontWeight: 500 }}>et horaires</span>
                                </div>
                            </div>

                            <div style={{
                                background: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '1.5rem',
                                padding: isMobile ? '1.75rem' : '2rem',
                                borderTop: '4px solid #9333ea',
                                position: 'relative',
                                overflow: 'hidden',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                            }}>
                                <div style={{ position: 'absolute', top: 0, right: 0, padding: '3rem', background: 'rgba(147, 51, 234, 0.1)', filter: 'blur(40px)', borderRadius: '50%' }} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', position: 'relative', zIndex: 1 }}>
                                    <div style={{ padding: '0.75rem', background: '#f3e8ff', borderRadius: '1rem' }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>
                                    </div>
                                    <h4 style={{ color: '#0f172a', fontSize: '1.35rem', fontWeight: 800 }}>Demandes & documents</h4>
                                </div>
                                <p style={{ color: '#475569', fontSize: '1rem', marginBottom: '2rem', lineHeight: 1.6, position: 'relative', zIndex: 1 }}>
                                    Justificatifs, absences, retards, incidents, demandes client ou documents: WhatsPoint collecte et oriente sans portail supplémentaire.
                                </p>
                                <div style={{ color: '#0f172a', fontSize: '2rem', fontWeight: 800, position: 'relative', zIndex: 1 }}>
                                    Collecte <span style={{ color: '#64748b', fontSize: '1.1rem', fontWeight: 500 }}>et transmission</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* CTA Section */}
            <section style={{
                padding: isMobile ? '2.5rem 4%' : '3.25rem 5%',
                background: '#ffffff',
                textAlign: 'center'
            }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    style={{
                        maxWidth: '800px',
                        margin: '0 auto',
                        background: 'linear-gradient(135deg, #1e3a8a 0%, #4f46e5 100%)',
                        borderRadius: '1.5rem',
                        padding: isMobile ? '2rem 1.25rem' : '2.35rem 2rem'
                    }}
                >
                    <h2 style={{ color: 'white', fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 700, marginBottom: '1rem' }}>
                        {t('landing.cta.title')}
                    </h2>
                    <p style={{ color: '#c7d2fe', marginBottom: '2rem' }}>
                        {t('landing.cta.subtitle')}
                    </p>
                    <div style={{
                        display: 'flex',
                        gap: '1rem',
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                        flexDirection: isMobile ? 'column' : 'row'
                    }}>
                        <button
                            onClick={() => navigate('/onboarding')}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                padding: '1rem 2.5rem',
                                background: 'white',
                                border: 'none',
                                borderRadius: '0.75rem',
                                color: '#1e3a8a',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '1rem'
                            }}
                        >
                            Configurer mon environnement
                        </button>
                        <a
                            href="https://wa.me/33612345678?text=Menu"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                padding: '1rem 2rem',
                                background: 'rgba(255,255,255,0.15)',
                                border: '1px solid rgba(255,255,255,0.3)',
                                borderRadius: '0.75rem',
                                color: 'white',
                                textDecoration: 'none',
                                fontWeight: 500,
                                fontSize: '1rem'
                            }}
                        >
                            <MessageCircle size={20} />
                            {t('landing.cta.demo')}
                        </a>
                    </div>
                </motion.div>
            </section>

            {/* Footer */}
            <footer style={{
                padding: isMobile ? '1.5rem 4%' : '2.25rem 5%',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0'
            }}>
                <div style={{
                    maxWidth: '1200px',
                    margin: '0 auto',
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <MessageCircle size={20} color="#3b82f6" />
                        <span style={{ color: '#64748b', fontSize: '0.9rem' }}>
                            {t('landing.footer.copyright')}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <a href="/legal/notices" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem' }}>
                            {t('landing.footer.legal')}
                        </a>
                        <a href="/legal/privacy" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem' }}>
                            {t('landing.footer.privacy')}
                        </a>
                        <a href="mailto:contact@whatspoint.app" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem' }}>
                            {t('landing.footer.contact')}
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}

// Main export wrapped with VisitorProvider
export default function Landing() {
    return (
        <VisitorProvider>
            <LandingContent />
        </VisitorProvider>
    );
}
