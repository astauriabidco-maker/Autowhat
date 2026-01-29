import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Mail, Lock, Loader2, MessageCircle, Quote, CheckCircle } from 'lucide-react';

export default function Login() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        phoneNumber: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await axios.post('/auth/login', formData);
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Erreur de connexion');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen">
            {/* Left Side - Form */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 lg:px-16 xl:px-24 bg-white">
                <div className="max-w-md w-full mx-auto">
                    {/* Logo */}
                    <div className="flex items-center gap-2 mb-8">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center">
                            <MessageCircle className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold text-slate-900">WhatsPoint</span>
                    </div>

                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">
                            Bon retour parmi nous
                        </h1>
                        <p className="text-slate-500">
                            Entrez vos identifiants pour accéder au dashboard.
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Phone/Email Input */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Numéro de téléphone
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    value={formData.phoneNumber}
                                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                    className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-900 placeholder:text-slate-400"
                                    placeholder="+33612345678"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Mot de passe
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-900 placeholder:text-slate-400"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm border border-red-100">
                                ⚠️ {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Connexion...
                                </>
                            ) : (
                                'Se connecter'
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <p className="text-center text-slate-500 mt-8">
                        Pas encore de compte ?{' '}
                        <Link to="/register" className="text-indigo-600 font-semibold hover:text-indigo-700 transition">
                            Créer un espace
                        </Link>
                    </p>
                </div>
            </div>

            {/* Right Side - Visual */}
            <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-center items-center p-12 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 left-20 w-72 h-72 bg-indigo-500 rounded-full blur-3xl" />
                    <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500 rounded-full blur-3xl" />
                </div>

                {/* Content */}
                <div className="relative z-10 max-w-lg text-center">
                    {/* Quote Icon */}
                    <Quote className="w-16 h-16 text-indigo-400 mx-auto mb-8 opacity-50" />

                    {/* Testimonial */}
                    <blockquote className="text-3xl font-light text-white leading-relaxed mb-8">
                        "La gestion d'équipe n'a jamais été aussi simple.{' '}
                        <span className="text-indigo-400 font-medium">Zéro application à installer.</span>"
                    </blockquote>

                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-5 py-2.5 rounded-full border border-white/20">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <span className="text-white font-medium">Garantie 100% WhatsApp</span>
                    </div>

                    {/* Stats */}
                    <div className="flex justify-center gap-12 mt-12">
                        <div className="text-center">
                            <div className="text-4xl font-bold text-white">500+</div>
                            <div className="text-slate-400 text-sm">Managers actifs</div>
                        </div>
                        <div className="text-center">
                            <div className="text-4xl font-bold text-white">15k</div>
                            <div className="text-slate-400 text-sm">Pointages / jour</div>
                        </div>
                        <div className="text-center">
                            <div className="text-4xl font-bold text-white">99%</div>
                            <div className="text-slate-400 text-sm">Adoption</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
