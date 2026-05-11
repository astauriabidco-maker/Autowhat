import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, User, Mail, Lock, ArrowLeft, Check, AlertCircle, Loader2 } from 'lucide-react';
import { getErrorMessage } from '../../utils/errors';

type Plan = 'TRIAL' | 'PRO' | 'ENTERPRISE';

export default function CreateTenant() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const [formData, setFormData] = useState({
        companyName: '',
        adminName: '',
        adminEmail: '',
        password: '',
        plan: 'TRIAL' as Plan
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const token = localStorage.getItem('superadmin_token');
            const response = await fetch('/admin/tenants/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de la création');
            }

            setSuccess(true);
            setTimeout(() => {
                navigate(`/superadmin/tenants/${data.tenant.id}`);
            }, 1500);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Erreur lors de la création'));
        } finally {
            setLoading(false);
        }
    };

    const plans: { value: Plan; label: string; desc: string; price: string }[] = [
        { value: 'TRIAL', label: 'Essai', desc: '14 jours gratuits', price: '0€' },
        { value: 'PRO', label: 'Pro', desc: 'Jusqu\'à 50 employés', price: '29€/mois' },
        { value: 'ENTERPRISE', label: 'Enterprise', desc: 'Jusqu\'à 500 employés', price: '99€/mois' }
    ];

    if (success) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="w-8 h-8 text-green-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900">Client créé avec succès !</h2>
                    <p className="text-slate-500 mt-2">Redirection en cours...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/superadmin/tenants')}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">🏢 Nouveau Client</h1>
                    <p className="text-slate-500">Création manuelle (vente téléphone, virement...)</p>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <p className="text-red-700 text-sm">{error}</p>
                    </div>
                )}

                {/* Company Info */}
                <div>
                    <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Entreprise
                    </h3>
                    <input
                        type="text"
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        placeholder="Nom de la société"
                        required
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>

                {/* Admin Info */}
                <div className="space-y-4">
                    <h3 className="font-medium text-slate-900 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Administrateur Principal
                    </h3>
                    <input
                        type="text"
                        value={formData.adminName}
                        onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                        placeholder="Nom complet"
                        required
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="email"
                            value={formData.adminEmail}
                            onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                            placeholder="Email"
                            required
                            className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="Mot de passe initial"
                            required
                            minLength={6}
                            className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                {/* Plan Selection */}
                <div>
                    <h3 className="font-medium text-slate-900 mb-4">Plan Initial</h3>
                    <div className="grid grid-cols-3 gap-3">
                        {plans.map((plan) => (
                            <button
                                key={plan.value}
                                type="button"
                                onClick={() => setFormData({ ...formData, plan: plan.value })}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${formData.plan === plan.value
                                        ? 'border-indigo-600 bg-indigo-50'
                                        : 'border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <p className="font-semibold text-slate-900">{plan.label}</p>
                                <p className="text-xs text-slate-500 mt-1">{plan.desc}</p>
                                <p className="text-sm font-medium text-indigo-600 mt-2">{plan.price}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Création en cours...
                        </>
                    ) : (
                        <>
                            <Check className="w-4 h-4" />
                            Créer le Client
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
