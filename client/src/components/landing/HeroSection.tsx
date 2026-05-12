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
    getHeroTitleKey
} from '../../config/landingVariants';
import { useState, useEffect } from 'react';
import { FileText, Clock as ClockIcon, ArrowRightLeft, CheckCircle2, ShieldCheck, LockKeyhole, Smartphone } from 'lucide-react';

export default function HeroSection() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { countryCode, zone, trafficSource, deviceType } = useVisitor();

    // Get dynamic content based on visitor context
    const heroImageSrc = getHeroImage(countryCode, zone);
    const titleKey = getHeroTitleKey(trafficSource);

    // Mobile vs Desktop layout adjustments
    const isMobile = deviceType === 'mobile';

    // WhatsApp Slides state
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isHovered, setIsHovered] = useState(false);

    const SLIDES = [
        {
            id: 'collect',
            icon: <ClockIcon size={16} />,
            h1: 'Pointage et présence',
            h1Accent: 'sans friction.',
            label: '1. Présence',
            title: 'Le cœur de WhatsPoint.',
            desc: 'Les équipes pointent leur arrivée, leur départ ou leur présence directement dans WhatsApp, avec heure, site, GPS et historique exploitable.',
            userText: 'Bonjour, je prends mon service aux urgences.',
            botText: '✅ Présence enregistrée.\n📍 Service Urgences\n🕐 07:02',
            color: '#22c55e'
        },
        {
            id: 'hr',
            icon: <FileText size={16} />,
            h1: 'Le planning devient',
            h1Accent: 'consultable.',
            label: '2. Planning',
            title: 'Horaires, service, prochain poste.',
            desc: 'En hôpital, restauration, sécurité ou nettoyage, les équipes consultent leurs horaires et reçoivent les changements sans ouvrir un portail.',
            userText: 'Quel est mon planning demain ?',
            botText: '📅 Demain : 07:00 - 14:30\n🏥 Service : Cardiologie\n👤 Référent : Cadre de garde',
            color: '#9333ea'
        },
        {
            id: 'manager',
            icon: <CheckCircle2 size={16} />,
            h1: 'Les demandes terrain',
            h1Accent: 'remontent.',
            label: '3. Demandes',
            title: 'Absence, justificatif, incident, besoin client.',
            desc: 'WhatsPoint collecte les demandes simples autour de la présence: absence, retard, justificatif, changement d’horaire, incident ou intervention.',
            userText: 'Je serai en retard de 20 minutes, transport bloqué.',
            botText: '📝 Information reçue.\nManager notifié.\nStatut : en attente de prise en compte.',
            color: '#f97316'
        },
        {
            id: 'export',
            icon: <ArrowRightLeft size={16} />,
            h1: 'La réponse revient',
            h1Accent: 'dans WhatsApp.',
            label: '4. Notification',
            title: 'Statut, document ou confirmation.',
            desc: 'L’utilisateur n’a pas besoin d’ouvrir un portail métier. Il reçoit le suivi, la décision ou le document directement dans la conversation.',
            userText: 'Avez-vous une mise à jour ?',
            botText: '📩 Intervention planifiée demain à 09:30.\nTechnicien assigné.\nUn rappel sera envoyé automatiquement.',
            color: '#8b5cf6'
        }
    ];
    const slideCount = SLIDES.length;

    useEffect(() => {
        if (isHovered) return;
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slideCount);
        }, 8500);
        return () => clearInterval(timer);
    }, [isHovered, slideCount]);

    return (
        <section style={{
            minHeight: isMobile ? 'auto' : '72vh',
            background: `linear-gradient(135deg, rgba(248, 250, 252, 0.98) 0%, rgba(239, 246, 255, 0.94) 48%, rgba(240, 253, 244, 0.9) 100%), url(${heroImageSrc})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'center',
            padding: isMobile ? '5rem 4% 2rem' : '6rem 5% 1.5rem',
            borderBottom: '1px solid rgba(148, 163, 184, 0.22)',
            color: '#0f172a',
            overflow: 'hidden'
        }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: isMobile ? '1.5rem' : '2.25rem',
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
                        background: 'rgba(37, 99, 235, 0.08)',
                        padding: '0.5rem 1rem',
                        borderRadius: '2rem',
                        marginBottom: '1.1rem',
                        border: '1px solid rgba(37, 99, 235, 0.16)'
                    }}>
                        <Sparkles size={16} color="#2563eb" />
                        <span style={{ color: '#1d4ed8', fontSize: '0.85rem', fontWeight: 600 }}>
                            {t('landing.hero.badge')} • {t(titleKey)}
                        </span>
                    </div>

                    <h1 style={{
                        color: '#0f172a',
                        fontSize: isMobile ? '2.15rem' : '3.65rem',
                        fontWeight: 800,
                        lineHeight: 1.03,
                        marginBottom: '0.85rem',
                        letterSpacing: 0
                    }}>
                        Pointage, présence et planning
                        <span style={{ color: '#2563eb' }}> dans WhatsApp.</span>
                    </h1>

                    <p style={{
                        color: '#475569',
                        fontSize: isMobile ? '1.05rem' : '1.18rem',
                        lineHeight: 1.55,
                        maxWidth: '610px',
                        marginBottom: '1.1rem'
                    }}>
                        Vos équipes pointent, consultent leurs horaires et transmettent leurs demandes
                        sans installer une nouvelle application. WhatsPoint structure tout et l’envoie au bon service.
                    </p>

                    {/* Theme Tabs Navbar */}
                    <div style={{
                        display: 'flex',
                        gap: '0.6rem',
                        flexWrap: 'wrap',
                        marginBottom: '1.4rem'
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
                                    border: currentSlide === idx ? `1px solid ${slide.color}50` : '1px solid rgba(148, 163, 184, 0.26)',
                                    background: currentSlide === idx ? `${slide.color}12` : 'rgba(255, 255, 255, 0.72)',
                                    color: currentSlide === idx ? slide.color : '#475569',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: currentSlide === idx ? '0 10px 22px rgba(15, 23, 42, 0.08)' : 'none'
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
                        style={{ minHeight: isMobile ? '92px' : '68px', marginBottom: '1.25rem' }}
                    >
                        <h2 style={{
                            color: '#0f172a',
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            marginBottom: '0.75rem'
                        }}>
                            {SLIDES[currentSlide].title}
                        </h2>
                        <p style={{
                            color: '#475569',
                            fontSize: '1rem',
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
                            onClick={() => navigate('/onboarding')}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                padding: '1rem 2rem',
                                background: 'rgba(255, 255, 255, 0.78)',
                                border: '1px solid rgba(148, 163, 184, 0.45)',
                                borderRadius: '0.75rem',
                                color: '#0f172a',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: '1rem',
                                width: isMobile ? '100%' : 'auto',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#ffffff';
                                e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.45)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.78)';
                                e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.45)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            Créer mon environnement
                        </button>
                        {isMobile && (
                            <button
                                onClick={() => navigate('/login')}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    padding: '0.95rem 2rem',
                                    background: 'rgba(255, 255, 255, 0.55)',
                                    border: '1px solid rgba(148, 163, 184, 0.45)',
                                    borderRadius: '0.75rem',
                                    color: '#334155',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: '1rem',
                                    width: '100%'
                                }}
                            >
                                Connexion
                            </button>
                        )}
                    </div>

                    {/* Reassurance Badges */}
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: isMobile ? '0.75rem' : '1.5rem',
                        marginTop: '1rem'
                    }}>
                        {[
                            { icon: <ShieldCheck size={17} />, text: t('landing.hero.badges.gdpr', 'Conforme RGPD') },
                            { icon: <LockKeyhole size={17} />, text: t('landing.hero.badges.encrypted', 'Chiffré') },
                            { icon: <Smartphone size={17} />, text: t('landing.hero.badges.noApp', 'Pas d\'app à installer') }
                        ].map((badge, idx) => (
                            <div key={idx} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                color: '#475569',
                                fontSize: '0.9rem',
                                fontWeight: 500
                            }}>
                                <span style={{ display: 'inline-flex', color: '#2563eb' }}>{badge.icon}</span>
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
                            background: '#0f172a',
                            borderRadius: '2.5rem',
                            padding: '0.6rem',
                            boxShadow: '0 28px 70px -24px rgba(15, 23, 42, 0.42)',
                            width: isMobile ? '300px' : '300px',
                            border: '1px solid rgba(15, 23, 42, 0.12)',
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
                                    padding: isMobile ? '0.9rem 0.85rem' : '0.9rem 0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem'
                                }}>
                                    <div style={{
                                        width: '34px',
                                        height: '34px',
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
                                    padding: isMobile ? '1.1rem 0.85rem' : '1.1rem 0.85rem',
                                    flex: 1,
                                    minHeight: '270px',
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
