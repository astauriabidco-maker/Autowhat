import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    AlertTriangle,
    BellRing,
    CheckCircle2,
    Loader2,
    MessageSquare,
    Phone,
    Plus,
    RefreshCw,
    Save,
    ShieldCheck,
    Unlink
} from 'lucide-react';

interface TenantSummary {
    id: string;
    name: string;
    country: string;
    plan: string;
    status: string;
    assignedSystemNumberId?: string | null;
}

interface SystemNumber {
    id: string;
    phoneNumberId: string;
    displayNumber: string;
    countryCode: string;
    wabaId: string;
    isActive: boolean;
    channelType: 'SHARED' | 'DEDICATED' | 'BYON';
    setupStatus: 'PENDING_MANUAL_SETUP' | 'ACTIVE' | 'SUSPENDED' | 'FAILED';
    planScope: 'ANY' | 'TRIAL' | 'PRO' | 'ENTERPRISE' | string;
    maxTenants: number;
    tenantCount: number;
    availableSlots: number;
    disabledWebhookCount: number;
    lastDisabledWebhookAt?: string | null;
    tokenPreview: string;
    tenants: TenantSummary[];
}

interface PoolHealthAlert {
    id: string;
    severity: 'critical' | 'warning';
    kind: string;
    message: string;
    countryCode?: string;
    planScope?: string;
    tenantName?: string;
    displayNumber?: string;
}

interface PoolHealth {
    summary: {
        totalAlerts: number;
        criticalAlerts: number;
        warningAlerts: number;
        activeTenants: number;
        activeNumbers: number;
        availableSharedSlots: number;
    };
    alerts: PoolHealthAlert[];
}

interface NumbersResponse {
    numbers: SystemNumber[];
    tenants: TenantSummary[];
    health: PoolHealth;
}

const emptyForm = {
    phoneNumberId: '',
    displayNumber: '',
    countryCode: 'FR',
    accessToken: '',
    wabaId: '',
    isActive: true,
    channelType: 'DEDICATED' as SystemNumber['channelType'],
    setupStatus: 'ACTIVE' as SystemNumber['setupStatus'],
    planScope: 'PRO',
    maxTenants: 1
};

function channelTypeLabel(channelType: SystemNumber['channelType']) {
    if (channelType === 'DEDICATED') return 'Dédié';
    if (channelType === 'BYON') return 'BYON';
    return 'Mutualisé';
}

function setupStatusLabel(setupStatus: SystemNumber['setupStatus']) {
    if (setupStatus === 'PENDING_MANUAL_SETUP') return 'Setup manuel';
    if (setupStatus === 'SUSPENDED') return 'Suspendu';
    if (setupStatus === 'FAILED') return 'Erreur';
    return 'Prêt';
}

function planScopeLabel(planScope: SystemNumber['planScope']) {
    return planScope === 'ANY' ? 'Tous plans' : planScope;
}

export default function WhatsAppNumbers() {
    const token = localStorage.getItem('superadmin_token');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [checkingHealth, setCheckingHealth] = useState(false);
    const [numbers, setNumbers] = useState<SystemNumber[]>([]);
    const [tenants, setTenants] = useState<TenantSummary[]>([]);
    const [health, setHealth] = useState<PoolHealth | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [selectedTenants, setSelectedTenants] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchNumbers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get<NumbersResponse>('/admin/whatsapp-numbers', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNumbers(response.data.numbers);
            setTenants(response.data.tenants);
            setHealth(response.data.health);
        } catch (err) {
            console.error('Error fetching WhatsApp numbers:', err);
            setError('Impossible de charger les numéros WhatsApp.');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchNumbers();
    }, [fetchNumbers]);

    const unassignedTenants = useMemo(
        () => tenants.filter(tenant => !tenant.assignedSystemNumberId && tenant.status === 'ACTIVE'),
        [tenants]
    );

    const assignableTenantsFor = useCallback((number: SystemNumber) => (
        unassignedTenants.filter(tenant => number.planScope === 'ANY' || tenant.plan === number.planScope)
    ), [unassignedTenants]);

    const saveNumber = async () => {
        setSaving(true);
        setError(null);
        setMessage(null);
        try {
            await axios.post('/admin/whatsapp-numbers', form, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setForm(emptyForm);
            setMessage('Numéro WhatsApp importé.');
            await fetchNumbers();
        } catch (err) {
            console.error('Error saving WhatsApp number:', err);
            setError('Import impossible. Vérifiez les champs Meta et le token.');
        } finally {
            setSaving(false);
        }
    };

    const assignNumber = async (numberId: string) => {
        const tenantId = selectedTenants[numberId];
        if (!tenantId) {
            setError('Sélectionnez un client avant assignation.');
            return;
        }

        setSaving(true);
        setError(null);
        setMessage(null);
        try {
            await axios.post(`/admin/whatsapp-numbers/${numberId}/assign`, {
                tenantId,
                exclusive: numbers.find(number => number.id === numberId)?.channelType !== 'SHARED'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSelectedTenants(current => ({ ...current, [numberId]: '' }));
            setMessage('Numéro WhatsApp assigné.');
            await fetchNumbers();
        } catch (err) {
            console.error('Error assigning WhatsApp number:', err);
            setError('Assignation impossible. Le numéro est peut-être déjà utilisé.');
        } finally {
            setSaving(false);
        }
    };

    const unassignTenant = async (tenantId: string) => {
        setSaving(true);
        setError(null);
        setMessage(null);
        try {
            await axios.post(`/admin/whatsapp-numbers/tenants/${tenantId}/unassign`, null, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage('Numéro retiré du client.');
            await fetchNumbers();
        } catch (err) {
            console.error('Error unassigning WhatsApp number:', err);
            setError('Retrait impossible.');
        } finally {
            setSaving(false);
        }
    };

    const toggleNumber = async (number: SystemNumber) => {
        setSaving(true);
        setError(null);
        setMessage(null);
        try {
            await axios.patch(`/admin/whatsapp-numbers/${number.id}`, {
                isActive: !number.isActive
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(number.isActive ? 'Numéro désactivé.' : 'Numéro activé.');
            await fetchNumbers();
        } catch (err) {
            console.error('Error toggling WhatsApp number:', err);
            setError('Mise à jour impossible.');
        } finally {
            setSaving(false);
        }
    };

    const triggerHealthAlert = async () => {
        setCheckingHealth(true);
        setError(null);
        setMessage(null);
        try {
            const response = await axios.post('/admin/whatsapp-numbers/health/check', { force: true }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const sent = response.data.notificationsSent || 0;
            const alerts = response.data.alertsDetected || 0;
            setMessage(alerts === 0
                ? 'Controle effectue : aucune alerte pool.'
                : `Controle effectue : ${alerts} alerte(s), ${sent} notification(s) envoyee(s).`
            );
            await fetchNumbers();
        } catch (err) {
            console.error('Error triggering WhatsApp pool health alert:', err);
            setError('Controle de sante impossible.');
        } finally {
            setCheckingHealth(false);
        }
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Numéros WhatsApp</h1>
                    <p className="mt-1 text-gray-500">Pool de numéros WhatsPoint, dédiés ou mutualisés, avec capacité contrôlée.</p>
                </div>
                <button
                    onClick={fetchNumbers}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-600 hover:bg-gray-50"
                >
                    <RefreshCw size={18} />
                    Actualiser
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                    <AlertTriangle size={20} />
                    {error}
                </div>
            )}

            {message && (
                <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
                    <CheckCircle2 size={20} />
                    {message}
                </div>
            )}

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 text-blue-600" size={20} />
                    <p className="text-sm text-blue-800">
                        Cette page ne provisionne pas automatiquement de numéro Meta/Twilio. Elle sert à importer plusieurs canaux déjà validés, puis à répartir les clients sans concentrer tout le trafic sur un seul numéro.
                    </p>
                </div>
            </div>

            {health && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div>
                            <h2 className="font-semibold text-gray-900">Santé du pool</h2>
                            <p className="text-sm text-gray-500">Disponibilité, capacité et cohérence des assignations WhatsApp.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={triggerHealthAlert}
                                disabled={checkingHealth}
                                className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {checkingHealth ? <Loader2 className="animate-spin" size={16} /> : <BellRing size={16} />}
                                Tester l'alerte
                            </button>
                            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${health.summary.criticalAlerts > 0 ? 'bg-red-100 text-red-700' : health.summary.warningAlerts > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                {health.summary.totalAlerts === 0 ? 'OK' : `${health.summary.totalAlerts} alerte(s)`}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                        <div className="border-l-4 border-red-500 bg-red-50 px-4 py-3">
                            <p className="text-xs font-semibold uppercase text-red-700">Critiques</p>
                            <p className="text-2xl font-bold text-red-900">{health.summary.criticalAlerts}</p>
                        </div>
                        <div className="border-l-4 border-amber-500 bg-amber-50 px-4 py-3">
                            <p className="text-xs font-semibold uppercase text-amber-700">Warnings</p>
                            <p className="text-2xl font-bold text-amber-900">{health.summary.warningAlerts}</p>
                        </div>
                        <div className="border-l-4 border-blue-500 bg-blue-50 px-4 py-3">
                            <p className="text-xs font-semibold uppercase text-blue-700">Clients actifs</p>
                            <p className="text-2xl font-bold text-blue-900">{health.summary.activeTenants}</p>
                        </div>
                        <div className="border-l-4 border-green-500 bg-green-50 px-4 py-3">
                            <p className="text-xs font-semibold uppercase text-green-700">Numéros prêts</p>
                            <p className="text-2xl font-bold text-green-900">{health.summary.activeNumbers}</p>
                        </div>
                        <div className="border-l-4 border-slate-500 bg-slate-50 px-4 py-3">
                            <p className="text-xs font-semibold uppercase text-slate-700">Places shared</p>
                            <p className="text-2xl font-bold text-slate-900">{health.summary.availableSharedSlots}</p>
                        </div>
                    </div>

                    <div className="mt-5 divide-y divide-gray-100">
                        {health.alerts.length === 0 ? (
                            <div className="py-4 text-sm text-gray-500">Aucune alerte détectée.</div>
                        ) : health.alerts.map(alert => (
                            <div key={alert.id} className="flex items-start gap-3 py-3">
                                <AlertTriangle className={alert.severity === 'critical' ? 'mt-0.5 text-red-600' : 'mt-0.5 text-amber-600'} size={18} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                                    <p className="text-xs text-gray-500">
                                        {[alert.countryCode, alert.planScope, alert.tenantName, alert.displayNumber].filter(Boolean).join(' · ')}
                                    </p>
                                </div>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${alert.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {alert.severity === 'critical' ? 'Critique' : 'Warning'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                    <div className="rounded-lg bg-red-50 p-2 text-red-600">
                        <Plus size={20} />
                    </div>
                    <div>
                        <h2 className="font-semibold text-gray-900">Importer un numéro système</h2>
                        <p className="text-sm text-gray-500">Ajoutez un numéro WhatsApp Business déjà configuré côté Meta.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <input
                        aria-label="Numéro affiché"
                        value={form.displayNumber}
                        onChange={(event) => setForm({ ...form, displayNumber: event.target.value })}
                        placeholder="+33123456789"
                        className="rounded-lg border border-gray-300 px-4 py-2"
                    />
                    <input
                        aria-label="Phone Number ID Meta"
                        value={form.phoneNumberId}
                        onChange={(event) => setForm({ ...form, phoneNumberId: event.target.value })}
                        placeholder="Phone Number ID Meta"
                        className="rounded-lg border border-gray-300 px-4 py-2"
                    />
                    <input
                        aria-label="Pays du numéro"
                        value={form.countryCode}
                        onChange={(event) => setForm({ ...form, countryCode: event.target.value.toUpperCase() })}
                        placeholder="FR"
                        className="rounded-lg border border-gray-300 px-4 py-2"
                    />
                    <input
                        aria-label="WABA ID"
                        value={form.wabaId}
                        onChange={(event) => setForm({ ...form, wabaId: event.target.value })}
                        placeholder="WABA ID"
                        className="rounded-lg border border-gray-300 px-4 py-2"
                    />
                    <select
                        aria-label="Type de canal"
                        value={form.channelType}
                        onChange={(event) => {
                            const channelType = event.target.value as SystemNumber['channelType'];
                            setForm({
                                ...form,
                                channelType,
                                maxTenants: channelType === 'SHARED' ? Math.max(form.maxTenants, 2) : 1
                            });
                        }}
                        className="rounded-lg border border-gray-300 px-4 py-2"
                    >
                        <option value="DEDICATED">Dédié WhatsPoint</option>
                        <option value="SHARED">Mutualisé WhatsPoint</option>
                        <option value="BYON">BYON accompagné</option>
                    </select>
                    <select
                        aria-label="Statut de setup"
                        value={form.setupStatus}
                        onChange={(event) => setForm({ ...form, setupStatus: event.target.value as SystemNumber['setupStatus'] })}
                        className="rounded-lg border border-gray-300 px-4 py-2"
                    >
                        <option value="ACTIVE">Prêt</option>
                        <option value="PENDING_MANUAL_SETUP">Setup manuel</option>
                        <option value="SUSPENDED">Suspendu</option>
                        <option value="FAILED">Erreur</option>
                    </select>
                    <select
                        aria-label="Plan cible"
                        value={form.planScope}
                        onChange={(event) => setForm({ ...form, planScope: event.target.value })}
                        className="rounded-lg border border-gray-300 px-4 py-2"
                    >
                        <option value="ANY">Tous plans</option>
                        <option value="TRIAL">TRIAL</option>
                        <option value="PRO">PRO</option>
                        <option value="ENTERPRISE">ENTERPRISE</option>
                    </select>
                    <input
                        aria-label="Capacité clients"
                        type="number"
                        min={1}
                        value={form.maxTenants}
                        onChange={(event) => setForm({ ...form, maxTenants: Number(event.target.value) })}
                        disabled={form.channelType !== 'SHARED'}
                        placeholder="Capacité clients"
                        className="rounded-lg border border-gray-300 px-4 py-2 disabled:bg-gray-100"
                    />
                    <input
                        aria-label="Access token system user"
                        type="password"
                        value={form.accessToken}
                        onChange={(event) => setForm({ ...form, accessToken: event.target.value })}
                        placeholder="Access token system user"
                        className="rounded-lg border border-gray-300 px-4 py-2 md:col-span-3"
                    />
                </div>

                <button
                    onClick={saveNumber}
                    disabled={saving || !form.displayNumber || !form.phoneNumberId || !form.accessToken || !form.wabaId}
                    className="mt-5 flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Importer
                </button>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                {numbers.map(number => (
                    <div key={number.id} data-testid="whatsapp-number-card" className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="rounded-lg bg-green-50 p-2 text-green-600">
                                    <Phone size={20} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">{number.displayNumber}</h3>
                                    <p className="text-sm text-gray-500">{number.countryCode} · {number.phoneNumberId}</p>
                                    <p className="text-xs text-gray-400">WABA {number.wabaId} · token {number.tokenPreview}</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                            {channelTypeLabel(number.channelType)}
                                        </span>
                                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                                            {setupStatusLabel(number.setupStatus)}
                                        </span>
                                        <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">
                                            {planScopeLabel(number.planScope)}
                                        </span>
                                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                            {number.tenantCount}/{number.maxTenants} clients
                                        </span>
                                        {number.disabledWebhookCount > 0 && (
                                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                                                {number.disabledWebhookCount} webhook(s) ignoré(s)
                                            </span>
                                        )}
                                    </div>
                                    {number.lastDisabledWebhookAt && (
                                        <p className="mt-2 text-xs text-red-600">
                                            Dernier trafic ignoré : {new Date(number.lastDisabledWebhookAt).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => toggleNumber(number)}
                                disabled={saving}
                                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${number.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                            >
                                {number.isActive ? 'Actif' : 'Inactif'}
                            </button>
                        </div>

                        <div className="mt-5 border-t border-gray-100 pt-4">
                            <div className="mb-3 flex items-center justify-between">
                                <p className="text-sm font-medium text-gray-700">Clients assignés</p>
                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{number.availableSlots} place(s)</span>
                            </div>

                            {number.tenants.length === 0 ? (
                                <p className="text-sm text-gray-400">Aucun client assigné.</p>
                            ) : (
                                <div className="space-y-2">
                                    {number.tenants.map(tenant => (
                                        <div key={tenant.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                                            <div>
                                                <p className="text-sm font-medium text-gray-800">{tenant.name}</p>
                                                <p className="text-xs text-gray-500">{tenant.country} · {tenant.plan}</p>
                                            </div>
                                            <button
                                                onClick={() => unassignTenant(tenant.id)}
                                                disabled={saving}
                                                className="flex items-center gap-1 text-sm text-red-600 hover:text-red-800"
                                            >
                                                <Unlink size={15} />
                                                Retirer
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-5 flex gap-2">
                            <select
                                aria-label={`Assigner ${number.displayNumber}`}
                                value={selectedTenants[number.id] || ''}
                                onChange={(event) => setSelectedTenants(current => ({ ...current, [number.id]: event.target.value }))}
                                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            >
                                <option value="">Assigner à un client actif non assigné</option>
                                {assignableTenantsFor(number).map(tenant => (
                                    <option key={tenant.id} value={tenant.id}>
                                        {tenant.name} · {tenant.country} · {tenant.plan}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={() => assignNumber(number.id)}
                                disabled={saving || !number.isActive || number.setupStatus !== 'ACTIVE' || number.availableSlots < 1 || !selectedTenants[number.id]}
                                className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <MessageSquare size={16} />
                                Assigner
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
