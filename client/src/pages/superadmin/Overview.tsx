import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building2,
    Users,
    DollarSign,
    Clock,
    AlertCircle,
    MessageSquare,
    ArrowUp,
    ArrowDown,
    CheckCircle,
    Circle,
    UserPlus
} from 'lucide-react';

interface Stats {
    totalTenants: number;
    totalEmployees: number;
    proTenants: number;
    mrr: number;
    todayAttendances: number;
    pendingLeaves: number;
    messages?: {
        totalInbound: number;
        totalOutbound: number;
        total: number;
        todayInbound: number;
        todayOutbound: number;
        today: number;
    };
    recentTenants: Array<{
        id: string;
        name: string;
        createdAt: string;
        plan: string;
        employeeCount: number;
        adminName: string;
        adminPhone: string;
    }>;
}

interface OnboardingFunnel {
    periodDays: number;
    summary: {
        spacesCreated: number;
        magicLinkSent: number;
        dashboardReached: number;
        managerActivated: number;
        employeeInvited: number;
        employeeActivated: number;
        firstCheckin: number;
        magicLinkSentRate: number;
        dashboardReachedRate: number;
        managerActivationRate: number;
        employeeInviteRate: number;
        employeeActivationRate: number;
        firstCheckinRate: number;
    };
    items: Array<{
        tenantId: string;
        tenantName: string;
        completed: number;
        total: number;
        blockedAt: string | null;
        steps: Array<{
            key: string;
            label: string;
            done: boolean;
            timestamp: string | null;
        }>;
    }>;
}

export default function Overview() {
    const navigate = useNavigate();
    const [stats, setStats] = useState<Stats | null>(null);
    const [onboarding, setOnboarding] = useState<OnboardingFunnel | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem('superadmin_token');
            const [statsResponse, onboardingResponse] = await Promise.all([
                fetch('/admin/stats', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/admin/onboarding-funnel', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);
            setStats(await statsResponse.json());
            setOnboarding(await onboardingResponse.json());
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Clients */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-xl">
                            <Building2 className="text-blue-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total Clients</p>
                            <p className="text-2xl font-bold text-gray-900">{stats?.totalTenants || 0}</p>
                        </div>
                    </div>
                </div>

                {/* MRR */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-xl">
                            <DollarSign className="text-green-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">MRR</p>
                            <p className="text-2xl font-bold text-gray-900">{stats?.mrr || 0}€</p>
                            <p className="text-xs text-gray-400">{stats?.proTenants || 0} clients PRO</p>
                        </div>
                    </div>
                </div>

                {/* Total Employees */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 rounded-xl">
                            <Users className="text-purple-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Utilisateurs</p>
                            <p className="text-2xl font-bold text-gray-900">{stats?.totalEmployees || 0}</p>
                        </div>
                    </div>
                </div>

                {/* Today Pointages */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-orange-100 rounded-xl">
                            <Clock className="text-orange-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Pointages Aujourd'hui</p>
                            <p className="text-2xl font-bold text-gray-900">{stats?.todayAttendances || 0}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* WhatsApp Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Messages */}
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-sm p-6 text-white">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-xl">
                            <MessageSquare className="text-white" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-green-100">Messages WhatsApp (Total)</p>
                            <p className="text-2xl font-bold">{stats?.messages?.total || 0}</p>
                            <p className="text-xs text-green-200">Tous temps confondus</p>
                        </div>
                    </div>
                </div>

                {/* Messages Reçus */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-xl">
                            <ArrowDown className="text-blue-600" size={24} />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-gray-500">Messages Reçus</p>
                            <div className="flex items-baseline gap-2">
                                <p className="text-2xl font-bold text-gray-900">{stats?.messages?.totalInbound || 0}</p>
                                <span className="text-xs text-green-600">+{stats?.messages?.todayInbound || 0} aujourd'hui</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Messages Envoyés */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-teal-100 rounded-xl">
                            <ArrowUp className="text-teal-600" size={24} />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-gray-500">Messages Envoyés</p>
                            <div className="flex items-baseline gap-2">
                                <p className="text-2xl font-bold text-gray-900">{stats?.messages?.totalOutbound || 0}</p>
                                <span className="text-xs text-green-600">+{stats?.messages?.todayOutbound || 0} aujourd'hui</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* WhatsApp Onboarding Funnel */}
            {onboarding && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-emerald-100 rounded-xl">
                                <UserPlus className="text-emerald-600" size={22} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Tunnel onboarding WhatsApp</h2>
                                <p className="text-sm text-gray-500">Création espace → dashboard → invitation → premier pointage, sur {onboarding.periodDays} jours.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/superadmin/tenants')}
                            className="text-sm text-emerald-700 font-semibold hover:text-emerald-800"
                        >
                            Voir les clients →
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
                        {[
                            ['Espaces', onboarding.summary.spacesCreated, 100],
                            ['Liens envoyés', onboarding.summary.magicLinkSent, onboarding.summary.magicLinkSentRate],
                            ['Dashboards ouverts', onboarding.summary.dashboardReached, onboarding.summary.dashboardReachedRate],
                            ['Collaborateur invité', onboarding.summary.employeeInvited, onboarding.summary.employeeInviteRate],
                            ['Collaborateur actif', onboarding.summary.employeeActivated, onboarding.summary.employeeActivationRate],
                            ['Premier pointage', onboarding.summary.firstCheckin, onboarding.summary.firstCheckinRate]
                        ].map(([label, value, rate]) => (
                            <div key={label as string} className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                                <p className="text-xs text-gray-500 font-medium">{label}</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                                <p className="text-xs text-emerald-600 mt-1">{rate}% du tunnel</p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-5 space-y-3">
                        {onboarding.items.slice(0, 5).map((item) => (
                            <div key={item.tenantId} className="rounded-lg border border-gray-100 p-4 hover:bg-gray-50 transition">
                                <div className="flex items-center justify-between gap-3">
                                    <button
                                        onClick={() => navigate(`/superadmin/tenants/${item.tenantId}`)}
                                        className="font-semibold text-gray-900 hover:text-red-600 text-left"
                                    >
                                        {item.tenantName}
                                    </button>
                                    <span className="text-xs text-gray-500">{item.completed}/{item.total}</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 mt-3">
                                    {item.steps.map((step) => (
                                        <div key={step.key} className="flex items-center gap-1 text-xs">
                                            {step.done ? (
                                                <CheckCircle size={14} className="text-emerald-600" />
                                            ) : (
                                                <Circle size={14} className="text-gray-300" />
                                            )}
                                            <span className={step.done ? 'text-gray-700' : 'text-gray-400'}>{step.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent Tenants */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">Dernières inscriptions</h2>
                        <button
                            onClick={() => navigate('/superadmin/tenants')}
                            className="text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                            Voir tout →
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 text-left">
                            <tr>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Entreprise</th>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Admin</th>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Employés</th>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Plan</th>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Inscription</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {stats?.recentTenants?.map((tenant) => (
                                <tr key={tenant.id} className="hover:bg-gray-50 transition">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                                                {tenant.name.charAt(0)}
                                            </div>
                                            <span className="font-medium text-gray-900">{tenant.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 text-sm">
                                        {tenant.adminName}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {tenant.employeeCount}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${tenant.plan === 'PRO'
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {tenant.plan}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-sm">
                                        {formatDate(tenant.createdAt)}
                                    </td>
                                </tr>
                            ))}
                            {!stats?.recentTenants?.length && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        <AlertCircle className="mx-auto mb-2 text-gray-400" size={24} />
                                        Aucun client pour le moment
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
