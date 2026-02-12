import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
    BarChart3, CalendarClock, AlertTriangle, CheckCircle2, Clock, Users,
    TrendingUp, Zap, PenTool, ArrowRight, Send, Bell, RefreshCw,
    Timer, Target, ChevronRight, Building2, User, MapPin, SquareStack,
    MessageCircle
} from 'lucide-react';

interface DashboardData {
    kpis: {
        todayTotal: number;
        todayCompleted: number;
        todayInProgress: number;
        todayEnRoute: number;
        todayScheduled: number;
        overdueCount: number;
        completionRate: number;
        signatureRate: number;
        avgDurationMinutes: number;
        monthTotal: number;
        monthCompleted: number;
    };
    alerts: { type: string; severity: 'warning' | 'error' | 'info'; message: string; interventionId?: string }[];
    technicianWorkload: { id: string; name: string; phone: string; count: number; completed: number; hours: number }[];
    typeDistribution: { name: string; color: string; count: number }[];
    upcoming: any[];
    weeklyChart: { day: string; total: number; completed: number; inProgress: number }[];
    todayInterventions: any[];
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    SCHEDULED: { bg: '#f1f5f9', text: '#475569', label: 'Prévu' },
    EN_ROUTE: { bg: '#dbeafe', text: '#1d4ed8', label: 'En route' },
    IN_PROGRESS: { bg: '#fef3c7', text: '#b45309', label: 'En cours' },
    COMPLETED: { bg: '#dcfce7', text: '#15803d', label: 'Terminé' },
    CANCELED: { bg: '#fee2e2', text: '#b91c1c', label: 'Annulé' },
};

export default function OpsDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [sendingBriefing, setSendingBriefing] = useState(false);
    const [briefingResult, setBriefingResult] = useState<string | null>(null);

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    const fetchDashboard = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/operations/dashboard', { headers });
            setData(res.data);
        } catch (e) {
            console.error('Error fetching dashboard', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDashboard(); }, []);

    // Auto-refresh every 60s
    useEffect(() => {
        const interval = setInterval(fetchDashboard, 60000);
        return () => clearInterval(interval);
    }, []);

    const handleSendBriefing = async () => {
        if (!confirm('Envoyer la feuille de route du jour à tous les techniciens par WhatsApp ?')) return;
        setSendingBriefing(true);
        setBriefingResult(null);
        try {
            const res = await axios.post('/api/operations/daily-briefing', {}, { headers });
            setBriefingResult(`✅ Envoyé à ${res.data.technicianCount} technicien(s) — ${res.data.interventionCount} intervention(s)`);
        } catch (e) {
            setBriefingResult('❌ Erreur lors de l\'envoi');
        } finally {
            setSendingBriefing(false);
            setTimeout(() => setBriefingResult(null), 5000);
        }
    };

    const maxChart = useMemo(() => {
        if (!data?.weeklyChart) return 1;
        return Math.max(...data.weeklyChart.map(d => d.total), 1);
    }, [data?.weeklyChart]);

    if (loading || !data) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <BarChart3 className="text-blue-600" size={28} />
                        Tableau de bord Opérations
                    </h2>
                    <p className="text-gray-500 mt-1">
                        Vue d'ensemble en temps réel · Dernière mise à jour : {format(new Date(), 'HH:mm', { locale: fr })}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSendBriefing}
                        disabled={sendingBriefing}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition shadow-lg shadow-green-500/25 font-medium text-sm disabled:opacity-50"
                    >
                        <MessageCircle size={16} />
                        {sendingBriefing ? 'Envoi...' : 'Briefing WhatsApp'}
                    </button>
                    <button
                        onClick={fetchDashboard}
                        className="p-2.5 text-gray-500 hover:bg-gray-100 rounded-xl transition"
                        title="Actualiser"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {briefingResult && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800 animate-in slide-in-from-top duration-300">
                    {briefingResult}
                </div>
            )}

            {/* KPI Cards Row 1 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    {
                        label: 'Aujourd\'hui',
                        value: data.kpis.todayTotal,
                        sub: `${data.kpis.todayCompleted} terminée(s)`,
                        icon: <CalendarClock size={20} />,
                        gradient: 'from-blue-500 to-indigo-600',
                        shadow: 'shadow-blue-500/20',
                    },
                    {
                        label: 'En cours',
                        value: data.kpis.todayInProgress + data.kpis.todayEnRoute,
                        sub: `${data.kpis.todayEnRoute} en route · ${data.kpis.todayInProgress} sur place`,
                        icon: <Zap size={20} />,
                        gradient: 'from-amber-500 to-orange-600',
                        shadow: 'shadow-amber-500/20',
                    },
                    {
                        label: 'En retard',
                        value: data.kpis.overdueCount,
                        sub: 'nécessitent attention',
                        icon: <AlertTriangle size={20} />,
                        gradient: data.kpis.overdueCount > 0 ? 'from-red-500 to-rose-600' : 'from-green-500 to-emerald-600',
                        shadow: data.kpis.overdueCount > 0 ? 'shadow-red-500/20' : 'shadow-green-500/20',
                    },
                    {
                        label: 'Taux complétion',
                        value: `${data.kpis.completionRate}%`,
                        sub: `${data.kpis.monthCompleted}/${data.kpis.monthTotal} ce mois`,
                        icon: <Target size={20} />,
                        gradient: 'from-purple-500 to-violet-600',
                        shadow: 'shadow-purple-500/20',
                    },
                ].map((kpi, i) => (
                    <div key={i} className={`bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-xl transition-all duration-300 ${kpi.shadow}`}>
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm text-gray-500 font-medium">{kpi.label}</p>
                                <p className="text-3xl font-bold text-gray-900 mt-1">{kpi.value}</p>
                                <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>
                            </div>
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.gradient} flex items-center justify-center text-white`}>
                                {kpi.icon}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* KPI Cards Row 2 */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Taux signature', value: `${data.kpis.signatureRate}%`, icon: <PenTool size={16} />, color: 'text-indigo-600 bg-indigo-50' },
                    { label: 'Durée moyenne', value: data.kpis.avgDurationMinutes > 0 ? `${data.kpis.avgDurationMinutes} min` : '—', icon: <Timer size={16} />, color: 'text-teal-600 bg-teal-50' },
                    { label: 'Ce mois', value: data.kpis.monthTotal, icon: <TrendingUp size={16} />, color: 'text-pink-600 bg-pink-50' },
                ].map((s, i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 hover:shadow-md transition-all">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color}`}>
                            {s.icon}
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">{s.label}</p>
                            <p className="text-lg font-bold text-gray-900">{s.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Weekly Activity Chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <BarChart3 size={18} className="text-blue-500" />
                        Activité de la semaine
                    </h3>
                    <div className="flex items-end justify-between gap-2" style={{ height: 180 }}>
                        {data.weeklyChart.map((d, i) => {
                            const height = (d.total / maxChart) * 150;
                            const completedHeight = (d.completed / maxChart) * 150;
                            const isToday = i === (new Date().getDay() + 6) % 7;
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-xs font-bold text-gray-700">{d.total}</span>
                                    <div className="w-full relative" style={{ height: 150 }}>
                                        <div
                                            className={`absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t-lg transition-all duration-500 ${isToday ? 'w-full' : 'w-3/4'}`}
                                            style={{
                                                height: Math.max(height, 4),
                                                background: isToday
                                                    ? 'linear-gradient(to top, #3b82f6, #6366f1)'
                                                    : 'linear-gradient(to top, #e0e7ff, #c7d2fe)',
                                            }}
                                        />
                                        {d.completed > 0 && (
                                            <div
                                                className={`absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t-lg ${isToday ? 'w-full' : 'w-3/4'}`}
                                                style={{
                                                    height: Math.max(completedHeight, 2),
                                                    background: 'linear-gradient(to top, #22c55e, #16a34a)',
                                                    opacity: 0.5,
                                                }}
                                            />
                                        )}
                                    </div>
                                    <span className={`text-xs font-medium ${isToday ? 'text-blue-600 font-bold' : 'text-gray-500'}`}>
                                        {d.day}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-blue-400 to-indigo-500" />
                            Total
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-green-400 to-green-500 opacity-50" />
                            Terminées
                        </div>
                    </div>
                </div>

                {/* Alerts Panel */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Bell size={18} className="text-amber-500" />
                        Alertes
                        {data.alerts.length > 0 && (
                            <span className="ml-auto bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                {data.alerts.length}
                            </span>
                        )}
                    </h3>
                    {data.alerts.length === 0 ? (
                        <div className="text-center py-8">
                            <CheckCircle2 size={36} className="mx-auto text-green-400 mb-2" />
                            <p className="text-sm text-gray-500">Aucune alerte</p>
                            <p className="text-xs text-gray-400">Tout est sous contrôle 👍</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[220px] overflow-y-auto">
                            {data.alerts.map((alert, i) => (
                                <div
                                    key={i}
                                    className={`p-3 rounded-xl text-sm flex items-start gap-2 ${alert.severity === 'error'
                                            ? 'bg-red-50 border border-red-100'
                                            : alert.severity === 'warning'
                                                ? 'bg-amber-50 border border-amber-100'
                                                : 'bg-blue-50 border border-blue-100'
                                        }`}
                                >
                                    {alert.severity === 'error' ? (
                                        <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                                    ) : alert.severity === 'warning' ? (
                                        <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                    ) : (
                                        <Clock size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                                    )}
                                    <p className={`text-xs leading-tight ${alert.severity === 'error' ? 'text-red-700' :
                                            alert.severity === 'warning' ? 'text-amber-700' : 'text-blue-700'
                                        }`}>
                                        {alert.message}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Technician Workload */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Users size={18} className="text-indigo-500" />
                        Charge techniciens (semaine)
                    </h3>
                    {data.technicianWorkload.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">Aucune donnée cette semaine</p>
                    ) : (
                        <div className="space-y-3">
                            {data.technicianWorkload.map((tech) => {
                                const maxCount = Math.max(...data.technicianWorkload.map(t => t.count), 1);
                                const pct = (tech.count / maxCount) * 100;
                                return (
                                    <div key={tech.id}>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                                                    {tech.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-sm font-medium text-gray-800">{tech.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="text-gray-500">{tech.count} interv.</span>
                                                <span className="text-green-600 font-semibold">{tech.completed}✓</span>
                                                <span className="text-gray-400">{Math.round(tech.hours * 10) / 10}h</span>
                                            </div>
                                        </div>
                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-700"
                                                style={{
                                                    width: `${pct}%`,
                                                    background: 'linear-gradient(to right, #6366f1, #8b5cf6)',
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Type Distribution */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <SquareStack size={18} className="text-blue-500" />
                        Répartition par type (mois)
                    </h3>
                    {data.typeDistribution.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">Aucune intervention ce mois</p>
                    ) : (
                        <div className="space-y-3">
                            {data.typeDistribution.map((type, i) => {
                                const maxCount = Math.max(...data.typeDistribution.map(t => t.count), 1);
                                const pct = (type.count / maxCount) * 100;
                                const totalCount = data.typeDistribution.reduce((s, t) => s + t.count, 0);
                                const percentage = Math.round((type.count / totalCount) * 100);
                                return (
                                    <div key={i}>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: type.color }}
                                                />
                                                <span className="text-sm font-medium text-gray-700">{type.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="text-gray-500">{type.count}</span>
                                                <span className="text-gray-400 font-medium">{percentage}%</span>
                                            </div>
                                        </div>
                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-700"
                                                style={{
                                                    width: `${pct}%`,
                                                    backgroundColor: type.color,
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Upcoming Interventions & Today's Schedule */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Today's List */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Clock size={18} className="text-blue-500" />
                        Interventions du jour
                        <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            {data.todayInterventions.length}
                        </span>
                    </h3>
                    {data.todayInterventions.length === 0 ? (
                        <div className="text-center py-8">
                            <CalendarClock size={36} className="mx-auto text-gray-300 mb-2" />
                            <p className="text-sm text-gray-500">Aucune intervention aujourd'hui</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[320px] overflow-y-auto">
                            {data.todayInterventions.map((i: any) => (
                                <div
                                    key={i.id}
                                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all border border-gray-50"
                                >
                                    <div
                                        className="w-1 h-10 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: i.interventionType?.color || STATUS_COLORS[i.status]?.text || '#94a3b8' }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{i.title}</p>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                            <span className="flex items-center gap-1">
                                                <Clock size={10} />
                                                {format(new Date(i.scheduledStart), 'HH:mm')} – {format(new Date(i.scheduledEnd), 'HH:mm')}
                                            </span>
                                            <span className="flex items-center gap-1 truncate">
                                                <Building2 size={10} />
                                                {i.customer.companyName}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold" title={i.employee?.name}>
                                            {(i.employee?.name || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <span
                                            className="px-2 py-0.5 rounded-full text-xs font-semibold"
                                            style={{
                                                backgroundColor: STATUS_COLORS[i.status]?.bg,
                                                color: STATUS_COLORS[i.status]?.text,
                                            }}
                                        >
                                            {STATUS_COLORS[i.status]?.label}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Upcoming */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <ArrowRight size={18} className="text-green-500" />
                        Prochaines interventions
                    </h3>
                    {data.upcoming.length === 0 ? (
                        <div className="text-center py-8">
                            <CheckCircle2 size={36} className="mx-auto text-green-300 mb-2" />
                            <p className="text-sm text-gray-500">Rien de planifié</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[320px] overflow-y-auto">
                            {data.upcoming.map((i: any) => (
                                <div
                                    key={i.id}
                                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all border border-gray-50"
                                >
                                    <div className="flex-shrink-0 text-center">
                                        <p className="text-xs text-gray-400 font-medium uppercase">
                                            {format(new Date(i.scheduledStart), 'EEE', { locale: fr })}
                                        </p>
                                        <p className="text-lg font-bold text-gray-900">
                                            {format(new Date(i.scheduledStart), 'dd')}
                                        </p>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{i.title}</p>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                            <span>{format(new Date(i.scheduledStart), 'HH:mm')}</span>
                                            <span>·</span>
                                            <span className="truncate">{i.customer?.companyName}</span>
                                            {i.interventionType && (
                                                <>
                                                    <span>·</span>
                                                    <span
                                                        className="px-1.5 py-0.5 rounded text-xs font-medium text-white truncate"
                                                        style={{ backgroundColor: i.interventionType.color }}
                                                    >
                                                        {i.interventionType.name}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0" title={i.employee?.name}>
                                        {(i.employee?.name || '?').charAt(0).toUpperCase()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
