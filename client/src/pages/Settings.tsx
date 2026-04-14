import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Save,
    Building2,
    Cpu,
    MessageSquare,
    MapPin,
    Camera,
    Receipt,
    FileText,
    Bell,
    Loader2,
    CheckCircle,
    Globe,
    CreditCard,
    ExternalLink,
    Crown,
    Brain,
    Eye,
    MessageSquare as MessageIcon
} from 'lucide-react';
import Switch from '../components/ui/Switch';
import Combobox from '../components/ui/Combobox';

// Country configurations
const COUNTRIES = [
    { code: 'FR', flag: '🇫🇷', name: 'France', legalIdLabel: 'Numéro SIRET', taxLabel: 'N° TVA Intracommunautaire' },
    { code: 'CM', flag: '🇨🇲', name: 'Cameroun', legalIdLabel: 'Numéro NIU', taxLabel: 'Numéro Contribuable' },
    { code: 'US', flag: '🇺🇸', name: 'USA', legalIdLabel: 'EIN Number', taxLabel: 'Tax ID' },
    { code: 'CA', flag: '🇨🇦', name: 'Canada', legalIdLabel: 'Business Number', taxLabel: 'GST/HST Number' },
    { code: 'OTHER', flag: '🌍', name: 'Autre', legalIdLabel: 'Registration ID', taxLabel: 'Tax ID' }
];

// Industry suggestions
const INDUSTRY_SUGGESTIONS = [
    '🏗️ BTP / Construction',
    '🍽️ Restauration',
    '🧹 Services / Nettoyage',
    '🏢 Bureaux / Tertiaire',
    '🛒 Commerce / Retail',
    '🛡️ Sécurité',
    '🏥 Santé',
    '📦 Logistique'
];

// Default vocabulary by industry
const getDefaultVocabulary = (industry: string) => {
    const lower = industry.toLowerCase();
    if (lower.includes('btp') || lower.includes('construction')) {
        return { workplace: 'Chantier', manager: 'Chef', action_in: 'Start', action_out: 'Stop' };
    }
    if (lower.includes('restaurant')) {
        return { workplace: 'Restaurant', manager: 'Responsable', action_in: 'Service', action_out: 'Fin' };
    }
    if (lower.includes('nettoyage') || lower.includes('service')) {
        return { workplace: 'Site', manager: 'Chef d\'équipe', action_in: 'Arrivée', action_out: 'Départ' };
    }
    if (lower.includes('bureau') || lower.includes('tertiaire')) {
        return { workplace: 'Bureau', manager: 'Manager', action_in: 'Bonjour', action_out: 'Au revoir' };
    }
    // Generic default
    return { workplace: 'Lieu', manager: 'Responsable', action_in: 'Arrivée', action_out: 'Départ' };
};

interface Settings {
    name: string;
    industry: string;
    country: string;
    legalName: string;
    legalId: string;
    taxId: string;
    address: string;
    city: string;
    config: {
        enableGps: boolean;
        enablePhotos: boolean;
        enableExpenses: boolean;
        enableDocuments: boolean;
        enableReminders: boolean;
        enableVisionOcr?: boolean;
        enableRagFaq?: boolean;
        botPersonality?: string;
        logoUrl?: string;
    };
    vocabulary: {
        workplace: string;
        manager: string;
        action_in: string;
        action_out: string;
    };
}

interface ModuleItemProps {
    icon: React.ReactNode;
    label: string;
    description: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}

function ModuleItem({ icon, label, description, checked, onChange }: ModuleItemProps) {
    return (
        <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg transition-colors ${checked ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                    {icon}
                </div>
                <div>
                    <p className="font-medium text-gray-900">{label}</p>
                    <p className="text-sm text-gray-500">{description}</p>
                </div>
            </div>
            <Switch checked={checked} onChange={onChange} />
        </div>
    );
}

export default function Settings() {
    const navigate = useNavigate();
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Billing state
    const [billingPlan, setBillingPlan] = useState<string>('TRIAL');
    const [billingLoading, setBillingLoading] = useState(false);

    const currentCountry = COUNTRIES.find(c => c.code === settings?.country) || COUNTRIES[0];

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
            return;
        }
        fetchSettings();
        fetchBillingStatus();
    }, [navigate]);

    const fetchSettings = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/settings', {
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = response.data;
            setSettings({
                name: data.name || '',
                industry: data.industry || 'BTP',
                country: data.country || 'FR',
                legalName: data.legalName || '',
                legalId: data.legalId || '',
                taxId: data.taxId || '',
                address: data.address || '',
                city: data.city || '',
                config: {
                    enableGps: data.config?.enableGps ?? true,
                    enablePhotos: data.config?.enablePhotos ?? true,
                    enableExpenses: data.config?.enableExpenses ?? true,
                    enableDocuments: data.config?.enableDocuments ?? true,
                    enableReminders: data.config?.enableReminders ?? true,
                    enableVisionOcr: data.config?.enableVisionOcr ?? true,
                    enableRagFaq: data.config?.enableRagFaq ?? false,
                    botPersonality: data.config?.botPersonality ?? 'Je suis l\'assistant RH.',
                    logoUrl: data.config?.logoUrl || ''
                },
                vocabulary: {
                    workplace: data.vocabulary?.workplace || 'Chantier',
                    manager: data.vocabulary?.manager || 'Chef',
                    action_in: data.vocabulary?.action_in || 'Start',
                    action_out: data.vocabulary?.action_out || 'Stop'
                }
            });
        } catch (err) {
            console.error('Error loading settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !settings) return;

        const formData = new FormData();
        formData.append('logo', file);

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/settings/logo', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            setSettings({
                ...settings,
                config: { ...settings.config, logoUrl: res.data.logoUrl }
            });
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
        } catch (err) {
            console.error('Error uploading logo:', err);
        }
    };

    const fetchBillingStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/billing/status', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBillingPlan(response.data.plan || 'TRIAL');
        } catch (err) {
            console.error('Error loading billing:', err);
        }
    };

    const handleSubscribe = async () => {
        setBillingLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post('/api/billing/checkout', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.url) {
                window.location.href = response.data.url;
            }
        } catch (err) {
            console.error('Checkout error:', err);
        } finally {
            setBillingLoading(false);
        }
    };

    const handleManageBilling = async () => {
        setBillingLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post('/api/billing/portal', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.url) {
                window.location.href = response.data.url;
            }
        } catch (err) {
            console.error('Portal error:', err);
        } finally {
            setBillingLoading(false);
        }
    };

    const handleIndustryChange = (newIndustry: string) => {
        if (!settings) return;

        const defaults = getDefaultVocabulary(newIndustry);
        setSettings({
            ...settings,
            industry: newIndustry,
            vocabulary: defaults
        });
        setHasChanges(true);
    };

    const handleConfigChange = (key: keyof Settings['config'], value: boolean) => {
        if (!settings) return;
        setSettings({
            ...settings,
            config: { ...settings.config, [key]: value }
        });
        setHasChanges(true);
    };

    const handleVocabularyChange = (key: keyof Settings['vocabulary'], value: string) => {
        if (!settings) return;
        setSettings({
            ...settings,
            vocabulary: { ...settings.vocabulary, [key]: value }
        });
        setHasChanges(true);
    };

    const handlePersonalityChange = (value: string) => {
        if (!settings) return;
        setSettings({
            ...settings,
            config: { ...settings.config, botPersonality: value }
        });
        setHasChanges(true);
    };

    const updateField = (field: keyof Settings, value: any) => {
        if (!settings) return;
        setSettings({ ...settings, [field]: value });
        setHasChanges(true);
    };

    const handleSave = async () => {
        if (!settings) return;

        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            await axios.put('/api/settings', settings, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowToast(true);
            setHasChanges(false);
            setTimeout(() => setShowToast(false), 3000);
        } catch (err) {
            console.error('Error saving settings:', err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-gray-400" size={32} />
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-red-500">Erreur de chargement</div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto pb-24">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
                <p className="text-gray-500 mt-1">Configurez votre espace de travail et le comportement du Bot</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* --- COLONNE GAUCHE (2/3) --- */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Card 1: Identité & Profil Légal */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-50 rounded-lg">
                                    <Building2 size={22} className="text-blue-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">Identité Entreprise</h2>
                                    <p className="text-sm text-gray-500">Informations légales et logo</p>
                                </div>
                            </div>
                            
                            {/* Logo Upload */}
                            <div className="relative">
                                <label className="cursor-pointer group block">
                                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                                    {settings.config.logoUrl ? (
                                        <div className="w-20 h-20 rounded-lg border border-gray-200 overflow-hidden relative shadow-sm">
                                            <img src={settings.config.logoUrl} alt="Logo" className="w-full h-full object-contain bg-gray-50" />
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Camera className="text-white w-6 h-6" />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 bg-gray-50 group-hover:bg-gray-100 group-hover:border-blue-400 transition-colors">
                                            <Camera className="w-6 h-6 mb-1" />
                                            <span className="text-[10px] font-medium uppercase">Logo</span>
                                        </div>
                                    )}
                                </label>
                            </div>
                        </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Pays */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            <Globe size={14} className="inline mr-1" />
                            Pays
                        </label>
                        <select
                            value={settings.country}
                            onChange={(e) => updateField('country', e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        >
                            {COUNTRIES.map(c => (
                                <option key={c.code} value={c.code}>
                                    {c.flag} {c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Nom commercial */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Nom Commercial
                        </label>
                        <input
                            type="text"
                            value={settings.name}
                            onChange={(e) => updateField('name', e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Ma Société"
                        />
                    </div>

                    {/* Raison Sociale */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Raison Sociale
                        </label>
                        <input
                            type="text"
                            value={settings.legalName}
                            onChange={(e) => updateField('legalName', e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Ma Société SAS"
                        />
                    </div>

                    {/* Identifiant Légal (label dynamique) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            {currentCountry.legalIdLabel}
                        </label>
                        <input
                            type="text"
                            value={settings.legalId}
                            onChange={(e) => updateField('legalId', e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder={settings.country === 'FR' ? '123 456 789 00012' : ''}
                        />
                    </div>

                    {/* Numéro TVA */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            {currentCountry.taxLabel}
                        </label>
                        <input
                            type="text"
                            value={settings.taxId}
                            onChange={(e) => updateField('taxId', e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder={settings.country === 'FR' ? 'FR12345678901' : ''}
                        />
                    </div>

                    {/* Adresse */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Adresse
                        </label>
                        <input
                            type="text"
                            value={settings.address}
                            onChange={(e) => updateField('address', e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="123 rue de l'Exemple"
                        />
                    </div>

                    {/* Ville */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Ville
                        </label>
                        <input
                            type="text"
                            value={settings.city}
                            onChange={(e) => updateField('city', e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Paris"
                        />
                    </div>

                    {/* Secteur d'activité (Combobox) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Secteur d'activité
                        </label>
                        <Combobox
                            value={settings.industry}
                            onChange={handleIndustryChange}
                            options={INDUSTRY_SUGGESTIONS}
                            placeholder="Sélectionner ou créer..."
                            allowCreate={true}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            💡 Nouveau secteur = vocabulaire générique personnalisable
                        </p>
                    </div>
                    </div>
                </div>

                {/* Card 2: Modules Actifs */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-green-50 rounded-lg">
                        <Cpu size={22} className="text-green-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Modules Actifs</h2>
                        <p className="text-sm text-gray-500">Activez ou désactivez les fonctionnalités du Bot</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                    <ModuleItem
                        icon={<MapPin size={18} />}
                        label="📍 Géolocalisation (GPS)"
                        description="Enregistre la position au pointage"
                        checked={settings.config.enableGps}
                        onChange={(v) => handleConfigChange('enableGps', v)}
                    />
                    <ModuleItem
                        icon={<Camera size={18} />}
                        label="📸 Preuves Photo"
                        description="Demande une photo au pointage"
                        checked={settings.config.enablePhotos}
                        onChange={(v) => handleConfigChange('enablePhotos', v)}
                    />
                    <ModuleItem
                        icon={<Receipt size={18} />}
                        label="💸 Notes de Frais"
                        description="Soumettre des frais par WhatsApp"
                        checked={settings.config.enableExpenses}
                        onChange={(v) => handleConfigChange('enableExpenses', v)}
                    />
                    <ModuleItem
                        icon={<FileText size={18} />}
                        label="📂 Documents"
                        description="Coffre-fort et partage RH"
                        checked={settings.config.enableDocuments}
                        onChange={(v) => handleConfigChange('enableDocuments', v)}
                    />
                    <ModuleItem
                        icon={<Bell size={18} />}
                        label="🔔 Rappels Automatiques"
                        description="Notifications d'absence et rappels"
                        checked={settings.config.enableReminders}
                        onChange={(v) => handleConfigChange('enableReminders', v)}
                    />
                </div>
            </div>

            {/* Card 2.5: Intelligence Artificielle */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-24 bg-purple-200/50 blur-[80px] rounded-full pointer-events-none" />
                
                <div className="flex items-center gap-3 mb-6 relative z-10">
                    <div className="p-2.5 bg-indigo-600 rounded-lg shadow-md shadow-indigo-200">
                        <Brain size={22} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-indigo-950">Intelligence Artificielle (WhatsPoint Brain)</h2>
                        <p className="text-sm text-indigo-800/70">Pilotez les capacités cognitives de votre bot WhatsApp</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 relative z-10">
                    <ModuleItem
                        icon={<Eye size={18} />}
                        label="👁️ Lecture OCR (Notes de Frais)"
                        description="L'IA lit et extrait les montants des tickets de caisse via Vision."
                        checked={settings.config.enableVisionOcr ?? true}
                        onChange={(v) => handleConfigChange('enableVisionOcr', v)}
                    />
                    <ModuleItem
                        icon={<MessageIcon size={18} />}
                        label="🧠 Assistant RH (RAG)"
                        description="Le Bot répond aux questions en lisant vos Documents RH."
                        checked={settings.config.enableRagFaq ?? false}
                        onChange={(v) => handleConfigChange('enableRagFaq', v)}
                    />
                </div>

                <div className="mt-6 pt-6 border-t border-indigo-200/50 relative z-10">
                    <label className="block text-sm font-bold text-indigo-900 mb-2">
                        Personnalité de l'Assistant
                    </label>
                    <textarea 
                        value={settings.config.botPersonality || ''}
                        onChange={(e) => handlePersonalityChange(e.target.value)}
                        className="w-full h-20 p-3 bg-white/80 border border-indigo-200 rounded-xl text-sm text-slate-700 font-mono focus:ring-2 focus:ring-indigo-500 transition-all resize-none shadow-inner"
                        placeholder="Ex: Tu es un assistant strict, réponds très brièvement et de façon professionnelle..."
                    />
                    <p className="mt-1 text-xs text-indigo-800/60 font-medium">Les employés interagiront avec cette personnalité dynamique.</p>
                </div>
            </div>
            
            </div> {/* END COLONNE GAUCHE */}

            {/* --- COLONNE DROITE (1/3) --- */}
            <div className="space-y-8">

            {/* Card 3: Mon Abonnement */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-amber-50 rounded-lg">
                        <CreditCard size={22} className="text-amber-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Mon Abonnement</h2>
                        <p className="text-sm text-gray-500">Gérez votre plan et votre facturation</p>
                    </div>
                </div>

                {billingPlan === 'PRO' || billingPlan === 'ENTERPRISE' ? (
                    // PRO/ENTERPRISE - Already subscribed
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <CheckCircle className="text-green-600" size={24} />
                            <div>
                                <p className="font-semibold text-green-700">
                                    Abonnement {billingPlan} Actif
                                </p>
                                <p className="text-sm text-green-600">
                                    Employés illimités • Toutes les fonctionnalités
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleManageBilling}
                            disabled={billingLoading}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
                        >
                            {billingLoading ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <ExternalLink size={18} />
                            )}
                            Gérer mon abonnement / Factures
                        </button>
                    </div>
                ) : (
                    // TRIAL - Show pricing card
                    <div className="border border-indigo-200 rounded-xl p-6 bg-gradient-to-br from-indigo-50 to-white">
                        <div className="flex items-center gap-2 mb-4">
                            <Crown className="text-amber-500" size={24} />
                            <span className="text-sm font-medium text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">
                                Plan PRO
                            </span>
                        </div>

                        <div className="mb-4">
                            <span className="text-4xl font-bold text-gray-900">29€</span>
                            <span className="text-gray-500">/mois</span>
                        </div>

                        <ul className="space-y-2 mb-6 text-sm text-gray-600">
                            <li className="flex items-center gap-2">
                                <CheckCircle size={16} className="text-green-500" />
                                Employés illimités
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle size={16} className="text-green-500" />
                                Toutes les fonctionnalités
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle size={16} className="text-green-500" />
                                Support prioritaire
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle size={16} className="text-green-500" />
                                Export Excel & PDF
                            </li>
                        </ul>

                        <button
                            onClick={handleSubscribe}
                            disabled={billingLoading}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition shadow-md"
                        >
                            {billingLoading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Redirection...
                                </>
                            ) : (
                                <>
                                    <CreditCard size={18} />
                                    S'abonner maintenant
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Card 4: Vocabulaire du Bot */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-purple-50 rounded-lg">
                        <MessageSquare size={22} className="text-purple-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Langage Personnalisé</h2>
                        <p className="text-sm text-gray-500">Adaptez les termes du bot à votre métier</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Lieu de travail
                        </label>
                        <input
                            type="text"
                            value={settings.vocabulary.workplace}
                            onChange={(e) => handleVocabularyChange('workplace', e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Chantier, Bureau, Site..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Terme Manager
                        </label>
                        <input
                            type="text"
                            value={settings.vocabulary.manager}
                            onChange={(e) => handleVocabularyChange('manager', e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Chef, Patron, Responsable..."
                        />
                    </div>
                </div>
            </div>

            </div> {/* END COLONNE DROITE */}
            </div> {/* END GRID */}

            {/* Sticky Footer - Save Button */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end shadow-lg z-40">
                <button
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition ${hasChanges
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                >
                    {saving ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            Enregistrement...
                        </>
                    ) : (
                        <>
                            <Save size={18} />
                            Enregistrer les modifications
                        </>
                    )}
                </button>
            </div>

            {/* Success Toast */}
            {showToast && (
                <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-fade-in">
                    <CheckCircle size={20} />
                    <span>Paramètres enregistrés avec succès !</span>
                </div>
            )}
        </div>
    );
}
