import { motion } from 'framer-motion';
import { useVisitor } from '../../context/VisitorContext';
import { ArrowRightLeft } from 'lucide-react';

export default function IntegrationsSection() {
    const { deviceType } = useVisitor();
    const isMobile = deviceType === 'mobile';

    const integrations = [
        { name: 'KPaie', category: 'Paie (Zero-Touch)', color: '#8b5cf6' },
        { name: 'Silae', category: 'Paie', color: '#0ea5e9' },
        { name: 'PayFit', category: 'Paie', color: '#0d9488' },
        { name: 'Pennylane', category: 'Comptabilité', color: '#16a34a' },
        { name: 'Sage', category: 'Compta & Paie', color: '#00cc66' },
        { name: 'Lucca', category: 'SIRH', color: '#4f46e5' },
        { name: 'Evoliz', category: 'Facturation', color: '#ea580c' }
    ];

    return (
        <section style={{
            padding: isMobile ? '3rem 4%' : '4rem 5%',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            overflow: 'hidden'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                >
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.4rem 1rem',
                        background: 'white',
                        borderRadius: '2rem',
                        marginBottom: '1.5rem',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                    }}>
                        <ArrowRightLeft size={16} color="#64748b" />
                        <span style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600 }}>
                            Intégrations & Export
                        </span>
                    </div>

                    <h2 style={{
                        color: '#0f172a',
                        fontSize: isMobile ? '1.5rem' : '2.2rem',
                        fontWeight: 800,
                        marginBottom: '1rem',
                        letterSpacing: '-0.02em'
                    }}>
                        Au cœur de votre écosystème
                    </h2>
                    <p style={{
                        color: '#64748b',
                        fontSize: '1.05rem',
                        maxWidth: '700px',
                        margin: '0 auto 2.5rem',
                        lineHeight: 1.6
                    }}>
                        WhatsPoint collecte et structure la donnée brute depuis WhatsApp (Congés, Absences, Notes de frais). Ensuite ? Exportez automatiquement ou injectez vos variables directement dans votre moteur avec le concept unique de <strong>Zero-Touch Payroll</strong> (intégration native bidirectionnelle avec <strong>KPaie</strong>). Finie la double saisie.
                    </p>
                </motion.div>

                {/* Integrations Grid */}
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: isMobile ? '1rem' : '1.5rem'
                }}>
                    {integrations.map((integration, idx) => (
                        <motion.div
                            key={integration.name}
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4, delay: idx * 0.1 }}
                            viewport={{ once: true }}
                            style={{
                                background: 'white',
                                padding: '1.5rem',
                                borderRadius: '1rem',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                minWidth: '180px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <span style={{
                                color: integration.color,
                                fontSize: '1.5rem',
                                fontWeight: 900,
                                letterSpacing: '-0.05em'
                            }}>
                                {integration.name}
                            </span>
                            <span style={{
                                color: '#94a3b8',
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                {integration.category}
                            </span>
                        </motion.div>
                    ))}
                    
                    {/* Add CSV API fallback */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: integrations.length * 0.1 }}
                        viewport={{ once: true }}
                        style={{
                            background: '#0f172a',
                            padding: '1.5rem',
                            borderRadius: '1rem',
                            border: '1px solid #1e293b',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                            minWidth: '180px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <span style={{
                            color: 'white',
                            fontSize: '1.5rem',
                            fontWeight: 800,
                        }}>
                            API & CSV
                        </span>
                        <span style={{
                            color: '#94a3b8',
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            Export Universel
                        </span>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
