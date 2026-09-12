import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    AlertCircle,
    CalendarDays,
    CheckCircle2,
    ClipboardList,
    Clock,
    FileCheck2,
    Headphones,
    Inbox as InboxIcon,
    Loader2,
    MapPinned,
    MessageCircle,
    RefreshCw,
    Search,
    SlidersHorizontal,
    UserX,
    X,
    type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { getErrorMessage, getErrorStatus } from '../utils/errors';

type InboxKind = 'ATTENDANCE_GPS' | 'INTERVENTION' | 'SUPPORT' | 'LEAVE' | 'EXPENSE' | 'NOTIFICATION';
type InboxPriority = 'LOW' | 'NORMAL' | 'URGENT' | 'INFO';

interface InboxItem {
    id: string;
    kind: InboxKind;
    title: string;
    summary: string;
    actor: {
        id?: string;
        name: string;
        phoneNumber?: string | null;
    };
    priority: InboxPriority;
    status: string;
    createdAt: string;
    updatedAt?: string;
    targetUrl: string;
    availableActions: string[];
    metadata?: Record<string, unknown>;
}

type Counts = Record<InboxKind | 'ALL', number>;

interface InboxSummary {
    actionable: number;
    urgent: number;
    pendingApproval: number;
    stale: number;
}

interface InboxResponse {
    items: InboxItem[];
    counts: Counts;
    summary?: InboxSummary;
}

interface PendingDecision {
    item: InboxItem;
    action: string;
}

interface KindConfig {
    label: string;
    shortLabel: string;
    icon: LucideIcon;
    tint: string;
    badge: string;
}

const KIND_CONFIG: Record<InboxKind, KindConfig> = {
    ATTENDANCE_GPS: {
        label: 'Retards & GPS',
        shortLabel: 'GPS',
        icon: MapPinned,
        tint: 'text-rose-600 bg-rose-50 border-rose-100',
        badge: 'bg-rose-100 text-rose-700',
    },
    INTERVENTION: {
        label: 'Interventions masquées',
        shortLabel: 'Legacy',
        icon: MessageCircle,
        tint: 'text-slate-600 bg-slate-50 border-slate-100',
        badge: 'bg-slate-100 text-slate-700',
    },
    SUPPORT: {
        label: 'Questions manager',
        shortLabel: 'Support',
        icon: Headphones,
        tint: 'text-blue-600 bg-blue-50 border-blue-100',
        badge: 'bg-blue-100 text-blue-700',
    },
    LEAVE: {
        label: 'Absences & congés',
        shortLabel: 'Absence',
        icon: UserX,
        tint: 'text-emerald-600 bg-emerald-50 border-emerald-100',
        badge: 'bg-emerald-100 text-emerald-700',
    },
    EXPENSE: {
        label: 'Justificatifs',
        shortLabel: 'Justificatif',
        icon: FileCheck2,
        tint: 'text-purple-600 bg-purple-50 border-purple-100',
        badge: 'bg-purple-100 text-purple-700',
    },
    NOTIFICATION: {
        label: 'Alertes système',
        shortLabel: 'Signal',
        icon: AlertCircle,
        tint: 'text-rose-600 bg-rose-50 border-rose-100',
        badge: 'bg-rose-100 text-rose-700',
    },
};

const FILTERS: Array<{ key: 'ALL' | InboxKind; label: string }> = [
    { key: 'ALL', label: 'Tout' },
    { key: 'LEAVE', label: 'Absences' },
    { key: 'ATTENDANCE_GPS', label: 'Retards/GPS' },
    { key: 'EXPENSE', label: 'Justificatifs' },
    { key: 'SUPPORT', label: 'Support' },
];

const STATUS_LABELS: Record<string, string> = {
    PENDING: 'En attente',
    APPROVED: 'Validée',
    PLANNED: 'Planifiée',
    REJECTED: 'Refusée',
    OPEN: 'Ouvert',
    IN_PROGRESS: 'En cours',
    RESOLVED: 'Résolu',
    CLOSED: 'Fermé',
    READ: 'Lue',
    UNREAD: 'Non lue',
    APPROVED_EXPENSE: 'Validée',
    PENDING_GPS: 'GPS attendu',
    GPS_REQUIRED: 'GPS attendu',
    PENDING_REVIEW: 'À contrôler',
    GPS_NOT_CONFIGURED: 'GPS à configurer',
    WARNING: 'Sous réserve',
};

const ACTION_LABELS: Record<string, string> = {
    approve: 'Valider',
    reject: 'Refuser',
    plan: 'Planifier',
    open: 'Ouvrir',
    reply: 'Répondre',
    review: 'Contrôler',
    mark_read: 'Classer',
    confirm: 'Confirmer',
    comment: 'Commenter',
};

const WORKFLOW_STEPS = [
    { label: 'Retards', icon: Clock },
    { label: 'Absences', icon: UserX },
    { label: 'Justificatifs', icon: FileCheck2 },
    { label: 'Anomalies GPS', icon: MapPinned },
    { label: 'Congés simples', icon: CalendarDays },
];

const EMPTY_COUNTS: Counts = {
    ALL: 0,
    ATTENDANCE_GPS: 0,
    INTERVENTION: 0,
    SUPPORT: 0,
    LEAVE: 0,
    EXPENSE: 0,
    NOTIFICATION: 0,
};

const EMPTY_SUMMARY: InboxSummary = {
    actionable: 0,
    urgent: 0,
    pendingApproval: 0,
    stale: 0,
};

function getToken() {
    return localStorage.getItem('token');
}

function formatRelativeDate(value: string) {
    const date = new Date(value);
    const now = Date.now();
    const diffMinutes = Math.round((now - date.getTime()) / 60000);

    if (!Number.isFinite(diffMinutes)) return '';
    if (diffMinutes < 1) return 'Maintenant';
    if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;

    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `Il y a ${diffHours} h`;

    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getPriorityStyle(priority: InboxPriority) {
    if (priority === 'URGENT') return 'bg-red-100 text-red-700 border-red-200';
    if (priority === 'LOW') return 'bg-gray-100 text-gray-600 border-gray-200';
    if (priority === 'INFO') return 'bg-sky-100 text-sky-700 border-sky-200';
    return 'bg-amber-100 text-amber-700 border-amber-200';
}

function isActionable(item: InboxItem) {
    return item.availableActions.some(action => action !== 'open');
}

function isPendingApproval(item: InboxItem) {
    return item.status === 'PENDING' && item.availableActions.some(action => action === 'approve' || action === 'review');
}

export default function Inbox() {
    const navigate = useNavigate();
    const [items, setItems] = useState<InboxItem[]>([]);
    const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS);
    const [summary, setSummary] = useState<InboxSummary>(EMPTY_SUMMARY);
    const [activeKind, setActiveKind] = useState<'ALL' | InboxKind>('ALL');
    const [statusMode, setStatusMode] = useState<'open' | 'all'>('open');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);
    const [pendingDecision, setPendingDecision] = useState<PendingDecision | null>(null);
    const [decisionComment, setDecisionComment] = useState('');

    const fetchInbox = useCallback(async () => {
        const token = getToken();
        if (!token) {
            navigate('/');
            return;
        }

        setError('');
        setRefreshing(true);

        try {
            const params: Record<string, string | number> = { limit: 75 };
            if (activeKind !== 'ALL') params.kind = activeKind;
            if (statusMode === 'all') params.status = 'all';

            const response = await axios.get<InboxResponse>('/api/inbox', {
                params,
                headers: { Authorization: `Bearer ${token}` },
            });
            setItems(response.data.items || []);
            setCounts(response.data.counts || EMPTY_COUNTS);
            setSummary(response.data.summary || EMPTY_SUMMARY);
        } catch (err: unknown) {
            if (getErrorStatus(err) === 401) {
                localStorage.removeItem('token');
                navigate('/');
                return;
            }
            setError('Impossible de charger les demandes.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeKind, navigate, statusMode]);

    useEffect(() => {
        fetchInbox();
    }, [fetchInbox]);

    const filteredItems = useMemo(() => {
        const query = search.trim().toLowerCase();
        return items.filter(item => {
            if (!query) return true;

            return [
                item.title,
                item.summary,
                item.actor.name,
                item.actor.phoneNumber || '',
                item.status,
                KIND_CONFIG[item.kind].label,
            ].some(value => value.toLowerCase().includes(query));
        });
    }, [items, search]);

    const visibleSummary = useMemo<InboxSummary>(() => {
        if (!search.trim()) return summary;

        return {
            actionable: filteredItems.filter(isActionable).length,
            urgent: filteredItems.filter(item => item.priority === 'URGENT').length,
            pendingApproval: filteredItems.filter(isPendingApproval).length,
            stale: 0,
        };
    }, [filteredItems, search, summary]);

    const priorityItems = useMemo(
        () => filteredItems.filter(item => item.priority === 'URGENT' || isActionable(item)).slice(0, 3),
        [filteredItems]
    );

    const handleKindChange = (kind: 'ALL' | InboxKind) => {
        setActiveKind(kind);
    };

    const handleStatusModeChange = (mode: 'open' | 'all') => {
        setStatusMode(mode);
    };

    const openItem = (item: InboxItem) => {
        navigate(item.targetUrl);
    };

    const getActionKey = (item: InboxItem, action: string) => `${item.kind}:${item.id}:${action}`;

    const openDecisionModal = (item: InboxItem, action: string) => {
        setError('');
        setPendingDecision({ item, action });
        setDecisionComment('');
    };

    const runItemAction = async (item: InboxItem, action: string) => {
        const token = getToken();
        if (!token) {
            navigate('/');
            return;
        }

        const actionKey = getActionKey(item, action);
        setError('');
        setActionLoadingKey(actionKey);

        try {
            if (
                (item.kind === 'LEAVE' || item.kind === 'ATTENDANCE_GPS')
                && ['approve', 'reject', 'confirm', 'comment'].includes(action)
            ) {
                openDecisionModal(item, action);
                return;
            }

            if (item.kind === 'EXPENSE' && (action === 'approve' || action === 'reject')) {
                await axios.patch(
                    `/api/expenses/${item.id}/status`,
                    { status: action === 'approve' ? 'APPROVED' : 'REJECTED' },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                await fetchInbox();
                return;
            }

            if (item.kind === 'NOTIFICATION' && action === 'mark_read') {
                await axios.patch(
                    `/api/notifications/${item.id}/read`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                await fetchInbox();
                return;
            }

            if (item.kind === 'INTERVENTION' && (action === 'approve' || action === 'reject')) {
                await axios.post(
                    `/api/intervention-requests/${item.id}/${action}`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                await fetchInbox();
                return;
            }

            openItem(item);
        } catch (err: unknown) {
            if (getErrorStatus(err) === 401) {
                localStorage.removeItem('token');
                navigate('/');
                return;
            }
            setError(getErrorMessage(err, "Impossible d'exécuter cette action."));
        } finally {
            setActionLoadingKey(current => current === actionKey ? null : current);
        }
    };

    const submitDecision = async () => {
        if (!pendingDecision) return;

        const token = getToken();
        if (!token) {
            navigate('/');
            return;
        }

        const { item, action } = pendingDecision;
        const comment = decisionComment.trim();

        if (action === 'comment' && !comment) {
            setError('Un commentaire est requis pour commenter une demande.');
            return;
        }

        const apiAction = action === 'approve'
            ? 'APPROVE'
            : action === 'reject'
                ? 'REJECT'
                : action === 'confirm'
                    ? 'CONFIRM'
                    : 'COMMENT';
        const actionKey = getActionKey(item, action);

        setError('');
        setActionLoadingKey(actionKey);

        try {
            await axios.patch(
                `/api/inbox/${item.kind.toLowerCase()}/${item.id}/decision`,
                { action: apiAction, comment: comment || undefined },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setPendingDecision(null);
            setDecisionComment('');
            await fetchInbox();
        } catch (err: unknown) {
            if (getErrorStatus(err) === 401) {
                localStorage.removeItem('token');
                navigate('/');
                return;
            }
            setError(getErrorMessage(err, "Impossible d'exécuter cette action."));
        } finally {
            setActionLoadingKey(current => current === actionKey ? null : current);
        }
    };

    const pendingActionLabel = pendingDecision ? ACTION_LABELS[pendingDecision.action] || 'Traiter' : '';
    const pendingActionNeedsComment = pendingDecision?.action === 'comment';
    const pendingActionTone = pendingDecision?.action === 'reject'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-blue-200 bg-blue-50 text-blue-700';

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <InboxIcon className="text-blue-600" size={28} />
                        Inbox manager
                    </h2>
                    <p className="text-gray-500 mt-1">
                        Retards, absences, justificatifs, anomalies GPS et congés simples à traiter
                    </p>
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto">
                    <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1">
                        {(['open', 'all'] as const).map(mode => (
                            <button
                                key={mode}
                                onClick={() => handleStatusModeChange(mode)}
                                className={clsx(
                                    'px-3 py-2 rounded-lg text-sm font-medium transition',
                                    statusMode === mode
                                        ? 'bg-gray-900 text-white shadow-sm'
                                        : 'text-gray-600 hover:bg-gray-50'
                                )}
                            >
                                {mode === 'open' ? 'À traiter' : 'Tout'}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => fetchInbox()}
                        disabled={refreshing}
                        className="h-10 w-10 flex-shrink-0 inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                        title="Actualiser"
                    >
                        <RefreshCw size={18} className={clsx(refreshing && 'animate-spin')} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
                {FILTERS.map(filter => {
                    const isActive = activeKind === filter.key;
                    const count = counts[filter.key] || 0;
                    const Icon = filter.key === 'ALL' ? ClipboardList : KIND_CONFIG[filter.key].icon;
                    return (
                        <button
                            key={filter.key}
                            onClick={() => handleKindChange(filter.key)}
                            className={clsx(
                                'bg-white rounded-xl border p-3 sm:p-4 text-left transition hover:shadow-sm',
                                isActive ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100 hover:border-gray-200'
                            )}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <span className={clsx(
                                    'h-9 w-9 rounded-lg border flex items-center justify-center',
                                    filter.key === 'ALL' ? 'text-slate-600 bg-slate-50 border-slate-100' : KIND_CONFIG[filter.key].tint
                                )}>
                                    <Icon size={18} />
                                </span>
                                <span className="text-2xl font-bold text-gray-900">{count}</span>
                            </div>
                            <p className="text-sm font-medium text-gray-600 mt-3">{filter.label}</p>
                        </button>
                    );
                })}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase text-red-600">Urgences terrain</p>
                    <p className="mt-1 text-2xl font-bold text-red-700">{visibleSummary.urgent}</p>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase text-blue-600">Actions manager</p>
                    <p className="mt-1 text-2xl font-bold text-blue-700">{visibleSummary.actionable}</p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase text-amber-600">À valider</p>
                    <p className="mt-1 text-2xl font-bold text-amber-700">{visibleSummary.pendingApproval}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase text-gray-500">Vieillissement 24h</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">{visibleSummary.stale}</p>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-3 sm:p-4 shadow-sm">
                <div className="flex flex-wrap gap-2">
                    {WORKFLOW_STEPS.map(step => (
                        <span
                            key={step.label}
                            className="inline-flex h-9 items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700"
                        >
                            <step.icon size={15} className="text-blue-600" />
                            {step.label}
                        </span>
                    ))}
                </div>
            </div>

            {priorityItems.length > 0 && (
                <div className="rounded-2xl border border-gray-100 bg-white p-3 sm:p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-gray-900">À traiter maintenant</p>
                            <p className="text-xs text-gray-500">Les signaux RH terrain urgents ou actionnables en premier.</p>
                        </div>
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                            {priorityItems.length}
                        </span>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                        {priorityItems.map(item => {
                            const config = KIND_CONFIG[item.kind];
                            return (
                                <button
                                    key={`priority-${item.kind}-${item.id}`}
                                    onClick={() => openItem(item)}
                                    className="rounded-xl border border-gray-100 px-3 py-2 text-left transition hover:border-blue-200 hover:bg-blue-50"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={clsx('h-7 w-7 rounded-lg border flex items-center justify-center flex-shrink-0', config.tint)}>
                                            <config.icon size={15} />
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
                                            {item.title}
                                        </span>
                                    </div>
                                    <p className="mt-1 truncate text-xs text-gray-500">
                                        {item.priority === 'URGENT' ? 'Urgent' : 'Action requise'} - {formatRelativeDate(item.updatedAt || item.createdAt)}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                    <div className="relative flex-1 max-w-xl">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Rechercher par demande, personne, téléphone ou statut..."
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 px-1">
                        <SlidersHorizontal size={16} />
                        {filteredItems.length} élément{filteredItems.length > 1 ? 's' : ''}
                    </div>
                </div>

                {error && (
                    <div className="m-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <AlertCircle size={18} />
                        {error}
                    </div>
                )}

                {!error && filteredItems.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="mx-auto h-12 w-12 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center">
                            <CheckCircle2 size={24} />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-gray-900">Aucune demande</h3>
                        <p className="mt-1 text-sm text-gray-500">La file sélectionnée est à jour.</p>
                    </div>
                ) : filteredItems.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                        {filteredItems.map(item => {
                            const config = KIND_CONFIG[item.kind];
                            const Icon = config.icon;
                            const actionable = isActionable(item);
                            return (
                                <div
                                    key={`${item.kind}-${item.id}`}
                                    className={clsx(
                                        'p-4 transition',
                                        actionable ? 'bg-blue-50/30 hover:bg-blue-50/60' : 'hover:bg-gray-50/80',
                                        item.priority === 'URGENT' && 'border-l-4 border-red-500'
                                    )}
                                >
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                                        <div className="flex gap-3 flex-1 min-w-0">
                                            <div className={clsx('h-11 w-11 rounded-xl border flex items-center justify-center flex-shrink-0', config.tint)}>
                                                <Icon size={20} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={clsx('px-2 py-1 rounded-full text-xs font-semibold', config.badge)}>
                                                        {config.shortLabel}
                                                    </span>
                                                    <span className={clsx('px-2 py-1 rounded-full border text-xs font-semibold', getPriorityStyle(item.priority))}>
                                                        {item.priority === 'URGENT' ? 'Urgent' : item.priority === 'INFO' ? 'Info' : 'Normal'}
                                                    </span>
                                                    <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">
                                                        {STATUS_LABELS[item.status] || item.status}
                                                    </span>
                                                    {actionable && (
                                                        <span className="px-2 py-1 rounded-full bg-blue-600 text-white text-xs font-semibold">
                                                            Action requise
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => openItem(item)}
                                                    className="mt-2 text-left text-base font-semibold text-gray-900 hover:text-blue-700 transition line-clamp-2 sm:line-clamp-1"
                                                >
                                                    {item.title}
                                                </button>
                                                <p className="mt-1 text-sm text-gray-600 line-clamp-2">{item.summary}</p>
                                                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                                                    <span>{item.actor.name}</span>
                                                    {item.actor.phoneNumber && <span>{item.actor.phoneNumber}</span>}
                                                    <span>{formatRelativeDate(item.updatedAt || item.createdAt)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 lg:justify-end lg:min-w-64">
                                            {item.availableActions.slice(0, 3).map(action => {
                                                const actionKey = getActionKey(item, action);
                                                const isActionLoading = actionLoadingKey === actionKey;
                                                return (
                                                    <button
                                                        key={action}
                                                        onClick={() => runItemAction(item, action)}
                                                        disabled={isActionLoading}
                                                        className={clsx(
                                                            'min-h-10 justify-center px-3 py-2 rounded-lg text-sm font-medium transition inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed',
                                                            action === 'approve' || action === 'plan' || action === 'mark_read'
                                                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                                : action === 'reject'
                                                                    ? 'bg-white border border-red-200 text-red-700 hover:bg-red-50'
                                                                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                                                        )}
                                                    >
                                                        {isActionLoading && <Loader2 size={14} className="animate-spin" />}
                                                        {ACTION_LABELS[action] || 'Ouvrir'}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : null}
            </div>

            {pendingDecision && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4 py-6">
                    <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-gray-100">
                        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
                            <div>
                                <div className={clsx('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold', pendingActionTone)}>
                                    {pendingActionLabel}
                                </div>
                                <h3 className="mt-3 text-lg font-semibold text-gray-900">
                                    {pendingDecision.item.title}
                                </h3>
                                <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                                    {pendingDecision.item.summary}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setPendingDecision(null);
                                    setDecisionComment('');
                                    setError('');
                                }}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                                title="Fermer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5">
                            <label className="text-sm font-semibold text-gray-700" htmlFor="decision-comment">
                                Message au collaborateur{pendingActionNeedsComment ? '' : ' (facultatif)'}
                            </label>
                            <textarea
                                id="decision-comment"
                                value={decisionComment}
                                onChange={(event) => setDecisionComment(event.target.value)}
                                maxLength={500}
                                rows={5}
                                placeholder="Exemple : validé, remplacement organisé."
                                className="mt-2 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                            <div className="mt-2 flex justify-between text-xs text-gray-500">
                                <span>{pendingActionNeedsComment ? 'Commentaire obligatoire.' : 'Ce message sera envoyé via WhatsApp si la demande est validée ou refusée.'}</span>
                                <span>{decisionComment.length}/500</span>
                            </div>
                        </div>

                        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 p-5 sm:flex-row sm:justify-end">
                            <button
                                onClick={() => {
                                    setPendingDecision(null);
                                    setDecisionComment('');
                                    setError('');
                                }}
                                className="min-h-10 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={submitDecision}
                                disabled={actionLoadingKey === getActionKey(pendingDecision.item, pendingDecision.action)}
                                className={clsx(
                                    'min-h-10 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60',
                                    pendingDecision.action === 'reject'
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : 'bg-blue-600 hover:bg-blue-700'
                                )}
                            >
                                {actionLoadingKey === getActionKey(pendingDecision.item, pendingDecision.action)
                                    ? 'Traitement...'
                                    : `${pendingActionLabel} la demande`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
