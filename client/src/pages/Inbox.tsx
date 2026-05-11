import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    AlertCircle,
    Bell,
    CalendarDays,
    CheckCircle2,
    ClipboardList,
    Headphones,
    Inbox as InboxIcon,
    Loader2,
    MessageCircle,
    Receipt,
    RefreshCw,
    Search,
    SlidersHorizontal,
    type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { getErrorMessage, getErrorStatus } from '../utils/errors';

type InboxKind = 'INTERVENTION' | 'SUPPORT' | 'LEAVE' | 'EXPENSE' | 'NOTIFICATION';
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
}

type Counts = Record<InboxKind | 'ALL', number>;

interface InboxResponse {
    items: InboxItem[];
    counts: Counts;
}

interface KindConfig {
    label: string;
    shortLabel: string;
    icon: LucideIcon;
    tint: string;
    badge: string;
}

const KIND_CONFIG: Record<InboxKind, KindConfig> = {
    INTERVENTION: {
        label: 'Interventions',
        shortLabel: 'Intervention',
        icon: MessageCircle,
        tint: 'text-orange-600 bg-orange-50 border-orange-100',
        badge: 'bg-orange-100 text-orange-700',
    },
    SUPPORT: {
        label: 'Support',
        shortLabel: 'Support',
        icon: Headphones,
        tint: 'text-blue-600 bg-blue-50 border-blue-100',
        badge: 'bg-blue-100 text-blue-700',
    },
    LEAVE: {
        label: 'Absences',
        shortLabel: 'Absence',
        icon: CalendarDays,
        tint: 'text-emerald-600 bg-emerald-50 border-emerald-100',
        badge: 'bg-emerald-100 text-emerald-700',
    },
    EXPENSE: {
        label: 'Frais',
        shortLabel: 'Frais',
        icon: Receipt,
        tint: 'text-purple-600 bg-purple-50 border-purple-100',
        badge: 'bg-purple-100 text-purple-700',
    },
    NOTIFICATION: {
        label: 'Alertes',
        shortLabel: 'Alerte',
        icon: Bell,
        tint: 'text-rose-600 bg-rose-50 border-rose-100',
        badge: 'bg-rose-100 text-rose-700',
    },
};

const FILTERS: Array<{ key: 'ALL' | InboxKind; label: string }> = [
    { key: 'ALL', label: 'Tout' },
    { key: 'INTERVENTION', label: 'Intervention' },
    { key: 'LEAVE', label: 'RH' },
    { key: 'EXPENSE', label: 'Frais' },
    { key: 'SUPPORT', label: 'Support' },
    { key: 'NOTIFICATION', label: 'Alertes' },
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
};

const ACTION_LABELS: Record<string, string> = {
    approve: 'Valider',
    reject: 'Refuser',
    plan: 'Planifier',
    open: 'Ouvrir',
    reply: 'Répondre',
    review: 'Consulter',
    mark_read: 'Marquer lu',
};

const EMPTY_COUNTS: Counts = {
    ALL: 0,
    INTERVENTION: 0,
    SUPPORT: 0,
    LEAVE: 0,
    EXPENSE: 0,
    NOTIFICATION: 0,
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

export default function Inbox() {
    const navigate = useNavigate();
    const [items, setItems] = useState<InboxItem[]>([]);
    const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS);
    const [activeKind, setActiveKind] = useState<'ALL' | InboxKind>('ALL');
    const [statusMode, setStatusMode] = useState<'open' | 'all'>('open');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);

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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <InboxIcon className="text-blue-600" size={28} />
                        Boîte de demandes
                    </h2>
                    <p className="text-gray-500 mt-1">
                        Présence, planning, support et validations à traiter
                    </p>
                </div>

                <div className="flex items-center gap-2">
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
                        className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                        title="Actualiser"
                    >
                        <RefreshCw size={18} className={clsx(refreshing && 'animate-spin')} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {FILTERS.map(filter => {
                    const isActive = activeKind === filter.key;
                    const count = counts[filter.key] || 0;
                    const Icon = filter.key === 'ALL' ? ClipboardList : KIND_CONFIG[filter.key].icon;
                    return (
                        <button
                            key={filter.key}
                            onClick={() => handleKindChange(filter.key)}
                            className={clsx(
                                'bg-white rounded-xl border p-4 text-left transition hover:shadow-sm',
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
                    <div className="flex items-center gap-2 text-sm text-gray-500">
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
                            return (
                                <div key={`${item.kind}-${item.id}`} className="p-4 hover:bg-gray-50/80 transition">
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
                                                </div>
                                                <button
                                                    onClick={() => openItem(item)}
                                                    className="mt-2 text-left text-base font-semibold text-gray-900 hover:text-blue-700 transition line-clamp-1"
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

                                        <div className="flex flex-wrap gap-2 lg:justify-end">
                                            {item.availableActions.slice(0, 3).map(action => {
                                                const actionKey = getActionKey(item, action);
                                                const isActionLoading = actionLoadingKey === actionKey;
                                                return (
                                                    <button
                                                        key={action}
                                                        onClick={() => runItemAction(item, action)}
                                                        disabled={isActionLoading}
                                                        className={clsx(
                                                            'px-3 py-2 rounded-lg text-sm font-medium transition inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed',
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
        </div>
    );
}
