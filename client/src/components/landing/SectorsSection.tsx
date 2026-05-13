import { motion } from 'framer-motion';
import { useVisitor } from '../../context/VisitorContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { HardHat, Droplets, ShieldCheck, Building, ShoppingBag, Utensils, CheckCircle2, Stethoscope } from 'lucide-react';

export default function SectorsSection() {
    const { deviceType } = useVisitor();
    const isNarrowViewport = useMediaQuery('(max-width: 767px)');
    const isTabletViewport = useMediaQuery('(min-width: 768px) and (max-width: 900px)');
    const isMobile = deviceType === 'mobile' || isNarrowViewport;
    const isTablet = !isMobile && isTabletViewport;

    const sectors = [
        {
            id: 'hospital',
            icon: <Stethoscope size={32} />,
            title: 'Hôpital & Santé',
            description: 'Les équipes consultent leurs horaires, confirment leur prise de service et signalent les absences sans appeler le standard.',
            features: ['Planning consultable', 'Prise de service', 'Absences et remplacements'],
            color: '#0ea5e9',
            bgColor: '#bae6fd'
        },
        {
            id: 'btp',
            icon: <HardHat size={32} />,
            title: 'BTP & chantiers',
            description: 'Les équipes itinérantes pointent sur site, remontent les justificatifs et transmettent les incidents terrain.',
            features: ['Pointage géolocalisé', 'Justificatifs photo', 'Incidents chantier'],
            color: '#eab308',
            bgColor: '#fef08a'
        },
        {
            id: 'cleaning',
            icon: <Droplets size={32} />,
            title: 'Propreté & Nettoyage',
            description: 'Les agents confirment leur passage, ajoutent une photo et signalent les anomalies depuis le lieu d’intervention.',
            features: ['Preuves de passage', 'Planning agent', 'Signalement anomalie'],
            color: '#3b82f6',
            bgColor: '#bfdbfe'
        },
        {
            id: 'security',
            icon: <ShieldCheck size={32} />,
            title: 'Sécurité privée',
            description: 'Les agents valident leur prise de poste, déclarent un événement et gardent une trace horodatée.',
            features: ['Prise de poste', 'Main courante', 'Alerte événement'],
            color: '#10b981',
            bgColor: '#bbf7d0'
        },
        {
            id: 'retail',
            icon: <ShoppingBag size={32} />,
            title: 'Commerce & Retail',
            description: 'Les boutiques remontent les incidents, les demandes siège et les informations terrain sans ouvrir d’outil complexe.',
            features: ['Remontées magasin', 'Demandes siège', 'Suivi CRM / ERP'],
            color: '#f97316',
            bgColor: '#fed7aa'
        },
        {
            id: 'hospitality',
            icon: <Utensils size={32} />,
            title: 'Hôtellerie & Restauration',
            description: 'Les extras et équipes postées consultent leurs horaires, pointent et signalent les changements de dernière minute.',
            features: ['Pointage extras', 'Planning équipe', 'Absences urgentes'],
            color: '#ec4899',
            bgColor: '#fbcfe8'
        }
    ];

    return (
        <section id="sectors" style={{
            padding: isMobile ? '2.5rem 4%' : (isTablet ? '2.75rem 5%' : '3.25rem 5%'),
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <motion.div
                    initial={{ y: 24 }}
                    whileInView={{ y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    style={{ textAlign: 'center', marginBottom: isMobile ? '1.5rem' : '2rem' }}
                >
                    <h2 style={{
                        color: '#0f172a',
                        fontSize: isMobile ? '1.75rem' : (isTablet ? '2.15rem' : '2.5rem'),
                        fontWeight: 800,
                        marginBottom: '1rem',
                        letterSpacing: 0
                    }}>
                        Présence, planning et demandes terrain
                        <br />
                        <span style={{ color: '#3b82f6' }}>par secteur.</span>
                    </h2>
                    <p style={{
                        color: '#64748b',
                        fontSize: isMobile ? '1rem' : '1.1rem',
                        maxWidth: '650px',
                        margin: '0 auto',
                        lineHeight: 1.6
                    }}>
                        Les mêmes réflexes WhatsApp s’adaptent à vos contraintes métier :
                        horaires, sites, justificatifs, incidents et demandes à transmettre.
                    </p>
                </motion.div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : (isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))'),
                    gap: isMobile ? '0.85rem' : '1rem'
                }}>
                    {sectors.slice(0, 4).map((sector, idx) => (
                        <motion.div
                            key={sector.id}
                            initial={{ y: 22 }}
                            whileInView={{ y: 0 }}
                            transition={{ duration: 0.5, delay: idx * 0.1 }}
                            viewport={{ once: true }}
                            style={{
                                background: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '1.25rem',
                                padding: isMobile ? '1.35rem' : '1.35rem',
                                minHeight: isMobile ? 'auto' : '255px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                display: 'flex',
                                flexDirection: 'column',
                                transition: 'all 0.2s ease',
                                cursor: 'default'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                                e.currentTarget.style.borderColor = '#cbd5e1';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                            }}
                        >
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '1rem',
                                background: sector.bgColor,
                                color: sector.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '1.1rem'
                            }}>
                                {sector.icon}
                            </div>
                            
                            <h3 style={{
                                color: '#0f172a',
                                fontSize: '1.18rem',
                                fontWeight: 800,
                                marginBottom: '0.75rem'
                            }}>
                                {sector.title}
                            </h3>
                            
                            <p style={{
                                color: '#475569',
                                fontSize: '0.93rem',
                                lineHeight: 1.5,
                                flex: 1,
                                marginBottom: '1.1rem'
                            }}>
                                {sector.description}
                            </p>

                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {sector.features.map((feature, fIdx) => (
                                    <li key={fIdx} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        color: '#334155',
                                        fontSize: '0.84rem',
                                        fontWeight: 500,
                                        marginBottom: '0.5rem'
                                    }}>
                                        <CheckCircle2 size={16} color={sector.color} />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    ))}
                </div>

                <motion.div
                    initial={{ y: 18 }}
                    whileInView={{ y: 0 }}
                    transition={{ duration: 0.45, delay: 0.2 }}
                    viewport={{ once: true }}
                    style={{
                        margin: isMobile ? '1rem auto 0' : '1.35rem auto 0',
                        padding: isMobile ? '1rem' : '1rem 1.25rem',
                        maxWidth: '820px',
                        border: '1px dashed #cbd5e1',
                        borderRadius: '1rem',
                        background: '#f8fafc',
                        color: '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.65rem',
                        textAlign: 'center',
                        fontSize: '0.92rem',
                        fontWeight: 600,
                        lineHeight: 1.5
                    }}
                >
                    <Building size={18} color="#64748b" />
                    <span>Autres environnements : commerce, restauration, bureaux, logistique, sites industriels et réseaux d’agences.</span>
                </motion.div>
            </div>
        </section>
    );
}
