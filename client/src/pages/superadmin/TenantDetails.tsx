import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Building2,
    Users,
    Calendar,
    CreditCard,
    FileText,
    Download,
    CheckCircle,
    XCircle,
    Clock,
    Loader2,
    RefreshCw,
    Mail,
    AlertTriangle,
    UserCheck,
    TrendingUp,
    Zap,
    Shield
} from 'lucide-react';

interface Tenant {
    id: string;
    name: string;
    plan: string;
    status: string;
    maxEmployees: number;
    trialEndsAt: string | null;
    createdAt: string;
    country: string;
    legalName?: string;
    stripeCustomerId?: string | null;
}

interface TenantStats {
    totalEmployees: number;
    activeEmployees: number;
    attendanceLast30Days: number;
    totalSites: number;
    totalTickets: number;
    mrr: number;
}

interface Employee {
    id: string;
    name: string;
    phoneNumber: string;
    role: string;
    createdAt: string;
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

type TenantDetailsTab = 'overview' | 'billing' | 'team';

const formatCurrency = (amount: number, currency = 'eur') => {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: currency.toUpperCase()
    }).format(amount / 100);
};

const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    }).format(new Date(timestamp * 1000));
};

export default function TenantDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [stats, setStats] = useState<TenantStats | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [activeTab, setActiveTab] = useState<TenantDetailsTab>('overview');
    const [loadingInvoices, setLoadingInvoices] = useState(false);

    // Override state
    const [showOverride, setShowOverride] = useState(false);
    const [overridePlan, setOverridePlan] = useState('PRO');
    const [overrideMaxEmployees, setOverrideMaxEmployees] = useState(50);
    const [overrideReason, setOverrideReason] = useState('');
    const [savingOverride, setSavingOverride] = useState(false);

    const token = localStorage.getItem('superadmin_token');

    useEffect(() => {
        fetchFullDetails();
    }, [id]);

    useEffect(() => {
        if (activeTab === 'billing' && invoices.length === 0) {
            fetchInvoices();
        }
    }, [activeTab]);

    const fetchFullDetails = async () => {
        try {
            const res = await fetch(`/admin/tenants/${id}/full-details`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setTenant(data.tenant);
                setStats(data.stats);
                setEmployees(data.employees);
            }
        } catch (error) {
            console.error('Error fetching tenant details:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchInvoices = async () => {
        setLoadingInvoices(true);
        try {
            const res = await fetch(`/admin/tenants/${id}/invoices`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setInvoices(data);
            }
        } catch (error) {
            console.error('Error fetching invoices:', error);
        } finally {
            setLoadingInvoices(false);
        }
    };

    const handlePlanOverride = async () => {
        setSavingOverride(true);
        try {
            const res = await fetch(`/admin/tenants/${id}/plan-override`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    planName: overridePlan,
                    maxEmployees: overrideMaxEmployees,
                    reason: overrideReason
                })
            });
            const data = await res.json();
            if (res.ok) {
                alert(`✅ Plan mis à jour: ${data.message || 'Succès'}`);
                setShowOverride(false);
                fetchFullDetails();
            } else {
                alert(`❌ Erreur: ${data.error || 'Échec de la mise à jour'}`);
            }
        } catch (error) {
            console.error('Error overriding plan:', error);
            alert('❌ Erreur réseau lors du changement de plan');
        } finally {
            setSavingOverride(false);
        }
    };

    const handleImpersonate = async (managerId?: string, managerName?: string) => {
        const target = managerName ? `${managerName} (${tenant?.name})` : tenant?.name;
        if (!confirm(`Passer en mode support pour ${target} ?\n\nVous serez connecté comme manager de ce client.`)) {
            return;
        }

        try {
            const res = await fetch(`/admin/tenants/${id}/impersonate`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(managerId ? { managerId } : {})
            });
            const data = await res.json();
            if (res.ok) {
                sessionStorage.setItem('superadmin_original_token', 'cookie');
                sessionStorage.setItem('impersonated_tenant_name', tenant?.name || 'Tenant');
                sessionStorage.setItem('impersonated_manager_name', data.admin?.name || managerName || 'Manager');
                localStorage.setItem('token', 'cookie');
                navigate('/dashboard');
            } else {
                alert(`Erreur: ${data.error || 'Impersonation impossible'}`);
            }
        } catch (error) {
            console.error('Error impersonating:', error);
            alert('Erreur lors du passage en mode support');
        }
    };

    const handleSuspend = async () => {
        if (!confirm('Suspendre ce client ?')) return;
        try {
            await fetch(`/admin/tenants/${id}/suspend`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchFullDetails();
        } catch (error) {
            console.error('Error suspending:', error);
        }
    };

    const getStatusBadge = (status: string | null) => {
        switch (status) {
            case 'paid':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <CheckCircle size={12} /> Payé
                    </span>
                );
            case 'open':
            case 'draft':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                        <Clock size={12} /> En attente
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                        <XCircle size={12} /> {status || 'Inconnu'}
                    </span>
                );
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }

    if (!tenant) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500">Client non trouvé</p>
                <button onClick={() => navigate('/superadmin/tenants')} className="mt-4 text-indigo-600 hover:underline">
                    Retour à la liste
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/superadmin/tenants')} className="p-2 hover:bg-slate-100 rounded-lg">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Building2 className="w-6 h-6" />
                            {tenant.name}
                        </h1>
                        <p className="text-slate-500">ID: {tenant.id.slice(0, 8)}...</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => handleImpersonate()}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
                    >
                        <UserCheck size={16} />
                        Mode support
                    </button>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${tenant.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                        tenant.status === 'SUSPENDED' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                        }`}>
                        {tenant.status}
                    </span>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                        {tenant.plan}
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200">
                <div className="flex gap-6">
                    {([
                        { key: 'overview', label: 'Vue d\'ensemble', icon: TrendingUp },
                        { key: 'billing', label: 'Abonnement & Factures', icon: CreditCard },
                        { key: 'team', label: 'Collaborateurs', icon: Users }
                    ] satisfies Array<{ key: TenantDetailsTab; label: string; icon: typeof TrendingUp }>).map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`pb-3 px-1 border-b-2 font-medium flex items-center gap-2 transition ${activeTab === tab.key
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && stats && (
                <div className="space-y-6">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl border border-slate-200 p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-500">MRR</p>
                                    <p className="text-2xl font-bold text-slate-900">{stats.mrr}€</p>
                                </div>
                                <TrendingUp className="w-8 h-8 text-green-500" />
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-500">Employés</p>
                                    <p className="text-2xl font-bold text-slate-900">{stats.totalEmployees}/{tenant.maxEmployees}</p>
                                </div>
                                <Users className="w-8 h-8 text-blue-500" />
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-500">Actifs (30j)</p>
                                    <p className="text-2xl font-bold text-slate-900">{stats.activeEmployees}</p>
                                </div>
                                <UserCheck className="w-8 h-8 text-indigo-500" />
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-500">Inscrit le</p>
                                    <p className="text-lg font-bold text-slate-900">
                                        {new Date(tenant.createdAt).toLocaleDateString('fr-FR')}
                                    </p>
                                </div>
                                <Calendar className="w-8 h-8 text-orange-500" />
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <Zap className="w-5 h-5" />
                            Actions Rapides
                        </h3>
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => handleImpersonate()}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                            >
                                <UserCheck size={16} />
                                Se connecter comme manager
                            </button>
                            <button
                                onClick={handleSuspend}
                                className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                            >
                                <Shield size={16} />
                                {tenant.status === 'SUSPENDED' ? 'Réactiver' : 'Suspendre'}
                            </button>
                        </div>
                    </div>

                    {/* Trial Info */}
                    {tenant.trialEndsAt && new Date(tenant.trialEndsAt) > new Date() && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                            <div>
                                <p className="text-amber-800 font-medium">Période d'essai en cours</p>
                                <p className="text-amber-700 text-sm">
                                    Expire le {new Date(tenant.trialEndsAt).toLocaleDateString('fr-FR')}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* BILLING TAB */}
            {activeTab === 'billing' && (
                <div className="space-y-6">
                    {/* Override Zone */}
                    <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                        <h3 className="font-semibold text-red-800 mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            Zone Danger - Override Manuel
                        </h3>

                        {!showOverride ? (
                            <button
                                onClick={() => {
                                    // Initialize form with current tenant values
                                    setOverridePlan(tenant.plan);
                                    setOverrideMaxEmployees(tenant.maxEmployees);
                                    setOverrideReason('');
                                    setShowOverride(true);
                                }}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                            >
                                Changer le plan manuellement
                            </button>
                        ) : (
                            <div className="space-y-4 bg-white rounded-lg p-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Plan</label>
                                        <select
                                            value={overridePlan}
                                            onChange={(e) => setOverridePlan(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                                        >
                                            <option value="TRIAL">Trial</option>
                                            <option value="PRO">Pro (29€)</option>
                                            <option value="LARGE">Large / Enterprise (99€)</option>
                                            <option value="ENTERPRISE">Enterprise Legacy</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Max Employés</label>
                                        <input
                                            type="number"
                                            value={overrideMaxEmployees}
                                            onChange={(e) => setOverrideMaxEmployees(parseInt(e.target.value))}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Raison</label>
                                    <input
                                        type="text"
                                        value={overrideReason}
                                        onChange={(e) => setOverrideReason(e.target.value)}
                                        placeholder="Ex: Client VIP, Partenariat..."
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handlePlanOverride}
                                        disabled={savingOverride}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                    >
                                        {savingOverride ? 'Enregistrement...' : 'Appliquer l\'override'}
                                    </button>
                                    <button
                                        onClick={() => setShowOverride(false)}
                                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                                    >
                                        Annuler
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Invoices Table */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                <FileText size={20} />
                                Historique des factures
                            </h3>
                            <button
                                onClick={fetchInvoices}
                                disabled={loadingInvoices}
                                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                            >
                                <RefreshCw size={18} className={loadingInvoices ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        {loadingInvoices ? (
                            <div className="p-8 text-center">
                                <Loader2 className="animate-spin text-indigo-600 mx-auto" size={32} />
                            </div>
                        ) : invoices.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">
                                <FileText className="mx-auto mb-3 text-slate-300" size={48} />
                                <p>Aucune facture pour ce client</p>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">N° Facture</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Montant</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {invoices.map((invoice) => (
                                        <tr key={invoice.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-4 text-sm text-slate-900">
                                                {formatDate(invoice.date)}
                                            </td>
                                            <td className="px-4 py-4 text-sm text-slate-600 font-mono">
                                                {invoice.number || invoice.id.slice(-8)}
                                            </td>
                                            <td className="px-4 py-4 text-sm font-medium text-slate-900">
                                                {formatCurrency(invoice.amount, invoice.currency)}
                                            </td>
                                            <td className="px-4 py-4">
                                                {getStatusBadge(invoice.status)}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {invoice.pdf_url && (
                                                        <>
                                                            <a
                                                                href={invoice.pdf_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                                            >
                                                                <Download size={14} /> PDF
                                                            </a>
                                                            <button
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                                                                title="Envoyer par email"
                                                            >
                                                                <Mail size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* TEAM TAB */}
            {activeTab === 'team' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-200">
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                            <Users size={20} />
                            Collaborateurs ({employees.length})
                        </h3>
                    </div>

                    {employees.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            <Users className="mx-auto mb-3 text-slate-300" size={48} />
                            <p>Aucun collaborateur</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nom</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Téléphone/Email</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Rôle</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Inscrit le</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {employees.map((emp) => (
                                    <tr key={emp.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-4 text-sm font-medium text-slate-900">
                                            {emp.name}
                                        </td>
                                        <td className="px-4 py-4 text-sm text-slate-600">
                                            {emp.phoneNumber}
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${emp.role === 'MANAGER' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                {emp.role}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-sm text-slate-500">
                                            {new Date(emp.createdAt).toLocaleDateString('fr-FR')}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            {emp.role === 'MANAGER' ? (
                                                <button
                                                    onClick={() => handleImpersonate(emp.id, emp.name)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition"
                                                >
                                                    <UserCheck size={14} />
                                                    Entrer
                                                </button>
                                            ) : (
                                                <span className="text-xs text-slate-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}
