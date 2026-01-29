import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Users, Calendar, Building2 } from 'lucide-react';

interface RevenueStats {
    totalMRR: number;
    trialCount: number;
    proCount: number;
    enterpriseCount: number;
    tenantsByPlan: {
        id: string;
        name: string;
        plan: string;
        employeeCount: number;
        createdAt: string;
    }[];
}

// Pricing configuration (should match your actual pricing)
const PLAN_PRICING = {
    TRIAL: 0,
    PRO: 29,       // €/month
    ENTERPRISE: 99 // €/month
};

export default function Revenue() {
    const [stats, setStats] = useState<RevenueStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRevenueData();
    }, []);

    const fetchRevenueData = async () => {
        try {
            const token = localStorage.getItem('superadmin_token');
            const response = await fetch('/admin/stats', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();

                // Calculate revenue stats from tenants data
                const tenantsRes = await fetch('/admin/tenants/list?page=1&limit=100', {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (tenantsRes.ok) {
                    const tenantsData = await tenantsRes.json();

                    let trialCount = 0;
                    let proCount = 0;
                    let enterpriseCount = 0;

                    tenantsData.tenants.forEach((t: any) => {
                        if (t.plan === 'TRIAL') trialCount++;
                        else if (t.plan === 'PRO') proCount++;
                        else if (t.plan === 'ENTERPRISE') enterpriseCount++;
                    });

                    const totalMRR = (proCount * PLAN_PRICING.PRO) + (enterpriseCount * PLAN_PRICING.ENTERPRISE);

                    setStats({
                        totalMRR,
                        trialCount,
                        proCount,
                        enterpriseCount,
                        tenantsByPlan: tenantsData.tenants
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching revenue data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            </div>
        );
    }

    const projectedARR = (stats?.totalMRR || 0) * 12;
    const conversionRate = stats && stats.trialCount > 0
        ? ((stats.proCount + stats.enterpriseCount) / (stats.trialCount + stats.proCount + stats.enterpriseCount) * 100).toFixed(1)
        : '0';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Revenus</h1>
                <p className="text-gray-500">Suivi des revenus et conversions</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* MRR */}
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-xl">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-green-100">MRR</p>
                            <p className="text-3xl font-bold">{stats?.totalMRR || 0}€</p>
                        </div>
                    </div>
                </div>

                {/* ARR */}
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-xl">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-blue-100">ARR Projeté</p>
                            <p className="text-3xl font-bold">{projectedARR}€</p>
                        </div>
                    </div>
                </div>

                {/* Conversion Rate */}
                <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl shadow-lg p-6 text-white">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-xl">
                            <Users size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-purple-100">Taux Conversion</p>
                            <p className="text-3xl font-bold">{conversionRate}%</p>
                        </div>
                    </div>
                </div>

                {/* Total Clients Payants */}
                <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-xl">
                            <Building2 size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-orange-100">Clients Payants</p>
                            <p className="text-3xl font-bold">{(stats?.proCount || 0) + (stats?.enterpriseCount || 0)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Plan Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Répartition par Plan</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Trial */}
                    <div className="bg-gray-50 rounded-xl p-5 border-l-4 border-gray-400">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm text-gray-500">Trial (Gratuit)</p>
                                <p className="text-2xl font-bold text-gray-900">{stats?.trialCount || 0}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-500">Revenu</p>
                                <p className="text-lg font-semibold text-gray-600">0€</p>
                            </div>
                        </div>
                    </div>

                    {/* Pro */}
                    <div className="bg-blue-50 rounded-xl p-5 border-l-4 border-blue-500">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm text-blue-600">Pro</p>
                                <p className="text-2xl font-bold text-gray-900">{stats?.proCount || 0}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-blue-600">Revenu</p>
                                <p className="text-lg font-semibold text-blue-700">{(stats?.proCount || 0) * PLAN_PRICING.PRO}€/mois</p>
                            </div>
                        </div>
                    </div>

                    {/* Enterprise */}
                    <div className="bg-purple-50 rounded-xl p-5 border-l-4 border-purple-500">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm text-purple-600">Enterprise</p>
                                <p className="text-2xl font-bold text-gray-900">{stats?.enterpriseCount || 0}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-purple-600">Revenu</p>
                                <p className="text-lg font-semibold text-purple-700">{(stats?.enterpriseCount || 0) * PLAN_PRICING.ENTERPRISE}€/mois</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pricing Info */}
            <div className="bg-slate-800 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                    <Calendar size={20} />
                    <h3 className="font-semibold">Grille Tarifaire Actuelle</h3>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <p className="text-slate-400 text-sm">Trial</p>
                        <p className="text-2xl font-bold">0€</p>
                        <p className="text-slate-400 text-xs">14 jours</p>
                    </div>
                    <div className="border-x border-slate-700 px-4">
                        <p className="text-blue-400 text-sm">Pro</p>
                        <p className="text-2xl font-bold">{PLAN_PRICING.PRO}€</p>
                        <p className="text-slate-400 text-xs">/mois</p>
                    </div>
                    <div>
                        <p className="text-purple-400 text-sm">Enterprise</p>
                        <p className="text-2xl font-bold">{PLAN_PRICING.ENTERPRISE}€</p>
                        <p className="text-slate-400 text-xs">/mois</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
