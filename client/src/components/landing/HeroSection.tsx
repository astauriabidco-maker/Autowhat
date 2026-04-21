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
import { useState, useEffect } from 'react';
import { Camera, FileText, Wrench, Clock as ClockIcon, Shield, ArrowRightLeft, CheckCircle2 } from 'lucide-react';

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

    // WhatsApp Slides state
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isHovered, setIsHovered] = useState(false);

    const SLIDES = [
        {
            id: 'collect',
            icon: <ClockIcon size={16} />,
            h1: 'La donnée part du',
            h1Accent: 'terrain.',
            label: '1. Saisie Terrain',
            title: 'Pointage & Frais.',
            desc: 'La donnée est captée à la source. Vos équipes de terrain démarrent leur journée ou envoient un reçu de péage d\'un simple message WhatsApp.',
            userText: 'Salut, je viens d\'arriver sur le chantier Rivoli 🏗️',
            botText: '✅ Pointage enregistré !\n📍 Chantier Rivoli\n🕐 08:02',
            color: '#22c55e'
        },
        {
            id: 'hr',
            icon: <FileText size={16} />,
            h1: 'L\'IA vous fait gagner',
            h1Accent: '30h / mois.',
            label: '2. Demandes RH',
            title: 'Un assistant RH 24/7.',
            desc: 'L\'IA extrait les infos des photos et répond aux questions RH. Les employés posent leurs congés au chatbot sans déranger l\'administration.',
            userText: 'Je peux poser 2 jours de congés la semaine prochaine ?',
            botText: '📝 Demande pré-remplie.\nSolde restant : 14 jours.\nJ\'envoie au manager pour validation ?',
            color: '#9333ea'
        },
        {
            id: 'manager',
            icon: <CheckCircle2 size={16} />,
            h1: 'L\'encadrement valide en',
            h1Accent: 'un clic.',
            label: '3. Approbation',
            title: 'Validation immédiate.',
            desc: 'Le manager reçoit une alerte (congé, frais, heures sup) sur son téléphone et valide directement dans la conversation WhatsApp.',
            userText: '🔔 Jean a posé 2 jours de congés.\nSolde actuel : 14 jours.\nApprouver ?',
            botText: '✅ Congés validés ! Jean a été notifié et le planning d\'équipe est à jour.',
            color: '#f97316'
        },
        {
            id: 'export',
            icon: <ArrowRightLeft size={16} />,
            h1: 'La clôture de paie coule de',
            h1Accent: 'source.',
            label: '4. Export Paie (Silae)',
            title: 'La paie en pilote automatique.',
            desc: 'En fin de mois, le système transfère l\'ensemble des variables (heures, congés, frais) directement vers Silae ou KPaie via API.',
            userText: 'Exporte les variables de paie d\'Octobre vers Silae.',
            botText: '🚀 Synchronisation réussie !\n✅ 45 collaborateurs mis à jour sur Silae\n✅ 3 450€ de frais intégrés dans KPaie',
            color: '#0ea5e9'
        }
    ];

    useEffect(() => {
        if (isHovered) return;
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
        }, 8500);
        return () => clearInterval(timer);
    }, [isHovered]);

    return (
        <section style={{
            minHeight: '90vh',
            background: `linear-gradient(135deg, rgba(2, 6, 23, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%), url(${heroImageSrc})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'center',
            padding: isMobile ? '6rem 4% 4rem' : '8rem 5% 4rem',
            borderBottom: '1px solid rgba(255,255,255,0.05)'
        }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: isMobile ? '3rem' : '4rem',
                maxWidth: '1250px',
                margin: '0 auto',
                width: '100%',
                alignItems: 'center'
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
                        background: 'rgba(34, 197, 94, 0.1)',
                        padding: '0.5rem 1rem',
                        borderRadius: '2rem',
                        marginBottom: '1.5rem',
                        border: '1px solid rgba(34, 197, 94, 0.2)'
                    }}>
                        <Sparkles size={16} color="#4ade80" />
                        <span style={{ color: '#4ade80', fontSize: '0.85rem', fontWeight: 600 }}>
                            {t('landing.hero.badge')} • {t(titleKey)}
                        </span>
                    </div>

                    {/* Dynamic Title */}
                    <motion.div
                        key={`h1-${currentSlide}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        style={{ minHeight: isMobile ? '90px' : '110px' }}
                    >
                        <h1 style={{
                            color: 'white',
                            fontSize: isMobile ? '2.5rem' : '4.2rem',
                            fontWeight: 800,
                            lineHeight: 1.1,
                            marginBottom: '1.5rem',
                            letterSpacing: '-0.02em'
                        }}>
                            {SLIDES[currentSlide].h1}{' '}
                            <span style={{ color: '#4ade80' }}>
                                {SLIDES[currentSlide].h1Accent}
                            </span>
                        </h1>
                    </motion.div>

                    {/* Theme Tabs Navbar */}
                    <div style={{
                        display: 'flex',
                        gap: '0.6rem',
                        flexWrap: 'wrap',
                        marginBottom: '2rem'
                    }}>
                        {SLIDES.map((slide, idx) => (
                            <button
                                key={slide.id}
                                onClick={() => setCurrentSlide(idx)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    padding: '0.5rem 0.8rem',
                                    borderRadius: '1rem',
                                    border: currentSlide === idx ? `1px solid ${slide.color}50` : '1px solid rgba(255,255,255,0.1)',
                                    background: currentSlide === idx ? `${slide.color}15` : 'rgba(255,255,255,0.03)',
                                    color: currentSlide === idx ? slide.color : '#94a3b8',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: currentSlide === idx ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                                }}
                            >
                                {slide.icon}
                                {slide.label}
                            </button>
                        ))}
                    </div>

                    {/* Dynamic Slide Content */}
                    <motion.div
                        key={currentSlide}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ minHeight: isMobile ? '120px' : '100px', marginBottom: '2.5rem' }}
                    >
                        <h2 style={{
                            color: 'white',
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            marginBottom: '0.75rem'
                        }}>
                            {SLIDES[currentSlide].title}
                        </h2>
                        <p style={{
                            color: '#e2e8f0',
                            fontSize: '1.1rem',
                            lineHeight: 1.6,
                            maxWidth: '550px'
                        }}>
                            {SLIDES[currentSlide].desc}
                        </p>
                    </motion.div>

                    {/* CTAs */}
                    <div style={{
                        display: 'flex',
                        gap: '1rem',
                        flexWrap: 'wrap',
                        flexDirection: isMobile ? 'column' : 'row'
                    }}>
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
                                fontWeight: 700,
                                fontSize: '1rem',
                                boxShadow: '0 10px 30px rgba(34, 197, 94, 0.3)',
                                width: isMobile ? '100%' : 'auto',
                                transition: 'transform 0.2s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <MessageCircle size={20} />
                            {t('landing.hero.demo')}
                        </a>
                        <button
                            onClick={() => navigate('/register')}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                padding: '1rem 2rem',
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '0.75rem',
                                color: 'white',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: '1rem',
                                width: isMobile ? '100%' : 'auto',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                            }}
                        >
                            Démarrer gratuitement
                        </button>
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
                                fontSize: '0.9rem',
                                fontWeight: 500
                            }}>
                                <span>{badge.emoji}</span>
                                <span>{badge.text}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Right: WhatsApp Mockup */}
                <motion.div
                    initial={{ opacity: 0, x: isMobile ? 0 : 50, y: isMobile ? 30 : 0 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        order: 2,
                        marginTop: isMobile ? '2rem' : 0,
                        width: '100%'
                    }}
                >
                        <div style={{
                            background: '#1e293b',
                            borderRadius: '2.5rem',
                            padding: '0.6rem',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                            width: '340px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            position: 'relative'
                        }}>
                            {/* Phone Notch/Inner Border */}
                            <div style={{
                                background: '#0b141a',
                                borderRadius: '2rem',
                                overflow: 'hidden',
                                height: '100%',
                                border: '1px solid #334155',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                {/* Phone Header */}
                                <div style={{
                                    background: '#202c33',
                                    padding: '1.2rem 1rem 1rem',
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
                                    background: '#ece5dd', // Classic WhatsApp Light background
                                    backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
                                    backgroundSize: 'contain',
                                    padding: '1.5rem 1rem',
                                    flex: 1,
                                    minHeight: '340px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center'
                                }}>
                                {/* Sliding Conversation Content */}
                                <div key={currentSlide}>
                                    {/* Active feature badge */}
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3 }}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'center',
                                            marginBottom: '1rem'
                                        }}
                                    >
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            background: `${SLIDES[currentSlide].color}20`,
                                            color: SLIDES[currentSlide].color,
                                            padding: '0.3rem 0.8rem',
                                            borderRadius: '1rem',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            border: `1px solid ${SLIDES[currentSlide].color}50`
                                        }}>
                                            {SLIDES[currentSlide].icon}
                                            {SLIDES[currentSlide].label}
                                        </span>
                                    </motion.div>

                                    {/* User message */}
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8, x: 20 }}
                                        animate={{ opacity: 1, scale: 1, x: 0 }}
                                        transition={{ delay: 0.4, duration: 0.4 }}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'flex-end',
                                            marginBottom: '0.75rem'
                                        }}
                                    >
                                        <div style={{
                                            background: '#005c4b',
                                            padding: '0.75rem 1rem',
                                            borderRadius: '0.75rem 0.75rem 0 0.75rem',
                                            maxWidth: '85%',
                                            boxShadow: '0 1px 1px rgba(0,0,0,0.1)'
                                        }}>
                                            <span style={{ color: '#e9edef', fontSize: '0.9rem' }}>
                                                {SLIDES[currentSlide].userText}
                                            </span>
                                            <div style={{ color: '#8696a0', fontSize: '0.7rem', textAlign: 'right', marginTop: '0.25rem' }}>
                                                ✓✓
                                            </div>
                                        </div>
                                    </motion.div>

                                    {/* Bot Typing Indicator */}
                                    <motion.div
                                        initial={{ opacity: 0, height: 0, display: 'none' }}
                                        animate={{ opacity: [0, 1, 1, 0], height: [0, 40, 40, 0], display: ['none', 'flex', 'flex', 'none'] }}
                                        transition={{ delay: 1.2, duration: 1.8, times: [0, 0.1, 0.9, 1] }}
                                        style={{ display: 'flex', justifyContent: 'flex-start', overflow: 'hidden', marginBottom: '0.75rem' }}
                                    >
                                        <div style={{
                                            background: '#202c33', padding: '0.5rem 1rem', 
                                            borderRadius: '0.75rem 0.75rem 0.75rem 0', boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
                                        }}>
                                            <span style={{ color: '#8696a0', fontSize: '0.8rem', fontStyle: 'italic', letterSpacing: '2px' }}>•••</span>
                                        </div>
                                    </motion.div>

                                    {/* Bot response */}
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8, x: -20, display: 'none' }}
                                        animate={{ opacity: 1, scale: 1, x: 0, display: 'flex' }}
                                        transition={{ delay: 3.0, duration: 0.4 }}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'flex-start',
                                            marginBottom: '0.75rem'
                                        }}
                                    >
                                        <div style={{
                                            background: '#202c33',
                                            padding: '0.75rem 1rem',
                                            borderRadius: '0.75rem 0.75rem 0.75rem 0',
                                            maxWidth: '90%',
                                            boxShadow: '0 1px 1px rgba(0,0,0,0.1)'
                                        }}>
                                            <span style={{ color: '#e9edef', fontSize: '0.9rem', whiteSpace: 'pre-line' }}>
                                                {SLIDES[currentSlide].botText}
                                            </span>
                                            <div style={{ color: '#8696a0', fontSize: '0.7rem', marginTop: '0.4rem' }}>
                                                Maintenant
                                            </div>
                                        </div>
                                    </motion.div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
