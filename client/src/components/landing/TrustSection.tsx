import { motion } from 'framer-motion';
import {
    Shield,
    EyeOff,
    Clock3,
    Database,
    Lock,
    ClipboardCheck
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useVisitor } from '../../context/VisitorContext';
import { useIsMobile } from '../../hooks/useMediaQuery';

export default function TrustSection() {
    const { t } = useTranslation();
    const { deviceType } = useVisitor();
    const isViewportMobile = useIsMobile();
    const isMobile = deviceType === 'mobile' || isViewportMobile;

    const trustFeatures = [
        {
            icon: <EyeOff size={28} />,
            title: t('landing.trust.stealth.title', 'Données minimisées'),
            description: t('landing.trust.stealth.desc', 'WhatsPoint ne transmet que l’information utile au traitement métier, avec masquage des détails sensibles quand c’est nécessaire.'),
            color: '#8b5cf6'
        },
        {
            icon: <Clock3 size={28} />,
            title: t('landing.trust.retention.title', 'Conservation maîtrisée'),
            description: t('landing.trust.retention.desc', 'Présences, justificatifs et demandes suivent vos durées de conservation, avec suppression ou archivage selon vos règles.'),
            color: '#f59e0b'
        },
        {
            icon: <Database size={28} />,
            title: t('landing.trust.isolation.title', 'Cloisonnement client'),
            description: t('landing.trust.isolation.desc', 'Chaque organisation garde son espace, ses rôles, ses flux et ses historiques séparés des autres clients.'),
            color: '#10b981'
        }
    ];

    return (
        <section style={{
            padding: isMobile ? '3.25rem 4%' : '4.75rem 5%',
            background: '#ffffff',
            position: 'relative',
            overflow: 'hidden',
            borderBottom: '1px solid #e2e8f0'
        }}>
            {/* Background pattern */}
            <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'radial-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px)',
                backgroundSize: '30px 30px',
                opacity: 0.5
            }} />

            <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <motion.div
                    initial={{ y: 24 }}
                    whileInView={{ y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    style={{ textAlign: 'center', marginBottom: isMobile ? '2.25rem' : '2.75rem' }}
                >
                    {/* Shield icon */}
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: isMobile ? '64px' : '70px',
                        height: isMobile ? '64px' : '70px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2))',
                        marginBottom: '1.15rem',
                        border: '1px solid rgba(139, 92, 246, 0.3)'
                    }}>
                        <Shield size={isMobile ? 32 : 36} color="#8b5cf6" />
                    </div>

                    <h2 style={{
                        color: '#0f172a',
                        fontSize: isMobile ? '1.75rem' : '2.5rem',
                        fontWeight: 800,
                        marginBottom: '1rem',
                        lineHeight: 1.2,
                        letterSpacing: 0
                    }}>
                        {t('landing.trust.title', 'WhatsApp est le canal, pas votre système métier.')}
                    </h2>
                    <p style={{
                        color: '#475569',
                        fontSize: '1.1rem',
                        maxWidth: '600px',
                        margin: '0 auto',
                        lineHeight: 1.6
                    }}>
                        {t('landing.trust.subtitle', 'WhatsPoint capte les échanges terrain, garde la maîtrise des données et transmet uniquement ce qui doit être traité.')}
                    </p>
                </motion.div>

                {/* Trust cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                    gap: isMobile ? '1rem' : '1.5rem'
                }}>
                    {trustFeatures.map((feature, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ y: 30 }}
                            whileInView={{ y: 0 }}
                            transition={{ duration: 0.6, delay: idx * 0.1 }}
                            viewport={{ once: true }}
                            style={{
                                background: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '1.25rem',
                                padding: isMobile ? '1.5rem' : '1.75rem',
                                textAlign: 'center',
                                position: 'relative',
                                overflow: 'hidden',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                            }}
                        >
                            {/* Glow effect */}
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: '100px',
                                height: '100px',
                                background: `radial-gradient(circle, ${feature.color}30, transparent 70%)`,
                                filter: 'blur(20px)'
                            }} />

                            {/* Icon */}
                            <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '1rem',
                                background: `${feature.color}15`,
                                border: `1px solid ${feature.color}30`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1.1rem',
                                color: feature.color,
                                position: 'relative'
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
                                fontSize: '0.95rem'
                            }}>
                                {feature.description}
                            </p>
                        </motion.div>
                    ))}
                </div>

                {/* Bottom guarantee badges */}
                <motion.div
                    initial={{ y: 20 }}
                    whileInView={{ y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    viewport={{ once: true }}
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                        gap: isMobile ? '1rem' : '1.5rem',
                        marginTop: '2rem'
                    }}
                >
                    {[
                        { icon: <Lock size={16} />, text: t('landing.trust.badges.encrypted', 'Accès sécurisés') },
                        { icon: <Shield size={16} />, text: t('landing.trust.badges.gdpr', 'Règles RGPD configurables') },
                        { icon: <ClipboardCheck size={16} />, text: t('landing.trust.badges.audit', 'Historique traçable') }
                    ].map((badge, idx) => (
                        <div key={idx} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: '#64748b',
                            fontSize: '0.85rem'
                        }}>
                            <span style={{ color: '#8b5cf6' }}>{badge.icon}</span>
                            <span>{badge.text}</span>
                        </div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}
