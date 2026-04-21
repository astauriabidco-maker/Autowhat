import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Mail, Loader2, CheckCircle } from 'lucide-react';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await axios.post('/auth/forgot-password', { email });
            setSent(true);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Erreur lors de la demande');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex">
            {/* Left Panel - Branding */}
            <div className="hidden lg:flex lg:w-1/2 flex-col justify-center p-12 bg-gradient-to-br from-blue-600 to-indigo-800">
                <div className="max-w-md">
                    <h1 className="text-4xl font-bold text-white mb-6">
                        🚀 whatsPoint.com
                    </h1>
                    <p className="text-xl text-red-100">
                        Pas de panique ! Nous allons vous aider à récupérer votre accès en quelques instants.
                    </p>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
                <div className="w-full max-w-md">
                    <Link
                        to="/login"
                        className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition"
                    >
                        <ArrowLeft size={20} />
                        Retour à la connexion
                    </Link>

                    {sent ? (
                        <div className="text-center">
                            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle className="text-green-500" size={32} />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-4">
                                Email envoyé !
                            </h2>
                            <p className="text-gray-400 mb-8">
                                Si un compte existe avec cette adresse, vous recevrez un lien de réinitialisation dans quelques instants.
                            </p>
                            <p className="text-gray-500 text-sm">
                                Pensez à vérifier vos spams.
                            </p>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-3xl font-bold text-white mb-2">
                                Mot de passe oublié ?
                            </h2>
                            <p className="text-gray-400 mb-8">
                                Entrez votre numéro de téléphone ou email pour recevoir un lien de réinitialisation.
                            </p>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                {error && (
                                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                        {error}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Téléphone ou Email
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                        <input
                                            type="text"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="33612345678 ou email@example.com"
                                            required
                                            className="w-full pl-11 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || !email}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="animate-spin" size={20} />
                                            Envoi en cours...
                                        </>
                                    ) : (
                                        'Envoyer le lien de réinitialisation'
                                    )}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
