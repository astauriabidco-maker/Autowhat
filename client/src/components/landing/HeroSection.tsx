import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    MessageCircle,
    Sparkles,
    Bot
} from 'lucide-react';
import { useVisitor } from '../../context/VisitorContext';
import {
    getHeroImage,
    getHeroTitleKey,
    HERO_SUBTITLES
} from '../../config/landingVariants';

export default function HeroSection() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { countryCode, zone, trafficSource, deviceType } = useVisitor();

    // Get dynamic content based on visitor context
    const heroImageSrc = getHeroImage(countryCode, zone);
    const titleKey = getHeroTitleKey(trafficSource);
    const subtitleKey = trafficSource && HERO_SUBTITLES[trafficSource]
        ? HERO_SUBTITLES[trafficSource].key
        : HERO_SUBTITLES.default.key;

    // Mobile vs Desktop layout adjustments
    const isMobile = deviceType === 'mobile';

    return (
        <section style={{
            minHeight: '100vh',
            background: `linear-gradient(135deg, rgba(30, 58, 138, 0.95) 0%, rgba(49, 46, 129, 0.9) 50%, rgba(15, 23, 42, 0.95) 100%), url(${heroImageSrc})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'center',
            padding: isMobile ? '0 4%' : '0 5%',
            paddingTop: '80px'
        }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: isMobile ? '2rem' : '4rem',
                maxWidth: '1400px',
                margin: '0 auto',
                width: '100%'
            }}>
                {/* Left: Text */}
                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8 }}
                    style={{ order: isMobile ? 2 : 1 }}
                >
                    {/* Badge */}
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'rgba(59, 130, 246, 0.2)',
                        padding: '0.5rem 1rem',
                        borderRadius: '2rem',
                        marginBottom: '1.5rem'
                    }}>
                        <Sparkles size={16} color="#60a5fa" />
                        <span style={{ color: '#60a5fa', fontSize: '0.85rem' }}>
                            {t('landing.hero.badge')}
                        </span>
                    </div>

                    {/* Dynamic Title */}
                    <h1 style={{
                        color: 'white',
                        fontSize: isMobile ? '2rem' : '3.5rem',
                        fontWeight: 800,
                        lineHeight: 1.1,
                        marginBottom: '1.5rem'
                    }}>
                        {t(titleKey)}{' '}
                        <span style={{ color: '#60a5fa' }}>
                            {t('landing.hero.titleAccent')}
                        </span>
                    </h1>

                    {/* Dynamic Subtitle */}
                    <p style={{
                        color: '#94a3b8',
                        fontSize: isMobile ? '1rem' : '1.25rem',
                        lineHeight: 1.6,
                        marginBottom: '1rem',
                        maxWidth: '500px'
                    }}>
                        {t(subtitleKey)}
                    </p>
                    <p style={{
                        color: '#e2e8f0',
                        fontSize: isMobile ? '1rem' : '1.25rem',
                        fontWeight: 600,
                        lineHeight: 1.6,
                        marginBottom: '2rem',
                        maxWidth: '500px'
                    }}>
                        {t('landing.hero.subtitle2')}
                    </p>

                    {/* CTAs */}
                    <div style={{
                        display: 'flex',
                        gap: '1rem',
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
                                padding: '1rem 2rem',
                                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                                border: 'none',
                                borderRadius: '0.75rem',
                                color: 'white',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '1rem',
                                boxShadow: '0 10px 30px rgba(59, 130, 246, 0.4)',
                                width: isMobile ? '100%' : 'auto'
                            }}
                        >
                            {t('landing.hero.cta')}
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
                                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                borderRadius: '0.75rem',
                                color: 'white',
                                textDecoration: 'none',
                                fontWeight: 600,
                                fontSize: '1rem',
                                boxShadow: '0 10px 30px rgba(34, 197, 94, 0.3)',
                                width: isMobile ? '100%' : 'auto'
                            }}
                        >
                            <MessageCircle size={20} />
                            {t('landing.hero.demo')}
                        </a>
                    </div>

                    {/* Reassurance Badges */}
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: isMobile ? '0.75rem' : '1.5rem',
                        marginTop: '1.5rem'
                    }}>
                        {[
                            { emoji: '🔒', text: t('landing.hero.badges.gdpr', 'Conforme RGPD') },
                            { emoji: '🔐', text: t('landing.hero.badges.encrypted', 'Chiffré') },
                            { emoji: '📲', text: t('landing.hero.badges.noApp', 'Pas d\'app à installer') }
                        ].map((badge, idx) => (
                            <div key={idx} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                color: '#94a3b8',
                                fontSize: '0.85rem'
                            }}>
                                <span>{badge.emoji}</span>
                                <span>{badge.text}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Right: WhatsApp Mockup (hidden on mobile for cleaner UX) */}
                {!isMobile && (
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            order: 2
                        }}
                    >
                        <div style={{
                            background: '#1f2937',
                            borderRadius: '2rem',
                            padding: '1rem',
                            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                            width: '320px'
                        }}>
                            {/* Phone Header */}
                            <div style={{
                                background: '#075e54',
                                borderRadius: '1rem 1rem 0 0',
                                padding: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem'
                            }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Bot size={20} color="white" />
                                </div>
                                <div>
                                    <div style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem' }}>
                                        WhatsPoint Bot
                                    </div>
                                    <div style={{ color: '#25d366', fontSize: '0.75rem' }}>
                                        en ligne
                                    </div>
                                </div>
                            </div>

                            {/* Chat Messages */}
                            <div style={{
                                background: '#0b141a',
                                padding: '1rem',
                                minHeight: '280px'
                            }}>
                                {/* User message */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    marginBottom: '0.75rem'
                                }}>
                                    <div style={{
                                        background: '#005c4b',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '0.75rem 0.75rem 0 0.75rem',
                                        maxWidth: '80%'
                                    }}>
                                        <span style={{ color: 'white', fontSize: '0.9rem' }}>Hi 👋</span>
                                        <div style={{ color: '#8696a0', fontSize: '0.7rem', textAlign: 'right', marginTop: '0.25rem' }}>
                                            08:02 ✓✓
                                        </div>
                                    </div>
                                </div>

                                {/* Bot response */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'flex-start',
                                    marginBottom: '0.75rem'
                                }}>
                                    <div style={{
                                        background: '#1f2c34',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '0.75rem 0.75rem 0.75rem 0',
                                        maxWidth: '85%'
                                    }}>
                                        <span style={{ color: 'white', fontSize: '0.9rem' }}>
                                            ✅ <strong>Pointage enregistré !</strong>
                                            <br />
                                            <span style={{ color: '#8696a0' }}>
                                                📍 Chantier Rivoli<br />
                                                🕐 08:02
                                            </span>
                                        </span>
                                        <div style={{ color: '#8696a0', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                                            08:02
                                        </div>
                                    </div>
                                </div>

                                {/* Quick actions */}
                                <div style={{
                                    display: 'flex',
                                    gap: '0.5rem',
                                    flexWrap: 'wrap',
                                    marginTop: '1rem'
                                }}>
                                    {['📊 Stats', '📄 Documents', '💸 Frais'].map(btn => (
                                        <div key={btn} style={{
                                            background: 'rgba(37, 211, 102, 0.1)',
                                            border: '1px solid #25d366',
                                            padding: '0.5rem 0.75rem',
                                            borderRadius: '1rem',
                                            color: '#25d366',
                                            fontSize: '0.8rem'
                                        }}>
                                            {btn}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </section>
    );
}
