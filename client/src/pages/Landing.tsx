import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Zap,
    MapPin,
    Bot,
    MessageCircle,
    Building2,
    Sparkles,
    ShieldCheck,
    Clock,
    FileSpreadsheet,
    ChevronRight
} from 'lucide-react';

const SECTORS = [
    { id: 'btp', label: '🏗️ BTP', desc: 'Pointage chantier avec GPS et photos de progression.' },
    { id: 'cleaning', label: '🧹 Nettoyage', desc: 'Validation des interventions site par site.' },
    { id: 'security', label: '🛡️ Sécurité', desc: 'Contrôle des vacations et relèves.' },
    { id: 'retail', label: '🛒 Commerce', desc: 'Gestion des équipes en magasin.' }
];

export default function Landing() {
    const navigate = useNavigate();
    const [activeSector, setActiveSector] = useState('btp');

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a' }}>
            {/* Navbar */}
            <nav style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.5rem 5%',
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                background: 'rgba(15, 23, 42, 0.9)',
                backdropFilter: 'blur(10px)',
                zIndex: 100,
                borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MessageCircle size={28} color="#3b82f6" />
                    <span style={{ color: 'white', fontWeight: 700, fontSize: '1.25rem' }}>
                        WhatsPoint
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '2rem' }}>
                    <a href="#features" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem' }}>
                        Fonctionnalités
                    </a>
                    <a href="#sectors" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem' }}>
                        Secteurs
                    </a>
                    <a href="#pricing" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem' }}>
                        Tarifs
                    </a>
                </div>
                <button
                    onClick={() => navigate('/login')}
                    style={{
                        padding: '0.6rem 1.5rem',
                        background: 'transparent',
                        border: '1px solid #3b82f6',
                        borderRadius: '0.5rem',
                        color: '#3b82f6',
                        cursor: 'pointer',
                        fontWeight: 500,
                        fontSize: '0.9rem'
                    }}
                >
                    Espace Manager
                </button>
            </nav>

            {/* Hero Section */}
            <section style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #1e3a8a 0%, #312e81 50%, #0f172a 100%)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 5%',
                paddingTop: '80px'
            }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
                    {/* Left: Text */}
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: 'rgba(59, 130, 246, 0.2)',
                            padding: '0.5rem 1rem',
                            borderRadius: '2rem',
                            marginBottom: '1.5rem'
                        }}>
                            <Sparkles size={16} color="#60a5fa" />
                            <span style={{ color: '#60a5fa', fontSize: '0.85rem' }}>
                                Nouveau : Multi-secteurs disponible
                            </span>
                        </div>

                        <h1 style={{
                            color: 'white',
                            fontSize: '3.5rem',
                            fontWeight: 800,
                            lineHeight: 1.1,
                            marginBottom: '1.5rem'
                        }}>
                            La Gestion d'Équipe Terrain,{' '}
                            <span style={{ color: '#60a5fa' }}>sans installer d'App.</span>
                        </h1>

                        <p style={{
                            color: '#94a3b8',
                            fontSize: '1.25rem',
                            lineHeight: 1.6,
                            marginBottom: '2rem',
                            maxWidth: '500px'
                        }}>
                            Pilotez les heures, les congés et les frais de vos équipes directement via WhatsApp.
                            <strong style={{ color: '#e2e8f0' }}> 0% de formation, 100% d'adoption.</strong>
                        </p>

                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <a
                                href="https://wa.me/33612345678?text=Demo"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '1rem 2rem',
                                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                    borderRadius: '0.75rem',
                                    color: 'white',
                                    textDecoration: 'none',
                                    fontWeight: 600,
                                    fontSize: '1rem',
                                    boxShadow: '0 10px 30px rgba(34, 197, 94, 0.3)'
                                }}
                            >
                                <MessageCircle size={20} />
                                Essayer la Démo WhatsApp
                            </a>
                            <button
                                onClick={() => navigate('/login')}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '1rem 2rem',
                                    background: 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '0.75rem',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    fontSize: '1rem'
                                }}
                            >
                                Voir le Dashboard
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </motion.div>

                    {/* Right: WhatsApp Mockup */}
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                    >
                        <div style={{
                            background: '#1f2937',
                            borderRadius: '2rem',
                            padding: '1rem',
                            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                            width: '320px'
                        }}>
                            {/* Phone Header */}
                            <div style={{
                                background: '#075e54',
                                borderRadius: '1rem 1rem 0 0',
                                padding: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem'
                            }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Bot size={20} color="white" />
                                </div>
                                <div>
                                    <div style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem' }}>
                                        WhatsPoint Bot
                                    </div>
                                    <div style={{ color: '#25d366', fontSize: '0.75rem' }}>
                                        en ligne
                                    </div>
                                </div>
                            </div>

                            {/* Chat Messages */}
                            <div style={{
                                background: '#0b141a',
                                padding: '1rem',
                                minHeight: '280px'
                            }}>
                                {/* User message */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    marginBottom: '0.75rem'
                                }}>
                                    <div style={{
                                        background: '#005c4b',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '0.75rem 0.75rem 0 0.75rem',
                                        maxWidth: '80%'
                                    }}>
                                        <span style={{ color: 'white', fontSize: '0.9rem' }}>Hi 👋</span>
                                        <div style={{ color: '#8696a0', fontSize: '0.7rem', textAlign: 'right', marginTop: '0.25rem' }}>
                                            08:02 ✓✓
                                        </div>
                                    </div>
                                </div>

                                {/* Bot response */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'flex-start',
                                    marginBottom: '0.75rem'
                                }}>
                                    <div style={{
                                        background: '#1f2c34',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '0.75rem 0.75rem 0.75rem 0',
                                        maxWidth: '85%'
                                    }}>
                                        <span style={{ color: 'white', fontSize: '0.9rem' }}>
                                            ✅ <strong>Pointage enregistré !</strong>
                                            <br />
                                            <span style={{ color: '#8696a0' }}>
                                                📍 Chantier Rivoli<br />
                                                🕐 08:02
                                            </span>
                                        </span>
                                        <div style={{ color: '#8696a0', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                                            08:02
                                        </div>
                                    </div>
                                </div>

                                {/* Quick actions */}
                                <div style={{
                                    display: 'flex',
                                    gap: '0.5rem',
                                    flexWrap: 'wrap',
                                    marginTop: '1rem'
                                }}>
                                    {['📊 Stats', '📄 Documents', '💸 Frais'].map(btn => (
                                        <div key={btn} style={{
                                            background: 'rgba(37, 211, 102, 0.1)',
                                            border: '1px solid #25d366',
                                            padding: '0.5rem 0.75rem',
                                            borderRadius: '1rem',
                                            color: '#25d366',
                                            fontSize: '0.8rem'
                                        }}>
                                            {btn}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" style={{
                padding: '6rem 5%',
                background: '#0f172a'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        style={{ textAlign: 'center', marginBottom: '4rem' }}
                    >
                        <h2 style={{ color: 'white', fontSize: '2.5rem', fontWeight: 700, marginBottom: '1rem' }}>
                            Pourquoi WhatsPoint ?
                        </h2>
                        <p style={{ color: '#64748b', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
                            La solution la plus simple pour gérer vos équipes terrain
                        </p>
                    </motion.div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
                        {[
                            {
                                icon: <Zap size={32} />,
                                title: 'Déploiement Éclair',
                                desc: 'Ajoutez vos employés, ils reçoivent un WhatsApp. C\'est tout. Rien à installer.',
                                color: '#f59e0b'
                            },
                            {
                                icon: <MapPin size={32} />,
                                title: 'Preuves Terrain',
                                desc: 'Géolocalisation GPS et Photos obligatoires. Fini les doutes.',
                                color: '#10b981'
                            },
                            {
                                icon: <Bot size={32} />,
                                title: '100% Automatisé',
                                desc: 'Le bot relance les retardataires et génère le fichier Excel de paie.',
                                color: '#8b5cf6'
                            }
                        ].map((feature, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: idx * 0.1 }}
                                viewport={{ once: true }}
                                style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '1rem',
                                    padding: '2rem',
                                    textAlign: 'center'
                                }}
                            >
                                <div style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '1rem',
                                    background: `${feature.color}20`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 1.5rem',
                                    color: feature.color
                                }}>
                                    {feature.icon}
                                </div>
                                <h3 style={{ color: 'white', fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                                    {feature.title}
                                </h3>
                                <p style={{ color: '#64748b', lineHeight: 1.6 }}>
                                    {feature.desc}
                                </p>
                            </motion.div>
                        ))}
                    </div>

                    {/* Secondary features */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginTop: '3rem' }}>
                        {[
                            { icon: <Clock size={24} />, label: 'Pointage temps réel' },
                            { icon: <FileSpreadsheet size={24} />, label: 'Export Excel' },
                            { icon: <ShieldCheck size={24} />, label: 'RGPD compliant' },
                            { icon: <Building2 size={24} />, label: 'Multi-sites' }
                        ].map((item, idx) => (
                            <div key={idx} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '1rem',
                                background: 'rgba(255,255,255,0.02)',
                                borderRadius: '0.75rem',
                                border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                                <div style={{ color: '#3b82f6' }}>{item.icon}</div>
                                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Sectors Section */}
            <section id="sectors" style={{
                padding: '6rem 5%',
                background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)'
            }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        style={{ textAlign: 'center', marginBottom: '3rem' }}
                    >
                        <h2 style={{ color: 'white', fontSize: '2.5rem', fontWeight: 700, marginBottom: '1rem' }}>
                            Adapté à votre secteur
                        </h2>
                        <p style={{ color: '#64748b', fontSize: '1.1rem' }}>
                            Vocabulaire et fonctionnalités personnalisés par métier
                        </p>
                    </motion.div>

                    {/* Tabs */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        marginBottom: '2rem',
                        flexWrap: 'wrap'
                    }}>
                        {SECTORS.map(sector => (
                            <button
                                key={sector.id}
                                onClick={() => setActiveSector(sector.id)}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: activeSector === sector.id
                                        ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                                        : 'rgba(255,255,255,0.05)',
                                    border: 'none',
                                    borderRadius: '2rem',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    fontSize: '0.9rem',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {sector.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <motion.div
                        key={activeSector}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '1rem',
                            padding: '2rem',
                            textAlign: 'center'
                        }}
                    >
                        <p style={{ color: '#e2e8f0', fontSize: '1.1rem' }}>
                            {SECTORS.find(s => s.id === activeSector)?.desc}
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* CTA Section */}
            <section style={{
                padding: '6rem 5%',
                background: '#0f172a',
                textAlign: 'center'
            }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    style={{
                        maxWidth: '800px',
                        margin: '0 auto',
                        background: 'linear-gradient(135deg, #1e3a8a 0%, #4f46e5 100%)',
                        borderRadius: '1.5rem',
                        padding: '4rem 2rem'
                    }}
                >
                    <h2 style={{ color: 'white', fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>
                        Prêt à simplifier votre gestion d'équipe ?
                    </h2>
                    <p style={{ color: '#c7d2fe', marginBottom: '2rem' }}>
                        Essayez gratuitement pendant 14 jours. Sans engagement.
                    </p>
                    <a
                        href="https://wa.me/33612345678?text=Demo"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '1rem 2.5rem',
                            background: 'white',
                            borderRadius: '0.75rem',
                            color: '#1e3a8a',
                            textDecoration: 'none',
                            fontWeight: 600,
                            fontSize: '1rem'
                        }}
                    >
                        <MessageCircle size={20} />
                        Démarrer l'essai gratuit
                    </a>
                </motion.div>
            </section>

            {/* Footer */}
            <footer style={{
                padding: '3rem 5%',
                background: '#0f172a',
                borderTop: '1px solid rgba(255,255,255,0.1)'
            }}>
                <div style={{
                    maxWidth: '1200px',
                    margin: '0 auto',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <MessageCircle size={20} color="#3b82f6" />
                        <span style={{ color: '#64748b', fontSize: '0.9rem' }}>
                            © 2026 WhatsPoint. Tous droits réservés.
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: '2rem' }}>
                        <a href="/legal" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem' }}>
                            Mentions légales
                        </a>
                        <a href="/privacy" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem' }}>
                            Confidentialité
                        </a>
                        <a href="mailto:contact@whatspoint.fr" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem' }}>
                            Contact
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
