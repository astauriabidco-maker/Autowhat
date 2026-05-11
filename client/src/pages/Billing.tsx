import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    CreditCard,
    Download,
    CheckCircle,
    XCircle,
    Clock,
    Loader2,
    ExternalLink,
    FileText,
    Check,
    Zap,
    Star,
    Users,
    Brain,
    Wrench
} from 'lucide-react';
import { getErrorMessage } from '../utils/errors';

interface Plan {
    id: string;
    stripePriceId: string;
    name: string;
    description: string | null;
    price: number;
    currency: string;
    maxEmployees: number;
    features: string[];
    isPopular: boolean;
    sortOrder: number;
}

interface Invoice {
    id: string;
    number: string | null;
    date: number;
    amount: number;
    currency: string;
    status: string | null;
    pdf_url: string | null;
}

interface BillingStatus {
    plan: string;
    status: string;
    trialEndsAt: string | null;
    subscriptionStatus: string | null;
    maxEmployees: number;
}

// Format currency (Stripe returns cents)
const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: currency.toUpperCase()
    }).format(amount / 100);
};

// Format date
const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    }).format(new Date(timestamp * 1000));
};

export default function Billing() {
    const [loading, setLoading] = useState(true);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

    const token = localStorage.getItem('token');

    useEffect(() => {
        fetchBillingData();
    }, []);

    const fetchBillingData = async () => {
        try {
            const [plansRes, statusRes, invoicesRes] = await Promise.all([
                axios.get('/api/plans'),
                axios.get('/api/billing/status', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('/api/billing/invoices', { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setPlans(plansRes.data);
            setBillingStatus(statusRes.data);
            setInvoices(invoicesRes.data);
        } catch (error) {
            console.error('Error fetching billing data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectPlan = async (plan: Plan) => {
        if (!plan.stripePriceId) {
            alert('Ce plan n\'est pas encore configuré (Price ID manquant)');
            return;
        }

        setCheckoutLoading(plan.name);
        try {
            const res = await axios.post('/api/billing/checkout',
                { priceId: plan.stripePriceId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.url) {
                window.location.href = res.data.url;
            }
        } catch (error: unknown) {
            console.error('Checkout error:', error);
            alert(getErrorMessage(error, 'Erreur lors de la création de la session de paiement'));
        } finally {
            setCheckoutLoading(null);
        }
    };

    const handleManageSubscription = async () => {
        try {
            const res = await axios.post('/api/billing/portal', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.url) {
                window.location.href = res.data.url;
            }
        } catch (error) {
            console.error('Portal error:', error);
            alert('Erreur lors de l\'ouverture du portail de gestion');
        }
    };

    const getStatusBadge = (status: string | null) => {
        switch (status) {
            case 'paid':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <CheckCircle size={12} />
                        Payé
                    </span>
                );
            case 'open':
            case 'draft':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                        <Clock size={12} />
                        En attente
                    </span>
                );
            case 'uncollectible':
            case 'void':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                        <XCircle size={12} />
                        Échoué
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                        {status || 'Inconnu'}
                    </span>
                );
        }
    };

    const getPlanIcon = (planName: string) => {
        switch (planName) {
            case 'Small': return <Users className="text-blue-600" size={28} />;
            case 'Medium': return <Zap className="text-purple-600" size={28} />;
            case 'Large': return <Star className="text-yellow-500" size={28} />;
            default: return <CreditCard className="text-gray-600" size={28} />;
        }
    };

    const getPlanStyle = (planName: string, isCurrentPlan: boolean) => {
        if (isCurrentPlan) {
            return 'border-2 border-green-500 bg-green-50 ring-2 ring-green-200';
        }
        switch (planName) {
            case 'Medium': return 'border-2 border-purple-500 ring-2 ring-purple-100 scale-105';
            default: return 'border border-gray-200';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-red-600" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Facturation & Modules</h1>
                <p className="text-gray-500 mt-1">Gérez votre formule de base (Socle) et activez vos Add-ons Métier</p>
            </div>

            {/* Current Status */}
            {billingStatus && (
                <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                            <CreditCard className="text-gray-600" size={20} />
                        </div>
                        <div>
                            <p className="font-medium text-gray-900">
                                Plan actuel : <span className="text-red-600">{billingStatus.plan}</span>
                            </p>
                            <p className="text-sm text-gray-500">
                                {billingStatus.maxEmployees} employés max • Statut : {billingStatus.subscriptionStatus || 'active'}
                            </p>
                        </div>
                    </div>
                    {billingStatus.subscriptionStatus === 'active' && (
                        <button
                            onClick={handleManageSubscription}
                            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                        >
                            <ExternalLink size={16} />
                            Gérer
                        </button>
                    )}
                </div>
            )}

            {/* Pricing Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => {
                    const isCurrentPlan = billingStatus?.plan === plan.name;
                    const isPopular = plan.name === 'Medium';

                    return (
                        <div
                            key={plan.name}
                            className={`relative bg-white rounded-2xl p-6 transition-all ${getPlanStyle(plan.name, isCurrentPlan)}`}
                        >
                            {/* Popular Badge */}
                            {isPopular && !isCurrentPlan && (
                                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                    <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                                        POPULAIRE
                                    </span>
                                </div>
                            )}

                            {/* Current Plan Badge */}
                            {isCurrentPlan && (
                                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                    <span className="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                                        <CheckCircle size={12} />
                                        PLAN ACTUEL
                                    </span>
                                </div>
                            )}

                            {/* Plan Icon & Name */}
                            <div className="flex items-center gap-3 mb-4 mt-2">
                                <div className="p-2 bg-gray-100 rounded-xl">
                                    {getPlanIcon(plan.name)}
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                            </div>

                            {/* Price */}
                            <div className="mb-4">
                                <span className="text-4xl font-bold text-gray-900">{plan.price}€</span>
                                <span className="text-gray-500">/mois</span>
                            </div>

                            {/* Limit */}
                            <p className="text-gray-600 mb-6 font-medium">
                                Jusqu'à <span className="text-red-600 font-bold">{plan.maxEmployees}</span> employés
                            </p>

                            {/* Features */}
                            <ul className="space-y-3 mb-6">
                                {plan.features.map((feature, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                                        <Check className="text-green-500 flex-shrink-0 mt-0.5" size={16} />
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            {/* Action Button */}
                            {isCurrentPlan ? (
                                <button
                                    disabled
                                    className="w-full py-3 bg-gray-200 text-gray-500 font-medium rounded-xl cursor-not-allowed"
                                >
                                    Plan Actuel
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleSelectPlan(plan)}
                                    disabled={checkoutLoading !== null}
                                    className={`w-full py-3 font-medium rounded-xl transition flex items-center justify-center gap-2 ${isPopular
                                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                        : 'bg-red-600 hover:bg-red-700 text-white'
                                        } disabled:opacity-50`}
                                >
                                    {checkoutLoading === plan.name ? (
                                        <Loader2 size={20} className="animate-spin" />
                                    ) : (
                                        <>
                                            Choisir ce plan
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ADD-ONS SECTION (New Modular Pricing Strategy) */}
            <div className="mt-12">
                <div className="flex items-center gap-3 mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Add-ons (Modules Métier)</h2>
                    <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded">SUPERCHARGEZ VOTRE HUB</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Add-on Ops */}
                    <div className="bg-white border-2 border-orange-100 rounded-2xl p-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between shadow-sm">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-orange-100 rounded-lg">
                                    <Wrench className="text-orange-600" size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">Module Opérations & Terrain</h3>
                            </div>
                            <p className="text-sm text-gray-600 mb-3">Débloquez la gestion complète des pièces, les devis, le Dispatch Map Kanban et les rapports d'intervention signés sur chantier.</p>
                            <div className="text-lg font-bold text-gray-900">
                                49€ <span className="text-sm font-normal text-gray-500">/mois (Fixe, peu importe le nombre d'employés)</span>
                            </div>
                        </div>
                        <button className="px-6 py-2.5 bg-orange-50 hover:bg-orange-100 text-orange-700 font-medium rounded-lg border border-orange-200 transition-colors w-full sm:w-auto">
                            Ajouter au contrat
                        </button>
                    </div>

                    {/* Add-on AI */}
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-100 rounded-2xl p-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-16 bg-purple-200/40 blur-[50px] rounded-full pointer-events-none" />
                        <div className="flex-1 relative z-10">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-indigo-600 rounded-lg shadow-md shadow-indigo-200">
                                    <Brain className="text-white" size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-indigo-950">Module IA (Intelligence Artificielle)</h3>
                            </div>
                            <p className="text-sm text-indigo-900/80 mb-3">Active le Vision OCR pour la lecture automatique des notes de frais, et l'Agent RAG sur la Base Documentaire RH.</p>
                            <div className="text-lg font-bold text-indigo-950">
                                79€ <span className="text-sm font-normal text-indigo-800/60">/mois (Token LLM illimités)</span>
                            </div>
                        </div>
                        <button className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors w-full sm:w-auto relative z-10 shadow-lg shadow-indigo-200">
                            Activer l'IA
                        </button>
                    </div>
                </div>
            </div>

            {/* Prorata Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                    💡 <strong>Note :</strong> Le changement de plan est immédiat et calculé au prorata.
                    Si vous passez à un plan supérieur, vous ne paierez que la différence pour la période restante.
                </p>
            </div>

            {/* Invoice History */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <FileText size={20} />
                        Historique des factures
                    </h3>
                </div>

                {invoices.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <FileText className="mx-auto mb-3 text-gray-300" size={48} />
                        <p>Aucune facture pour le moment</p>
                        <p className="text-sm mt-1">Les factures apparaîtront ici après votre premier paiement</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Facture</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {invoices.map((invoice) => (
                                <tr key={invoice.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-4 text-sm text-gray-900">
                                        {formatDate(invoice.date)}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-600 font-mono">
                                        {invoice.number || invoice.id.slice(-8)}
                                    </td>
                                    <td className="px-4 py-4 text-sm font-medium text-gray-900">
                                        {formatCurrency(invoice.amount, invoice.currency)}
                                    </td>
                                    <td className="px-4 py-4">
                                        {getStatusBadge(invoice.status)}
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        {invoice.pdf_url ? (
                                            <a
                                                href={invoice.pdf_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                                            >
                                                <Download size={14} />
                                                PDF
                                            </a>
                                        ) : (
                                            <span className="text-sm text-gray-400">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
