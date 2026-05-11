import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Phone, Loader2, MessageCircle, Quote, CheckCircle, ArrowLeft, ShieldCheck } from 'lucide-react';
import { getErrorMessage, isMaintenanceModeError } from '../utils/errors';

export default function Login() {
    const navigate = useNavigate();
    const [step, setStep] = useState<1 | 2>(1);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [countdown, setCountdown] = useState(0);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Countdown timer for resend
    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown]);

    // Auto-focus first OTP input when step 2 is reached
    useEffect(() => {
        if (step === 2) {
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
    }, [step]);

    // Step 1: Request OTP
    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await axios.post('/auth/request-otp', { phoneNumber });
            setStep(2);
            setCountdown(60);
        } catch (err: unknown) {
            if (isMaintenanceModeError(err)) {
                setError('🔧 La plateforme est en maintenance. Réessayez dans quelques minutes.');
            } else {
                setError(getErrorMessage(err, 'Erreur lors de l\'envoi du code'));
            }
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Verify OTP
    const handleVerifyOtp = useCallback(async (otpValue: string[]) => {
        const code = otpValue.join('');
        if (code.length !== 6) return;

        setError('');
        setLoading(true);

        try {
            const response = await axios.post('/auth/verify-otp', {
                phoneNumber,
                otpCode: code,
            });
            localStorage.setItem('token', 'cookie');
            localStorage.setItem('user', JSON.stringify(response.data.user));
            navigate('/dashboard');
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Code invalide'));
            setOtp(['', '', '', '', '', '']);
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        } finally {
            setLoading(false);
        }
    }, [phoneNumber, navigate]);

    // Handle OTP digit input
    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return; // Only digits

        const newOtp = [...otp];
        newOtp[index] = value.slice(-1); // Take only the last digit
        setOtp(newOtp);

        // Auto-advance to next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all 6 digits are filled
        if (newOtp.every(d => d !== '')) {
            handleVerifyOtp(newOtp);
        }
    };

    // Handle backspace navigation
    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    // Handle paste
    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pastedData.length === 0) return;

        const newOtp = [...otp];
        for (let i = 0; i < pastedData.length; i++) {
            newOtp[i] = pastedData[i];
        }
        setOtp(newOtp);

        // Focus the next empty input or the last one
        const nextEmpty = newOtp.findIndex(d => d === '');
        inputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();

        // Auto-submit if all filled
        if (newOtp.every(d => d !== '')) {
            handleVerifyOtp(newOtp);
        }
    };

    // Resend OTP
    const handleResend = async () => {
        if (countdown > 0) return;
        setError('');
        setLoading(true);
        try {
            await axios.post('/auth/request-otp', { phoneNumber });
            setCountdown(60);
            setOtp(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Erreur lors du renvoi'));
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
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                            <MessageCircle className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold text-slate-900">WhatsPoint</span>
                    </div>

                    {/* ============ STEP 1: Phone Number ============ */}
                    {step === 1 && (
                        <>
                            <div className="mb-8">
                                <h1 className="text-3xl font-bold text-slate-900 mb-2">
                                    Connexion sécurisée
                                </h1>
                                <p className="text-slate-500">
                                    Recevez un code de connexion directement sur votre WhatsApp.
                                </p>
                            </div>

                            <form onSubmit={handleRequestOtp} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Numéro WhatsApp
                                    </label>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            type="tel"
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-400"
                                            placeholder="+33 6 12 34 56 78"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                {/* WhatsApp Branding Badge */}
                                <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                    <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                                        <MessageCircle className="w-4 h-4 text-white" />
                                    </div>
                                    <p className="text-sm text-emerald-700">
                                        Un code à 6 chiffres sera envoyé sur votre <strong>WhatsApp</strong>
                                    </p>
                                </div>

                                {error && (
                                    <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm border border-red-100">
                                        ⚠️ {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Envoi en cours...
                                        </>
                                    ) : (
                                        <>
                                            <MessageCircle className="w-5 h-5" />
                                            Recevoir le code sur WhatsApp
                                        </>
                                    )}
                                </button>
                            </form>
                        </>
                    )}

                    {/* ============ STEP 2: OTP Verification ============ */}
                    {step === 2 && (
                        <>
                            <div className="mb-8">
                                <button
                                    onClick={() => { setStep(1); setError(''); setOtp(['', '', '', '', '', '']); }}
                                    className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition mb-4"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Changer de numéro
                                </button>
                                <h1 className="text-3xl font-bold text-slate-900 mb-2">
                                    Vérification
                                </h1>
                                <p className="text-slate-500">
                                    Entrez le code reçu sur WhatsApp au{' '}
                                    <span className="font-semibold text-slate-700">{phoneNumber}</span>
                                </p>
                            </div>

                            <div className="space-y-6">
                                {/* OTP Input Grid */}
                                <div className="flex justify-between gap-3" onPaste={handlePaste}>
                                    {otp.map((digit, index) => (
                                        <input
                                            key={index}
                                            ref={(el) => { inputRefs.current[index] = el; }}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleOtpChange(index, e.target.value)}
                                            onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                            className="w-14 h-16 text-center text-2xl font-bold border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-900"
                                        />
                                    ))}
                                </div>

                                {error && (
                                    <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm border border-red-100">
                                        ⚠️ {error}
                                    </div>
                                )}

                                {/* Loading indicator during verification */}
                                {loading && (
                                    <div className="flex items-center justify-center gap-2 text-blue-600">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span className="text-sm font-medium">Vérification...</span>
                                    </div>
                                )}

                                {/* Security badge */}
                                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <ShieldCheck className="w-5 h-5 text-blue-500 flex-shrink-0" />
                                    <p className="text-xs text-slate-500">
                                        Connexion chiffrée de bout en bout. Le code est à usage unique et expire dans 10 minutes.
                                    </p>
                                </div>

                                {/* Resend code */}
                                <div className="text-center">
                                    {countdown > 0 ? (
                                        <p className="text-sm text-slate-400">
                                            Renvoyer le code dans <span className="font-semibold text-slate-600">{countdown}s</span>
                                        </p>
                                    ) : (
                                        <button
                                            onClick={handleResend}
                                            disabled={loading}
                                            className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition"
                                        >
                                            Renvoyer le code
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Footer */}
                    <p className="text-center text-slate-500 mt-8">
                        Pas encore de compte ?{' '}
                        <Link to="/register" className="text-blue-600 font-semibold hover:text-blue-700 transition">
                            Créer un espace
                        </Link>
                    </p>
                </div>
            </div>

            {/* Right Side - Visual */}
            <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-center items-center p-12 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-500 rounded-full blur-3xl" />
                    <div className="absolute bottom-20 right-20 w-96 h-96 bg-green-500 rounded-full blur-3xl" />
                </div>

                {/* Content */}
                <div className="relative z-10 max-w-lg text-center">
                    {/* Quote Icon */}
                    <Quote className="w-16 h-16 text-emerald-400 mx-auto mb-8 opacity-50" />

                    {/* Testimonial */}
                    <blockquote className="text-3xl font-light text-white leading-relaxed mb-8">
                        "Plus de mot de passe. Un simple{' '}
                        <span className="text-blue-400 font-medium">code WhatsApp</span>{' '}
                        et vous êtes connecté."
                    </blockquote>

                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-5 py-2.5 rounded-full border border-white/20">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <span className="text-white font-medium">Connexion sans mot de passe</span>
                    </div>

                    {/* Stats */}
                    <div className="flex justify-center gap-12 mt-12">
                        <div className="text-center">
                            <div className="text-4xl font-bold text-white">500+</div>
                            <div className="text-slate-400 text-sm">Managers actifs</div>
                        </div>
                        <div className="text-center">
                            <div className="text-4xl font-bold text-white">0</div>
                            <div className="text-slate-400 text-sm">Mot de passe</div>
                        </div>
                        <div className="text-center">
                            <div className="text-4xl font-bold text-white">10s</div>
                            <div className="text-slate-400 text-sm">Temps de connexion</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
