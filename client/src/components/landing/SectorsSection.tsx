import { motion } from 'framer-motion';
import { useVisitor } from '../../context/VisitorContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { HardHat, Droplets, ShieldCheck, Building, ShoppingBag, Utensils, CheckCircle2, Stethoscope } from 'lucide-react';

export default function SectorsSection() {
    const { deviceType } = useVisitor();
    const isViewportMobile = useIsMobile();
    const isMobile = deviceType === 'mobile' || isViewportMobile;

    const sectors = [
        {
            id: 'office',
            icon: <Building size={32} />,
            title: 'PME & TPE (Bureaux)',
            description: 'Simplifiez la vie de vos collaborateurs. Ils posent leurs congés et posent des questions RH directement dans WhatsApp.',
            features: ['Assistant RH 24/7 (RAG)', 'Demandes de congés NLP', 'Transmission notes de frais'],
            color: '#8b5cf6',
            bgColor: '#ddd6fe'
        },
        {
            id: 'retail',
            icon: <ShoppingBag size={32} />,
            title: 'Commerce & Retail',
            description: 'Une communication instantanée entre le siège et les boutiques. Les vendeurs remontent les infos produits d\'une simple photo.',
            features: ['Remontées terrain (Photo)', 'Planning équipe (Bot)', 'Déclaration incidents'],
            color: '#f97316',
            bgColor: '#fed7aa'
        },
        {
            id: 'hospitality',
            icon: <Utensils size={32} />,
            title: 'Hôtellerie & Restauration',
            description: 'Fini les plannings WhatsApp chaotiques. Centralisez les pointages des extras et centralisez les demandes d\'absences.',
            features: ['Pointage des extras', 'Notes vocales urgentes', 'Validation de présence'],
            color: '#ec4899',
            bgColor: '#fbcfe8'
        },
        {
            id: 'hospital',
            icon: <Stethoscope size={32} />,
            title: 'Hôpital & Santé',
            description: 'Les équipes consultent leurs horaires, confirment leur prise de service et signalent absences ou retards sans appeler le standard.',
            features: ['Consultation planning par WhatsApp', 'Pointage prise de service', 'Absences et remplacements'],
            color: '#0ea5e9',
            bgColor: '#bae6fd'
        },
        {
            id: 'btp',
            icon: <HardHat size={32} />,
            title: 'Bâtiment & Travaux (BTP)',
            description: 'Fini les feuilles de pointage papier. Gérez vos équipes itinérantes sur différents chantiers avec le pointage géolocalisé.',
            features: ['Pointage multi-chantiers', 'Notes de frais (OCR)', 'Suivi du parc matériel'],
            color: '#eab308',
            bgColor: '#fef08a'
        },
        {
            id: 'cleaning',
            icon: <Droplets size={32} />,
            title: 'Propreté & Nettoyage',
            description: 'Assurez-vous que les agents sont sur le bon site à la bonne heure. Preuves de passage instantanées par photo.',
            features: ['Preuves de passage horodatées', 'Signalement pannes', 'Planning en direct'],
            color: '#3b82f6',
            bgColor: '#bfdbfe'
        },
        {
            id: 'security',
            icon: <ShieldCheck size={32} />,
            title: 'Sécurité Privée',
            description: 'Garantissez la présence de vos agents. Mains courantes dictées vocalement et rapport PDF généré automatiquement.',
            features: ['Prise de poste sécurisée', 'Bouton SOS', 'Main courante vocale'],
            color: '#10b981',
            bgColor: '#bbf7d0'
        }
    ];

    return (
        <section id="sectors" style={{
            padding: isMobile ? '2.5rem 4%' : '3.25rem 5%',
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
                        fontSize: isMobile ? '1.75rem' : '2.5rem',
                        fontWeight: 800,
                        marginBottom: '1rem',
                        letterSpacing: 0
                    }}>
                        Pensé pour le terrain.
                        <br />
                        <span style={{ color: '#3b82f6' }}>Adapté à votre industrie.</span>
                    </h2>
                    <p style={{
                        color: '#64748b',
                        fontSize: '1.1rem',
                        maxWidth: '650px',
                        margin: '0 auto',
                        lineHeight: 1.6
                    }}>
                        Bureaux, boutiques ou chantiers. Peu importe votre secteur d'activité, WhatsApp est la seule interface que 100% de vos employés maîtrisent déjà.
                    </p>
                </motion.div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(350px, 1fr))',
                    gap: isMobile ? '1rem' : '1.5rem'
                }}>
                    {sectors.map((sector, idx) => (
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
                                padding: isMobile ? '1.5rem' : '1.75rem',
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
                                width: '56px',
                                height: '56px',
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
                                fontSize: '1.35rem',
                                fontWeight: 800,
                                marginBottom: '0.75rem'
                            }}>
                                {sector.title}
                            </h3>
                            
                            <p style={{
                                color: '#475569',
                                fontSize: '1rem',
                                lineHeight: 1.6,
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
                                        fontSize: '0.9rem',
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
            </div>
        </section>
    );
}
