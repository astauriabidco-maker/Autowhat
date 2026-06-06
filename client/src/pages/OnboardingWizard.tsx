import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Sparkles, Building2, Users, MessageSquare, Check,
    ArrowRight, ArrowLeft, MapPin, Plus, Loader2, X,
    Phone, User, Globe2, Navigation, ShieldAlert
} from 'lucide-react';

interface WizardStep {
    id: number;
    title: string;
    icon: React.ReactNode;
    completed: boolean;
}

interface SiteForm {
    name: string;
    address: string;
    country: string;
    locationMethod: 'address' | 'current' | 'none' | 'manual';
    gpsMode: 'STRICT' | 'WARNING' | 'DISABLED';
    radius: string;
    latitude: string;
    longitude: string;
}

interface EmployeeForm {
    name: string;
    phoneNumber: string;
}

export default function OnboardingWizard() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [skipLoading, setSkipLoading] = useState(false);
    const [showSkipModal, setShowSkipModal] = useState(false);
    const [companyName, setCompanyName] = useState('');
    const [locationLoading, setLocationLoading] = useState(false);
    const [locationError, setLocationError] = useState('');

    // Site form
    const [siteForm, setSiteForm] = useState<SiteForm>({
        name: '',
        address: '',
        country: 'FR',
        locationMethod: 'address',
        gpsMode: 'WARNING',
        radius: '200',
        latitude: '',
        longitude: ''
    });

    // Employees list
    const [employees, setEmployees] = useState<EmployeeForm[]>([
        { name: '', phoneNumber: '' }
    ]);

    const [tenantStats, setTenantStats] = useState({ sites: 0, employees: 0 });
    const countryOptions = [
        { code: 'FR', label: 'France', addressFirst: true },
        { code: 'CM', label: 'Cameroun', addressFirst: false },
        { code: 'US', label: 'États-Unis', addressFirst: true },
        { code: 'CA', label: 'Canada', addressFirst: true },
        { code: 'BE', label: 'Belgique', addressFirst: true },
        { code: 'CH', label: 'Suisse', addressFirst: true },
        { code: 'GB', label: 'Royaume-Uni', addressFirst: true },
        { code: 'DE', label: 'Allemagne', addressFirst: true },
        { code: 'ES', label: 'Espagne', addressFirst: true },
        { code: 'OTHER', label: 'Autre pays', addressFirst: false }
    ];
    const selectedCountry = countryOptions.find(country => country.code === siteForm.country) || countryOptions[0];

    const steps: WizardStep[] = [
        { id: 1, title: 'Bienvenue', icon: <Sparkles size={20} />, completed: currentStep > 1 },
        { id: 2, title: 'Premier site', icon: <Building2 size={20} />, completed: currentStep > 2 },
        { id: 3, title: 'Employés', icon: <Users size={20} />, completed: currentStep > 3 },
        { id: 4, title: 'WhatsApp', icon: <MessageSquare size={20} />, completed: currentStep > 4 },
        { id: 5, title: 'Terminé', icon: <Check size={20} />, completed: currentStep > 5 }
    ];

    useEffect(() => {
        fetchTenantInfo();
    }, []);

    const fetchTenantInfo = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/api/tenant/info', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCompanyName(res.data.name || 'Votre entreprise');
            const tenantCountry = res.data.country || 'FR';
            const countryConfig = countryOptions.find(country => country.code === tenantCountry);
            setSiteForm(prev => ({
                ...prev,
                country: countryConfig ? tenantCountry : 'OTHER',
                locationMethod: countryConfig?.addressFirst === false ? 'current' : 'address'
            }));

            // Also fetch onboarding status
            const statusRes = await axios.get('/api/user/onboarding-status', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTenantStats(statusRes.data.tenantStats || { sites: 0, employees: 0 });
        } catch (error) {
            console.error('Error fetching tenant info:', error);
        }
    };

    const handleCreateSite = async () => {
        if (!siteForm.name.trim()) return;

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/sites', {
                name: siteForm.name,
                address: siteForm.address || null,
                country: siteForm.country === 'OTHER' ? 'FR' : siteForm.country,
                locationMethod: siteForm.locationMethod,
                gpsMode: siteForm.locationMethod === 'none' ? 'DISABLED' : siteForm.gpsMode,
                radius: parseInt(siteForm.radius, 10) || 200,
                latitude: siteForm.latitude ? parseFloat(siteForm.latitude) : null,
                longitude: siteForm.longitude ? parseFloat(siteForm.longitude) : null
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setTenantStats(prev => ({ ...prev, sites: prev.sites + 1 }));
            setCurrentStep(3);
        } catch (error) {
            console.error('Error creating site:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUseCurrentLocation = () => {
        setLocationError('');
        if (!navigator.geolocation) {
            setLocationError("Votre navigateur ne permet pas de récupérer la position.");
            return;
        }

        setLocationLoading(true);
        navigator.geolocation.getCurrentPosition(
            position => {
                setSiteForm(prev => ({
                    ...prev,
                    locationMethod: 'current',
                    gpsMode: prev.gpsMode === 'DISABLED' ? 'WARNING' : prev.gpsMode,
                    latitude: position.coords.latitude.toFixed(6),
                    longitude: position.coords.longitude.toFixed(6)
                }));
                setLocationLoading(false);
            },
            () => {
                setLocationError("Position indisponible. Vous pouvez créer le site sans GPS pour l'instant.");
                setLocationLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    };

    const handleAddEmployees = async () => {
        const validEmployees = employees.filter(e => e.name.trim() && e.phoneNumber.trim());
        if (validEmployees.length === 0) {
            setCurrentStep(4);
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');

            for (const emp of validEmployees) {
                await axios.post('/api/employees', {
                    name: emp.name,
                    phoneNumber: emp.phoneNumber.startsWith('+') ? emp.phoneNumber : `+33${emp.phoneNumber.replace(/^0/, '')}`
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }

            setTenantStats(prev => ({ ...prev, employees: prev.employees + validEmployees.length }));
            setCurrentStep(4);
        } catch (error) {
            console.error('Error adding employees:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleComplete = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/user/complete-onboarding', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            navigate('/dashboard');
        } catch (error) {
            console.error('Error completing onboarding:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSkip = async () => {
        setSkipLoading(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/user/complete-onboarding', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            navigate('/dashboard');
        } catch (error) {
            console.error('Error skipping onboarding:', error);
        } finally {
            setSkipLoading(false);
            setShowSkipModal(false);
        }
    };

    const addEmployeeRow = () => {
        setEmployees([...employees, { name: '', phoneNumber: '' }]);
    };

    const updateEmployee = (index: number, field: keyof EmployeeForm, value: string) => {
        const updated = [...employees];
        updated[index][field] = value;
        setEmployees(updated);
    };

    const removeEmployee = (index: number) => {
        if (employees.length > 1) {
            setEmployees(employees.filter((_, i) => i !== index));
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
            {/* Progress Bar */}
            <div className="fixed top-0 left-0 right-0 h-1 bg-slate-700 z-50">
                <div
                    className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-500"
                    style={{ width: `${(currentStep / 5) * 100}%` }}
                />
            </div>

            {/* Header */}
            <header className="py-6 px-8">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
                            <Sparkles size={20} className="text-white" />
                        </div>
                        <span className="text-white font-bold text-xl">AutoWhats</span>
                    </div>

                    {currentStep < 5 && (
                        <button
                            onClick={() => setShowSkipModal(true)}
                            className="text-slate-400 hover:text-white text-sm transition-colors"
                        >
                            Passer cette étape →
                        </button>
                    )}
                </div>
            </header>

            {/* Steps Indicator */}
            <div className="py-6 px-8">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between">
                        {steps.map((step, index) => (
                            <div key={step.id} className="flex items-center">
                                <div className={`
                                    w-10 h-10 rounded-full flex items-center justify-center transition-all
                                    ${currentStep === step.id
                                        ? 'bg-red-600 text-white scale-110'
                                        : step.completed
                                            ? 'bg-green-600 text-white'
                                            : 'bg-slate-700 text-slate-400'}
                                `}>
                                    {step.completed ? <Check size={18} /> : step.icon}
                                </div>
                                {index < steps.length - 1 && (
                                    <div className={`
                                        w-16 h-0.5 mx-2 transition-colors
                                        ${step.completed ? 'bg-green-600' : 'bg-slate-700'}
                                    `} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <main className="flex-1 flex items-center justify-center px-8 pb-12">
                <div className="max-w-2xl w-full">

                    {/* Step 1: Welcome */}
                    {currentStep === 1 && (
                        <div className="text-center space-y-8 animate-fade-in">
                            <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-orange-500 rounded-3xl mx-auto flex items-center justify-center">
                                <Sparkles size={48} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-bold text-white mb-4">
                                    Bienvenue sur AutoWhats ! 🎉
                                </h1>
                                <p className="text-slate-400 text-lg max-w-md mx-auto">
                                    Configurons ensemble votre espace de travail pour <span className="text-white font-medium">{companyName}</span>.
                                </p>
                            </div>

                            <div className="bg-slate-800/50 rounded-2xl p-6 text-left space-y-4">
                                <h3 className="text-white font-semibold">Ce que nous allons configurer :</h3>
                                <ul className="space-y-3 text-slate-300">
                                    <li className="flex items-center gap-3">
                                        <Building2 size={18} className="text-red-400" />
                                        Créer votre premier site de travail
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <Users size={18} className="text-blue-400" />
                                        Ajouter vos premiers employés
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <MessageSquare size={18} className="text-green-400" />
                                        Vérifier la connexion WhatsApp
                                    </li>
                                </ul>
                            </div>

                            <button
                                onClick={() => setCurrentStep(2)}
                                className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold flex items-center gap-2 mx-auto transition-colors"
                            >
                                Commencer
                                <ArrowRight size={20} />
                            </button>
                        </div>
                    )}

                    {/* Step 2: Create First Site */}
                    {currentStep === 2 && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-4">
                                    <Building2 size={32} className="text-white" />
                                </div>
                                <h2 className="text-3xl font-bold text-white mb-2">Créez votre premier site</h2>
                                <p className="text-slate-400">Un site représente un lieu de travail (bureau, chantier, agence...)</p>
                            </div>

                            <div className="bg-slate-800/50 rounded-2xl p-6 space-y-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-2">Nom du site *</label>
                                    <input
                                        type="text"
                                        value={siteForm.name}
                                        onChange={e => setSiteForm({ ...siteForm, name: e.target.value })}
                                        placeholder="ex: Siège Paris, Chantier Lyon..."
                                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-red-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-slate-400 mb-2">
                                        <Globe2 size={14} className="inline mr-1" />
                                        Pays du site
                                    </label>
                                    <select
                                        value={siteForm.country}
                                        onChange={e => {
                                            const nextCountry = e.target.value;
                                            const nextConfig = countryOptions.find(country => country.code === nextCountry);
                                            setSiteForm({
                                                ...siteForm,
                                                country: nextCountry,
                                                locationMethod: nextConfig?.addressFirst === false ? 'current' : 'address'
                                            });
                                        }}
                                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-red-500"
                                    >
                                        {countryOptions.map(country => (
                                            <option key={country.code} value={country.code}>{country.label}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-slate-500 mt-2">
                                        Le pays du site peut être différent du pays de l'entreprise.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {([
                                        { key: 'address', icon: MapPin, title: 'Entrer une adresse', desc: selectedCountry.addressFirst ? 'Recommandé pour ce pays' : 'Si vous avez une adresse fiable' },
                                        { key: 'current', icon: Navigation, title: 'Position actuelle', desc: 'Idéal sur site ou chantier' },
                                        { key: 'none', icon: ShieldAlert, title: 'Sans GPS', desc: 'À compléter plus tard' }
                                    ] as const).map(option => {
                                        const Icon = option.icon;
                                        const active = siteForm.locationMethod === option.key;
                                        return (
                                            <button
                                                key={option.key}
                                                type="button"
                                                onClick={() => setSiteForm({
                                                    ...siteForm,
                                                    locationMethod: option.key,
                                                    gpsMode: option.key === 'none' ? 'DISABLED' : siteForm.gpsMode === 'DISABLED' ? 'WARNING' : siteForm.gpsMode
                                                })}
                                                className={`text-left rounded-xl border p-4 transition ${active
                                                    ? 'border-red-500 bg-red-500/10 text-white'
                                                    : 'border-slate-600 bg-slate-700/60 text-slate-300 hover:border-slate-400'
                                                    }`}
                                            >
                                                <Icon size={20} className={active ? 'text-red-300' : 'text-slate-400'} />
                                                <p className="font-semibold mt-2">{option.title}</p>
                                                <p className="text-xs text-slate-400 mt-1">{option.desc}</p>
                                            </button>
                                        );
                                    })}
                                </div>

                                {siteForm.locationMethod === 'address' && (
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-2">Adresse du site</label>
                                        <input
                                            type="text"
                                            value={siteForm.address}
                                            onChange={e => setSiteForm({ ...siteForm, address: e.target.value })}
                                            placeholder={selectedCountry.addressFirst ? 'ex: 15 rue de la Paix, Paris' : 'ex: Quartier, repère ou lieu connu'}
                                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-red-500"
                                        />
                                        <p className="text-xs text-slate-500 mt-2">
                                            Si l'adresse est reconnue, WhatsPoint positionnera le site automatiquement.
                                        </p>
                                    </div>
                                )}

                                {siteForm.locationMethod === 'current' && (
                                    <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                            <div>
                                                <p className="text-white font-semibold">Utiliser la position de cet appareil</p>
                                                <p className="text-sm text-slate-400">Pratique si vous êtes déjà sur le site de pointage.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleUseCurrentLocation}
                                                disabled={locationLoading}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
                                            >
                                                {locationLoading ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                                                Capturer
                                            </button>
                                        </div>
                                        {siteForm.latitude && siteForm.longitude && (
                                            <p className="text-xs text-blue-200 mt-3">
                                                Position capturée : {siteForm.latitude}, {siteForm.longitude}
                                            </p>
                                        )}
                                        {locationError && <p className="text-xs text-amber-300 mt-3">{locationError}</p>}
                                    </div>
                                )}

                                {siteForm.locationMethod !== 'none' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-slate-400 mb-2">Contrôle GPS</label>
                                            <select
                                                value={siteForm.gpsMode}
                                                onChange={e => setSiteForm({ ...siteForm, gpsMode: e.target.value as SiteForm['gpsMode'] })}
                                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-red-500"
                                            >
                                                <option value="WARNING">Avertir sans bloquer</option>
                                                <option value="STRICT">Bloquer hors zone</option>
                                                <option value="DISABLED">Désactivé</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-slate-400 mb-2">Rayon autorisé</label>
                                            <input
                                                type="number"
                                                value={siteForm.radius}
                                                onChange={e => setSiteForm({ ...siteForm, radius: e.target.value })}
                                                min="25"
                                                max="5000"
                                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-red-500"
                                            />
                                        </div>
                                    </div>
                                )}

                                <details className="rounded-xl border border-slate-700 p-4">
                                    <summary className="cursor-pointer text-sm text-slate-400">Coordonnées avancées</summary>
                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <input
                                            type="text"
                                            value={siteForm.latitude}
                                            onChange={e => setSiteForm({ ...siteForm, latitude: e.target.value, locationMethod: 'manual' })}
                                            placeholder="Latitude"
                                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-red-500"
                                        />
                                        <input
                                            type="text"
                                            value={siteForm.longitude}
                                            onChange={e => setSiteForm({ ...siteForm, longitude: e.target.value, locationMethod: 'manual' })}
                                            placeholder="Longitude"
                                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-red-500"
                                        />
                                    </div>
                                </details>

                                {siteForm.locationMethod === 'none' && (
                                    <p className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 text-sm text-amber-100">
                                        Le site sera créé sans contrôle GPS. Vous pourrez activer la géolocalisation plus tard.
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-between">
                                <button
                                    onClick={() => setCurrentStep(1)}
                                    className="px-6 py-3 text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
                                >
                                    <ArrowLeft size={18} />
                                    Retour
                                </button>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setCurrentStep(3)}
                                        className="px-6 py-3 text-slate-400 hover:text-white transition-colors"
                                    >
                                        Passer
                                    </button>
                                    <button
                                        onClick={handleCreateSite}
                                        disabled={!siteForm.name.trim() || loading}
                                        className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl font-semibold flex items-center gap-2 transition-colors"
                                    >
                                        {loading ? <Loader2 className="animate-spin" size={18} /> : 'Créer le site'}
                                        <ArrowRight size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Add Employees */}
                    {currentStep === 3 && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-purple-600 rounded-2xl mx-auto flex items-center justify-center mb-4">
                                    <Users size={32} className="text-white" />
                                </div>
                                <h2 className="text-3xl font-bold text-white mb-2">Ajoutez vos employés</h2>
                                <p className="text-slate-400">Ils recevront leurs pointages par WhatsApp</p>
                            </div>

                            <div className="bg-slate-800/50 rounded-2xl p-6 space-y-4">
                                {employees.map((emp, index) => (
                                    <div key={index} className="flex gap-3 items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <User size={14} className="text-slate-400" />
                                                <label className="text-sm text-slate-400">Nom</label>
                                            </div>
                                            <input
                                                type="text"
                                                value={emp.name}
                                                onChange={e => updateEmployee(index, 'name', e.target.value)}
                                                placeholder="Jean Dupont"
                                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-red-500"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Phone size={14} className="text-slate-400" />
                                                <label className="text-sm text-slate-400">Téléphone</label>
                                            </div>
                                            <input
                                                type="tel"
                                                value={emp.phoneNumber}
                                                onChange={e => updateEmployee(index, 'phoneNumber', e.target.value)}
                                                placeholder="+33612345678"
                                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-red-500"
                                            />
                                        </div>
                                        {employees.length > 1 && (
                                            <button
                                                onClick={() => removeEmployee(index)}
                                                className="mt-8 p-2 text-slate-400 hover:text-red-400 transition-colors"
                                            >
                                                <X size={18} />
                                            </button>
                                        )}
                                    </div>
                                ))}

                                <button
                                    onClick={addEmployeeRow}
                                    className="w-full py-3 border-2 border-dashed border-slate-600 hover:border-slate-500 rounded-xl text-slate-400 hover:text-white flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Plus size={18} />
                                    Ajouter un employé
                                </button>
                            </div>

                            <div className="flex justify-between">
                                <button
                                    onClick={() => setCurrentStep(2)}
                                    className="px-6 py-3 text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
                                >
                                    <ArrowLeft size={18} />
                                    Retour
                                </button>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setCurrentStep(4)}
                                        className="px-6 py-3 text-slate-400 hover:text-white transition-colors"
                                    >
                                        Passer
                                    </button>
                                    <button
                                        onClick={handleAddEmployees}
                                        disabled={loading}
                                        className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 text-white rounded-xl font-semibold flex items-center gap-2 transition-colors"
                                    >
                                        {loading ? <Loader2 className="animate-spin" size={18} /> : 'Continuer'}
                                        <ArrowRight size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: WhatsApp Check */}
                    {currentStep === 4 && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-green-600 rounded-2xl mx-auto flex items-center justify-center mb-4">
                                    <MessageSquare size={32} className="text-white" />
                                </div>
                                <h2 className="text-3xl font-bold text-white mb-2">Connexion WhatsApp</h2>
                                <p className="text-slate-400">Le bot WhatsApp est géré par la plateforme</p>
                            </div>

                            <div className="bg-slate-800/50 rounded-2xl p-6 text-center">
                                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Check size={40} className="text-green-400" />
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-2">Bot WhatsApp activé ✅</h3>
                                <p className="text-slate-400 mb-4">
                                    Vos employés peuvent dès maintenant envoyer "Bonjour" au numéro WhatsApp pour commencer à pointer.
                                </p>
                                <div className="bg-slate-700/50 rounded-xl p-4 text-left">
                                    <p className="text-sm text-slate-400 mb-2">Commandes disponibles :</p>
                                    <ul className="text-sm text-slate-300 space-y-1">
                                        <li>• <span className="text-green-400">Bonjour</span> - Pointer l'arrivée</li>
                                        <li>• <span className="text-red-400">Ciao</span> - Pointer le départ</li>
                                        <li>• <span className="text-blue-400">Congé</span> - Demander un congé</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="flex justify-between">
                                <button
                                    onClick={() => setCurrentStep(3)}
                                    className="px-6 py-3 text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
                                >
                                    <ArrowLeft size={18} />
                                    Retour
                                </button>
                                <button
                                    onClick={() => setCurrentStep(5)}
                                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold flex items-center gap-2 transition-colors"
                                >
                                    Terminer
                                    <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 5: Complete */}
                    {currentStep === 5 && (
                        <div className="text-center space-y-8 animate-fade-in">
                            <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-500 rounded-3xl mx-auto flex items-center justify-center">
                                <Check size={48} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-bold text-white mb-4">
                                    Configuration terminée ! 🚀
                                </h1>
                                <p className="text-slate-400 text-lg max-w-md mx-auto">
                                    Votre espace <span className="text-white font-medium">{companyName}</span> est prêt.
                                </p>
                            </div>

                            <div className="bg-slate-800/50 rounded-2xl p-6 grid grid-cols-2 gap-6">
                                <div className="text-center">
                                    <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                                        <Building2 size={24} className="text-blue-400" />
                                    </div>
                                    <p className="text-2xl font-bold text-white">{tenantStats.sites}</p>
                                    <p className="text-slate-400 text-sm">Site(s) créé(s)</p>
                                </div>
                                <div className="text-center">
                                    <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                                        <Users size={24} className="text-purple-400" />
                                    </div>
                                    <p className="text-2xl font-bold text-white">{tenantStats.employees}</p>
                                    <p className="text-slate-400 text-sm">Employé(s)</p>
                                </div>
                            </div>

                            <button
                                onClick={handleComplete}
                                disabled={loading}
                                className="px-8 py-4 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white rounded-xl font-semibold flex items-center gap-2 mx-auto transition-all"
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <>
                                        Accéder au tableau de bord
                                        <ArrowRight size={20} />
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </main>

            {/* Skip Modal */}
            {showSkipModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full">
                        <h3 className="text-xl font-semibold text-white mb-4">Passer la configuration ?</h3>
                        <p className="text-slate-400 mb-6">
                            Vous pourrez toujours configurer vos sites et employés plus tard depuis les paramètres.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowSkipModal(false)}
                                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                            >
                                Continuer la config
                            </button>
                            <button
                                onClick={handleSkip}
                                disabled={skipLoading}
                                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg flex items-center gap-2 transition-colors"
                            >
                                {skipLoading ? <Loader2 className="animate-spin" size={16} /> : 'Passer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CSS Animation */}
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.4s ease-out;
                }
            `}</style>
        </div>
    );
}
