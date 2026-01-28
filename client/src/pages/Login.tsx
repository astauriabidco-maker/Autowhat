import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Login() {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await axios.post('/auth/login', {
                phoneNumber,
                password,
            });

            // Store token and user info
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));

            // Redirect to dashboard
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Erreur de connexion');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">
                        📊 Dashboard RH
                    </h1>
                    <p className="text-gray-600 mt-2">
                        Connectez-vous pour accéder au tableau de bord
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-lg shadow-md p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Phone Number */}
                        <div>
                            <label
                                htmlFor="phone"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                Numéro de téléphone
                            </label>
                            <input
                                id="phone"
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="+33699999999"
                                required
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                Mot de passe
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                            />
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                                ⚠️ {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            {loading ? 'Connexion...' : 'Se connecter'}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <div className="text-center mt-6 space-y-2">
                    <p className="text-gray-600">
                        Pas encore de compte ?{' '}
                        <a href="/register" className="text-blue-600 font-medium hover:underline">
                            S'inscrire
                        </a>
                    </p>
                    <p className="text-gray-400 text-sm">
                        AutoWhats © 2026 - Gestion des Présences
                    </p>
                </div>
            </div>
        </div>
    );
}
