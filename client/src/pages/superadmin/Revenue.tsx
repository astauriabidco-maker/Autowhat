import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Users, Calendar, Building2, PieChart as PieIcon } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
    BarChart, Bar
} from 'recharts';

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

interface AnalyticsData {
    mrrHistory: {
        month: string;
        mrr: number;
        pro: number;
        enterprise: number;
        trial: number;
        total: number;
    }[];
    planDistribution: {
        trial: number;
        pro: number;
        enterprise: number;
    };
    funnel: {
        signups: number;
        activeTrials: number;
        converted: number;
        conversionRate: number;
        expiredTrials: number;
    };
    currentMRR: number;
    projectedARR: number;
}

// Pricing configuration (should match your actual pricing)
const PLAN_PRICING = {
    TRIAL: 0,
    PRO: 29,       // €/month
    ENTERPRISE: 99 // €/month
};

// Chart colors
const COLORS = {
    trial: '#9ca3af',
    pro: '#3b82f6',
    enterprise: '#8b5cf6',
    mrr: '#10b981',
    arr: '#6366f1'
};

export default function Revenue() {
    const [stats, setStats] = useState<RevenueStats | null>(null);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('superadmin_token');

            // Fetch analytics data
            const analyticsRes = await fetch('/admin/analytics', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (analyticsRes.ok) {
                const analyticsData = await analyticsRes.json();
                setAnalytics(analyticsData);

                // Set stats from analytics
                setStats({
                    totalMRR: analyticsData.currentMRR,
                    trialCount: analyticsData.planDistribution.trial,
                    proCount: analyticsData.planDistribution.pro,
                    enterpriseCount: analyticsData.planDistribution.enterprise,
                    tenantsByPlan: []
                });
            }
        } catch (error) {
            console.error('Error fetching data:', error);
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

    const projectedARR = analytics?.projectedARR || 0;
    const conversionRate = analytics?.funnel.conversionRate || 0;

    // Prepare pie chart data
    const pieData = analytics ? [
        { name: 'Trial', value: analytics.planDistribution.trial, color: COLORS.trial },
        { name: 'Pro', value: analytics.planDistribution.pro, color: COLORS.pro },
        { name: 'Enterprise', value: analytics.planDistribution.enterprise, color: COLORS.enterprise }
    ].filter(d => d.value > 0) : [];

    // Prepare funnel data
    const funnelData = analytics ? [
        { name: 'Inscriptions', value: analytics.funnel.signups, fill: '#6b7280' },
        { name: 'Trials Actifs', value: analytics.funnel.activeTrials, fill: COLORS.trial },
        { name: 'Convertis', value: analytics.funnel.converted, fill: COLORS.pro },
        { name: 'Expirés', value: analytics.funnel.expiredTrials, fill: '#ef4444' }
    ] : [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Revenus & Analytics</h1>
                <p className="text-gray-500">Suivi des revenus, conversions et tendances</p>
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
                            <p className="text-3xl font-bold">{analytics?.currentMRR || 0}€</p>
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
                            <p className="text-3xl font-bold">{analytics?.funnel.converted || 0}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* MRR Trend Chart */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <TrendingUp size={20} className="text-green-500" />
                        Évolution MRR (6 mois)
                    </h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={analytics?.mrrHistory || []}>
                                <defs>
                                    <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS.mrr} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={COLORS.mrr} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={(v) => `${v}€`} />
                                <Tooltip
                                    formatter={(value: any) => [`${value}€`, 'MRR']}
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="mrr"
                                    stroke={COLORS.mrr}
                                    strokeWidth={3}
                                    fill="url(#mrrGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Plan Distribution Pie */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <PieIcon size={20} className="text-purple-500" />
                        Répartition par Plan
                    </h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, percent }: { name: string, percent?: number }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                    labelLine={false}
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Legend />
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Conversion Funnel */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Users size={20} className="text-blue-500" />
                    Entonnoir de Conversion
                </h2>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={funnelData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="#9ca3af" width={100} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                {funnelData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Plan Distribution Cards */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Détail par Plan</h2>

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
