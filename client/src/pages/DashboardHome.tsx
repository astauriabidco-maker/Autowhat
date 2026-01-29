import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import clsx from 'clsx';
import {
    Users,
    MapPin,
    UserX,
    Clock,
    TrendingUp,
    LogIn,
    LogOut as LogOutIcon,
    FileText,
    BarChart3,
    Target,
    Timer
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area
} from 'recharts';
import { useSiteContext } from '../context/SiteContext';

interface KPIData {
    totalEmployees: number;
    activeNow: number;
    pendingExpenses: number;
}

interface WeeklyData {
    day: string;
    hours: number;
}

interface ActivityItem {
    type: 'CHECKIN' | 'CHECKOUT' | 'EXPENSE';
    user: string;
    time: string;
    timeAgo: string;
    details: string;
}

interface AnalyticsData {
    punctuality: {
        onTime: number;
        late: number;
        rate: number;
    };
    productivityTrend: { date: string; hours: number }[];
    avgWeekly: {
        hours: number;
        minutes: number;
        formatted: string;
    };
    avgDaily: {
        hours: number;
        minutes: number;
        formatted: string;
    };
    fillRate: number;
}

interface DashboardStats {
    totalEmployees: number;
    activeNow: number;
    pendingExpenses: number;
    weeklyActivity: WeeklyData[];
    recentActivity: ActivityItem[];
    analytics?: AnalyticsData;
}

export default function DashboardHome() {
    const navigate = useNavigate();
    const { selectedSiteId } = useSiteContext();
    const [kpis, setKpis] = useState<KPIData>({
        totalEmployees: 0,
        activeNow: 0,
        pendingExpenses: 0
    });
    const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
            return;
        }
        fetchDashboardData();
    }, [navigate, selectedSiteId]); // Refetch on site change

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            // Single API call for all dashboard data - with optional siteId filter
            const params = selectedSiteId ? { siteId: selectedSiteId } : {};
            const response = await axios.get<DashboardStats>('/api/dashboard/stats', { headers, params });

            const { totalEmployees, activeNow, pendingExpenses, weeklyActivity, recentActivity, analytics: analyticsData } = response.data;

            setKpis({
                totalEmployees,
                activeNow,
                pendingExpenses
            });

            setWeeklyData(weeklyActivity);
            setActivities(recentActivity);
            if (analyticsData) {
                setAnalytics(analyticsData);
            }

        } catch (err: any) {
            if (err.response?.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                navigate('/');
            }
        } finally {
            setLoading(false);
        }
    };

    // Calculate absent (total - active)
    const absentToday = kpis.totalEmployees - kpis.activeNow;

    const kpiCards = [
        {
            title: 'Effectif Total',
            value: kpis.totalEmployees,
            icon: <Users size={24} />,
            bgColor: 'bg-blue-50',
            textColor: 'text-blue-600',
            borderColor: 'border-blue-200'
        },
        {
            title: 'En service',
            value: kpis.activeNow,
            icon: <MapPin size={24} />,
            bgColor: 'bg-green-50',
            textColor: 'text-green-600',
            borderColor: 'border-green-200'
        },
        {
            title: 'Absents',
            value: absentToday,
            icon: <UserX size={24} />,
            bgColor: 'bg-orange-50',
            textColor: 'text-orange-600',
            borderColor: 'border-orange-200'
        },
        {
            title: 'Frais à valider',
            value: kpis.pendingExpenses,
            icon: <Clock size={24} />,
            bgColor: 'bg-purple-50',
            textColor: 'text-purple-600',
            borderColor: 'border-purple-200'
        }
    ];

    const getActivityIcon = (type: ActivityItem['type']) => {
        switch (type) {
            case 'CHECKIN':
                return <LogIn size={16} className="text-green-500" />;
            case 'CHECKOUT':
                return <LogOutIcon size={16} className="text-red-500" />;
            case 'EXPENSE':
                return <FileText size={16} className="text-purple-500" />;
            default:
                return <Clock size={16} className="text-gray-500" />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Chargement du tableau de bord...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* WhatsApp Activation Widget */}
            <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border border-indigo-200 p-6 rounded-xl shadow-sm">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="text-5xl">🚀</div>
                        <div>
                            <h3 className="font-bold text-indigo-900 text-lg">
                                Activez votre Assistant WhatsApp
                            </h3>
                            <p className="text-indigo-700 text-sm mt-1">
                                Pour recevoir les alertes et gérer vos équipes, envoyez le message d'activation au Bot.
                            </p>
                        </div>
                    </div>
                    <a
                        href={`https://wa.me/${import.meta.env.VITE_BOT_PHONE_NUMBER || '33612345678'}?text=${encodeURIComponent("Admin Start")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:from-green-600 hover:to-emerald-700 transition-all flex items-center gap-2 whitespace-nowrap shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                        <span className="text-xl">💬</span>
                        Activer sur WhatsApp
                    </a>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpiCards.map((card, idx) => (
                    <div
                        key={idx}
                        className={clsx(
                            'bg-white rounded-lg border p-5 transition-all hover:shadow-md',
                            card.borderColor
                        )}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm text-gray-500 font-medium">{card.title}</p>
                                <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                            </div>
                            <div className={clsx('p-3 rounded-lg', card.bgColor)}>
                                <span className={card.textColor}>{card.icon}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* 📊 Performance & Analyse Section */}
            {analytics && (
                <>
                    <div className="flex items-center gap-2 mt-4">
                        <span className="text-xl">📊</span>
                        <h2 className="text-lg font-bold text-gray-900">Performance & Analyse</h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        {/* Ponctualité du mois - Donut Chart */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">Ponctualité du mois</h3>
                            <div className="h-48 flex items-center justify-center relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'À l\'heure', value: analytics.punctuality.onTime },
                                                { name: 'En retard', value: analytics.punctuality.late }
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={70}
                                            paddingAngle={2}
                                            dataKey="value"
                                        >
                                            <Cell fill="#22c55e" />
                                            <Cell fill="#f97316" />
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1e293b',
                                                border: 'none',
                                                borderRadius: '8px',
                                                color: 'white'
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                {/* Central percentage */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-gray-900">{analytics.punctuality.rate}%</p>
                                        <p className="text-xs text-gray-500">ponctualité</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-center gap-4 mt-2 text-xs">
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                    À l'heure ({analytics.punctuality.onTime})
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                                    Retard ({analytics.punctuality.late})
                                </span>
                            </div>
                        </div>

                        {/* Volume de travail - Area Chart */}
                        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">Volume de travail (30 jours)</h3>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={analytics.productivityTrend}>
                                        <defs>
                                            <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis
                                            dataKey="date"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 10 }}
                                            interval="preserveStartEnd"
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 10 }}
                                            tickFormatter={(v) => `${v}h`}
                                            width={35}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1e293b',
                                                border: 'none',
                                                borderRadius: '8px',
                                                color: 'white'
                                            }}
                                            formatter={(value) => [`${value}h travaillées`, 'Volume']}
                                            labelFormatter={(label) => `Le ${label}`}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="hours"
                                            stroke="#6366f1"
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#colorHours)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Insight Cards */}
                        <div className="space-y-4">
                            {/* Moyenne Quotidienne */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <Timer size={20} className="text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-blue-600 font-medium">Moyenne Quotidienne</p>
                                        <p className="text-2xl font-bold text-blue-900">{analytics.avgDaily.formatted}</p>
                                    </div>
                                </div>
                                <p className="text-xs text-blue-600 mt-2">Temps moyen par employé aujourd'hui</p>
                            </div>

                            {/* Taux de Remplissage */}
                            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-200 p-5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-100 rounded-lg">
                                        <Target size={20} className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-emerald-600 font-medium">Taux de Remplissage</p>
                                        <p className="text-2xl font-bold text-emerald-900">{analytics.fillRate}%</p>
                                    </div>
                                </div>
                                <p className="text-xs text-emerald-600 mt-2">Présents vs effectif total</p>
                            </div>

                            {/* Moyenne Hebdo */}
                            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-100 rounded-lg">
                                        <BarChart3 size={20} className="text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-purple-600 font-medium">Moyenne Hebdo</p>
                                        <p className="text-2xl font-bold text-purple-900">{analytics.avgWeekly.formatted}</p>
                                    </div>
                                </div>
                                <p className="text-xs text-purple-600 mt-2">Par employé cette semaine</p>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Charts & Activity Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Weekly Hours Chart */}
                <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                                Heures travaillées cette semaine
                            </h3>
                            <p className="text-sm text-gray-500">Total cumulé par jour</p>
                        </div>
                        <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                            <TrendingUp size={16} />
                            +12% vs semaine dernière
                        </div>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="day"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                    tickFormatter={(value) => `${value}h`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1e293b',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: 'white'
                                    }}
                                    formatter={(value) => value != null ? [`${value}h`, 'Heures'] : ['', 'Heures']}
                                />
                                <Bar
                                    dataKey="hours"
                                    fill="#3b82f6"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={50}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Activity Feed */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Fil d'activité en direct
                    </h3>
                    <div className="space-y-3 max-h-72 overflow-y-auto">
                        {activities.length === 0 ? (
                            <p className="text-gray-500 text-sm text-center py-8">
                                Aucune activité récente
                            </p>
                        ) : (
                            activities.map((activity, index) => (
                                <div
                                    key={`${activity.user}-${activity.time}-${index}`}
                                    className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition"
                                >
                                    <div className="mt-0.5">
                                        {getActivityIcon(activity.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-gray-900 truncate">
                                            <span className="font-medium">{activity.user}</span> — {activity.details}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {activity.timeAgo}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Stats Footer */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold">💬 WhatsApp Bot Actif</h3>
                        <p className="text-blue-100 text-sm mt-1">
                            Vos employés peuvent pointer via WhatsApp en envoyant "Menu"
                        </p>
                    </div>
                    <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium">En ligne</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
