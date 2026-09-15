import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
    Key,
    CreditCard,
    Mail,
    MessageSquare,
    Database,
    Map,
    Webhook,
    Activity,
    ExternalLink,
    Save,
    Plus,
    X,
    Loader2,
    Check,
    AlertTriangle,
    RefreshCw,
    Eye,
    Search
} from 'lucide-react';

interface IntegrationKey {
    key: string;
    isSet: boolean;
    isEnabled: boolean;
    preview: string | null;
    updatedAt: string | null;
}

interface Provider {
    name: string;
    icon: string;
    keys: IntegrationKey[];
}

type IntegrationsData = Record<string, Provider>;

interface ConnectorDelivery {
    id: string;
    webhookId: string;
    eventId: string | null;
    eventType: string;
    status: string;
    statusCode: number | null;
    durationMs: number | null;
    error: string | null;
    retryCount: number;
    nextRetryAt: string | null;
    createdAt: string;
}

interface ConnectorDeliveryDetail extends ConnectorDelivery {
    replayable: boolean;
    payload: unknown;
    responseBody: string | null;
}

interface ConnectorWebhookStatus {
    id: string;
    name: string;
    environment: 'sandbox' | 'production' | 'custom';
    endpoint: string;
    tenantId: string | null;
    tenant: { id: string; name: string; country: string | null; plan: string; status: string } | null;
    isActive: boolean;
    version: string;
    events: string[];
    missingEvents: string[];
    successCount: number;
    failureCount: number;
    lastTriggeredAt: string | null;
    latestDelivery: ConnectorDelivery | null;
    recentDeliveries: ConnectorDelivery[];
}

interface ConnectorStatus {
    provider: string;
    name: string;
    displayName: string;
    version: string;
    docsUrl: string;
    openApiUrl: string;
    requiredEvents: string[];
    testableEvents?: string[];
    endpoints: {
        sandbox: string;
        production: string;
    };
    state: 'not_configured' | 'disabled' | 'partial' | 'configured' | 'healthy' | 'degraded';
    totals: {
        webhooks: number;
        activeWebhooks: number;
        successes: number;
        failures: number;
    };
    webhooks: ConnectorWebhookStatus[];
    recentDeliveries: ConnectorDelivery[];
}

interface ConnectorLogPanel {
    provider: string;
    connectorName: string;
    testableEvents: string[];
    webhook: ConnectorWebhookStatus;
}

interface ConnectorLogFilters {
    eventType: string;
    status: string;
    eventId: string;
}

// Icon mapping
const ICONS: Record<string, React.ElementType> = {
    CreditCard,
    Mail,
    MessageSquare,
    Database,
    Map,
    Webhook,
    Key,
};

const CONNECTOR_STATE_LABELS: Record<ConnectorStatus['state'], { label: string; className: string }> = {
    healthy: { label: 'Sain', className: 'bg-green-100 text-green-700 border-green-200' },
    configured: { label: 'Configuré', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    partial: { label: 'Partiel', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    degraded: { label: 'Dégradé', className: 'bg-red-100 text-red-700 border-red-200' },
    disabled: { label: 'Désactivé', className: 'bg-gray-100 text-gray-700 border-gray-200' },
    not_configured: { label: 'Non configuré', className: 'bg-gray-100 text-gray-700 border-gray-200' }
};

const DELIVERY_STATUS_LABELS: Record<string, { label: string; className: string }> = {
    SUCCESS: { label: 'Succès', className: 'bg-green-100 text-green-700' },
    PENDING: { label: 'Retry', className: 'bg-amber-100 text-amber-700' },
    FAILED: { label: 'Échec', className: 'bg-red-100 text-red-700' }
};

const MESSAGE_STATUS_TEST_VALUES = ['sent', 'delivered', 'read', 'failed'] as const;

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
    if (value === null || value === undefined) return '-';
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
}

export default function Integrations() {
    const [loading, setLoading] = useState(true);
    const [integrations, setIntegrations] = useState<IntegrationsData>({});
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [newValue, setNewValue] = useState('');
    const [saving, setSaving] = useState(false);
    const [showAddCustom, setShowAddCustom] = useState(false);
    const [customKey, setCustomKey] = useState({ provider: '', key: '', value: '' });
    const [connectorStatuses, setConnectorStatuses] = useState<ConnectorStatus[]>([]);
    const [supportedEvents, setSupportedEvents] = useState<string[]>([]);
    const [showAddConnector, setShowAddConnector] = useState(false);
    const [connectorSecret, setConnectorSecret] = useState<string | null>(null);
    const [newConnector, setNewConnector] = useState({
        provider: '',
        displayName: '',
        sandboxEndpoint: '',
        productionEndpoint: '',
        tenantId: '',
        requiredEvents: ['employee.created'],
        generateSecret: true
    });
    const [savingConnectorWebhookId, setSavingConnectorWebhookId] = useState<string | null>(null);
    const [testingConnector, setTestingConnector] = useState<string | null>(null);
    const [connectorLogPanel, setConnectorLogPanel] = useState<ConnectorLogPanel | null>(null);
    const [connectorLogFilters, setConnectorLogFilters] = useState<ConnectorLogFilters>({
        eventType: '',
        status: '',
        eventId: ''
    });
    const [connectorLogs, setConnectorLogs] = useState<ConnectorDeliveryDetail[]>([]);
    const [connectorLogsNextCursor, setConnectorLogsNextCursor] = useState<string | null>(null);
    const [connectorLogsLoading, setConnectorLogsLoading] = useState(false);
    const [selectedConnectorLog, setSelectedConnectorLog] = useState<ConnectorDeliveryDetail | null>(null);
    const [replayingConnectorLogId, setReplayingConnectorLogId] = useState<string | null>(null);

    const token = localStorage.getItem('superadmin_token');

    const fetchIntegrations = useCallback(async () => {
        try {
            const [integrationsRes, connectorsRes] = await Promise.all([
                axios.get('/admin/integrations', {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get('/admin/connectors', {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);
            setIntegrations(integrationsRes.data);
            setConnectorStatuses(connectorsRes.data.connectors || []);
            setSupportedEvents(connectorsRes.data.supportedEvents || []);
        } catch (error) {
            console.error('Error fetching integrations:', error);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchIntegrations();
    }, [fetchIntegrations]);

    const saveIntegration = async (provider: string, key: string, value: string) => {
        setSaving(true);
        try {
            await axios.put('/admin/integrations', { provider, key, value }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEditingKey(null);
            setNewValue('');
            await fetchIntegrations();
        } catch (error) {
            console.error('Error saving integration:', error);
            alert('Erreur lors de la sauvegarde');
        } finally {
            setSaving(false);
        }
    };

    const saveCustomKey = async () => {
        if (!customKey.provider || !customKey.key || !customKey.value) {
            alert('Tous les champs sont requis');
            return;
        }
        setSaving(true);
        try {
            await axios.put('/admin/integrations', customKey, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowAddCustom(false);
            setCustomKey({ provider: '', key: '', value: '' });
            await fetchIntegrations();
        } catch (error) {
            console.error('Error saving custom key:', error);
            alert('Erreur lors de la sauvegarde');
        } finally {
            setSaving(false);
        }
    };

    const updateConnectorEvents = async (provider: string, webhookId: string, events: string[]) => {
        setSavingConnectorWebhookId(webhookId);
        try {
            await axios.put(`/admin/connectors/${provider}/webhooks/${webhookId}/events`, { events }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchIntegrations();
        } catch (error) {
            console.error('Error updating connector events:', error);
            alert('Erreur lors de la mise à jour des événements du connecteur');
        } finally {
            setSavingConnectorWebhookId(null);
        }
    };

    const testConnectorEvent = async (provider: string, connectorName: string, webhookId: string, eventType: string, status?: string) => {
        const label = status ? `${eventType} (${status})` : eventType;
        const confirmed = confirm(`Envoyer un test "${label}" vers le connecteur ${connectorName} ?`);
        if (!confirmed) return;

        const testKey = `${webhookId}:${eventType}:${status || 'default'}`;
        setTestingConnector(testKey);
        try {
            const res = await axios.post(`/admin/connectors/${provider}/webhooks/${webhookId}/test`, { eventType, status }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(res.data.success ? `Test "${label}" réussi.` : `Échec: ${res.data.error}`);
            await fetchIntegrations();
        } catch (error: unknown) {
            const message = axios.isAxiosError(error)
                ? error.response?.data?.error || error.response?.data?.message || error.message
                : 'Erreur inconnue';
            alert(`Erreur: ${message}`);
        } finally {
            setTestingConnector(null);
        }
    };

    const toggleNewConnectorEvent = (event: string) => {
        const checked = newConnector.requiredEvents.includes(event);
        setNewConnector({
            ...newConnector,
            requiredEvents: checked
                ? newConnector.requiredEvents.filter(currentEvent => currentEvent !== event)
                : [...newConnector.requiredEvents, event]
        });
    };

    const createConnector = async () => {
        if (!newConnector.provider || !newConnector.displayName || !newConnector.sandboxEndpoint || !newConnector.tenantId) {
            alert('Provider, nom, endpoint sandbox et tenantId sont requis');
            return;
        }
        if (newConnector.requiredEvents.length === 0) {
            alert('Sélectionnez au moins un événement');
            return;
        }

        setSaving(true);
        setConnectorSecret(null);
        try {
            const res = await axios.post('/admin/connectors', newConnector, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setConnectorSecret(res.data.webhook?.secretPlaintext || null);
            setNewConnector({
                provider: '',
                displayName: '',
                sandboxEndpoint: '',
                productionEndpoint: '',
                tenantId: '',
                requiredEvents: ['employee.created'],
                generateSecret: true
            });
            await fetchIntegrations();
        } catch (error: unknown) {
            const message = axios.isAxiosError(error)
                ? error.response?.data?.error || error.response?.data?.message || error.message
                : 'Erreur inconnue';
            alert(`Erreur: ${message}`);
        } finally {
            setSaving(false);
        }
    };

    const loadConnectorLogs = async (
        panel: ConnectorLogPanel,
        filters: ConnectorLogFilters,
        options: { append?: boolean; cursor?: string | null } = {}
    ) => {
        setConnectorLogsLoading(true);
        try {
            const res = await axios.get(`/admin/connectors/${panel.provider}/webhooks/${panel.webhook.id}/logs`, {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    limit: 25,
                    ...(filters.eventType ? { eventType: filters.eventType } : {}),
                    ...(filters.status ? { status: filters.status } : {}),
                    ...(filters.eventId ? { eventId: filters.eventId.trim() } : {}),
                    ...(options.cursor ? { cursor: options.cursor } : {})
                }
            });
            const logs = res.data.logs || [];
            setConnectorLogs(currentLogs => options.append ? [...currentLogs, ...logs] : logs);
            setConnectorLogsNextCursor(res.data.pagination?.nextCursor || null);
            setSelectedConnectorLog(currentLog => {
                if (options.append && currentLog) return currentLog;
                return logs[0] || null;
            });
        } catch (error: unknown) {
            const message = axios.isAxiosError(error)
                ? error.response?.data?.error || error.response?.data?.message || error.message
                : 'Erreur inconnue';
            alert(`Erreur: ${message}`);
        } finally {
            setConnectorLogsLoading(false);
        }
    };

    const openConnectorLogs = async (provider: string, connectorName: string, testableEvents: string[], webhook: ConnectorWebhookStatus) => {
        const panel = { provider, connectorName, testableEvents, webhook };
        const initialFilters = { eventType: '', status: '', eventId: '' };
        setConnectorLogPanel(panel);
        setConnectorLogFilters(initialFilters);
        setConnectorLogs([]);
        setConnectorLogsNextCursor(null);
        setSelectedConnectorLog(null);
        await loadConnectorLogs(panel, initialFilters);
    };

    const replayConnectorLog = async (log: ConnectorDeliveryDetail) => {
        if (!connectorLogPanel) return;
        const confirmed = confirm(`Rejouer "${log.eventType}" (${log.eventId || log.id}) vers ${connectorLogPanel.connectorName} ?`);
        if (!confirmed) return;

        setReplayingConnectorLogId(log.id);
        try {
            const res = await axios.post(
                `/admin/connectors/${connectorLogPanel.provider}/webhooks/${connectorLogPanel.webhook.id}/logs/${log.id}/replay`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert(res.data.success ? `Rejeu "${res.data.eventType || log.eventType}" réussi.` : `Échec: ${res.data.error}`);
            await loadConnectorLogs(connectorLogPanel, connectorLogFilters);
            await fetchIntegrations();
        } catch (error: unknown) {
            const message = axios.isAxiosError(error)
                ? error.response?.data?.error || error.response?.data?.message || error.message
                : 'Erreur inconnue';
            alert(`Erreur: ${message}`);
        } finally {
            setReplayingConnectorLogId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-red-600" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Intégrations & API</h1>
                    <p className="text-gray-500 mt-1">Configurez les clés API de vos services externes de manière sécurisée</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => fetchIntegrations()}
                        className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        <RefreshCw size={18} />
                        Actualiser
                    </button>
                    <button
                        onClick={() => setShowAddCustom(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                    >
                        <Plus size={18} />
                        Clé personnalisée
                    </button>
                    <button
                        onClick={() => setShowAddConnector(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg"
                    >
                        <Webhook size={18} />
                        Connecteur partenaire
                    </button>
                </div>
            </div>

            {showAddConnector && (
                <section className="bg-white border-2 border-gray-900 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Nouveau connecteur partenaire</h3>
                            <p className="text-sm text-gray-500">Crée une définition connecteur et un webhook HMAC tenant-scopé.</p>
                        </div>
                        <button onClick={() => setShowAddConnector(false)} className="text-gray-400 hover:text-gray-600">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            type="text"
                            placeholder="Provider (ex: KALLDY, ACME_PAYROLL)"
                            value={newConnector.provider}
                            onChange={(e) => setNewConnector({ ...newConnector, provider: e.target.value.toUpperCase() })}
                            className="px-4 py-2 border border-gray-300 rounded-lg"
                        />
                        <input
                            type="text"
                            placeholder="Nom affiché (ex: ACME Paie)"
                            value={newConnector.displayName}
                            onChange={(e) => setNewConnector({ ...newConnector, displayName: e.target.value })}
                            className="px-4 py-2 border border-gray-300 rounded-lg"
                        />
                        <input
                            type="url"
                            placeholder="Endpoint sandbox"
                            value={newConnector.sandboxEndpoint}
                            onChange={(e) => setNewConnector({ ...newConnector, sandboxEndpoint: e.target.value })}
                            className="px-4 py-2 border border-gray-300 rounded-lg"
                        />
                        <input
                            type="url"
                            placeholder="Endpoint production (optionnel)"
                            value={newConnector.productionEndpoint}
                            onChange={(e) => setNewConnector({ ...newConnector, productionEndpoint: e.target.value })}
                            className="px-4 py-2 border border-gray-300 rounded-lg"
                        />
                        <input
                            type="text"
                            placeholder="Tenant ID pilote"
                            value={newConnector.tenantId}
                            onChange={(e) => setNewConnector({ ...newConnector, tenantId: e.target.value })}
                            className="px-4 py-2 border border-gray-300 rounded-lg"
                        />
                        <label className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={newConnector.generateSecret}
                                onChange={(e) => setNewConnector({ ...newConnector, generateSecret: e.target.checked })}
                                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                            />
                            Générer un secret HMAC
                        </label>
                    </div>
                    <div className="mt-4">
                        <p className="text-xs font-medium text-gray-500 mb-2">Événements activés</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {supportedEvents.map(event => (
                                <label key={event} className="flex items-center gap-2 text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={newConnector.requiredEvents.includes(event)}
                                        onChange={() => toggleNewConnectorEvent(event)}
                                        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                    />
                                    <span className="truncate">{event}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    {connectorSecret && (
                        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <p className="text-sm font-medium text-amber-900">Secret HMAC généré</p>
                            <p className="mt-1 font-mono text-xs text-amber-800 break-all">{connectorSecret}</p>
                        </div>
                    )}
                    <div className="flex gap-2 mt-5">
                        <button
                            onClick={createConnector}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Créer le connecteur
                        </button>
                        <button
                            onClick={() => setShowAddConnector(false)}
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg"
                        >
                            Fermer
                        </button>
                    </div>
                </section>
            )}

            {connectorStatuses.map(connectorStatus => (
                <section key={connectorStatus.provider} className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-50 rounded-lg">
                                    <Webhook className="text-red-600" size={22} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">Connecteur {connectorStatus.displayName}</h2>
                                    <p className="text-sm text-gray-500">Convention {connectorStatus.version} pour les flux partenaire validés.</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-4">
                                {connectorStatus.requiredEvents.map(event => (
                                    <span key={event} className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                                        {event}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium border rounded-full ${CONNECTOR_STATE_LABELS[connectorStatus.state].className}`}>
                                <Activity size={15} />
                                {CONNECTOR_STATE_LABELS[connectorStatus.state].label}
                            </span>
                            <a
                                href={connectorStatus.openApiUrl}
                                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                            >
                                <ExternalLink size={15} />
                                OpenAPI
                            </a>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500">Webhooks actifs</p>
                            <p className="text-xl font-semibold text-gray-900">{connectorStatus.totals.activeWebhooks}/{connectorStatus.totals.webhooks}</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500">Succès</p>
                            <p className="text-xl font-semibold text-green-600">{connectorStatus.totals.successes}</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500">Échecs</p>
                            <p className="text-xl font-semibold text-red-600">{connectorStatus.totals.failures}</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500">Endpoint</p>
                            <p className="text-sm font-medium text-gray-900">{connectorStatus.webhooks[0]?.environment || 'sandbox'}</p>
                        </div>
                    </div>

                    <div className="mt-5 space-y-3">
                        {connectorStatus.webhooks.length === 0 ? (
                            <p className="text-sm text-gray-500">Aucun webhook {connectorStatus.name} détecté.</p>
                        ) : (
                            connectorStatus.webhooks.map(webhook => (
                                <div key={webhook.id} className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <p className="font-medium text-gray-900">{webhook.name}</p>
                                            <p className="text-xs text-gray-500 font-mono break-all">{webhook.endpoint}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-medium px-2 py-1 rounded ${webhook.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {webhook.isActive ? 'Actif' : 'Inactif'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => openConnectorLogs(connectorStatus.provider, connectorStatus.name, connectorStatus.testableEvents || connectorStatus.requiredEvents, webhook)}
                                                className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                            >
                                                <Eye size={13} />
                                                Détails
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-sm">
                                        <div>
                                            <p className="text-xs text-gray-500">Tenant</p>
                                            <p className="text-gray-800">{webhook.tenant?.name || webhook.tenantId || 'Global'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Dernier événement</p>
                                            <p className="text-gray-800">{webhook.latestDelivery?.eventType || 'Aucun'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Dernier statut</p>
                                            <p className="text-gray-800">
                                                {webhook.latestDelivery
                                                    ? `${webhook.latestDelivery.status} · HTTP ${webhook.latestDelivery.statusCode || '-'} · ${webhook.latestDelivery.durationMs || '-'}ms`
                                                    : '-'}
                                            </p>
                                        </div>
                                    </div>
                                    {webhook.missingEvents.length > 0 && (
                                        <p className="mt-3 text-sm text-amber-700">
                                            Événements manquants: {webhook.missingEvents.join(', ')}
                                        </p>
                                    )}
                                    <div className="mt-4 border border-gray-100 rounded-lg p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-xs font-medium text-gray-500">Événements activés pour ce tenant</p>
                                            {savingConnectorWebhookId === webhook.id && (
                                                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                                    <Loader2 size={13} className="animate-spin" />
                                                    Sauvegarde
                                                </span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
                                            {connectorStatus.requiredEvents.map(event => {
                                                const enabledEvents = connectorStatus.requiredEvents.filter(requiredEvent => webhook.events.includes(requiredEvent));
                                                const checked = enabledEvents.includes(event);
                                                const nextEvents = checked
                                                    ? enabledEvents.filter(currentEvent => currentEvent !== event)
                                                    : [...enabledEvents, event];

                                                return (
                                                    <label key={event} className="flex items-center gap-2 text-sm text-gray-700">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            disabled={savingConnectorWebhookId === webhook.id || !webhook.tenantId}
                                                            onChange={() => updateConnectorEvents(connectorStatus.provider, webhook.id, nextEvents)}
                                                            className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                                        />
                                                        <span className="truncate">{event}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        {!webhook.tenantId && (
                                            <p className="mt-3 flex items-center gap-2 text-xs text-amber-700">
                                                <AlertTriangle size={14} />
                                                {connectorStatus.name} doit être configuré sur un tenant précis avant activation.
                                            </p>
                                        )}
                                    </div>
                                    <div className="mt-4 border border-gray-100 rounded-lg p-3">
                                        <p className="text-xs font-medium text-gray-500">Tests contrôlés</p>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
                                            {(connectorStatus.testableEvents || connectorStatus.requiredEvents).flatMap(event => {
                                                const statusVariants = event === 'message.status.updated' ? MESSAGE_STATUS_TEST_VALUES : [undefined];
                                                return statusVariants.map(status => {
                                                    const testKey = `${webhook.id}:${event}:${status || 'default'}`;
                                                    const disabled = !webhook.isActive || !webhook.tenantId || testingConnector !== null;
                                                    const label = status ? `${event} ${status}` : event;

                                                    return (
                                                        <button
                                                            key={`${event}:${status || 'default'}`}
                                                            type="button"
                                                            disabled={disabled}
                                                            onClick={() => testConnectorEvent(connectorStatus.provider, connectorStatus.name, webhook.id, event, status)}
                                                            className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            {testingConnector === testKey ? (
                                                                <Loader2 size={14} className="animate-spin" />
                                                            ) : (
                                                                <Activity size={14} />
                                                            )}
                                                            Tester {label}
                                                        </button>
                                                    );
                                                });
                                            })}
                                        </div>
                                    </div>
                                    {webhook.recentDeliveries.length > 0 && (
                                        <div className="mt-4 overflow-x-auto border border-gray-100 rounded-lg">
                                            <div className="grid min-w-[860px] grid-cols-[1fr_1fr_auto_auto_auto_auto_auto] gap-3 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">
                                                <span>Événement</span>
                                                <span>EventId</span>
                                                <span>Statut</span>
                                                <span>HTTP</span>
                                                <span>Latence</span>
                                                <span>Retry</span>
                                                <span>Date</span>
                                            </div>
                                            {webhook.recentDeliveries.map(delivery => {
                                                const statusMeta = DELIVERY_STATUS_LABELS[delivery.status] || {
                                                    label: delivery.status,
                                                    className: 'bg-gray-100 text-gray-700'
                                                };

                                                return (
                                                    <div key={delivery.id} className="grid min-w-[860px] grid-cols-[1fr_1fr_auto_auto_auto_auto_auto] gap-3 border-t border-gray-100 px-3 py-2 text-xs text-gray-700">
                                                        <span className="truncate font-medium">{delivery.eventType}</span>
                                                        <span className="truncate font-mono text-gray-500">{delivery.eventId || '-'}</span>
                                                        <span className={`px-2 py-0.5 rounded-full font-medium ${statusMeta.className}`}>
                                                            {statusMeta.label}
                                                        </span>
                                                        <span>{delivery.statusCode || '-'}</span>
                                                        <span>{delivery.durationMs ? `${delivery.durationMs}ms` : '-'}</span>
                                                        <span>{delivery.retryCount}</span>
                                                        <span>{formatDateTime(delivery.createdAt)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </section>
            ))}

            {connectorLogPanel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
                    <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
                        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Détails connecteur</h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    {connectorLogPanel.connectorName} · {connectorLogPanel.webhook.name}
                                </p>
                                <p className="mt-1 max-w-3xl break-all font-mono text-xs text-gray-500">
                                    {connectorLogPanel.webhook.endpoint}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setConnectorLogPanel(null)}
                                className="rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                                aria-label="Fermer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="border-b border-gray-200 px-5 py-4">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_1fr_auto]">
                                <select
                                    value={connectorLogFilters.eventType}
                                    onChange={(event) => setConnectorLogFilters({ ...connectorLogFilters, eventType: event.target.value })}
                                    className="rounded border border-gray-300 px-3 py-2 text-sm"
                                >
                                    <option value="">Tous les événements</option>
                                    {connectorLogPanel.testableEvents.map(event => (
                                        <option key={event} value={event}>{event}</option>
                                    ))}
                                </select>
                                <select
                                    value={connectorLogFilters.status}
                                    onChange={(event) => setConnectorLogFilters({ ...connectorLogFilters, status: event.target.value })}
                                    className="rounded border border-gray-300 px-3 py-2 text-sm"
                                >
                                    <option value="">Tous les statuts</option>
                                    <option value="SUCCESS">Succès</option>
                                    <option value="PENDING">Retry</option>
                                    <option value="FAILED">Échec</option>
                                </select>
                                <input
                                    type="text"
                                    value={connectorLogFilters.eventId}
                                    onChange={(event) => setConnectorLogFilters({ ...connectorLogFilters, eventId: event.target.value })}
                                    placeholder="EventId exact"
                                    className="rounded border border-gray-300 px-3 py-2 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => loadConnectorLogs(connectorLogPanel, connectorLogFilters)}
                                    disabled={connectorLogsLoading}
                                    className="inline-flex items-center justify-center gap-2 rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                                >
                                    {connectorLogsLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                                    Filtrer
                                </button>
                            </div>
                        </div>

                        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                            <div className="min-h-0 overflow-auto border-r border-gray-200">
                                <div className="grid min-w-[980px] grid-cols-[1fr_1fr_auto_auto_auto_auto_auto] gap-3 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500">
                                    <span>Événement</span>
                                    <span>EventId</span>
                                    <span>Statut</span>
                                    <span>HTTP</span>
                                    <span>Latence</span>
                                    <span>Date</span>
                                    <span>Action</span>
                                </div>
                                {connectorLogs.length === 0 && !connectorLogsLoading && (
                                    <p className="px-4 py-8 text-center text-sm text-gray-500">Aucun log pour ces filtres.</p>
                                )}
                                {connectorLogs.map(log => {
                                    const statusMeta = DELIVERY_STATUS_LABELS[log.status] || {
                                        label: log.status,
                                        className: 'bg-gray-100 text-gray-700'
                                    };
                                    const selected = selectedConnectorLog?.id === log.id;

                                    return (
                                        <div
                                            key={log.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => setSelectedConnectorLog(log)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    setSelectedConnectorLog(log);
                                                }
                                            }}
                                            className={`grid min-w-[980px] w-full grid-cols-[1fr_1fr_auto_auto_auto_auto_auto] gap-3 border-t border-gray-100 px-4 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 ${selected ? 'bg-red-50' : ''}`}
                                        >
                                            <span className="truncate font-medium">{log.eventType}</span>
                                            <span className="truncate font-mono text-gray-500">{log.eventId || '-'}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-center font-medium ${statusMeta.className}`}>
                                                {statusMeta.label}
                                            </span>
                                            <span>{log.statusCode || '-'}</span>
                                            <span>{log.durationMs ? `${log.durationMs}ms` : '-'}</span>
                                            <span>{formatDateTime(log.createdAt)}</span>
                                            <span>
                                                {log.replayable ? (
                                                    <button
                                                        type="button"
                                                        disabled={replayingConnectorLogId !== null}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            replayConnectorLog(log);
                                                        }}
                                                        className="inline-flex items-center justify-center rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {replayingConnectorLogId === log.id ? 'Rejeu...' : 'Rejouer'}
                                                    </button>
                                                ) : log.status !== 'SUCCESS' ? (
                                                    <span className="text-[11px] text-gray-400">Non rejouable</span>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </span>
                                        </div>
                                    );
                                })}
                                {connectorLogsNextCursor && (
                                    <div className="border-t border-gray-100 p-3">
                                        <button
                                            type="button"
                                            onClick={() => loadConnectorLogs(connectorLogPanel, connectorLogFilters, { append: true, cursor: connectorLogsNextCursor })}
                                            disabled={connectorLogsLoading}
                                            className="w-full rounded border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            Charger plus
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="min-h-0 overflow-auto bg-gray-50 p-4">
                                {selectedConnectorLog ? (
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-xs font-medium uppercase text-gray-500">Erreur</p>
                                            <pre className="mt-2 max-h-36 overflow-auto rounded border border-gray-200 bg-white p-3 text-xs text-gray-700 whitespace-pre-wrap">
                                                {selectedConnectorLog.error || '-'}
                                            </pre>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium uppercase text-gray-500">Réponse partenaire</p>
                                            <pre className="mt-2 max-h-44 overflow-auto rounded border border-gray-200 bg-white p-3 text-xs text-gray-700 whitespace-pre-wrap">
                                                {selectedConnectorLog.responseBody || '-'}
                                            </pre>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium uppercase text-gray-500">Payload redigé</p>
                                            <pre className="mt-2 max-h-80 overflow-auto rounded border border-gray-200 bg-white p-3 font-mono text-xs text-gray-700 whitespace-pre-wrap">
                                                {formatJson(selectedConnectorLog.payload)}
                                            </pre>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="py-8 text-center text-sm text-gray-500">Sélectionnez une ligne pour inspecter le détail.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Security Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <Key className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                    <div>
                        <p className="font-medium text-blue-900">🔒 Stockage sécurisé</p>
                        <p className="text-sm text-blue-700 mt-1">
                            Toutes les clés API sont chiffrées avec AES-256 avant d'être stockées en base de données.
                            Seuls les 4 derniers caractères sont visibles.
                        </p>
                    </div>
                </div>
            </div>

            {/* Custom Key Modal */}
            {showAddCustom && (
                <div className="bg-white rounded-xl border-2 border-red-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">➕ Ajouter une clé personnalisée</h3>
                        <button onClick={() => setShowAddCustom(false)} className="text-gray-400 hover:text-gray-600">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                            type="text"
                            placeholder="Provider (ex: CUSTOM_API)"
                            value={customKey.provider}
                            onChange={(e) => setCustomKey({ ...customKey, provider: e.target.value.toUpperCase() })}
                            className="px-4 py-2 border border-gray-300 rounded-lg"
                        />
                        <input
                            type="text"
                            placeholder="Clé (ex: API_KEY)"
                            value={customKey.key}
                            onChange={(e) => setCustomKey({ ...customKey, key: e.target.value.toUpperCase() })}
                            className="px-4 py-2 border border-gray-300 rounded-lg"
                        />
                        <input
                            type="password"
                            placeholder="Valeur secrète"
                            value={customKey.value}
                            onChange={(e) => setCustomKey({ ...customKey, value: e.target.value })}
                            className="px-4 py-2 border border-gray-300 rounded-lg"
                        />
                    </div>
                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={saveCustomKey}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Sauvegarder
                        </button>
                        <button
                            onClick={() => setShowAddCustom(false)}
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg"
                        >
                            Annuler
                        </button>
                    </div>
                </div>
            )}

            {/* Provider Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Object.entries(integrations).map(([providerId, provider]) => {
                    const IconComponent = ICONS[provider.icon] || Key;
                    const hasConfigured = provider.keys.some(k => k.isSet);

                    return (
                        <div
                            key={providerId}
                            className={`bg-white rounded-xl border-2 p-6 ${hasConfigured ? 'border-green-200' : 'border-gray-200'}`}
                        >
                            {/* Provider Header */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`p-2 rounded-lg ${hasConfigured ? 'bg-green-100' : 'bg-gray-100'}`}>
                                    <IconComponent className={hasConfigured ? 'text-green-600' : 'text-gray-500'} size={24} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                                    <p className="text-sm text-gray-500">{providerId}</p>
                                </div>
                                {hasConfigured && (
                                    <span className="ml-auto flex items-center gap-1 text-green-600 text-sm">
                                        <Check size={16} />
                                        Configuré
                                    </span>
                                )}
                            </div>

                            {/* Keys List */}
                            <div className="space-y-3">
                                {provider.keys.map((keyItem) => {
                                    const editKey = `${providerId}.${keyItem.key}`;
                                    const isEditing = editingKey === editKey;

                                    return (
                                        <div key={keyItem.key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-700 text-sm">{keyItem.key}</p>
                                                {isEditing ? (
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <input
                                                            type="password"
                                                            placeholder="Nouvelle valeur..."
                                                            value={newValue}
                                                            onChange={(e) => setNewValue(e.target.value)}
                                                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm"
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={() => saveIntegration(providerId, keyItem.key, newValue)}
                                                            disabled={saving || !newValue}
                                                            className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50"
                                                        >
                                                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                        </button>
                                                        <button
                                                            onClick={() => { setEditingKey(null); setNewValue(''); }}
                                                            className="p-1.5 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {keyItem.isSet ? (
                                                            <span className="font-mono text-sm text-gray-600">
                                                                {keyItem.preview}
                                                            </span>
                                                        ) : (
                                                            <span className="text-sm text-orange-500 flex items-center gap-1">
                                                                <AlertTriangle size={14} />
                                                                Non configuré
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {!isEditing && (
                                                <button
                                                    onClick={() => setEditingKey(editKey)}
                                                    className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
                                                >
                                                    ✏️ Modifier
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
