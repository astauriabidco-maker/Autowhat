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
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useState, useEffect } from 'react';
import {
    FileText,
    Clock as ClockIcon,
    ArrowRightLeft,
    CheckCircle2,
    ShieldCheck,
    LockKeyhole,
    Smartphone,
    BarChart3,
    CalendarDays,
    MapPin,
    UsersRound
} from 'lucide-react';

export default function HeroSection() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { countryCode, zone, trafficSource, deviceType } = useVisitor();

    // Get dynamic content based on visitor context
    const heroImageSrc = getHeroImage(countryCode, zone);
    const titleKey = getHeroTitleKey(trafficSource);

    // Compact landing layout for mobile and portrait tablets.
    const isCompactViewport = useMediaQuery('(max-width: 900px)');
    const isTabletPortrait = useMediaQuery('(min-width: 768px) and (max-width: 900px)');
    const isMobile = deviceType === 'mobile' || isCompactViewport;
    const isNarrowMobile = isMobile && !isTabletPortrait;
    const stackActions = isMobile && !isTabletPortrait;

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
            padding: isMobile ? (isTabletPortrait ? '5.25rem 5% 2rem' : '3.45rem 4.5% 1rem') : '6rem 5% 1.5rem',
            borderBottom: '1px solid rgba(148, 163, 184, 0.22)',
            color: '#0f172a',
            overflow: 'hidden'
        }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: isNarrowMobile ? '0.75rem' : (isMobile ? '1rem' : '2.25rem'),
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
                    style={{ order: 1, minWidth: 0 }}
                >
                    {/* Badge */}
                    <div style={{
                        display: isNarrowMobile ? 'none' : 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'rgba(37, 99, 235, 0.08)',
                        padding: isMobile ? '0.45rem 0.75rem' : '0.5rem 1rem',
                        borderRadius: '2rem',
                        marginBottom: isMobile ? '0.85rem' : '1.1rem',
                        border: '1px solid rgba(37, 99, 235, 0.16)',
                        maxWidth: '100%'
                    }}>
                        <Sparkles size={isMobile ? 14 : 16} color="#2563eb" style={{ flexShrink: 0 }} />
                        <span style={{ color: '#1d4ed8', fontSize: isMobile ? '0.76rem' : '0.85rem', fontWeight: 600, whiteSpace: isMobile ? 'normal' : 'nowrap' }}>
                            {isMobile ? 'Pointage, planning et demandes terrain' : `${t('landing.hero.badge')} • ${t(titleKey)}`}
                        </span>
                    </div>

                    <h1 style={{
                        color: '#0f172a',
                        fontSize: isMobile ? (isTabletPortrait ? '2.45rem' : '1.54rem') : '3.65rem',
                        fontWeight: 850,
                        lineHeight: isMobile ? (isTabletPortrait ? 1.06 : 1.08) : 1.03,
                        marginBottom: isMobile ? '0.55rem' : '0.85rem',
                        letterSpacing: 0
                    }}>
                        {isMobile ? (
                            <>
                                Pointer et voir son planning
                                <span style={{ color: '#2563eb' }}> dans WhatsApp.</span>
                            </>
                        ) : (
                            <>
                                WhatsApp pour pointer, planifier et remonter
                                <span style={{ color: '#2563eb' }}> le terrain.</span>
                            </>
                        )}
                    </h1>

                    <p style={{
                        color: '#475569',
                        fontSize: isMobile ? (isTabletPortrait ? '1.04rem' : '0.88rem') : '1.18rem',
                        lineHeight: isMobile ? (isTabletPortrait ? 1.52 : 1.42) : 1.55,
                        maxWidth: isMobile ? (isTabletPortrait ? '620px' : '315px') : '610px',
                        marginBottom: isMobile ? '0.65rem' : '1.1rem'
                    }}>
                        {isMobile
                            ? 'Présences, horaires et demandes arrivent au bon service, sans nouvelle application.'
                            : 'Vos équipes utilisent WhatsApp. WhatsPoint transforme leurs messages en présences, plannings, justificatifs et demandes exploitables par vos services métier.'}
                    </p>

                    {isMobile ? null : (
                        <div style={{
                            display: 'flex',
                            gap: '0.6rem',
                            flexWrap: 'wrap',
                            margin: '0 0 1.4rem',
                            padding: 0
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
                                        boxShadow: currentSlide === idx ? '0 10px 22px rgba(15, 23, 42, 0.08)' : 'none',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {slide.icon}
                                    {slide.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {!isMobile && (
                        <motion.div
                            key={currentSlide}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            style={{ minHeight: '68px', marginBottom: '1.25rem' }}
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
                    )}

                    {/* CTAs */}
                    <div style={{
                        display: 'flex',
                        gap: isNarrowMobile ? '0.5rem' : (isMobile ? '0.65rem' : '1rem'),
                        flexWrap: 'wrap',
                        flexDirection: stackActions ? 'column' : 'row',
                        alignItems: isMobile ? 'stretch' : 'center',
                        maxWidth: isNarrowMobile ? '315px' : 'none'
                    }}>
                        {isNarrowMobile ? (
                            <>
                                <button
                                    onClick={() => navigate('/onboarding')}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0.78rem 1rem',
                                        background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                                        border: 'none',
                                        borderRadius: '0.75rem',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontWeight: 800,
                                        fontSize: '0.92rem',
                                        width: '100%',
                                        boxShadow: '0 12px 26px rgba(37, 99, 235, 0.25)'
                                    }}
                                >
                                    Créer mon espace
                                </button>
                                <a
                                    href="https://wa.me/33612345678?text=Menu"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.45rem',
                                        padding: '0.72rem 1rem',
                                        background: 'rgba(34, 197, 94, 0.1)',
                                        border: '1px solid rgba(34, 197, 94, 0.3)',
                                        borderRadius: '0.75rem',
                                        color: '#15803d',
                                        textDecoration: 'none',
                                        fontWeight: 800,
                                        fontSize: '0.9rem',
                                        width: '100%'
                                    }}
                                >
                                    <MessageCircle size={18} style={{ flexShrink: 0 }} />
                                    Démo WhatsApp
                                </a>
                                <button
                                    onClick={() => navigate('/login')}
                                    style={{
                                        alignSelf: 'center',
                                        padding: '0.3rem 0.5rem',
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#334155',
                                        cursor: 'pointer',
                                        fontWeight: 800,
                                        fontSize: '0.88rem'
                                    }}
                                >
                                    Connexion
                                </button>
                            </>
                        ) : (
                            <>
                        <a
                            href="https://wa.me/33612345678?text=Menu"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: isMobile ? 'flex-start' : 'center',
                                gap: '0.5rem',
                                padding: isMobile ? '0.78rem 1rem 0.78rem 1.1rem' : '1rem 2rem',
                                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                borderRadius: '0.75rem',
                                color: 'white',
                                textDecoration: 'none',
                                fontWeight: 700,
                                fontSize: isMobile ? '0.94rem' : '1rem',
                                boxShadow: '0 10px 30px rgba(34, 197, 94, 0.3)',
                                width: stackActions ? '100%' : 'auto',
                                transition: 'transform 0.2s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <MessageCircle size={20} style={{ flexShrink: 0 }} />
                            Démo WhatsApp
                        </a>
                        <button
                            onClick={() => navigate('/onboarding')}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: isMobile ? 'flex-start' : 'center',
                                gap: '0.5rem',
                                padding: isMobile ? '0.78rem 1rem 0.78rem 1.1rem' : '1rem 2rem',
                                background: 'rgba(255, 255, 255, 0.78)',
                                border: '1px solid rgba(148, 163, 184, 0.45)',
                                borderRadius: '0.75rem',
                                color: '#0f172a',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: isMobile ? '0.94rem' : '1rem',
                                width: stackActions ? '100%' : 'auto',
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
                            {isMobile ? 'Créer mon espace' : 'Créer mon environnement'}
                        </button>
                        {isMobile && (
                            <button
                                onClick={() => navigate('/login')}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-start',
                                    gap: '0.5rem',
                                    padding: '0.76rem 1rem 0.76rem 1.1rem',
                                    background: 'rgba(255, 255, 255, 0.55)',
                                    border: '1px solid rgba(148, 163, 184, 0.45)',
                                    borderRadius: '0.75rem',
                                    color: '#334155',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: '0.94rem',
                                    width: stackActions ? '100%' : 'auto'
                                }}
                            >
                                Connexion
                            </button>
                        )}
                            </>
                        )}
                    </div>

                    {/* Reassurance Badges */}
                    {!isMobile && <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '1.5rem',
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
                    </div>}
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
                        flexDirection: isMobile ? 'column' : 'row',
                        gap: isMobile ? '0.75rem' : '1rem',
                        order: 2,
                        marginTop: isMobile ? '0.65rem' : 0,
                        width: '100%'
                    }}
                >
                    {isNarrowMobile ? (
                        <div style={{
                            width: '100%',
                            maxWidth: '315px',
                            display: 'grid',
                            gap: '0.55rem'
                        }}>
                            <div style={{
                                background: '#0f172a',
                                border: '1px solid rgba(15, 23, 42, 0.14)',
                                borderRadius: '1rem',
                                overflow: 'hidden',
                                boxShadow: '0 20px 44px -24px rgba(15, 23, 42, 0.45)'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.7rem 0.8rem',
                                    background: '#202c33'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                                        <span style={{
                                            width: '30px',
                                            height: '30px',
                                            borderRadius: '50%',
                                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                            display: 'grid',
                                            placeItems: 'center',
                                            color: '#ffffff'
                                        }}>
                                            <Bot size={17} />
                                        </span>
                                        <span>
                                            <strong style={{ display: 'block', color: '#ffffff', fontSize: '0.83rem' }}>
                                                WhatsPoint Bot
                                            </strong>
                                            <span style={{ color: '#22c55e', fontSize: '0.72rem', fontWeight: 700 }}>
                                                en ligne
                                            </span>
                                        </span>
                                    </div>
                                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 700 }}>07:02</span>
                                </div>
                                <div style={{
                                    padding: '0.75rem',
                                    background: '#ece5dd',
                                    display: 'grid',
                                    gap: '0.55rem'
                                }}>
                                    <div style={{
                                        justifySelf: 'end',
                                        maxWidth: '86%',
                                        background: '#dcf8c6',
                                        color: '#0f172a',
                                        borderRadius: '0.75rem 0.75rem 0 0.75rem',
                                        padding: '0.55rem 0.65rem',
                                        fontSize: '0.78rem',
                                        fontWeight: 650,
                                        lineHeight: 1.35
                                    }}>
                                        Je prends mon service aux urgences.
                                    </div>
                                    <div style={{
                                        justifySelf: 'start',
                                        maxWidth: '90%',
                                        background: '#ffffff',
                                        color: '#0f172a',
                                        borderRadius: '0.75rem 0.75rem 0.75rem 0',
                                        padding: '0.55rem 0.65rem',
                                        fontSize: '0.78rem',
                                        lineHeight: 1.4,
                                        boxShadow: '0 1px 1px rgba(15, 23, 42, 0.08)'
                                    }}>
                                        <strong style={{ color: '#16a34a' }}>Présence enregistrée</strong><br />
                                        Site validé · Manager notifié
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                background: 'rgba(255, 255, 255, 0.9)',
                                border: '1px solid rgba(148, 163, 184, 0.28)',
                                borderRadius: '1rem',
                                padding: '0.75rem',
                                boxShadow: '0 16px 38px -26px rgba(15, 23, 42, 0.38)'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: '0.55rem'
                                }}>
                                    <span style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 800 }}>
                                        Vue manager
                                    </span>
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                        color: '#2563eb',
                                        fontSize: '0.72rem',
                                        fontWeight: 800
                                    }}>
                                        <BarChart3 size={14} />
                                        temps réel
                                    </span>
                                </div>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: '0.45rem'
                                }}>
                                    {[
                                        { label: 'Présents', value: '42', color: '#16a34a' },
                                        { label: 'Alertes', value: '3', color: '#ea580c' },
                                        { label: 'Planning', value: '2', color: '#2563eb' }
                                    ].map((metric) => (
                                        <div key={metric.label} style={{
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '0.75rem',
                                            background: '#f8fafc',
                                            padding: '0.48rem 0.4rem',
                                            minWidth: 0
                                        }}>
                                            <strong style={{ display: 'block', color: metric.color, fontSize: '1rem', lineHeight: 1 }}>
                                                {metric.value}
                                            </strong>
                                            <span style={{ display: 'block', color: '#64748b', fontSize: '0.65rem', fontWeight: 750, marginTop: '0.25rem' }}>
                                                {metric.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                    <>
                        <div style={{
                            background: '#0f172a',
                            borderRadius: isMobile ? '1.8rem' : '2.5rem',
                            padding: isMobile ? '0.45rem' : '0.6rem',
                            boxShadow: '0 28px 70px -24px rgba(15, 23, 42, 0.42)',
                            width: isMobile ? (isTabletPortrait ? '320px' : 'min(100%, 260px)') : '300px',
                            border: '1px solid rgba(15, 23, 42, 0.12)',
                            position: 'relative'
                        }}>
                            {/* Phone Notch/Inner Border */}
                            <div style={{
                                background: '#0b141a',
                                borderRadius: isMobile ? '1.45rem' : '2rem',
                                overflow: 'hidden',
                                height: '100%',
                                border: '1px solid #334155',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                {/* Phone Header */}
                                <div style={{
                                    background: '#202c33',
                                    padding: isMobile ? '0.75rem' : '0.9rem 0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem'
                                }}>
                                    <div style={{
                                        width: isMobile ? '30px' : '34px',
                                        height: isMobile ? '30px' : '34px',
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
                                    padding: isMobile ? '0.85rem 0.7rem' : '1.1rem 0.85rem',
                                    flex: 1,
                                    minHeight: isMobile ? (isTabletPortrait ? '245px' : '185px') : '270px',
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
                                            marginBottom: isMobile ? '0.7rem' : '1rem'
                                        }}
                                    >
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            background: `${SLIDES[currentSlide].color}20`,
                                            color: SLIDES[currentSlide].color,
                                            padding: isMobile ? '0.25rem 0.65rem' : '0.3rem 0.8rem',
                                            borderRadius: '1rem',
                                            fontSize: isMobile ? '0.7rem' : '0.75rem',
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
                                            padding: isMobile ? '0.6rem 0.75rem' : '0.75rem 1rem',
                                            borderRadius: '0.75rem 0.75rem 0 0.75rem',
                                            maxWidth: '85%',
                                            boxShadow: '0 1px 1px rgba(0,0,0,0.1)'
                                        }}>
                                            <span style={{ color: '#e9edef', fontSize: isMobile ? '0.82rem' : '0.9rem' }}>
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
                                            background: '#202c33', padding: isMobile ? '0.4rem 0.8rem' : '0.5rem 1rem', 
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
                                            padding: isMobile ? '0.6rem 0.75rem' : '0.75rem 1rem',
                                            borderRadius: '0.75rem 0.75rem 0.75rem 0',
                                            maxWidth: '90%',
                                            boxShadow: '0 1px 1px rgba(0,0,0,0.1)'
                                        }}>
                                            <span style={{ color: '#e9edef', fontSize: isMobile ? '0.82rem' : '0.9rem', whiteSpace: 'pre-line' }}>
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
                    <div style={{
                        width: isMobile ? (isTabletPortrait ? '320px' : 'min(100%, 260px)') : '285px',
                        background: 'rgba(255, 255, 255, 0.88)',
                        border: '1px solid rgba(148, 163, 184, 0.28)',
                        borderRadius: isMobile ? '1rem' : '1.25rem',
                        padding: isMobile ? '0.85rem' : '1rem',
                        boxShadow: '0 24px 60px -30px rgba(15, 23, 42, 0.38)'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: isMobile ? '0.7rem' : '1rem'
                        }}>
                            <div>
                                <p style={{ margin: 0, color: '#64748b', fontSize: '0.75rem', fontWeight: 700 }}>
                                    Dashboard manager
                                </p>
                                <h3 style={{ margin: '0.15rem 0 0', color: '#0f172a', fontSize: isMobile ? '0.96rem' : '1.05rem', fontWeight: 850 }}>
                                    Aujourd'hui
                                </h3>
                            </div>
                            <span style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '0.75rem',
                                display: 'grid',
                                placeItems: 'center',
                                background: '#dbeafe',
                                color: '#2563eb'
                            }}>
                                <BarChart3 size={19} />
                            </span>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '0.6rem',
                            marginBottom: isMobile ? '0.55rem' : '0.8rem'
                        }}>
                            {[
                                { label: 'Présents', value: '42', color: '#16a34a' },
                                { label: 'Alertes', value: '3', color: '#ea580c' },
                            ].map((metric) => (
                                <div key={metric.label} style={{
                                    padding: isMobile ? '0.55rem' : '0.75rem',
                                    borderRadius: '0.75rem',
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0'
                                }}>
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>
                                        {metric.label}
                                    </p>
                                    <p style={{ margin: '0.15rem 0 0', color: metric.color, fontSize: isMobile ? '1.1rem' : '1.35rem', fontWeight: 850 }}>
                                        {metric.value}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {[
                            { icon: <MapPin size={15} />, title: 'Pointage GPS', detail: 'Service Urgences validé' },
                            { icon: <CalendarDays size={15} />, title: 'Planning', detail: '2 remplacements à confirmer' },
                            { icon: <UsersRound size={15} />, title: 'Demande client', detail: 'Intervention à qualifier' },
                        ].filter((_, index) => !isMobile || index < 2).map((item) => (
                            <div key={item.title} style={{
                                display: 'flex',
                                gap: '0.65rem',
                                alignItems: 'center',
                                padding: isMobile ? '0.48rem 0' : '0.65rem 0',
                                borderTop: '1px solid #e2e8f0'
                            }}>
                                <span style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '0.55rem',
                                    display: 'grid',
                                    placeItems: 'center',
                                    background: '#eef2ff',
                                    color: '#4f46e5',
                                    flexShrink: 0
                                }}>
                                    {item.icon}
                                </span>
                                <span>
                                    <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.82rem' }}>{item.title}</strong>
                                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{item.detail}</span>
                                </span>
                            </div>
                        ))}
                    </div>
                    </>
                    )}
                </motion.div>
            </div>
        </section>
    );
}
