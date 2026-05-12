import { motion } from 'framer-motion';
import { useVisitor } from '../../context/VisitorContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import {
    ArrowRightLeft,
    BriefcaseBusiness,
    Cable,
    FileJson,
    FileText,
    Headphones,
    Scale,
    UserRoundCheck,
    Webhook,
    Wrench
} from 'lucide-react';

export default function IntegrationsSection() {
    const { deviceType } = useVisitor();
    const isViewportMobile = useIsMobile();
    const isMobile = deviceType === 'mobile' || isViewportMobile;

    const businessFlows = [
        {
            title: 'Pointage & planning',
            example: 'Arrivée, départ, prise de service, prochain horaire.',
            target: 'collecté puis transmis RH / planning',
            icon: <UserRoundCheck size={22} />,
            color: '#16a34a'
        },
        {
            title: 'Intervention client',
            example: 'Panne, photo, urgence, adresse et compte rendu.',
            target: 'qualifié puis routé intervention',
            icon: <Wrench size={22} />,
            color: '#ea580c'
        },
        {
            title: 'Absences & justificatifs',
            example: 'Retard, arrêt maladie, absence ou document.',
            target: 'contrôlé puis transmis RH / paie',
            icon: <FileText size={22} />,
            color: '#8b5cf6'
        },
        {
            title: 'Support client',
            example: 'Réclamation, demande, pièce jointe et suivi dossier.',
            target: 'créé puis suivi helpdesk / CRM',
            icon: <Headphones size={22} />,
            color: '#2563eb'
        },
        {
            title: 'Juridique & conformité',
            example: 'Question, mandat, pièce, signature ou preuve.',
            target: 'préparé puis transmis juridique',
            icon: <Scale size={22} />,
            color: '#16a34a'
        },
        {
            title: 'Commerce & terrain',
            example: 'Commande, incident, remontée magasin ou visite.',
            target: 'structuré puis envoyé ERP / CRM',
            icon: <BriefcaseBusiness size={22} />,
            color: '#0d9488'
        }
    ];

    const capabilities = [
        { name: 'API', category: 'REST / JSON', icon: <FileJson size={18} /> },
        { name: 'Webhooks', category: 'temps réel', icon: <Webhook size={18} /> },
        { name: 'CSV / SFTP', category: 'flux batch', icon: <Cable size={18} /> }
    ];

    return (
        <section style={{
            padding: isMobile ? '2rem 4%' : '2.5rem 5%',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            overflow: 'hidden'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
                <motion.div
                    initial={{ y: 20 }}
                    whileInView={{ y: 0 }}
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
                        marginBottom: '0.75rem',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                    }}>
                        <ArrowRightLeft size={16} color="#64748b" />
                        <span style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600 }}>
                            Cas d’usage métiers
                        </span>
                    </div>

                    <h2 style={{
                        color: '#0f172a',
                        fontSize: isMobile ? '1.5rem' : '2.2rem',
                        fontWeight: 800,
                        marginBottom: '0.75rem',
                        letterSpacing: 0
                    }}>
                        Le pointage ouvre la porte aux demandes terrain.
                    </h2>
                    <p style={{
                        color: '#64748b',
                        fontSize: '1.05rem',
                        maxWidth: '720px',
                        margin: '0 auto 1.5rem',
                        lineHeight: 1.6
                    }}>
                        WhatsPoint collecte l’information dans WhatsApp, la qualifie, puis la transmet
                        au bon outil métier. Le pointage et le planning restent le socle, les autres flux suivent.
                    </p>
                </motion.div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
                    gap: isMobile ? '0.75rem' : '1rem'
                }}>
                    {businessFlows.map((flow, idx) => (
                        <motion.div
                            key={flow.title}
                            initial={{ y: 20 }}
                            whileInView={{ y: 0 }}
                            transition={{ duration: 0.4, delay: idx * 0.08 }}
                            viewport={{ once: true }}
                            style={{
                                background: 'white',
                                padding: '1rem',
                                borderRadius: '1rem',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                gap: '0.65rem',
                                minHeight: isMobile ? 'auto' : '145px',
                                textAlign: 'left'
                            }}
                        >
                            <div style={{
                                width: '46px',
                                height: '46px',
                                borderRadius: '0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: flow.color,
                                background: `${flow.color}14`
                            }}>
                                {flow.icon}
                            </div>
                            <h3 style={{
                                color: '#0f172a',
                                fontSize: '1.08rem',
                                fontWeight: 800
                            }}>
                                {flow.title}
                            </h3>
                            <p style={{
                                color: '#475569',
                                fontSize: '0.92rem',
                                lineHeight: 1.5,
                                margin: 0
                            }}>
                                {flow.example}
                            </p>
                            <span style={{
                                marginTop: 'auto',
                                color: flow.color,
                                background: `${flow.color}10`,
                                border: `1px solid ${flow.color}28`,
                                borderRadius: '999px',
                                padding: '0.35rem 0.7rem',
                                fontSize: '0.78rem',
                                fontWeight: 700
                            }}>
                                {flow.target}
                            </span>
                        </motion.div>
                    ))}
                </div>

                <div style={{
                    marginTop: '1.1rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: '1rem'
                }}>
                    <div style={{
                        width: '100%',
                        color: '#64748b',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        marginBottom: '0.25rem'
                    }}>
                        WhatsPoint ne remplace pas vos logiciels métier : il les alimente.
                    </div>
                    {capabilities.map((capability, idx) => (
                        <motion.div
                            key={capability.name}
                            initial={{ scale: 0.9 }}
                            whileInView={{ scale: 1 }}
                            transition={{ duration: 0.4, delay: idx * 0.08 }}
                            viewport={{ once: true }}
                            style={{
                                background: '#0f172a',
                                padding: '0.85rem 1.1rem',
                                borderRadius: '1rem',
                                border: '1px solid #1e293b',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                minWidth: '160px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <span style={{
                                color: 'white',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                fontSize: '1.1rem',
                                fontWeight: 800
                            }}>
                                {capability.icon}
                                {capability.name}
                            </span>
                            <span style={{
                                color: '#94a3b8',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                {capability.category}
                            </span>
                        </motion.div>
                    ))}

                    <motion.div
                        initial={{ scale: 0.9 }}
                        whileInView={{ scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.24 }}
                        viewport={{ once: true }}
                        style={{
                            background: '#ffffff',
                            padding: '0.85rem 1.1rem',
                            borderRadius: '1rem',
                            border: '1px dashed #94a3b8',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                            minWidth: '160px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <span style={{ color: '#0f172a', fontSize: '1.1rem', fontWeight: 800 }}>
                            Votre outil
                        </span>
                        <span style={{
                            color: '#64748b',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            connecteur sur mesure
                        </span>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
