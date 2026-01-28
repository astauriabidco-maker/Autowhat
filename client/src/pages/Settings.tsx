import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const INDUSTRIES = [
    { value: 'BTP', label: '🏗️ BTP / Construction' },
    { value: 'RETAIL', label: '🛒 Commerce / Retail' },
    { value: 'CLEANING', label: '🧹 Nettoyage / Propreté' },
    { value: 'SECURITY', label: '🛡️ Sécurité' },
    { value: 'OFFICE', label: '🏢 Bureau / Tertiaire' },
    { value: 'GENERIC', label: '📋 Générique' }
];

interface Settings {
    name: string;
    industry: string;
    workStartTime: string;
    maxWorkHours: number;
    config: {
        enableGps: boolean;
        enablePhotos: boolean;
        enableExpenses: boolean;
        enableDocuments: boolean;
        enableLeaveRequests: boolean;
    };
    vocabulary: {
        workplace: string;
        action_in: string;
        action_out: string;
    };
}

export default function Settings() {
    const navigate = useNavigate();
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [industryChanged, setIndustryChanged] = useState(false);
    const [originalIndustry, setOriginalIndustry] = useState<string>('');

    const API_BASE = window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : '';

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
            return;
        }
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE}/api/settings`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSettings(response.data);
            setOriginalIndustry(response.data.industry);
            setLoading(false);
        } catch (err) {
            setError('Erreur lors du chargement des paramètres');
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!settings) return;

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const token = localStorage.getItem('token');
            await axios.put(`${API_BASE}/api/settings`, {
                ...settings,
                resetToDefaults: industryChanged
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSuccess('✅ Paramètres enregistrés avec succès !');
            setIndustryChanged(false);
            setOriginalIndustry(settings.industry);
            setTimeout(() => setSuccess(null), 5000);
        } catch (err) {
            setError('Erreur lors de la sauvegarde');
        } finally {
            setSaving(false);
        }
    };

    const handleIndustryChange = (newIndustry: string) => {
        if (!settings) return;
        setSettings({ ...settings, industry: newIndustry });
        setIndustryChanged(newIndustry !== originalIndustry);
    };

    const handleConfigToggle = (key: keyof Settings['config']) => {
        if (!settings) return;
        setSettings({
            ...settings,
            config: { ...settings.config, [key]: !settings.config[key] }
        });
    };

    const handleVocabChange = (key: keyof Settings['vocabulary'], value: string) => {
        if (!settings) return;
        setSettings({
            ...settings,
            vocabulary: { ...settings.vocabulary, [key]: value }
        });
    };

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚙️</div>
                    <p>Chargement...</p>
                </div>
            </div>
        );
    }

    if (!settings) return null;

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            padding: '2rem'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '2rem'
            }}>
                <div>
                    <h1 style={{ color: 'white', fontSize: '2rem', margin: 0 }}>⚙️ Paramètres</h1>
                    <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>
                        Configurez votre entreprise et personnalisez le bot
                    </p>
                </div>
                <button
                    onClick={() => navigate('/dashboard')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '0.5rem',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                    }}
                >
                    ← Retour Dashboard
                </button>
            </div>

            {/* Alerts */}
            {error && (
                <div style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    color: '#fca5a5',
                    marginBottom: '1.5rem'
                }}>
                    {error}
                </div>
            )}

            {success && (
                <div style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    border: '1px solid rgba(16, 185, 129, 0.5)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    color: '#6ee7b7',
                    marginBottom: '1.5rem'
                }}>
                    {success}
                </div>
            )}

            {industryChanged && (
                <div style={{
                    background: 'rgba(251, 191, 36, 0.2)',
                    border: '1px solid rgba(251, 191, 36, 0.5)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    color: '#fcd34d',
                    marginBottom: '1.5rem'
                }}>
                    ⚠️ Changement de secteur détecté. Cela chargera les réglages par défaut pour ce secteur.
                </div>
            )}

            {/* Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>

                {/* Card 1: Identity & Sector */}
                <div style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '1rem',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '1.5rem'
                }}>
                    <h2 style={{ color: 'white', marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem' }}>
                        🏢 Identité & Secteur
                    </h2>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                            Nom de l'entreprise
                        </label>
                        <input
                            type="text"
                            value={settings.name}
                            onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '0.5rem',
                                color: 'white',
                                fontSize: '0.875rem',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                            Secteur d'activité
                        </label>
                        <select
                            value={settings.industry}
                            onChange={(e) => handleIndustryChange(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '0.5rem',
                                color: 'white',
                                fontSize: '0.875rem',
                                boxSizing: 'border-box'
                            }}
                        >
                            {INDUSTRIES.map(ind => (
                                <option key={ind.value} value={ind.value}>{ind.label}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                                Heure de début
                            </label>
                            <input
                                type="time"
                                value={settings.workStartTime}
                                onChange={(e) => setSettings({ ...settings, workStartTime: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    background: 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '0.5rem',
                                    color: 'white',
                                    fontSize: '0.875rem',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                                Max heures/jour
                            </label>
                            <input
                                type="number"
                                value={settings.maxWorkHours}
                                onChange={(e) => setSettings({ ...settings, maxWorkHours: parseInt(e.target.value) || 12 })}
                                min={1}
                                max={24}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    background: 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '0.5rem',
                                    color: 'white',
                                    fontSize: '0.875rem',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Card 2: Feature Toggles */}
                <div style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '1rem',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '1.5rem'
                }}>
                    <h2 style={{ color: 'white', marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem' }}>
                        🔧 Modules Activés
                    </h2>

                    {[
                        { key: 'enableGps', icon: '📍', label: 'Géolocalisation (GPS)' },
                        { key: 'enablePhotos', icon: '📸', label: 'Preuves Photo' },
                        { key: 'enableExpenses', icon: '💸', label: 'Notes de Frais' },
                        { key: 'enableDocuments', icon: '📄', label: 'Documents RH' },
                        { key: 'enableLeaveRequests', icon: '🏖️', label: 'Demandes de Congés' }
                    ].map(({ key, icon, label }) => (
                        <div
                            key={key}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.75rem 0',
                                borderBottom: '1px solid rgba(255,255,255,0.1)'
                            }}
                        >
                            <span style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>
                                {icon} {label}
                            </span>
                            <button
                                onClick={() => handleConfigToggle(key as keyof Settings['config'])}
                                style={{
                                    width: '50px',
                                    height: '26px',
                                    borderRadius: '13px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    background: settings.config[key as keyof Settings['config']]
                                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                        : 'rgba(255,255,255,0.2)',
                                    transition: 'background 0.2s ease'
                                }}
                            >
                                <span
                                    style={{
                                        position: 'absolute',
                                        top: '3px',
                                        left: settings.config[key as keyof Settings['config']] ? '27px' : '3px',
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        background: 'white',
                                        transition: 'left 0.2s ease',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                    }}
                                />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Card 3: Vocabulary */}
                <div style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '1rem',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '1.5rem'
                }}>
                    <h2 style={{ color: 'white', marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem' }}>
                        💬 Vocabulaire du Bot
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
                        Personnalisez les termes utilisés par le chatbot
                    </p>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                            🏠 Lieu de travail
                        </label>
                        <input
                            type="text"
                            value={settings.vocabulary.workplace}
                            onChange={(e) => handleVocabChange('workplace', e.target.value)}
                            placeholder="Chantier, Bureau, Magasin..."
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '0.5rem',
                                color: 'white',
                                fontSize: '0.875rem',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                            👋 Action d'arrivée
                        </label>
                        <input
                            type="text"
                            value={settings.vocabulary.action_in}
                            onChange={(e) => handleVocabChange('action_in', e.target.value)}
                            placeholder="Arrivée chantier, Prise de poste..."
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '0.5rem',
                                color: 'white',
                                fontSize: '0.875rem',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                            🏁 Action de départ
                        </label>
                        <input
                            type="text"
                            value={settings.vocabulary.action_out}
                            onChange={(e) => handleVocabChange('action_out', e.target.value)}
                            placeholder="Fin de chantier, Bonne soirée..."
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '0.5rem',
                                color: 'white',
                                fontSize: '0.875rem',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div style={{
                marginTop: '2rem',
                display: 'flex',
                justifyContent: 'center'
            }}>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        padding: '1rem 3rem',
                        background: saving
                            ? 'rgba(255,255,255,0.1)'
                            : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        border: 'none',
                        borderRadius: '0.75rem',
                        color: 'white',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        fontWeight: '600',
                        fontSize: '1rem',
                        boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    {saving ? (
                        <>
                            <span style={{
                                display: 'inline-block',
                                width: '1rem',
                                height: '1rem',
                                border: '2px solid white',
                                borderTopColor: 'transparent',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }}></span>
                            Enregistrement...
                        </>
                    ) : (
                        <>💾 Enregistrer les modifications</>
                    )}
                </button>
            </div>

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
