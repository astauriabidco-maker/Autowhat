import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { User, Mail, Lock, Phone, Building2, MapPin, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';

// Secteurs d'activité avec icônes
const SECTORS = [
    { id: 'BTP', name: 'BTP / Construction', icon: '🏗️' },
    { id: 'RETAIL', name: 'Commerce / Retail', icon: '🛒' },
    { id: 'CLEANING', name: 'Propreté / Services', icon: '🧹' },
    { id: 'SECURITY', name: 'Sécurité', icon: '🛡️' },
    { id: 'OFFICE', name: 'Bureau / Tertiaire', icon: '💼' },
    { id: 'GENERIC', name: 'Autre', icon: '🏢' },
];

// Pays disponibles
const COUNTRIES = [
    { code: 'FR', name: 'France', flag: '🇫🇷' },
    { code: 'CM', name: 'Cameroun', flag: '🇨🇲' },
    { code: 'US', name: 'États-Unis', flag: '🇺🇸' },
    { code: 'CA', name: 'Canada', flag: '🇨🇦' },
    { code: 'BE', name: 'Belgique', flag: '🇧🇪' },
    { code: 'CH', name: 'Suisse', flag: '🇨🇭' },
];

export default function Register() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // Form data
    const [formData, setFormData] = useState({
        // Step 1 - Admin
        fullName: '',
        email: '',
        password: '',
        phone: '',
        // Step 2 - Company
        companyName: '',
        country: 'FR',
        sector: '',
    });

    const updateField = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleNext = () => {
        // Validate step 1
        if (!formData.fullName || !formData.email || !formData.password || !formData.phone) {
            setError('Veuillez remplir tous les champs');
            return;
        }
        if (formData.password.length < 6) {
            setError('Le mot de passe doit contenir au moins 6 caractères');
            return;
        }
        setError('');
        setStep(2);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validate step 2
        if (!formData.companyName || !formData.sector) {
            setError('Veuillez remplir tous les champs');
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post('/auth/register', formData);

            // Store token and user info
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));

            // Redirect to dashboard
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Erreur lors de l\'inscription');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-8">
            <div className="max-w-xl w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">
                        🚀 Créer votre compte
                    </h1>
                    <p className="text-gray-600 mt-2">
                        Configurez votre espace en quelques minutes
                    </p>

                    {/* Progress indicator */}
                    <div className="flex items-center justify-center mt-6 gap-2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
                            }`}>
                            1
                        </div>
                        <div className={`w-16 h-1 rounded ${step >= 2 ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
                            }`}>
                            2
                        </div>
                    </div>
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <form onSubmit={handleSubmit}>
                        {/* Step 1: Admin Info */}
                        {step === 1 && (
                            <div className="space-y-5">
                                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                                    👤 Vos informations
                                </h2>

                                {/* Full Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Prénom et Nom *
                                    </label>
                                    <div className="relative">
                                        <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            value={formData.fullName}
                                            onChange={(e) => updateField('fullName', e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                                            placeholder="Jean Dupont"
                                        />
                                    </div>
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Email *
                                    </label>
                                    <div className="relative">
                                        <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => updateField('email', e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                                            placeholder="jean@entreprise.com"
                                        />
                                    </div>
                                </div>

                                {/* Password */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Mot de passe *
                                    </label>
                                    <div className="relative">
                                        <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="password"
                                            value={formData.password}
                                            onChange={(e) => updateField('password', e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Minimum 6 caractères</p>
                                </div>

                                {/* Phone */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Téléphone WhatsApp *
                                    </label>
                                    <div className="relative">
                                        <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => updateField('phone', e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                                            placeholder="+33612345678"
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        📱 Format international requis (ex: +33612345678)
                                    </p>
                                </div>

                                {/* Error */}
                                {error && (
                                    <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                                        ⚠️ {error}
                                    </div>
                                )}

                                {/* Next Button */}
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition flex items-center justify-center gap-2"
                                >
                                    Continuer <ArrowRight size={18} />
                                </button>
                            </div>
                        )}

                        {/* Step 2: Company Info */}
                        {step === 2 && (
                            <div className="space-y-5">
                                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                                    🏢 Votre entreprise
                                </h2>

                                {/* Company Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Nom de la société *
                                    </label>
                                    <div className="relative">
                                        <Building2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            value={formData.companyName}
                                            onChange={(e) => updateField('companyName', e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                                            placeholder="Mon Entreprise SARL"
                                        />
                                    </div>
                                </div>

                                {/* Country */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Pays *
                                    </label>
                                    <div className="relative">
                                        <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <select
                                            value={formData.country}
                                            onChange={(e) => updateField('country', e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white appearance-none"
                                        >
                                            {COUNTRIES.map(c => (
                                                <option key={c.code} value={c.code}>
                                                    {c.flag} {c.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Sector - Grid of buttons */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Secteur d'activité *
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {SECTORS.map(s => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                onClick={() => updateField('sector', s.id)}
                                                className={`p-3 rounded-lg border-2 transition text-left flex items-center gap-2 ${formData.sector === s.id
                                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                <span className="text-xl">{s.icon}</span>
                                                <span className="text-sm font-medium">{s.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Error */}
                                {error && (
                                    <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                                        ⚠️ {error}
                                    </div>
                                )}

                                {/* Buttons */}
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-2"
                                    >
                                        <ArrowLeft size={18} /> Retour
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 size={18} className="animate-spin" />
                                                Création...
                                            </>
                                        ) : (
                                            <>
                                                Créer mon compte 🚀
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>
                </div>

                {/* Login Link */}
                <p className="text-center text-gray-600 mt-6">
                    Déjà un compte ?{' '}
                    <Link to="/login" className="text-indigo-600 font-medium hover:underline">
                        Se connecter
                    </Link>
                </p>

                {/* Footer */}
                <p className="text-center text-gray-400 text-sm mt-4">
                    AutoWhats © 2026 - Gestion des Présences par WhatsApp
                </p>
            </div>
        </div>
    );
}
