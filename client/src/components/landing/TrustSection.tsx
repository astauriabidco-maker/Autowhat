import { motion } from 'framer-motion';
import {
    Shield,
    Eye,
    Trash2,
    Database,
    Lock,
    CheckCircle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useVisitor } from '../../context/VisitorContext';

export default function TrustSection() {
    const { t } = useTranslation();
    const { deviceType } = useVisitor();
    const isMobile = deviceType === 'mobile';

    const trustFeatures = [
        {
            icon: <Eye size={28} />,
            title: t('landing.trust.stealth.title', 'Mode Furtif'),
            description: t('landing.trust.stealth.desc', 'Nos algorithmes anonymisent les noms de chantiers avant qu\'ils n\'atteignent WhatsApp.'),
            color: '#8b5cf6'
        },
        {
            icon: <Trash2 size={28} />,
            title: t('landing.trust.retention.title', 'Auto-Destruction'),
            description: t('landing.trust.retention.desc', 'Vos archives sont supprimées automatiquement selon vos règles RGPD.'),
            color: '#f59e0b'
        },
        {
            icon: <Database size={28} />,
            title: t('landing.trust.isolation.title', 'Cloisonnement'),
            description: t('landing.trust.isolation.desc', 'Chaque entreprise possède sa base de données isolée. Zéro mélange.'),
            color: '#10b981'
        }
    ];

    return (
        <section style={{
            padding: isMobile ? '4rem 4%' : '6rem 5%',
            background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
            position: 'relative',
            overflow: 'hidden'
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
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    style={{ textAlign: 'center', marginBottom: '4rem' }}
                >
                    {/* Shield icon */}
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2))',
                        marginBottom: '1.5rem',
                        border: '1px solid rgba(139, 92, 246, 0.3)'
                    }}>
                        <Shield size={40} color="#8b5cf6" />
                    </div>

                    <h2 style={{
                        color: 'white',
                        fontSize: isMobile ? '1.75rem' : '2.5rem',
                        fontWeight: 800,
                        marginBottom: '1rem',
                        lineHeight: 1.2
                    }}>
                        {t('landing.trust.title', 'Vos données n\'appartiennent pas à Meta.')}
                    </h2>
                    <p style={{
                        color: '#94a3b8',
                        fontSize: '1.1rem',
                        maxWidth: '600px',
                        margin: '0 auto',
                        lineHeight: 1.6
                    }}>
                        {t('landing.trust.subtitle', 'WhatsApp est le canal. Jamais le propriétaire de vos informations.')}
                    </p>
                </motion.div>

                {/* Trust cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                    gap: '2rem'
                }}>
                    {trustFeatures.map((feature, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: idx * 0.1 }}
                            viewport={{ once: true }}
                            style={{
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '1.25rem',
                                padding: '2rem',
                                textAlign: 'center',
                                position: 'relative',
                                overflow: 'hidden'
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
                                width: '64px',
                                height: '64px',
                                borderRadius: '1rem',
                                background: `${feature.color}15`,
                                border: `1px solid ${feature.color}30`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1.5rem',
                                color: feature.color,
                                position: 'relative'
                            }}>
                                {feature.icon}
                            </div>

                            <h3 style={{
                                color: 'white',
                                fontSize: '1.25rem',
                                fontWeight: 700,
                                marginBottom: '0.75rem'
                            }}>
                                {feature.title}
                            </h3>
                            <p style={{
                                color: '#94a3b8',
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
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    viewport={{ once: true }}
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                        gap: '2rem',
                        marginTop: '3rem'
                    }}
                >
                    {[
                        { icon: <Lock size={16} />, text: t('landing.trust.badges.encrypted', 'Chiffrement AES-256') },
                        { icon: <Shield size={16} />, text: t('landing.trust.badges.gdpr', 'Conforme RGPD') },
                        { icon: <CheckCircle size={16} />, text: t('landing.trust.badges.audit', 'Audité annuellement') }
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
