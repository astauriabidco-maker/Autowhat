import { motion } from 'framer-motion';
import {
    MapPin,
    Camera,
    FileText,
    MessageCircle,
    Clock,
    CheckCircle,
    Smartphone
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useVisitor } from '../../context/VisitorContext';

export default function FeaturesGrid() {
    const { t } = useTranslation();
    const { deviceType } = useVisitor();
    const isMobile = deviceType === 'mobile';

    return (
        <section id="hr-suite" style={{
            padding: isMobile ? '4rem 4%' : '6rem 5%',
            background: '#ffffff'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    style={{ textAlign: 'center', marginBottom: '3rem' }}
                >
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'rgba(59, 130, 246, 0.1)',
                        padding: '0.5rem 1rem',
                        borderRadius: '2rem',
                        marginBottom: '1rem'
                    }}>
                        <Smartphone size={16} color="#3b82f6" />
                        <span style={{ color: '#2563eb', fontSize: '0.85rem', fontWeight: 600 }}>
                            {t('landing.suite.badge', 'POCKET HR SUITE')}
                        </span>
                    </div>
                    <h2 style={{
                        color: '#0f172a',
                        fontSize: isMobile ? '1.75rem' : '2.5rem',
                        fontWeight: 800,
                        marginBottom: '1rem',
                        letterSpacing: '-0.02em'
                    }}>
                        {t('landing.suite.title', 'Bien plus qu\'une pointeuse.')}
                    </h2>
                    <p style={{
                        color: '#475569',
                        fontSize: '1.1rem',
                        maxWidth: '600px',
                        margin: '0 auto'
                    }}>
                        {t('landing.suite.subtitle', 'Une suite RH complète accessible depuis WhatsApp. Vos managers adorent le dashboard.')}
                    </p>
                </motion.div>

                {/* Bento Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
                    gridTemplateRows: isMobile ? 'auto' : 'repeat(2, 1fr)',
                    gap: '1.5rem'
                }}>
                    {/* Card 1 - Large: Pointage & GPS */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        style={{
                            gridColumn: isMobile ? 'span 1' : 'span 2',
                            gridRow: isMobile ? 'auto' : 'span 2',
                            background: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '1.5rem',
                            padding: '2rem',
                            position: 'relative',
                            overflow: 'hidden',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                            minHeight: isMobile ? '280px' : '400px'
                        }}
                    >
                        {/* Decorative map pins */}
                        <div style={{
                            position: 'absolute',
                            bottom: '20%',
                            right: '10%',
                            opacity: 0.1
                        }}>
                            <MapPin size={120} color="#3b82f6" />
                        </div>

                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '1rem',
                            background: 'rgba(59, 130, 246, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '1.5rem'
                        }}>
                            <MapPin size={28} color="#3b82f6" />
                        </div>

                        <h3 style={{
                            color: '#0f172a',
                            fontSize: '1.5rem',
                            fontWeight: 800,
                            marginBottom: '0.75rem'
                        }}>
                            {t('landing.suite.gps.title', 'Pointage GPS')}
                        </h3>
                        <p style={{
                            color: '#475569',
                            fontSize: '1rem',
                            lineHeight: 1.6,
                            maxWidth: '300px'
                        }}>
                            {t('landing.suite.gps.desc', 'Un "Hi" suffit. Le GPS vérifie automatiquement que l\'employé est bien sur site.')}
                        </p>

                        {/* Mini feature list */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                            marginTop: '1.5rem'
                        }}>
                            {[
                                t('landing.suite.gps.f1', 'Vérification site automatique'),
                                t('landing.suite.gps.f2', 'Export Excel pour la paie'),
                                t('landing.suite.gps.f3', 'Historique géolocalisé')
                            ].map((f, idx) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <CheckCircle size={16} color="#22c55e" />
                                    <span style={{ color: '#334155', fontSize: '0.9rem', fontWeight: 500 }}>{f}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Card 2: Notes de Frais */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        viewport={{ once: true }}
                        style={{
                            background: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '1.5rem',
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                        }}
                    >
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '0.75rem',
                            background: 'rgba(245, 158, 11, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '1rem'
                        }}>
                            <Camera size={24} color="#f59e0b" />
                        </div>
                        <h3 style={{
                            color: '#0f172a',
                            fontSize: '1.1rem',
                            fontWeight: 800,
                            marginBottom: '0.5rem'
                        }}>
                            {t('landing.suite.expenses.title', 'Notes de Frais')}
                        </h3>
                        <p style={{
                            color: '#475569',
                            fontSize: '0.9rem',
                            lineHeight: 1.5,
                            flex: 1
                        }}>
                            {t('landing.suite.expenses.desc', 'Une photo du ticket, et c\'est comptabilisé. L\'IA extrait les montants.')}
                        </p>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginTop: '1rem',
                            padding: '0.75rem',
                            background: 'rgba(245, 158, 11, 0.1)',
                            borderRadius: '0.75rem'
                        }}>
                            <CheckCircle size={16} color="#f59e0b" />
                            <span style={{ color: '#fbbf24', fontSize: '0.8rem', fontWeight: 600 }}>
                                {t('landing.suite.expenses.badge', 'OCR Intelligent')}
                            </span>
                        </div>
                    </motion.div>

                    {/* Card 3: Coffre-fort Doc */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        viewport={{ once: true }}
                        style={{
                            background: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '1.5rem',
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                        }}
                    >
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '0.75rem',
                            background: 'rgba(16, 185, 129, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '1rem'
                        }}>
                            <FileText size={24} color="#10b981" />
                        </div>
                        <h3 style={{
                            color: '#0f172a',
                            fontSize: '1.1rem',
                            fontWeight: 800,
                            marginBottom: '0.5rem'
                        }}>
                            {t('landing.suite.docs.title', 'Coffre-fort Doc')}
                        </h3>
                        <p style={{
                            color: '#475569',
                            fontSize: '0.9rem',
                            lineHeight: 1.5,
                            flex: 1
                        }}>
                            {t('landing.suite.docs.desc', 'Contrats, permis et habilitations accessibles sur le terrain.')}
                        </p>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginTop: '1rem',
                            padding: '0.75rem',
                            background: 'rgba(16, 185, 129, 0.1)',
                            borderRadius: '0.75rem'
                        }}>
                            <CheckCircle size={16} color="#10b981" />
                            <span style={{ color: '#34d399', fontSize: '0.8rem', fontWeight: 600 }}>
                                {t('landing.suite.docs.badge', 'Accès Hors-Ligne')}
                            </span>
                        </div>
                    </motion.div>

                    {/* Card 4: Support Intégré */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        viewport={{ once: true }}
                        style={{
                            background: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '1.5rem',
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                        }}
                    >
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '0.75rem',
                            background: 'rgba(139, 92, 246, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '1rem'
                        }}>
                            <MessageCircle size={24} color="#8b5cf6" />
                        </div>
                        <h3 style={{
                            color: '#0f172a',
                            fontSize: '1.1rem',
                            fontWeight: 800,
                            marginBottom: '0.5rem'
                        }}>
                            {t('landing.suite.support.title', 'Support Intégré')}
                        </h3>
                        <p style={{
                            color: '#475569',
                            fontSize: '0.9rem',
                            lineHeight: 1.5,
                            flex: 1
                        }}>
                            {t('landing.suite.support.desc', 'Vos équipes nous parlent directement via WhatsApp. Réponse < 2h.')}
                        </p>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginTop: '1rem',
                            padding: '0.75rem',
                            background: 'rgba(139, 92, 246, 0.1)',
                            borderRadius: '0.75rem'
                        }}>
                            <Clock size={16} color="#8b5cf6" />
                            <span style={{ color: '#a78bfa', fontSize: '0.8rem', fontWeight: 600 }}>
                                {t('landing.suite.support.badge', 'SLA 2 heures')}
                            </span>
                        </div>
                    </motion.div>

                    {/* Card 5: Dashboard Preview */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        viewport={{ once: true }}
                        style={{
                            gridColumn: isMobile ? 'span 1' : 'span 2',
                            background: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '1.5rem',
                            padding: '2rem',
                            display: 'flex',
                            flexDirection: isMobile ? 'column' : 'row',
                            alignItems: 'center',
                            gap: '2rem',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                        }}
                    >
                        <div style={{ flex: 1 }}>
                            <h3 style={{
                                color: '#0f172a',
                                fontSize: '1.25rem',
                                fontWeight: 800,
                                marginBottom: '0.75rem'
                            }}>
                                {t('landing.suite.dashboard.title', 'Dashboard Manager')}
                            </h3>
                            <p style={{
                                color: '#475569',
                                fontSize: '0.95rem',
                                lineHeight: 1.6,
                                marginBottom: '1rem'
                            }}>
                                {t('landing.suite.dashboard.desc', 'Pendant que vos équipes pointent sur WhatsApp, vous pilotez tout depuis une interface moderne.')}
                            </p>
                            <div style={{
                                display: 'flex',
                                gap: '1rem',
                                flexWrap: 'wrap'
                            }}>
                                {['📊 Temps réel', '📈 Analytique', '📥 Export'].map((tag, idx) => (
                                    <span key={idx} style={{
                                        padding: '0.5rem 1rem',
                                        background: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '2rem',
                                        color: '#475569',
                                        fontSize: '0.8rem',
                                        fontWeight: 500
                                    }}>
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                        {/* Placeholder for dashboard mockup */}
                        <div style={{
                            width: isMobile ? '100%' : '200px',
                            height: '120px',
                            borderRadius: '0.75rem',
                            background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                            border: '1px solid #cbd5e1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#64748b',
                            fontSize: '0.8rem',
                            fontWeight: 600
                        }}>
                            Dashboard Preview
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
