import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, Search } from 'lucide-react';

interface ConnectorProvider {
    provider: string;
    displayName: string;
}

interface ConnectorIssue {
    id: string;
    webhookId: string;
    provider: string;
    connectorName: string;
    eventId: string | null;
    eventType: string;
    status: 'FAILED' | 'PENDING' | string;
    statusCode: number | null;
    durationMs: number | null;
    error: string | null;
    retryCount: number;
    nextRetryAt: string | null;
    createdAt: string;
    replayable: boolean;
    payload: unknown;
    responseBody: string | null;
    webhook: {
        id: string;
        name: string;
        endpoint: string;
        tenantId: string | null;
        isActive: boolean;
    };
    tenant: {
        id: string;
        name: string;
        country: string | null;
        plan: string;
        status: string;
    } | null;
}

interface IssueResponse {
    providers: ConnectorProvider[];
    issues: ConnectorIssue[];
    pagination: {
        nextCursor: string | null;
        hasMore: boolean;
    };
}

interface ErrorResponse {
    error?: string;
}

const STATUS_META: Record<string, { label: string; className: string }> = {
    FAILED: { label: 'Dead-letter', className: 'bg-red-100 text-red-700' },
    PENDING: { label: 'Retry prévu', className: 'bg-yellow-100 text-yellow-700' }
};

function formatDateTime(value: string | null) {
    if (!value) return '-';
    return new Date(value).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatJson(value: unknown) {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

export default function WebhookIssues() {
    const [providers, setProviders] = useState<ConnectorProvider[]>([]);
    const [issues, setIssues] = useState<ConnectorIssue[]>([]);
    const [selectedIssue, setSelectedIssue] = useState<ConnectorIssue | null>(null);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [replayingId, setReplayingId] = useState<string | null>(null);
    const [filters, setFilters] = useState({
        provider: '',
        status: '',
        eventType: '',
        eventId: ''
    });

    const fetchIssues = useCallback(async (options?: { append?: boolean; cursor?: string | null }) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('superadmin_token');
            const params = new URLSearchParams();
            params.set('limit', '50');
            if (filters.provider) params.set('provider', filters.provider);
            if (filters.status) params.set('status', filters.status);
            if (filters.eventType) params.set('eventType', filters.eventType);
            if (filters.eventId) params.set('eventId', filters.eventId);
            if (options?.cursor) params.set('cursor', options.cursor);

            const response = await fetch(`/admin/connectors/deliveries/issues?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json() as IssueResponse & ErrorResponse;
            if (!response.ok) {
                throw new Error(data.error || 'Erreur chargement');
            }

            setProviders(data.providers || []);
            setIssues(current => options?.append ? [...current, ...(data.issues || [])] : data.issues || []);
            setNextCursor(data.pagination?.nextCursor || null);
            if (!options?.append) {
                setSelectedIssue(data.issues?.[0] || null);
            }
        } catch (error) {
            console.error('Error fetching webhook issues:', error);
            alert(error instanceof Error ? error.message : 'Erreur lors du chargement des webhooks à traiter');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchIssues();
    }, [fetchIssues]);

    const replayIssue = async (issue: ConnectorIssue) => {
        const confirmed = confirm(`Rejouer "${issue.eventType}" (${issue.eventId || issue.id}) vers ${issue.connectorName} ?`);
        if (!confirmed) return;

        setReplayingId(issue.id);
        try {
            const token = localStorage.getItem('superadmin_token');
            const response = await fetch(`/admin/connectors/${issue.provider}/webhooks/${issue.webhook.id}/logs/${issue.id}/replay`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Rejeu refusé');
            }
            alert(`Rejeu "${data.eventType || issue.eventType}" réussi.`);
            await fetchIssues();
        } catch (error) {
            alert(`Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        } finally {
            setReplayingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                        <AlertTriangle size={24} className="text-red-600" />
                        Webhooks à traiter
                    </h1>
                    <p className="text-gray-500">Dead-letter et retries connecteurs, avec rejeu contrôlé.</p>
                </div>
                <button
                    type="button"
                    onClick={() => fetchIssues()}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 disabled:opacity-50"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Actualiser
                </button>
            </div>

            <div className="grid gap-3 rounded-lg border border-gray-100 bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                <select
                    value={filters.provider}
                    onChange={event => setFilters(current => ({ ...current, provider: event.target.value }))}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                    <option value="">Tous les connecteurs</option>
                    {providers.map(provider => (
                        <option key={provider.provider} value={provider.provider}>{provider.displayName}</option>
                    ))}
                </select>
                <select
                    value={filters.status}
                    onChange={event => setFilters(current => ({ ...current, status: event.target.value }))}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                    <option value="">Failed + Pending</option>
                    <option value="FAILED">Dead-letter</option>
                    <option value="PENDING">Retry prévu</option>
                </select>
                <input
                    value={filters.eventType}
                    onChange={event => setFilters(current => ({ ...current, eventType: event.target.value }))}
                    placeholder="eventType"
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
                <input
                    value={filters.eventId}
                    onChange={event => setFilters(current => ({ ...current, eventId: event.target.value }))}
                    placeholder="eventId"
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
                <button
                    type="button"
                    onClick={() => fetchIssues()}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                    <Search size={16} />
                    Filtrer
                </button>
            </div>

            <div className="grid min-h-[560px] overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
                <div className="min-h-0 overflow-auto">
                    <div className="grid min-w-[1040px] grid-cols-[1.1fr_1fr_1fr_auto_auto_auto_auto] gap-3 bg-gray-50 px-4 py-3 text-xs font-medium uppercase text-gray-500">
                        <span>Connecteur</span>
                        <span>Événement</span>
                        <span>Tenant</span>
                        <span>Statut</span>
                        <span>HTTP</span>
                        <span>Date</span>
                        <span>Action</span>
                    </div>
                    {issues.length === 0 && !loading && (
                        <p className="px-4 py-10 text-center text-sm text-gray-500">Aucun webhook à traiter.</p>
                    )}
                    {issues.map(issue => {
                        const meta = STATUS_META[issue.status] || { label: issue.status, className: 'bg-gray-100 text-gray-700' };
                        const selected = selectedIssue?.id === issue.id;
                        return (
                            <div
                                key={issue.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedIssue(issue)}
                                onKeyDown={event => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        setSelectedIssue(issue);
                                    }
                                }}
                                className={`grid min-w-[1040px] grid-cols-[1.1fr_1fr_1fr_auto_auto_auto_auto] gap-3 border-t border-gray-100 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 ${selected ? 'bg-red-50' : ''}`}
                            >
                                <div className="min-w-0">
                                    <p className="truncate font-medium text-gray-900">{issue.connectorName}</p>
                                    <p className="truncate text-xs text-gray-500">{issue.webhook.name}</p>
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate font-medium">{issue.eventType}</p>
                                    <p className="truncate font-mono text-xs text-gray-500">{issue.eventId || issue.id}</p>
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate">{issue.tenant?.name || 'Global'}</p>
                                    <p className="text-xs text-gray-500">{issue.tenant ? `${issue.tenant.country || '-'} · ${issue.tenant.plan}` : '-'}</p>
                                </div>
                                <span className={`self-center rounded-full px-2 py-1 text-xs font-medium ${meta.className}`}>{meta.label}</span>
                                <span className="self-center">{issue.statusCode || '-'}</span>
                                <span className="self-center">{formatDateTime(issue.createdAt)}</span>
                                <span className="self-center">
                                    {issue.replayable ? (
                                        <button
                                            type="button"
                                            onClick={event => {
                                                event.stopPropagation();
                                                replayIssue(issue);
                                            }}
                                            disabled={replayingId !== null}
                                            className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <RotateCcw size={13} />
                                            {replayingId === issue.id ? 'Rejeu...' : 'Rejouer'}
                                        </button>
                                    ) : (
                                        <span className="text-xs text-gray-400">Non rejouable</span>
                                    )}
                                </span>
                            </div>
                        );
                    })}
                    {nextCursor && (
                        <div className="border-t border-gray-100 p-3">
                            <button
                                type="button"
                                onClick={() => fetchIssues({ append: true, cursor: nextCursor })}
                                disabled={loading}
                                className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                                Charger plus
                            </button>
                        </div>
                    )}
                </div>

                <aside className="min-h-0 overflow-auto border-t border-gray-200 bg-gray-50 p-4 xl:border-l xl:border-t-0">
                    {!selectedIssue ? (
                        <div className="flex h-full items-center justify-center text-sm text-gray-500">Sélectionnez un log.</div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs font-medium uppercase text-gray-500">Détail</p>
                                <h2 className="mt-1 text-lg font-semibold text-gray-900">{selectedIssue.eventType}</h2>
                                <p className="font-mono text-xs text-gray-500">{selectedIssue.eventId || selectedIssue.id}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-xs text-gray-500">Connecteur</p>
                                    <p className="font-medium text-gray-900">{selectedIssue.connectorName}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Webhook</p>
                                    <p className="font-medium text-gray-900">{selectedIssue.webhook.name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Retry</p>
                                    <p className="font-medium text-gray-900">{selectedIssue.retryCount}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Prochaine tentative</p>
                                    <p className="font-medium text-gray-900">{formatDateTime(selectedIssue.nextRetryAt)}</p>
                                </div>
                            </div>
                            {selectedIssue.error && (
                                <div>
                                    <p className="text-xs font-medium uppercase text-gray-500">Erreur</p>
                                    <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-white p-3 text-xs text-red-700">{selectedIssue.error}</pre>
                                </div>
                            )}
                            <div>
                                <p className="text-xs font-medium uppercase text-gray-500">Payload redacted</p>
                                <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-white p-3 text-xs text-gray-700">{formatJson(selectedIssue.payload)}</pre>
                            </div>
                            {selectedIssue.responseBody && (
                                <div>
                                    <p className="text-xs font-medium uppercase text-gray-500">Réponse redacted</p>
                                    <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-white p-3 text-xs text-gray-700">{selectedIssue.responseBody}</pre>
                                </div>
                            )}
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}
