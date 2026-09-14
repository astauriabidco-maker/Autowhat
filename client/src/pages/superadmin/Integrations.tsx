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
    RefreshCw
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

interface KalldyStatus {
    provider: 'KALLDY';
    version: string;
    requiredEvents: string[];
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
    webhooks: Array<{
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
        latestDelivery: {
            eventType: string;
            status: string;
            statusCode: number | null;
            durationMs: number | null;
            error: string | null;
            createdAt: string;
        } | null;
    }>;
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

const KALLDY_STATE_LABELS: Record<KalldyStatus['state'], { label: string; className: string }> = {
    healthy: { label: 'Sain', className: 'bg-green-100 text-green-700 border-green-200' },
    configured: { label: 'Configuré', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    partial: { label: 'Partiel', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    degraded: { label: 'Dégradé', className: 'bg-red-100 text-red-700 border-red-200' },
    disabled: { label: 'Désactivé', className: 'bg-gray-100 text-gray-700 border-gray-200' },
    not_configured: { label: 'Non configuré', className: 'bg-gray-100 text-gray-700 border-gray-200' }
};

export default function Integrations() {
    const [loading, setLoading] = useState(true);
    const [integrations, setIntegrations] = useState<IntegrationsData>({});
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [newValue, setNewValue] = useState('');
    const [saving, setSaving] = useState(false);
    const [showAddCustom, setShowAddCustom] = useState(false);
    const [customKey, setCustomKey] = useState({ provider: '', key: '', value: '' });
    const [kalldyStatus, setKalldyStatus] = useState<KalldyStatus | null>(null);

    const token = localStorage.getItem('superadmin_token');

    const fetchIntegrations = useCallback(async () => {
        try {
            const [integrationsRes, kalldyRes] = await Promise.all([
                axios.get('/admin/integrations', {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get('/admin/integrations/kalldy/status', {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);
            setIntegrations(integrationsRes.data);
            setKalldyStatus(kalldyRes.data);
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
                </div>
            </div>

            {kalldyStatus && (
                <section className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-50 rounded-lg">
                                    <Webhook className="text-red-600" size={22} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">Connecteur Kalldy v1</h2>
                                    <p className="text-sm text-gray-500">Convention {kalldyStatus.version} pour les flux paie validés.</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-4">
                                {kalldyStatus.requiredEvents.map(event => (
                                    <span key={event} className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                                        {event}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium border rounded-full ${KALLDY_STATE_LABELS[kalldyStatus.state].className}`}>
                                <Activity size={15} />
                                {KALLDY_STATE_LABELS[kalldyStatus.state].label}
                            </span>
                            <a
                                href="/api/docs/public-v1.yaml"
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
                            <p className="text-xl font-semibold text-gray-900">{kalldyStatus.totals.activeWebhooks}/{kalldyStatus.totals.webhooks}</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500">Succès</p>
                            <p className="text-xl font-semibold text-green-600">{kalldyStatus.totals.successes}</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500">Échecs</p>
                            <p className="text-xl font-semibold text-red-600">{kalldyStatus.totals.failures}</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500">Endpoint</p>
                            <p className="text-sm font-medium text-gray-900">{kalldyStatus.webhooks[0]?.environment || 'sandbox'}</p>
                        </div>
                    </div>

                    <div className="mt-5 space-y-3">
                        {kalldyStatus.webhooks.length === 0 ? (
                            <p className="text-sm text-gray-500">Aucun webhook Kalldy détecté.</p>
                        ) : (
                            kalldyStatus.webhooks.map(webhook => (
                                <div key={webhook.id} className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <p className="font-medium text-gray-900">{webhook.name}</p>
                                            <p className="text-xs text-gray-500 font-mono break-all">{webhook.endpoint}</p>
                                        </div>
                                        <span className={`text-xs font-medium px-2 py-1 rounded ${webhook.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {webhook.isActive ? 'Actif' : 'Inactif'}
                                        </span>
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
                                </div>
                            ))
                        )}
                    </div>
                </section>
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
