import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    AlertTriangle,
    Check,
    Copy,
    ExternalLink,
    KeyRound,
    Loader2,
    Plus,
    RefreshCw,
    ShieldOff
} from 'lucide-react';

interface TenantSummary {
    id: string;
    name: string;
    country: string;
    plan: string;
    status: string;
}

interface PublicApiKey {
    id: string;
    tenantId: string;
    name: string;
    prefix: string;
    scopes: string[];
    isActive: boolean;
    expiresAt?: string | null;
    revokedAt?: string | null;
    lastUsedAt?: string | null;
    createdAt: string;
    tenant: TenantSummary;
}

interface ApiKeysResponse {
    apiKeys: PublicApiKey[];
    tenants: TenantSummary[];
}

const emptyForm = {
    tenantId: '',
    name: '',
    scopes: ['tenant:read'],
    expiresAt: ''
};

function formatDate(value?: string | null) {
    if (!value) return 'Jamais';
    return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(new Date(value));
}

function statusLabel(apiKey: PublicApiKey) {
    if (apiKey.revokedAt || !apiKey.isActive) return 'Révoquée';
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) <= new Date()) return 'Expirée';
    return 'Active';
}

export default function ApiKeys() {
    const token = localStorage.getItem('superadmin_token');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [apiKeys, setApiKeys] = useState<PublicApiKey[]>([]);
    const [tenants, setTenants] = useState<TenantSummary[]>([]);
    const [scopes, setScopes] = useState<string[]>([]);
    const [selectedTenantId, setSelectedTenantId] = useState('');
    const [form, setForm] = useState(emptyForm);
    const [createdToken, setCreatedToken] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

    const fetchApiKeys = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [keysResponse, scopesResponse] = await Promise.all([
                axios.get<ApiKeysResponse>('/admin/api/keys', {
                    headers,
                    params: selectedTenantId ? { tenantId: selectedTenantId } : undefined
                }),
                axios.get<{ scopes: string[] }>('/admin/api/scopes', { headers })
            ]);

            setApiKeys(keysResponse.data.apiKeys);
            setTenants(keysResponse.data.tenants);
            setScopes(scopesResponse.data.scopes);
            setForm(current => ({
                ...current,
                tenantId: current.tenantId || selectedTenantId || keysResponse.data.tenants[0]?.id || ''
            }));
        } catch (err) {
            console.error('Error fetching public API keys:', err);
            setError('Impossible de charger les clés API.');
        } finally {
            setLoading(false);
        }
    }, [headers, selectedTenantId]);

    useEffect(() => {
        fetchApiKeys();
    }, [fetchApiKeys]);

    const activeTenants = useMemo(
        () => tenants.filter(tenant => tenant.status === 'ACTIVE'),
        [tenants]
    );

    const toggleScope = (scope: string) => {
        setForm(current => ({
            ...current,
            scopes: current.scopes.includes(scope)
                ? current.scopes.filter(item => item !== scope)
                : [...current.scopes, scope]
        }));
    };

    const createApiKey = async () => {
        if (!form.tenantId || !form.name.trim() || form.scopes.length === 0) {
            setError('Sélectionnez un client, un nom et au moins un scope.');
            return;
        }

        setSaving(true);
        setError(null);
        setMessage(null);
        setCreatedToken(null);
        try {
            const payload = {
                name: form.name.trim(),
                scopes: form.scopes,
                expiresAt: form.expiresAt || undefined
            };
            const response = await axios.post<{ token: string }>(
                `/admin/tenants/${form.tenantId}/api-keys`,
                payload,
                { headers }
            );

            setCreatedToken(response.data.token);
            setMessage('Clé API créée.');
            setForm({
                ...emptyForm,
                tenantId: form.tenantId
            });
            await fetchApiKeys();
        } catch (err) {
            console.error('Error creating public API key:', err);
            setError(axios.isAxiosError(err) && err.response?.data?.error
                ? err.response.data.error
                : 'Création impossible.'
            );
        } finally {
            setSaving(false);
        }
    };

    const revokeApiKey = async (apiKey: PublicApiKey) => {
        if (!window.confirm(`Révoquer la clé "${apiKey.name}" ?`)) {
            return;
        }

        setSaving(true);
        setError(null);
        setMessage(null);
        try {
            await axios.post(`/admin/tenants/${apiKey.tenantId}/api-keys/${apiKey.id}/revoke`, null, { headers });
            setMessage('Clé API révoquée.');
            await fetchApiKeys();
        } catch (err) {
            console.error('Error revoking public API key:', err);
            setError('Révocation impossible.');
        } finally {
            setSaving(false);
        }
    };

    const copyToken = async () => {
        if (!createdToken) return;
        await navigator.clipboard.writeText(createdToken);
        setMessage('Clé copiée.');
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="animate-spin text-red-600" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Clés API publiques</h1>
                    <p className="mt-1 text-gray-500">Créez et révoquez les accès API destinés aux ERP, agents IA et connecteurs MCP.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <a
                        href="/api/docs/public-v1.yaml"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                    >
                        <ExternalLink size={18} />
                        OpenAPI
                    </a>
                    <button
                        onClick={() => fetchApiKeys()}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                    >
                        <RefreshCw size={18} />
                        Actualiser
                    </button>
                </div>
            </div>

            {message && (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                    <Check size={18} />
                    {message}
                </div>
            )}

            {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <AlertTriangle size={18} />
                    {error}
                </div>
            )}

            {createdToken && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="mb-3 flex items-start gap-2 text-amber-900">
                        <AlertTriangle className="mt-0.5 shrink-0" size={18} />
                        <div>
                            <p className="font-semibold">Token affiché une seule fois</p>
                            <p className="text-sm text-amber-800">Transmettez-le au client maintenant. Ensuite, seule la prévisualisation restera visible.</p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 md:flex-row">
                        <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-white px-3 py-2 text-sm text-slate-900">
                            {createdToken}
                        </code>
                        <button
                            onClick={copyToken}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700"
                        >
                            <Copy size={16} />
                            Copier
                        </button>
                    </div>
                </div>
            )}

            <div className="rounded-lg border border-gray-200 bg-white p-5">
                <div className="mb-4 flex items-center gap-2">
                    <KeyRound className="text-red-600" size={20} />
                    <h2 className="text-lg font-semibold text-gray-900">Nouvelle clé</h2>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <label className="space-y-1">
                        <span className="text-sm font-medium text-gray-700">Client</span>
                        <select
                            value={form.tenantId}
                            onChange={(event) => setForm({ ...form, tenantId: event.target.value })}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        >
                            {activeTenants.map(tenant => (
                                <option key={tenant.id} value={tenant.id}>
                                    {tenant.name} · {tenant.country} · {tenant.plan}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="space-y-1">
                        <span className="text-sm font-medium text-gray-700">Nom</span>
                        <input
                            value={form.name}
                            onChange={(event) => setForm({ ...form, name: event.target.value })}
                            placeholder="ERP Production"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                    </label>

                    <label className="space-y-1">
                        <span className="text-sm font-medium text-gray-700">Expiration</span>
                        <input
                            type="datetime-local"
                            value={form.expiresAt}
                            onChange={(event) => setForm({ ...form, expiresAt: event.target.value })}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                    </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    {scopes.map(scope => (
                        <button
                            key={scope}
                            onClick={() => toggleScope(scope)}
                            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                                form.scopes.includes(scope)
                                    ? 'border-red-600 bg-red-50 text-red-700'
                                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {scope}
                        </button>
                    ))}
                </div>

                <div className="mt-5 flex justify-end">
                    <button
                        onClick={createApiKey}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                        Créer la clé
                    </button>
                </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white">
                <div className="flex flex-col gap-3 border-b border-gray-200 p-4 md:flex-row md:items-center md:justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Clés existantes</h2>
                    <select
                        value={selectedTenantId}
                        onChange={(event) => setSelectedTenantId(event.target.value)}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                        <option value="">Tous les clients</option>
                        {tenants.map(tenant => (
                            <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                        ))}
                    </select>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Clé</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Client</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Scopes</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Statut</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Dernier usage</th>
                                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {apiKeys.map(apiKey => (
                                <tr key={apiKey.id}>
                                    <td className="px-4 py-4">
                                        <p className="font-medium text-gray-900">{apiKey.name}</p>
                                        <code className="text-xs text-gray-500">{apiKey.prefix}</code>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-700">
                                        {apiKey.tenant?.name || apiKey.tenantId}
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {apiKey.scopes.map(scope => (
                                                <span key={scope} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
                                                    {scope}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                                            statusLabel(apiKey) === 'Active'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {statusLabel(apiKey)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-600">{formatDate(apiKey.lastUsedAt)}</td>
                                    <td className="px-4 py-4 text-right">
                                        <button
                                            onClick={() => revokeApiKey(apiKey)}
                                            disabled={saving || !apiKey.isActive || Boolean(apiKey.revokedAt)}
                                            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <ShieldOff size={16} />
                                            Révoquer
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {apiKeys.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                                        Aucune clé API trouvée.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
