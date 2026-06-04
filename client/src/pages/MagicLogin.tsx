import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, Loader2, MessageCircle, ShieldAlert } from 'lucide-react';
import { getErrorMessage } from '../utils/errors';

type MagicLoginStatus = 'loading' | 'success' | 'error';

export default function MagicLogin() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const hasConsumedToken = useRef(false);
    const [status, setStatus] = useState<MagicLoginStatus>('loading');
    const [message, setMessage] = useState('Connexion au dashboard manager...');

    useEffect(() => {
        if (hasConsumedToken.current) return;
        hasConsumedToken.current = true;

        const token = searchParams.get('token');

        if (!token) {
            setStatus('error');
            setMessage('Ce lien de connexion est incomplet.');
            return;
        }

        const consumeToken = async () => {
            try {
                const response = await axios.post('/auth/magic-login', { token });
                localStorage.setItem('token', 'cookie');
                localStorage.setItem('user', JSON.stringify(response.data.user));

                setStatus('success');
                setMessage('Connexion réussie. Ouverture du dashboard...');

                const redirectTo = response.data.redirectTo || '/dashboard';
                window.history.replaceState(null, '', '/magic-login');
                setTimeout(() => navigate(redirectTo, { replace: true }), 350);
            } catch (error: unknown) {
                setStatus('error');
                setMessage(getErrorMessage(error, 'Lien de connexion expiré ou déjà utilisé.'));
            }
        };

        consumeToken();
    }, [navigate, searchParams]);

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/70 p-8">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                        <MessageCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="text-lg font-bold text-slate-900">WhatsPoint</p>
                        <p className="text-sm text-slate-500">Accès manager sécurisé</p>
                    </div>
                </div>

                <div className="flex flex-col items-center text-center">
                    {status === 'loading' && (
                        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-5">
                            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-5">
                            <CheckCircle className="w-8 h-8 text-emerald-600" />
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-5">
                            <ShieldAlert className="w-8 h-8 text-amber-600" />
                        </div>
                    )}

                    <h1 className="text-2xl font-bold text-slate-900 mb-3">
                        {status === 'error' ? 'Lien non valide' : 'Ouverture de votre espace'}
                    </h1>
                    <p className="text-slate-600 leading-relaxed">
                        {message}
                    </p>

                    {status === 'error' && (
                        <div className="w-full mt-8 space-y-3">
                            <Link
                                to="/login"
                                className="block w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all"
                            >
                                Se connecter avec un code WhatsApp
                            </Link>
                            <Link
                                to="/"
                                className="block w-full py-3.5 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-all"
                            >
                                Retour à l'accueil
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
