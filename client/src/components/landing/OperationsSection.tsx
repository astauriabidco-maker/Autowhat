import { motion } from 'framer-motion';
import {
    ClipboardCheck,
    FileText,
    MessageCircle,
    Network,
    RefreshCw,
    Route,
    Users
} from 'lucide-react';
import { useVisitor } from '../../context/useVisitor';
import { useIsMobile } from '../../hooks/useMediaQuery';

export default function OperationsSection() {
    const { deviceType } = useVisitor();
    const isViewportMobile = useIsMobile();
    const isMobile = deviceType === 'mobile' || isViewportMobile;

    const modules = [
        {
            icon: <Users size={24} />,
            title: 'Identification',
            description: 'Reconnaissance du collaborateur, du manager ou du contact RH depuis son numéro WhatsApp.',
            color: '#2563eb'
        },
        {
            icon: <MessageCircle size={24} />,
            title: 'Collecte sans friction',
            description: 'Pointage, absence, retard, photo ou document simple arrivent depuis la conversation habituelle.',
            color: '#ea580c'
        },
        {
            icon: <Route size={24} />,
            title: 'Décision manager',
            description: 'L’Inbox concentre les demandes, les validations, les refus et les commentaires utiles.',
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
            title: 'Livraison suivie',
            description: 'Chaque événement a un eventId, un statut, des retries et une trace exploitable.',
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
            padding: isMobile ? '2.5rem 4%' : '3.25rem 5%',
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
                        marginBottom: isMobile ? '1.5rem' : '1.75rem'
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
                            De WhatsApp à la paie, sans portail terrain.
                        </h2>

                        <p style={{
                            color: '#475569',
                            fontSize: '1.08rem',
                            lineHeight: 1.65,
                            maxWidth: '560px'
                        }}>
                            WhatsPoint récupère les signaux terrain dans WhatsApp, les qualifie dans une Inbox manager,
                            puis les transmet aux bons outils RH ou paie avec une preuve technique exploitable.
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
                            { label: 'Signal reçu sur WhatsApp', value: 'Capté', color: '#2563eb' },
                            { label: 'Demande qualifiée pour le manager', value: 'Inbox', color: '#ea580c' },
                            { label: 'Webhook signé vers RH/paie', value: 'HMAC', color: '#16a34a' },
                            { label: 'Retour envoyé au collaborateur', value: 'Notifié', color: '#7c3aed' }
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
                                minHeight: isMobile ? 'auto' : '145px',
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
