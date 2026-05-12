import { motion } from 'framer-motion';
import {
    CalendarClock,
    ClipboardCheck,
    FileText,
    MessageCircle,
    Network,
    RefreshCw,
    Route,
    Users
} from 'lucide-react';
import { useVisitor } from '../../context/VisitorContext';
import { useIsMobile } from '../../hooks/useMediaQuery';

export default function OperationsSection() {
    const { deviceType } = useVisitor();
    const isViewportMobile = useIsMobile();
    const isMobile = deviceType === 'mobile' || isViewportMobile;

    const modules = [
        {
            icon: <Users size={24} />,
            title: 'Identification',
            description: 'Reconnaissance du client, du salarié, du technicien ou du contact depuis son numéro WhatsApp.',
            color: '#2563eb'
        },
        {
            icon: <MessageCircle size={24} />,
            title: 'Collecte guidée',
            description: 'Messages, photos, documents, localisation ou choix interactifs sont transformés en demande exploitable.',
            color: '#ea580c'
        },
        {
            icon: <Route size={24} />,
            title: 'Orientation métier',
            description: 'Une panne va au service intervention, une absence aux RH, une réclamation au support.',
            color: '#16a34a'
        },
        {
            icon: <Network size={24} />,
            title: 'Connexion aux outils',
            description: 'WhatsPoint alimente vos logiciels existants sans demander aux utilisateurs de les apprendre.',
            color: '#7c3aed'
        },
        {
            icon: <RefreshCw size={24} />,
            title: 'Suivi asynchrone',
            description: 'Accusé immédiat sur WhatsApp, transmission en arrière-plan, relances et reprise en cas d’erreur.',
            color: '#0891b2'
        },
        {
            icon: <FileText size={24} />,
            title: 'Retour utilisateur',
            description: 'Statut, document, décision ou confirmation reviennent dans WhatsApp depuis le service concerné.',
            color: '#be123c'
        }
    ];

    return (
        <section id="operations" style={{
            padding: isMobile ? '3.25rem 4%' : '4.75rem 5%',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <motion.div
                    initial={{ y: 24 }}
                    whileInView={{ y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '0.9fr 1.1fr',
                        gap: isMobile ? '1.5rem' : '3rem',
                        alignItems: 'center',
                        marginBottom: isMobile ? '2rem' : '2.5rem'
                    }}
                >
                    <div>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: '#fff7ed',
                            border: '1px solid #fed7aa',
                            padding: '0.5rem 1rem',
                            borderRadius: '2rem',
                            marginBottom: '1rem'
                        }}>
                            <ClipboardCheck size={16} color="#ea580c" />
                            <span style={{ color: '#c2410c', fontSize: '0.85rem', fontWeight: 700 }}>
                                WORKFLOWS METIERS
                            </span>
                        </div>

                        <h2 style={{
                            color: '#0f172a',
                            fontSize: isMobile ? '1.75rem' : '2.5rem',
                            fontWeight: 800,
                            lineHeight: 1.15,
                            marginBottom: '1rem',
                            letterSpacing: 0
                        }}>
                            Chaque demande arrive au bon service.
                        </h2>

                        <p style={{
                            color: '#475569',
                            fontSize: '1.08rem',
                            lineHeight: 1.65,
                            maxWidth: '560px'
                        }}>
                            Le client signale une panne, le salarié envoie un justificatif, le technicien
                            transmet une photo. WhatsPoint transforme ces messages en demandes propres
                            et les envoie au service métier concerné.
                        </p>
                    </div>

                    <div style={{
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '1.25rem',
                        padding: isMobile ? '1rem' : '1.25rem',
                        boxShadow: '0 18px 45px -30px rgba(15, 23, 42, 0.35)'
                    }}>
                        {[
                            { label: 'Demande reçue sur WhatsApp', value: 'Nouveau', color: '#2563eb' },
                            { label: 'Informations qualifiées', value: 'Structuré', color: '#ea580c' },
                            { label: 'Envoyé au bon service', value: 'Orienté', color: '#16a34a' },
                            { label: 'Réponse renvoyée dans WhatsApp', value: 'Notifié', color: '#7c3aed' }
                        ].map((step, idx) => (
                            <div key={step.label} style={{
                                display: 'grid',
                                gridTemplateColumns: '32px 1fr auto',
                                gap: '0.9rem',
                                alignItems: 'center',
                                padding: '0.9rem',
                                borderBottom: idx === 3 ? 'none' : '1px solid #e2e8f0'
                            }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '0.75rem',
                                    background: `${step.color}14`,
                                    color: step.color,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {idx === 0 ? <MessageCircle size={17} /> : idx === 3 ? <FileText size={17} /> : <ClipboardCheck size={17} />}
                                </div>
                                <span style={{ color: '#334155', fontSize: '0.95rem', fontWeight: 650 }}>
                                    {step.label}
                                </span>
                                <span style={{
                                    color: step.color,
                                    background: `${step.color}12`,
                                    border: `1px solid ${step.color}30`,
                                    borderRadius: '999px',
                                    padding: '0.3rem 0.65rem',
                                    fontSize: '0.76rem',
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap'
                                }}>
                                    {step.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                    gap: isMobile ? '1rem' : '1.25rem'
                }}>
                    {modules.map((module, idx) => (
                        <motion.div
                            key={module.title}
                            initial={{ y: 20 }}
                            whileInView={{ y: 0 }}
                            transition={{ duration: 0.45, delay: idx * 0.06 }}
                            viewport={{ once: true }}
                            style={{
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '1rem',
                                padding: '1.2rem',
                                minHeight: isMobile ? 'auto' : '168px',
                                boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.04)'
                            }}
                        >
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '0.85rem',
                                background: `${module.color}14`,
                                color: module.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '1rem'
                            }}>
                                {module.icon}
                            </div>
                            <h3 style={{
                                color: '#0f172a',
                                fontSize: '1.08rem',
                                fontWeight: 800,
                                marginBottom: '0.55rem'
                            }}>
                                {module.title}
                            </h3>
                            <p style={{
                                color: '#475569',
                                fontSize: '0.94rem',
                                lineHeight: 1.55
                            }}>
                                {module.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
