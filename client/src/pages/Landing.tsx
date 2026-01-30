import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import axios from 'axios';
import {
    MessageCircle,
    Check,
    Users,
    Loader2,
    Globe,
    ChevronDown
} from 'lucide-react';
import { VisitorProvider, useVisitor } from '../context/VisitorContext';
import HeroSection from '../components/landing/HeroSection';
import Testimonials from '../components/landing/Testimonials';
import TrustSection from '../components/landing/TrustSection';
import FeaturesGrid from '../components/landing/FeaturesGrid';
import EnterpriseSection from '../components/landing/EnterpriseSection';

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
                setPlans(res.data.plans);
            })
            .catch(err => {
                console.error('Error fetching offer:', err);
                axios.get('/api/plans')
                    .then(res => setPlans(res.data))
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
        <div style={{ minHeight: '100vh', background: '#0f172a' }}>
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
                background: 'rgba(15, 23, 42, 0.9)',
                backdropFilter: 'blur(10px)',
                zIndex: 100,
                borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MessageCircle size={28} color="#3b82f6" />
                    <span style={{ color: 'white', fontWeight: 700, fontSize: '1.25rem' }}>
                        WhatsPoint
                    </span>
                </div>

                {/* Desktop navigation */}
                {!isMobile && (
                    <div style={{ display: 'flex', gap: '2rem' }}>
                        <a href="#features" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem' }}>
                            {t('landing.nav.features')}
                        </a>
                        <a href="#sectors" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem' }}>
                            {t('landing.nav.sectors')}
                        </a>
                        <a href="#testimonials" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem' }}>
                            {t('landing.nav.testimonials')}
                        </a>
                        <a href="#pricing" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem' }}>
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
                                background: 'rgba(255,255,255,0.1)',
                                border: 'none',
                                borderRadius: '0.5rem',
                                color: 'white',
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
                                background: '#1e293b',
                                borderRadius: '0.5rem',
                                border: '1px solid rgba(255,255,255,0.1)',
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
                                            background: i18n.language === lang ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                                            border: 'none',
                                            color: 'white',
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
                                border: 'none',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                fontWeight: 500,
                                fontSize: '0.9rem'
                            }}
                        >
                            {t('common.login')}
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/register')}
                        style={{
                            padding: '0.6rem 1.5rem',
                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            border: 'none',
                            borderRadius: '0.5rem',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.9rem'
                        }}
                    >
                        {t('common.freeTrial')}
                    </button>
                </div>
            </nav>

            {/* Hero Section - Dynamic based on visitor context */}
            <HeroSection />

            {/* Trust Section - Privacy Shield */}
            <TrustSection />

            {/* Pocket HR Suite - Bento Grid */}
            <section id="features">
                <FeaturesGrid />
            </section>

            {/* Enterprise Section - Scale Features */}
            <EnterpriseSection />

            {/* Testimonials Section - Dynamic based on visitor country */}
            <section id="testimonials">
                <Testimonials />
            </section>

            {/* Pricing Section */}
            <section id="pricing" style={{
                padding: isMobile ? '4rem 4%' : '6rem 5%',
                background: '#0f172a'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        style={{ textAlign: 'center', marginBottom: '4rem' }}
                    >
                        <h2 style={{ color: 'white', fontSize: isMobile ? '1.75rem' : '2.5rem', fontWeight: 700, marginBottom: '1rem' }}>
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
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                            <Loader2 size={32} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : `repeat(${Math.min(plans.length, 3)}, 1fr)`,
                            gap: '2rem',
                            alignItems: 'stretch'
                        }}>
                            {plans.map((plan, idx) => (
                                <motion.div
                                    key={plan.id}
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: idx * 0.1 }}
                                    viewport={{ once: true }}
                                    style={{
                                        background: plan.isPopular
                                            ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)'
                                            : 'rgba(255,255,255,0.03)',
                                        border: plan.isPopular
                                            ? '2px solid #3b82f6'
                                            : '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '1.5rem',
                                        padding: '2.5rem 2rem',
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
                                        color: 'white',
                                        fontSize: '1.5rem',
                                        fontWeight: 700,
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
                                        <span style={{ color: 'white', fontSize: isMobile ? '2rem' : '3rem', fontWeight: 800 }}>
                                            {formatPrice(plan.price, plan.currency)}
                                        </span>
                                        <span style={{ color: '#64748b', fontSize: '1rem' }}>
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
                                                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                                                    {feature}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>

                                    {/* CTA button */}
                                    <button
                                        onClick={() => navigate('/register')}
                                        style={{
                                            width: '100%',
                                            padding: '1rem',
                                            background: plan.isPopular
                                                ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                                                : 'rgba(255,255,255,0.1)',
                                            border: plan.isPopular ? 'none' : '1px solid rgba(255,255,255,0.2)',
                                            borderRadius: '0.75rem',
                                            color: 'white',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            fontSize: '1rem',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        {t('landing.pricing.startTrial')}
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* CTA Section */}
            <section style={{
                padding: isMobile ? '4rem 4%' : '6rem 5%',
                background: '#0f172a',
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
                        padding: isMobile ? '3rem 1.5rem' : '4rem 2rem'
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
                            onClick={() => navigate('/register')}
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
                            {t('landing.cta.button')}
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
                padding: isMobile ? '2rem 4%' : '3rem 5%',
                background: '#0f172a',
                borderTop: '1px solid rgba(255,255,255,0.1)'
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
                        <a href="mailto:contact@whatspoint.fr" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem' }}>
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
