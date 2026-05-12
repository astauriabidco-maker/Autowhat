import { motion } from 'framer-motion';
import {
    ArrowRight,
    BadgeCheck,
    BriefcaseBusiness,
    CalendarDays,
    ClipboardCheck,
    MessageCircle,
    Send,
    UserRoundCheck,
} from 'lucide-react';
import { useVisitor } from '../../context/VisitorContext';

const steps = [
    {
        icon: <MessageCircle size={22} />,
        title: 'Employé WhatsApp',
        text: 'Pointage, demande de planning, justificatif, incident ou besoin client.',
        color: '#22c55e',
    },
    {
        icon: <BadgeCheck size={22} />,
        title: 'WhatsPoint qualifie',
        text: 'Heure, site, identité, pièce jointe, urgence et contexte métier sont structurés.',
        color: '#2563eb',
    },
    {
        icon: <Send size={22} />,
        title: 'Transmission',
        text: 'Le bon service reçoit une donnée exploitable, en temps réel ou en flux batch.',
        color: '#7c3aed',
    },
    {
        icon: <BriefcaseBusiness size={22} />,
        title: 'Outil métier',
        text: 'RH, planning, intervention, paie, support client, ERP ou connecteur sur mesure.',
        color: '#0f766e',
    },
];

const outcomes = [
    { icon: <UserRoundCheck size={18} />, label: 'RH', detail: 'présence, absences, justificatifs' },
    { icon: <CalendarDays size={18} />, label: 'Planning', detail: 'horaires, remplacements, services' },
    { icon: <ClipboardCheck size={18} />, label: 'Intervention', detail: 'demande client, photo, urgence' },
];

export default function WorkflowSection() {
    const { deviceType } = useVisitor();
    const isMobile = deviceType === 'mobile';

    return (
        <section style={{
            padding: isMobile ? '2.5rem 4%' : '3rem 5%',
            background: '#ffffff',
            borderBottom: '1px solid rgba(15, 23, 42, 0.08)'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <motion.div
                    initial={{ opacity: 0, y: 22 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    viewport={{ once: true }}
                    style={{ textAlign: 'center', marginBottom: isMobile ? '1.75rem' : '2.25rem' }}
                >
                    <p style={{
                        color: '#2563eb',
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '0.7rem'
                    }}>
                        Flux métier
                    </p>
                    <h2 style={{
                        color: '#0f172a',
                        fontSize: isMobile ? '1.85rem' : '2.7rem',
                        lineHeight: 1.08,
                        fontWeight: 850,
                        letterSpacing: 0,
                        marginBottom: '0.85rem'
                    }}>
                        WhatsPoint transforme WhatsApp en données exploitables.
                    </h2>
                    <p style={{
                        color: '#475569',
                        fontSize: isMobile ? '1rem' : '1.12rem',
                        lineHeight: 1.65,
                        maxWidth: '760px',
                        margin: '0 auto'
                    }}>
                        La plateforme ne remplace pas vos outils. Elle collecte les informations terrain,
                        les qualifie, puis les transmet au bon service.
                    </p>
                </motion.div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))',
                    gap: isMobile ? '0.8rem' : '1rem',
                    alignItems: 'stretch',
                    marginBottom: isMobile ? '1.5rem' : '2rem'
                }}>
                    {steps.map((step, index) => (
                        <motion.div
                            key={step.title}
                            initial={{ opacity: 0, y: 18 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45, delay: index * 0.06 }}
                            viewport={{ once: true }}
                            style={{
                                position: 'relative',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '0.75rem',
                                padding: '1.25rem',
                                minHeight: '190px'
                            }}
                        >
                            <div style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '0.75rem',
                                display: 'grid',
                                placeItems: 'center',
                                background: `${step.color}12`,
                                color: step.color,
                                marginBottom: '1rem'
                            }}>
                                {step.icon}
                            </div>
                            <h3 style={{
                                color: '#0f172a',
                                fontSize: '1.08rem',
                                fontWeight: 800,
                                marginBottom: '0.55rem'
                            }}>
                                {step.title}
                            </h3>
                            <p style={{
                                color: '#475569',
                                fontSize: '0.95rem',
                                lineHeight: 1.55,
                                margin: 0
                            }}>
                                {step.text}
                            </p>
                            {!isMobile && index < steps.length - 1 && (
                                <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    right: '-22px',
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '999px',
                                    display: 'grid',
                                    placeItems: 'center',
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    color: '#64748b',
                                    zIndex: 2
                                }}>
                                    <ArrowRight size={18} />
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
                    gap: '0.8rem'
                }}>
                    {outcomes.map((outcome) => (
                        <div key={outcome.label} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.8rem',
                            padding: '0.9rem 1rem',
                            border: '1px solid #dbeafe',
                            borderRadius: '0.75rem',
                            background: '#eff6ff'
                        }}>
                            <span style={{
                                display: 'inline-flex',
                                color: '#2563eb',
                                flexShrink: 0
                            }}>
                                {outcome.icon}
                            </span>
                            <span>
                                <strong style={{ color: '#0f172a' }}>{outcome.label}</strong>
                                <span style={{ color: '#475569' }}> · {outcome.detail}</span>
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
