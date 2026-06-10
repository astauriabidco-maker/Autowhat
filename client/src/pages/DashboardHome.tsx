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
    Timer,
    CheckCircle,
    Circle,
    UserPlus,
    ShieldAlert,
    AlertTriangle,
    XCircle
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
import { getErrorStatus } from '../utils/errors';

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
    gpsSupervision?: GpsSupervision;
}

interface GpsSupervision {
    riskLevel: 'low' | 'medium' | 'high';
    summary: {
        totalSites: number;
        strictSites: number;
        missingGpsSites: number;
        nonStrictSites: number;
        disabledGpsSites: number;
        pendingProposals: number;
        rejectedLast7Days: number;
        validatedLast7Days: number;
        expiredLast7Days: number;
    };
    riskSites: Array<{
        id: string;
        name: string;
        reason: string;
        severity: 'medium' | 'high';
    }>;
    pendingProposals: Array<{
        managerId: string;
        managerName: string | null;
        siteId: string | null;
        siteName: string;
        providerName: string | null;
        sharedAt: string | null;
        countryMismatch: boolean;
    }>;
    recentEvents: Array<{
        id: string;
        type: 'SITE_GPS_POSITION_SHARED' | 'SITE_GPS_UPDATED' | 'SITE_GPS_REJECTED' | 'SITE_GPS_APPROVAL_REMINDER_SENT' | 'SITE_GPS_EXPIRED';
        createdAt: string;
        siteId: string | null;
        siteName: string;
        source: string | null;
        actor: string | null;
        countryMismatch: boolean;
    }>;
}

interface OnboardingStep {
    key: string;
    label: string;
    done: boolean;
    timestamp: string | null;
}

interface OnboardingProgress {
    summary: {
        employeeCount: number;
        activatedEmployees: number;
        employeesWithCheckin: number;
        remainingSeats: number;
    };
    firstEmployee: {
        id: string;
        name: string | null;
        activated: boolean;
        invitedAt: string | null;
        activationReminderSentAt: string | null;
        firstCheckinAt: string | null;
    } | null;
    steps: OnboardingStep[];
    nextAction: string;
}

export default function DashboardHome() {
    const navigate = useNavigate();
    const { selectedSiteId, sites } = useSiteContext();
    const [kpis, setKpis] = useState<KPIData>({
        totalEmployees: 0,
        activeNow: 0,
        pendingExpenses: 0
    });
    const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [onboarding, setOnboarding] = useState<OnboardingProgress | null>(null);
    const [gpsSupervision, setGpsSupervision] = useState<GpsSupervision | null>(null);
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
            const [response, onboardingResponse] = await Promise.all([
                axios.get<DashboardStats>('/api/dashboard/stats', { headers, params }),
                axios.get<OnboardingProgress>('/api/onboarding/progress', { headers })
            ]);

            const { totalEmployees, activeNow, pendingExpenses, weeklyActivity, recentActivity, analytics: analyticsData, gpsSupervision: gpsData } = response.data;

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
            setGpsSupervision(gpsData || null);
            setOnboarding(onboardingResponse.data);

        } catch (err: unknown) {
            if (getErrorStatus(err) === 401) {
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
    const sitesWithoutGps = sites.filter(site => !site.latitude || !site.longitude);
    const sitesNotStrict = sites.filter(site => site.latitude && site.longitude && site.gpsMode !== 'STRICT');
    const sitesToSecure = sites.filter(site => !site.latitude || !site.longitude || site.gpsMode !== 'STRICT');
    const completedOnboardingSteps = onboarding?.steps.filter(step => step.done).length || 0;
    const adminStartUrl = `https://wa.me/${import.meta.env.VITE_BOT_PHONE_NUMBER || '33612345678'}?text=${encodeURIComponent("Admin Start")}`;
    const firstEmployeeName = onboarding?.firstEmployee?.name || 'le collaborateur invité';
    const formatOnboardingDate = (value: string | null | undefined) =>
        value
            ? new Date(value).toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            })
            : null;
    const onboardingAction = (() => {
        if (!onboarding) {
            return {
                title: 'Invitez votre premier collaborateur',
                description: 'Envoyez une invitation WhatsApp à une personne réelle pour voir le premier pointage arriver ici.',
                cta: 'Inviter un collaborateur',
                route: '/employees',
                href: null
            };
        }

        if (onboarding.nextAction === 'manager_activated') {
            return {
                title: 'Activez votre manager WhatsApp',
                description: 'Revenez dans WhatsApp et envoyez Admin Start. Vous pourrez ensuite inviter un premier collaborateur.',
                cta: 'Activer sur WhatsApp',
                route: '/dashboard',
                href: adminStartUrl
            };
        }

        if (onboarding.nextAction === 'employee_invited') {
            return {
                title: 'Invitez votre premier collaborateur',
                description: 'Ajoutez un collaborateur réel. Il recevra WhatsApp et pourra pointer sans installer d’application.',
                cta: 'Inviter maintenant',
                route: '/employees',
                href: null
            };
        }

        if (onboarding.nextAction === 'employee_activated') {
            const reminderSentAt = formatOnboardingDate(onboarding.firstEmployee?.activationReminderSentAt);

            return {
                title: `${firstEmployeeName} doit activer son accès`,
                description: reminderSentAt
                    ? `Relance envoyée au manager le ${reminderSentAt}. Prochaine action : contactez ${firstEmployeeName} pour lui demander de répondre au message WhatsApp reçu.`
                    : `Prochaine action manager : contactez ${firstEmployeeName} et demandez-lui de répondre au message WhatsApp reçu. Son accès sera actif dès sa première réponse.`,
                cta: 'Ouvrir Employés',
                route: '/employees',
                href: null
            };
        }

        if (onboarding.nextAction === 'first_checkin') {
            return {
                title: 'Prêt pour le premier pointage',
                description: 'Le collaborateur peut cliquer sur Pointer depuis WhatsApp. Le résultat apparaîtra dans le tableau de bord.',
                cta: 'Voir les pointages',
                route: '/attendance',
                href: null
            };
        }

        return {
            title: 'Tunnel opérationnel',
            description: 'Le premier pointage est arrivé. Vous pouvez maintenant élargir le test à d’autres collaborateurs.',
            cta: 'Inviter un autre collaborateur',
            route: '/employees',
            href: null
        };
    })();

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

    const formatShortDate = (value: string | null | undefined) =>
        value
            ? new Date(value).toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            })
            : 'Date inconnue';

    const gpsEventLabel = (type: GpsSupervision['recentEvents'][number]['type']) => {
        if (type === 'SITE_GPS_POSITION_SHARED') return 'Position proposée';
        if (type === 'SITE_GPS_REJECTED') return 'Position refusée';
        if (type === 'SITE_GPS_APPROVAL_REMINDER_SENT') return 'Relance validation';
        if (type === 'SITE_GPS_EXPIRED') return 'Position expirée';
        return 'Position validée';
    };

    const gpsSourceLabel = (source: string | null) => {
        if (!source) return null;
        const labels: Record<string, string> = {
            WHATSAPP_EMPLOYEE: 'WhatsApp collaborateur',
            WHATSAPP_EMPLOYEE_VALIDATED: 'WhatsApp validé',
            manager_dashboard: 'Dashboard',
            manager_dashboard_validated: 'Dashboard validé',
            manager_dashboard_corrected_country: 'Pays corrigé',
            manager_dashboard_rejected: 'Dashboard refusé'
        };
        return labels[source] || source;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Chargement du tableau de bord...</div>
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* WhatsApp Activation Widget */}
            <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border border-indigo-200 p-4 sm:p-6 rounded-xl shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                        <div className="text-3xl sm:text-5xl">🚀</div>
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
                        className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:from-green-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-lg"
                    >
                        <span className="text-xl">💬</span>
                        Activer sur WhatsApp
                    </a>
                </div>
            </div>

            {/* First Steps Widget */}
            {onboarding && (
                <div className="bg-white border border-emerald-200 rounded-xl shadow-sm p-4 sm:p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-emerald-100 rounded-lg">
                                    <UserPlus className="text-emerald-600" size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900">Premiers pas WhatsPoint</h3>
                                    <p className="text-sm text-gray-500">
                                        {completedOnboardingSteps}/{onboarding.steps.length} étapes validées. Prochaine action : {onboardingAction.title.toLowerCase()}.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                if (onboardingAction.href) {
                                    window.open(onboardingAction.href, '_blank', 'noopener,noreferrer');
                                    return;
                                }
                                navigate(onboardingAction.route);
                            }}
                            className="w-full sm:w-auto px-4 py-3 sm:py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition"
                        >
                            {onboardingAction.cta}
                        </button>
                    </div>

                    <div className="mt-5 rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-emerald-950">{onboardingAction.title}</p>
                                <p className="text-sm text-emerald-800 mt-1">{onboardingAction.description}</p>
                            </div>
                            {onboarding.nextAction === 'employee_activated' && (
                                <span className="inline-flex w-fit items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                                    En attente de réponse
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
                        {onboarding.steps.map((step) => (
                            <div
                                key={step.key}
                                className={clsx(
                                    'rounded-lg border p-4',
                                    step.done ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    {step.done ? (
                                        <CheckCircle size={18} className="text-emerald-600" />
                                    ) : (
                                        <Circle size={18} className="text-gray-400" />
                                    )}
                                    <span className={clsx('text-sm font-semibold', step.done ? 'text-emerald-900' : 'text-gray-600')}>
                                        {step.label}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    {step.timestamp ? new Date(step.timestamp).toLocaleString('fr-FR') : 'En attente'}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 text-sm text-gray-600">
                        {onboarding.firstEmployee ? (
                            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center">
                                <span>
                                    Premier collaborateur : <strong>{onboarding.firstEmployee.name || 'Sans nom'}</strong>.
                                </span>
                                <span>Activés : {onboarding.summary.activatedEmployees}/{onboarding.summary.employeeCount}.</span>
                                {onboarding.firstEmployee.invitedAt && (
                                    <span className="text-gray-500">
                                        Invité le {formatOnboardingDate(onboarding.firstEmployee.invitedAt)}.
                                    </span>
                                )}
                                {!onboarding.firstEmployee.activated && onboarding.firstEmployee.activationReminderSentAt && (
                                    <span className="text-amber-700 font-medium">
                                        Relance envoyée le {formatOnboardingDate(onboarding.firstEmployee.activationReminderSentAt)}.
                                    </span>
                                )}
                            </div>
                        ) : (
                            <span>Prochaine étape : invitez un premier collaborateur depuis WhatsApp ou depuis l'écran Employés.</span>
                        )}
                    </div>
                </div>
            )}

            {/* GPS Trust Alert */}
            {sitesToSecure.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl shadow-sm p-4 sm:p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                                <ShieldAlert className="text-amber-700" size={22} />
                            </div>
                            <div>
                                <h3 className="font-bold text-amber-950">Sécurisez vos sites de pointage</h3>
                                <p className="text-sm text-amber-900 mt-1">
                                    {sitesWithoutGps.length > 0 && (
                                        <span>{sitesWithoutGps.length} site{sitesWithoutGps.length > 1 ? 's' : ''} sans coordonnées GPS. </span>
                                    )}
                                    {sitesNotStrict.length > 0 && (
                                        <span>{sitesNotStrict.length} site{sitesNotStrict.length > 1 ? 's' : ''} configuré{sitesNotStrict.length > 1 ? 's' : ''} sans mode strict. </span>
                                    )}
                                    En mode strict, WhatsPoint bloque les pointages hors zone.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/sites-gps')}
                            className="w-full sm:w-auto px-4 py-3 sm:py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition"
                        >
                            Configurer les sites GPS
                        </button>
                    </div>
                </div>
            )}

            {gpsSupervision && (
                <section className={clsx(
                    'bg-white border rounded-xl shadow-sm p-4 sm:p-6 space-y-5',
                    gpsSupervision.riskLevel === 'high'
                        ? 'border-red-200'
                        : gpsSupervision.riskLevel === 'medium'
                            ? 'border-amber-200'
                            : 'border-emerald-200'
                )}>
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className={clsx(
                                'p-2 rounded-lg shrink-0',
                                gpsSupervision.riskLevel === 'high'
                                    ? 'bg-red-100 text-red-700'
                                    : gpsSupervision.riskLevel === 'medium'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-emerald-100 text-emerald-700'
                            )}>
                                {gpsSupervision.riskLevel === 'low' ? <CheckCircle size={22} /> : <ShieldAlert size={22} />}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900">Supervision GPS</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Suivez les sites sans GPS strict, les positions refusées et les validations récentes.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/sites-gps')}
                            className="w-full sm:w-auto px-4 py-3 sm:py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition"
                        >
                            Ouvrir le GPS Center
                        </button>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                            {
                                label: 'Sites stricts',
                                value: `${gpsSupervision.summary.strictSites}/${gpsSupervision.summary.totalSites}`,
                                tone: 'emerald',
                                icon: <CheckCircle size={18} />
                            },
                            {
                                label: 'À sécuriser',
                                value: gpsSupervision.summary.missingGpsSites + gpsSupervision.summary.nonStrictSites,
                                tone: gpsSupervision.summary.missingGpsSites > 0 ? 'red' : 'amber',
                                icon: <AlertTriangle size={18} />
                            },
                            {
                                label: 'En attente',
                                value: gpsSupervision.summary.pendingProposals,
                                tone: 'blue',
                                icon: <Clock size={18} />
                            },
                            {
                                label: 'Refus/expirées',
                                value: gpsSupervision.summary.rejectedLast7Days + gpsSupervision.summary.expiredLast7Days,
                                tone: gpsSupervision.summary.rejectedLast7Days + gpsSupervision.summary.expiredLast7Days > 0 ? 'red' : 'gray',
                                icon: <XCircle size={18} />
                            }
                        ].map((item) => (
                            <div key={item.label} className={clsx(
                                'rounded-lg border p-3 sm:p-4',
                                item.tone === 'emerald' && 'bg-emerald-50 border-emerald-200 text-emerald-800',
                                item.tone === 'red' && 'bg-red-50 border-red-200 text-red-800',
                                item.tone === 'amber' && 'bg-amber-50 border-amber-200 text-amber-800',
                                item.tone === 'blue' && 'bg-blue-50 border-blue-200 text-blue-800',
                                item.tone === 'gray' && 'bg-gray-50 border-gray-200 text-gray-700'
                            )}>
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-semibold">{item.label}</p>
                                    {item.icon}
                                </div>
                                <p className="text-2xl font-bold mt-2">{item.value}</p>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                            <h4 className="text-sm font-bold text-gray-900">Risques à traiter</h4>
                            <div className="mt-3 space-y-2">
                                {gpsSupervision.riskSites.length === 0 ? (
                                    <p className="text-sm text-gray-500">Aucun site à risque immédiat.</p>
                                ) : (
                                    gpsSupervision.riskSites.map(site => (
                                        <div key={`${site.id}-${site.reason}`} className="flex items-start justify-between gap-3 rounded-lg bg-white border border-gray-200 p-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-gray-900 truncate">{site.name}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{site.reason}</p>
                                            </div>
                                            <span className={clsx(
                                                'rounded-full px-2 py-0.5 text-xs font-semibold shrink-0',
                                                site.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                            )}>
                                                {site.severity === 'high' ? 'haut' : 'moyen'}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                            <h4 className="text-sm font-bold text-gray-900">Positions en attente</h4>
                            <div className="mt-3 space-y-2">
                                {gpsSupervision.pendingProposals.length === 0 ? (
                                    <p className="text-sm text-gray-500">Aucune proposition à valider.</p>
                                ) : (
                                    gpsSupervision.pendingProposals.map(proposal => (
                                        <div key={`${proposal.managerId}-${proposal.siteId}`} className="rounded-lg bg-white border border-gray-200 p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-gray-900 truncate">{proposal.siteName}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        {proposal.providerName || 'Collaborateur'} · {formatShortDate(proposal.sharedAt)}
                                                    </p>
                                                </div>
                                                {proposal.countryMismatch && (
                                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 shrink-0">
                                                        pays
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                            <h4 className="text-sm font-bold text-gray-900">Historique GPS</h4>
                            <div className="mt-3 space-y-2">
                                {gpsSupervision.recentEvents.length === 0 ? (
                                    <p className="text-sm text-gray-500">Aucun événement GPS récent.</p>
                                ) : (
                                    gpsSupervision.recentEvents.map(event => (
                                        <div key={event.id} className="rounded-lg bg-white border border-gray-200 p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                                        {gpsEventLabel(event.type)} · {event.siteName}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        {formatShortDate(event.createdAt)}
                                                        {event.actor ? ` · ${event.actor}` : ''}
                                                    </p>
                                                </div>
                                                {gpsSourceLabel(event.source) && (
                                                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 shrink-0">
                                                        {gpsSourceLabel(event.source)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {kpiCards.map((card, idx) => (
                    <div
                        key={idx}
                        className={clsx(
                            'bg-white rounded-lg border p-4 sm:p-5 transition-all hover:shadow-md',
                            card.borderColor
                        )}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs sm:text-sm text-gray-500 font-medium">{card.title}</p>
                                <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                            </div>
                            <div className={clsx('hidden sm:block p-3 rounded-lg', card.bgColor)}>
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
