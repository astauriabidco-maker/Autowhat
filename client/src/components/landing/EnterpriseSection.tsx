import { motion } from 'framer-motion';
import {
    Smartphone,
    Globe,
    Shield,
    Zap,
    Building2,
    ArrowRight,
    CheckCircle2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useVisitor } from '../../context/VisitorContext';

export default function EnterpriseSection() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { deviceType } = useVisitor();
    const isMobile = deviceType === 'mobile';

    const enterpriseFeatures = [
        {
            icon: <Smartphone size={32} />,
            title: t('landing.enterprise.byon.title', 'BYON - Bring Your Own Number'),
            description: t('landing.enterprise.byon.desc', 'Connectez votre propre ligne WhatsApp Business officielle. Gardez votre numéro historique.'),
            highlight: t('landing.enterprise.byon.highlight', 'Numéro vérifié ✓'),
            color: '#22c55e'
        },
        {
            icon: <Globe size={32} />,
            title: t('landing.enterprise.global.title', 'Infrastructure Globale'),
            description: t('landing.enterprise.global.desc', 'Numéros locaux disponibles dans plus de 150 pays. Déployez à l\'international en 24h.'),
            highlight: t('landing.enterprise.global.highlight', '150+ pays'),
            color: '#3b82f6'
        },
        {
            icon: <Shield size={32} />,
            title: t('landing.enterprise.antiban.title', 'Protection Anti-Ban'),
            description: t('landing.enterprise.antiban.desc', 'Algorithmes de lissage de trafic et rotation intelligente pour une délivrabilité de 99.9%.'),
            highlight: t('landing.enterprise.antiban.highlight', '99.9% uptime'),
            color: '#8b5cf6'
        }
    ];

    return (
        <section id="enterprise" style={{
            padding: isMobile ? '3.25rem 4%' : '4.75rem 5%',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <motion.div
                    initial={{ y: 24 }}
                    whileInView={{ y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    style={{
                        textAlign: 'center',
                        marginBottom: isMobile ? '2rem' : '2.75rem'
                    }}
                >
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: '#f3e8ff',
                        padding: '0.5rem 1rem',
                        borderRadius: '2rem',
                        marginBottom: '1rem',
                        border: '1px solid #e9d5ff'
                    }}>
                        <Building2 size={16} color="#8b5cf6" />
                        <span style={{ color: '#8b5cf6', fontSize: '0.85rem', fontWeight: 600 }}>
                            {t('landing.enterprise.badge', 'ENTERPRISE & SCALE')}
                        </span>
                    </div>

                    <h2 style={{
                        color: '#0f172a',
                        fontSize: isMobile ? '1.75rem' : '2.5rem',
                        fontWeight: 800,
                        marginBottom: '1rem',
                        letterSpacing: 0
                    }}>
                        {t('landing.enterprise.title', 'Prêt pour les grands comptes.')}
                    </h2>
                    <p style={{
                        color: '#64748b',
                        fontSize: '1.1rem',
                        maxWidth: '600px',
                        margin: '0 auto'
                    }}>
                        {t('landing.enterprise.subtitle', 'Les mêmes fonctionnalités que les leaders du marché, à une fraction du prix.')}
                    </p>
                </motion.div>

                {/* Features */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                    gap: isMobile ? '1rem' : '1.5rem',
                    marginBottom: isMobile ? '2rem' : '2.75rem'
                }}>
                    {enterpriseFeatures.map((feature, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ y: 22 }}
                            whileInView={{ y: 0 }}
                            transition={{ duration: 0.6, delay: idx * 0.1 }}
                            viewport={{ once: true }}
                            style={{
                                background: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '1.5rem',
                                padding: isMobile ? '1.5rem' : '1.75rem',
                                position: 'relative',
                                overflow: 'hidden',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                            }}
                        >
                            {/* Subtle glow */}
                            <div style={{
                                position: 'absolute',
                                top: '-50px',
                                right: '-50px',
                                width: '150px',
                                height: '150px',
                                borderRadius: '50%',
                                background: `${feature.color}10`,
                                filter: 'blur(40px)'
                            }} />

                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '1rem',
                                background: `${feature.color}15`,
                                border: `1px solid ${feature.color}30`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '1.1rem',
                                color: feature.color
                            }}>
                                {feature.icon}
                            </div>

                            <h3 style={{
                                color: '#0f172a',
                                fontSize: '1.25rem',
                                fontWeight: 800,
                                marginBottom: '0.75rem'
                            }}>
                                {feature.title}
                            </h3>
                            <p style={{
                                color: '#475569',
                                lineHeight: 1.6,
                                marginBottom: '1rem'
                            }}>
                                {feature.description}
                            </p>

                            {/* Highlight badge */}
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem 1rem',
                                background: `${feature.color}15`,
                                borderRadius: '2rem',
                                color: feature.color,
                                fontSize: '0.85rem',
                                fontWeight: 600
                            }}>
                                <Zap size={14} />
                                {feature.highlight}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* CTA for Enterprise */}
                <motion.div
                    initial={{ y: 24 }}
                    whileInView={{ y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    viewport={{ once: true }}
                    style={{
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '1.5rem',
                        padding: isMobile ? '1.75rem' : '2.25rem',
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '2rem',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                >
                    <div>
                        <h3 style={{
                            color: '#0f172a',
                            fontSize: isMobile ? '1.25rem' : '1.5rem',
                            fontWeight: 800,
                            marginBottom: '0.5rem'
                        }}>
                            {t('landing.enterprise.cta.title', 'Besoin d\'un déploiement sur-mesure ?')}
                        </h3>
                        <p style={{
                            color: '#475569',
                            fontSize: '1rem'
                        }}>
                            {t('landing.enterprise.cta.desc', 'Notre équipe configure votre instance en moins de 48h.')}
                        </p>

                        {/* Trust badges */}
                        <div style={{
                            display: 'flex',
                            gap: '1rem',
                            marginTop: '1rem',
                            flexWrap: 'wrap'
                        }}>
                            {[
                                t('landing.enterprise.cta.b1', 'SLA Garanti'),
                                t('landing.enterprise.cta.b2', 'Account Manager Dédié'),
                                t('landing.enterprise.cta.b3', 'Formation Incluse')
                            ].map((badge, idx) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    color: '#475569',
                                    fontSize: '0.85rem',
                                    fontWeight: 500
                                }}>
                                    <CheckCircle2 size={14} color="#22c55e" />
                                    <span>{badge}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={() => navigate('/contact')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '1rem 2rem',
                            background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                            border: 'none',
                            borderRadius: '0.75rem',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '1rem',
                            whiteSpace: 'nowrap',
                            transition: 'transform 0.2s ease'
                        }}
                    >
                        {t('landing.enterprise.cta.button', 'Contacter les ventes')}
                        <ArrowRight size={18} />
                    </button>
                </motion.div>
            </div>
        </section>
    );
}
