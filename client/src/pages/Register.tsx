import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { User, Mail, Lock, Phone, Building2, MapPin, Loader2, ArrowRight, ArrowLeft, MessageCircle, Users, Zap } from 'lucide-react';

// Secteurs d'activité
const SECTORS = [
    { id: 'BTP', name: 'BTP / Construction', icon: '🏗️', desc: 'Chantiers, ouvriers' },
    { id: 'RETAIL', name: 'Commerce / Retail', icon: '🛒', desc: 'Magasins, vendeurs' },
    { id: 'CLEANING', name: 'Propreté / Services', icon: '🧹', desc: 'Sites, agents' },
    { id: 'SECURITY', name: 'Sécurité', icon: '🛡️', desc: 'Postes, gardiens' },
    { id: 'OFFICE', name: 'Bureau / Tertiaire', icon: '💼', desc: 'Bureaux, collaborateurs' },
    { id: 'GENERIC', name: 'Autre secteur', icon: '🏢', desc: 'Configuration flexible' },
];

// Pays disponibles
const COUNTRIES = [
    { code: 'FR', name: 'France', flag: '🇫🇷' },
    { code: 'CM', name: 'Cameroun', flag: '🇨🇲' },
    { code: 'BE', name: 'Belgique', flag: '🇧🇪' },
    { code: 'CH', name: 'Suisse', flag: '🇨🇭' },
    { code: 'CA', name: 'Canada', flag: '🇨🇦' },
];

export default function Register() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        phone: '',
        companyName: '',
        country: 'FR',
        sector: '',
    });

    const updateField = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleNext = () => {
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

        if (!formData.companyName || !formData.sector) {
            setError('Veuillez remplir tous les champs');
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post('/auth/register', formData);
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Erreur lors de l\'inscription');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen">
            {/* Left Side - Form */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 lg:px-16 xl:px-24 bg-white py-12">
                <div className="max-w-md w-full mx-auto">
                    {/* Logo */}
                    <div className="flex items-center gap-2 mb-8">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center">
                            <MessageCircle className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold text-slate-900">WhatsPoint</span>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center gap-3 mb-8">
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${step === 1
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
                            Administrateur
                        </div>
                        <div className="w-8 h-0.5 bg-slate-200" />
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${step === 2
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
                            Entreprise
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit}>
                        {/* Step 1: Admin Info */}
                        {step === 1 && (
                            <div className="space-y-5">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-1">
                                        Vos informations
                                    </h2>
                                    <p className="text-slate-500 text-sm">
                                        Créez votre compte administrateur
                                    </p>
                                </div>

                                {/* Full Name */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Prénom et Nom
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            type="text"
                                            value={formData.fullName}
                                            onChange={(e) => updateField('fullName', e.target.value)}
                                            className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                            placeholder="Jean Dupont"
                                        />
                                    </div>
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Email professionnel
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => updateField('email', e.target.value)}
                                            className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                            placeholder="jean@entreprise.com"
                                        />
                                    </div>
                                </div>

                                {/* Password */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Mot de passe
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            type="password"
                                            value={formData.password}
                                            onChange={(e) => updateField('password', e.target.value)}
                                            className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1.5">Minimum 6 caractères</p>
                                </div>

                                {/* Phone */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Téléphone WhatsApp
                                    </label>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => updateField('phone', e.target.value)}
                                            className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                            placeholder="+33612345678"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1.5">Format international requis</p>
                                </div>

                                {error && (
                                    <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm border border-red-100">
                                        ⚠️ {error}
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={handleNext}
                                    className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-all shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2"
                                >
                                    Continuer
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        )}

                        {/* Step 2: Company Info */}
                        {step === 2 && (
                            <div className="space-y-5">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-1">
                                        Votre entreprise
                                    </h2>
                                    <p className="text-slate-500 text-sm">
                                        Configurez votre espace de travail
                                    </p>
                                </div>

                                {/* Company Name */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Nom de la société
                                    </label>
                                    <div className="relative">
                                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            type="text"
                                            value={formData.companyName}
                                            onChange={(e) => updateField('companyName', e.target.value)}
                                            className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                            placeholder="Mon Entreprise SARL"
                                        />
                                    </div>
                                </div>

                                {/* Country */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Pays
                                    </label>
                                    <div className="relative">
                                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <select
                                            value={formData.country}
                                            onChange={(e) => updateField('country', e.target.value)}
                                            className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white appearance-none cursor-pointer"
                                        >
                                            {COUNTRIES.map(c => (
                                                <option key={c.code} value={c.code}>
                                                    {c.flag} {c.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Sector Grid */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-3">
                                        Secteur d'activité
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {SECTORS.map(s => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                onClick={() => updateField('sector', s.id)}
                                                className={`p-4 rounded-xl border-2 transition-all text-left ${formData.sector === s.id
                                                        ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20'
                                                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <span className="text-2xl mb-2 block">{s.icon}</span>
                                                <span className="text-sm font-semibold text-slate-900 block">{s.name}</span>
                                                <span className="text-xs text-slate-500">{s.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {error && (
                                    <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm border border-red-100">
                                        ⚠️ {error}
                                    </div>
                                )}

                                {/* Buttons */}
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="flex-1 py-3.5 px-4 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                        Retour
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-1 py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Création...
                                            </>
                                        ) : (
                                            <>
                                                Créer mon espace
                                                <ArrowRight className="w-5 h-5" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>

                    {/* Footer */}
                    <p className="text-center text-slate-500 mt-8">
                        Déjà un compte ?{' '}
                        <Link to="/login" className="text-indigo-600 font-semibold hover:text-indigo-700 transition">
                            Se connecter
                        </Link>
                    </p>
                </div>
            </div>

            {/* Right Side - Visual */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 flex-col justify-center items-center p-12 relative overflow-hidden">
                {/* Background Effects */}
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-10 right-10 w-64 h-64 bg-white rounded-full blur-3xl" />
                    <div className="absolute bottom-20 left-10 w-80 h-80 bg-blue-300 rounded-full blur-3xl" />
                </div>

                {/* Content */}
                <div className="relative z-10 max-w-lg text-center">
                    {/* Icon */}
                    <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-8 border border-white/20">
                        <Users className="w-10 h-10 text-white" />
                    </div>

                    {/* Text */}
                    <h2 className="text-3xl font-bold text-white mb-4">
                        Rejoignez +500 managers
                    </h2>
                    <p className="text-xl text-white/80 leading-relaxed mb-8">
                        qui pilotent leurs équipes sur WhatsApp.
                    </p>

                    {/* Features */}
                    <div className="space-y-4">
                        {[
                            { icon: <Zap className="w-5 h-5" />, text: 'Déploiement en 5 minutes' },
                            { icon: <MessageCircle className="w-5 h-5" />, text: 'Zéro application à installer' },
                            { icon: <Users className="w-5 h-5" />, text: 'Essai gratuit 14 jours' },
                        ].map((feature, idx) => (
                            <div key={idx} className="flex items-center gap-3 bg-white/10 backdrop-blur-sm px-5 py-3 rounded-xl border border-white/20 text-white">
                                {feature.icon}
                                <span className="font-medium">{feature.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
