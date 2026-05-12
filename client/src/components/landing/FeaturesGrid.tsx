import { motion } from 'framer-motion';
import {
    MapPin,
    Camera,
    FileText,
    Clock,
    CheckCircle,
    Smartphone,
    CalendarDays,
    Activity,
    BarChart3,
    ClipboardCheck,
    UserCheck
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useVisitor } from '../../context/VisitorContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export default function FeaturesGrid() {
    const { t } = useTranslation();
    const { deviceType } = useVisitor();
    const isNarrowViewport = useMediaQuery('(max-width: 767px)');
    const isTabletViewport = useMediaQuery('(min-width: 768px) and (max-width: 900px)');
    const isMobile = deviceType === 'mobile' || isNarrowViewport;
    const isTablet = !isMobile && isTabletViewport;

    return (
        <section id="hr-suite" style={{
            padding: isMobile ? '2.5rem 4%' : (isTablet ? '2.75rem 5%' : '3.25rem 5%'),
            background: '#ffffff'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <motion.div
                    initial={{ y: 24 }}
                    whileInView={{ y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    style={{ textAlign: 'center', marginBottom: isMobile ? '1.5rem' : '1.75rem' }}
                >
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'rgba(59, 130, 246, 0.1)',
                        padding: '0.5rem 1rem',
                        borderRadius: '2rem',
                        marginBottom: '0.7rem'
                    }}>
                        <Smartphone size={16} color="#3b82f6" />
                        <span style={{ color: '#2563eb', fontSize: '0.85rem', fontWeight: 600 }}>
                            {t('landing.suite.badge', 'PRESENCE & PLANNING')}
                        </span>
                    </div>
                    <h2 style={{
                        color: '#0f172a',
                        fontSize: isMobile ? '1.75rem' : (isTablet ? '2.15rem' : '2.5rem'),
                        fontWeight: 800,
                        marginBottom: '0.65rem',
                        letterSpacing: 0
                    }}>
                        {t('landing.suite.title', 'Le pointage reste le socle.')}
                    </h2>
                    <p style={{
                        color: '#475569',
                        fontSize: isMobile ? '1rem' : '1.1rem',
                        maxWidth: '600px',
                        margin: '0 auto'
                    }}>
                        {t('landing.suite.subtitle', 'Présences, horaires, sites et justificatifs accessibles depuis WhatsApp, puis transmis au bon service.')}
                    </p>
                </motion.div>

                {/* Product Workflow Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : (isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(6, 1fr)'),
                    gap: isMobile ? '0.85rem' : '1rem'
                }}>
                    {/* Pointage - primary workflow */}
                    <motion.div
                        initial={{ y: 24 }}
                        whileInView={{ y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        style={{
                            gridColumn: isMobile ? 'span 1' : (isTablet ? 'span 1' : 'span 3'),
                            background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 65%)',
                            border: '1px solid #e2e8f0',
                            borderRadius: '1.5rem',
                            padding: isMobile ? '1.2rem' : '1.35rem',
                            position: 'relative',
                            overflow: 'hidden',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                            minHeight: isMobile ? 'auto' : '330px'
                        }}
                    >
                        <div style={{ position: 'absolute', right: '-24px', bottom: '-24px', opacity: 0.08 }}>
                            <MapPin size={180} color="#2563eb" />
                        </div>

                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '1rem',
                                background: 'rgba(59, 130, 246, 0.16)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '0.8rem'
                            }}>
                                <MapPin size={28} color="#2563eb" />
                            </div>

                            <h3 style={{
                                color: '#0f172a',
                                fontSize: isMobile ? '1.5rem' : '1.85rem',
                                fontWeight: 850,
                                marginBottom: '0.75rem',
                                letterSpacing: 0
                            }}>
                                Pointage & présence terrain
                            </h3>
                            <p style={{
                                color: '#475569',
                                fontSize: '1rem',
                                lineHeight: 1.5,
                                maxWidth: '430px',
                                marginBottom: '0.8rem'
                            }}>
                                Un message WhatsApp suffit pour enregistrer l’arrivée, la prise de service ou le départ, avec site, heure et contrôle GPS.
                            </p>

                            <div style={{
                                background: '#0f172a',
                                borderRadius: '1.25rem',
                                padding: '0.8rem',
                                color: 'white',
                                maxWidth: '430px',
                                marginBottom: '0.8rem',
                                boxShadow: '0 18px 40px -24px rgba(15, 23, 42, 0.75)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.55rem' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 750 }}>WhatsPoint Bot</span>
                                    <span style={{ color: '#86efac', fontSize: '0.75rem', fontWeight: 700 }}>Validé</span>
                                </div>
                                <div style={{
                                    background: '#dcfce7',
                                    color: '#14532d',
                                    borderRadius: '0.85rem',
                                    padding: '0.65rem',
                                    fontSize: '0.88rem',
                                    lineHeight: 1.5
                                }}>
                                    Présence enregistrée à 07:02<br />
                                    Service Urgences · Site validé<br />
                                    Historique prêt pour export RH
                                </div>
                            </div>

                            <div style={{ display: 'grid', gap: '0.45rem' }}>
                                {[
                                    'Vérification site automatique',
                                    'Historique géolocalisé exploitable',
                                    'Transmission vers vos outils métier'
                                ].map((item) => (
                                    <div key={item} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.55rem',
                                        color: '#334155',
                                        fontSize: '0.92rem',
                                        fontWeight: 600
                                    }}>
                                        <CheckCircle size={16} color="#22c55e" />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* Planning - second pillar */}
                    <motion.div
                        initial={{ y: 24 }}
                        whileInView={{ y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        viewport={{ once: true }}
                        style={{
                            gridColumn: isMobile ? 'span 1' : (isTablet ? 'span 1' : 'span 3'),
                            background: 'linear-gradient(135deg, #f5f3ff 0%, #ffffff 64%)',
                            border: '1px solid #e2e8f0',
                            borderRadius: '1.5rem',
                            padding: isMobile ? '1.2rem' : '1.35rem',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                            minHeight: isMobile ? 'auto' : '330px',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{ position: 'absolute', right: '-20px', bottom: '-20px', opacity: 0.08 }}>
                            <CalendarDays size={170} color="#7c3aed" />
                        </div>

                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '1rem',
                                background: 'rgba(139, 92, 246, 0.16)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '0.8rem'
                            }}>
                                <CalendarDays size={28} color="#7c3aed" />
                            </div>

                            <h3 style={{
                                color: '#0f172a',
                                fontSize: isMobile ? '1.5rem' : '1.85rem',
                                fontWeight: 850,
                                marginBottom: '0.75rem',
                                letterSpacing: 0
                            }}>
                                Planning consultable dans WhatsApp
                            </h3>
                            <p style={{
                                color: '#475569',
                                fontSize: '1rem',
                                lineHeight: 1.5,
                                maxWidth: '430px',
                                marginBottom: '0.8rem'
                            }}>
                                Les équipes demandent leur prochain horaire, leur service ou un changement sans appeler le standard ni ouvrir un portail.
                            </p>

                            <div style={{
                                background: 'white',
                                border: '1px solid #ddd6fe',
                                borderRadius: '1.25rem',
                                padding: '0.8rem',
                                maxWidth: '430px',
                                marginBottom: '0.8rem',
                                boxShadow: '0 14px 30px -24px rgba(91, 33, 182, 0.65)'
                            }}>
                                {[
                                    ['Demain', '07:00 - 14:30', 'Cardiologie'],
                                    ['Mercredi', 'Repos', 'Remplacement couvert'],
                                    ['Jeudi', '14:00 - 21:00', 'Urgences']
                                ].map(([day, hours, service]) => (
                                    <div key={day} style={{
                                        display: 'grid',
                                        gridTemplateColumns: '88px 1fr',
                                        gap: '0.8rem',
                                        padding: '0.55rem 0',
                                        borderBottom: day === 'Jeudi' ? 'none' : '1px solid #ede9fe'
                                    }}>
                                        <span style={{ color: '#7c3aed', fontWeight: 800, fontSize: '0.86rem' }}>{day}</span>
                                        <span style={{ color: '#334155', fontWeight: 650, fontSize: '0.9rem' }}>
                                            {hours}<br />
                                            <span style={{ color: '#64748b', fontWeight: 500 }}>{service}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'grid', gap: '0.45rem' }}>
                                {[
                                    'Horaires à jour pour chaque collaborateur',
                                    'Réponse immédiate dans la conversation',
                                    'Changements transmis au bon service'
                                ].map((item) => (
                                    <div key={item} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.55rem',
                                        color: '#334155',
                                        fontSize: '0.92rem',
                                        fontWeight: 600
                                    }}>
                                        <CheckCircle size={16} color="#8b5cf6" />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* Extensions */}
                    {[
                        {
                            icon: <Camera size={24} color="#f59e0b" />,
                            title: 'Notes de frais',
                            desc: 'Photo du justificatif, extraction des informations utiles, transmission comptable.',
                            badge: 'Extension',
                            bg: 'rgba(245, 158, 11, 0.12)',
                            color: '#f59e0b'
                        },
                        {
                            icon: <FileText size={24} color="#10b981" />,
                            title: 'Documents terrain',
                            desc: 'Contrats, habilitations et justificatifs accessibles ou collectés depuis WhatsApp.',
                            badge: 'Extension',
                            bg: 'rgba(16, 185, 129, 0.12)',
                            color: '#10b981'
                        },
                        {
                            icon: <ClipboardCheck size={24} color="#f97316" />,
                            title: 'Demandes à traiter',
                            desc: 'Absence, retard, incident ou demande client arrivent qualifiés côté manager.',
                            badge: 'Workflow',
                            bg: 'rgba(249, 115, 22, 0.12)',
                            color: '#f97316'
                        }
                    ].map((card, idx) => (
                        <motion.div
                            key={card.title}
                            initial={{ y: 24 }}
                            whileInView={{ y: 0 }}
                            transition={{ duration: 0.45, delay: 0.08 * idx }}
                            viewport={{ once: true }}
                            style={{
                                gridColumn: isMobile ? 'span 1' : (isTablet ? 'span 1' : 'span 2'),
                                background: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '1.25rem',
                                padding: '1.25rem',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.04)'
                            }}
                        >
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '0.9rem',
                                background: card.bg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '0.8rem'
                            }}>
                                {card.icon}
                            </div>
                            <h3 style={{ color: '#0f172a', fontSize: '1.08rem', fontWeight: 820, marginBottom: '0.55rem' }}>
                                {card.title}
                            </h3>
                            <p style={{ color: '#475569', fontSize: '0.92rem', lineHeight: 1.55, marginBottom: '1rem' }}>
                                {card.desc}
                            </p>
                            <span style={{
                                display: 'inline-flex',
                                padding: '0.45rem 0.75rem',
                                borderRadius: '999px',
                                background: card.bg,
                                color: card.color,
                                fontSize: '0.78rem',
                                fontWeight: 750
                            }}>
                                {card.badge}
                            </span>
                        </motion.div>
                    ))}

                    {/* Dashboard */}
                    <motion.div
                        initial={{ y: 24 }}
                        whileInView={{ y: 0 }}
                        transition={{ duration: 0.6, delay: 0.25 }}
                        viewport={{ once: true }}
                        style={{
                            gridColumn: isMobile ? 'span 1' : (isTablet ? 'span 2' : 'span 6'),
                            background: '#0f172a',
                            borderRadius: '1.5rem',
                            padding: isMobile ? '1.35rem' : '1.75rem',
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : '0.9fr 1.1fr',
                            gap: isMobile ? '1rem' : '1.5rem',
                            alignItems: 'center',
                            boxShadow: '0 24px 60px -34px rgba(15, 23, 42, 0.8)'
                        }}
                    >
                        <div>
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                padding: '0.45rem 0.75rem',
                                borderRadius: '999px',
                                background: 'rgba(59, 130, 246, 0.16)',
                                color: '#93c5fd',
                                fontSize: '0.78rem',
                                fontWeight: 800,
                                marginBottom: '1rem'
                            }}>
                                <BarChart3 size={15} />
                                Dashboard manager
                            </div>
                            <h3 style={{
                                color: 'white',
                                fontSize: isMobile ? '1.45rem' : '1.85rem',
                                fontWeight: 850,
                                marginBottom: '0.75rem',
                                letterSpacing: 0
                            }}>
                                Pendant que le terrain utilise WhatsApp, le manager pilote tout.
                            </h3>
                            <p style={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: 1.6, marginBottom: '1.1rem' }}>
                                Présences, anomalies, justificatifs et demandes restent structurés dans une interface de suivi.
                            </p>
                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                {['Temps réel', 'Exports', 'Historique'].map((tag) => (
                                    <span key={tag} style={{
                                        padding: '0.55rem 0.85rem',
                                        border: '1px solid rgba(148, 163, 184, 0.28)',
                                        borderRadius: '999px',
                                        color: '#e2e8f0',
                                        fontSize: '0.82rem',
                                        fontWeight: 650
                                    }}>
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div style={{
                            background: 'white',
                            borderRadius: '1.25rem',
                            padding: '1rem',
                            border: '1px solid rgba(255, 255, 255, 0.12)'
                        }}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                                gap: '0.75rem',
                                marginBottom: '1rem'
                            }}>
                                {[
                                    ['Présents', '42', '+8 depuis 07:00', '#22c55e'],
                                    ['Retards', '3', 'à vérifier', '#f97316'],
                                    ['Demandes', '7', 'à traiter', '#3b82f6']
                                ].map(([label, value, detail, color]) => (
                                    <div key={label} style={{
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '0.9rem',
                                        padding: '0.85rem'
                                    }}>
                                        <div style={{ color: '#64748b', fontSize: '0.76rem', fontWeight: 750, marginBottom: '0.4rem' }}>{label}</div>
                                        <div style={{ color: '#0f172a', fontSize: '1.55rem', fontWeight: 850, marginBottom: '0.15rem' }}>{value}</div>
                                        <div style={{ color, fontSize: '0.75rem', fontWeight: 700 }}>{detail}</div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'grid', gap: '0.65rem' }}>
                                {[
                                    ['07:02', 'Awa D.', 'Prise de service validée', <UserCheck size={16} color="#22c55e" />],
                                    ['07:18', 'Service cardio', 'Planning consulté', <CalendarDays size={16} color="#8b5cf6" />],
                                    ['07:24', 'Agent terrain', 'Justificatif reçu', <Activity size={16} color="#f97316" />]
                                ].map(([time, name, event, icon]) => (
                                    <div key={`${time}-${name}`} style={{
                                        display: 'grid',
                                        gridTemplateColumns: '52px 28px 1fr',
                                        gap: '0.65rem',
                                        alignItems: 'center',
                                        padding: '0.72rem',
                                        background: '#f8fafc',
                                        borderRadius: '0.85rem'
                                    }}>
                                        <span style={{ color: '#64748b', fontSize: '0.76rem', fontWeight: 800 }}>{time}</span>
                                        <span style={{ display: 'inline-flex' }}>{icon}</span>
                                        <span style={{ color: '#334155', fontSize: '0.86rem', fontWeight: 650 }}>
                                            {name}<br />
                                            <span style={{ color: '#64748b', fontWeight: 500 }}>{event}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
