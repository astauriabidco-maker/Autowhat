import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Webhook,
    Plus,
    Trash2,
    Play,
    Check,
    X,
    Loader2,
    ChevronDown,
    ChevronRight,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';

interface WebhookConfig {
    id: string;
    name: string;
    url: string;
    secret: string | null;
    events: string[];
    isActive: boolean;
    tenantId: string | null;
    createdAt: string;
    lastTriggeredAt: string | null;
    successCount: number;
    failureCount: number;
    _count: { logs: number };
}

interface WebhookEvent {
    key: string;
    value: string;
    description: string;
}

interface WebhookLog {
    id: string;
    eventType: string;
    statusCode: number | null;
    error: string | null;
    duration: number | null;
    createdAt: string;
}

export default function Webhooks() {
    const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
    const [events, setEvents] = useState<WebhookEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [expandedWebhook, setExpandedWebhook] = useState<string | null>(null);
    const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
    const [testing, setTesting] = useState<string | null>(null);

    // Form state
    const [form, setForm] = useState({
        name: '',
        url: '',
        events: [] as string[],
        generateSecret: true
    });

    const getToken = () => localStorage.getItem('superadmin_token');

    useEffect(() => {
        fetchWebhooks();
        fetchEvents();
    }, []);

    const fetchWebhooks = async () => {
        try {
            const res = await axios.get('/admin/webhooks', {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            setWebhooks(res.data);
        } catch (error) {
            console.error('Error fetching webhooks:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchEvents = async () => {
        try {
            const res = await axios.get('/admin/webhooks/events', {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            setEvents(res.data);
        } catch (error) {
            console.error('Error fetching events:', error);
        }
    };

    const fetchWebhookLogs = async (webhookId: string) => {
        try {
            const res = await axios.get(`/admin/webhooks/${webhookId}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            setWebhookLogs(res.data.logs || []);
        } catch (error) {
            console.error('Error fetching logs:', error);
        }
    };

    const handleCreate = async () => {
        try {
            const res = await axios.post('/admin/webhooks', form, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });

            // Show the secret to the user
            if (res.data.secretPlaintext) {
                alert(`Webhook créé ! Voici votre secret (à sauvegarder) :\n\n${res.data.secretPlaintext}`);
            }

            setShowModal(false);
            resetForm();
            fetchWebhooks();
        } catch (error: any) {
            alert(error.response?.data?.error || 'Erreur lors de la création');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Supprimer ce webhook ?')) return;

        try {
            await axios.delete(`/admin/webhooks/${id}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            fetchWebhooks();
        } catch (error) {
            console.error('Error deleting webhook:', error);
        }
    };

    const handleTest = async (id: string) => {
        setTesting(id);
        try {
            const res = await axios.post(`/admin/webhooks/${id}/test`, {}, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            alert(res.data.success ? '✅ Test réussi !' : `❌ Échec: ${res.data.error}`);
            fetchWebhooks();
        } catch (error: any) {
            alert(`❌ Erreur: ${error.response?.data?.error || 'Erreur inconnue'}`);
        } finally {
            setTesting(null);
        }
    };

    const handleToggleActive = async (webhook: WebhookConfig) => {
        try {
            await axios.put(`/admin/webhooks/${webhook.id}`, {
                isActive: !webhook.isActive
            }, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            fetchWebhooks();
        } catch (error) {
            console.error('Error toggling webhook:', error);
        }
    };

    const toggleEventSelection = (eventValue: string) => {
        setForm(prev => ({
            ...prev,
            events: prev.events.includes(eventValue)
                ? prev.events.filter(e => e !== eventValue)
                : [...prev.events, eventValue]
        }));
    };

    const resetForm = () => {
        setForm({ name: '', url: '', events: [], generateSecret: true });
    };

    const toggleExpand = (id: string) => {
        if (expandedWebhook === id) {
            setExpandedWebhook(null);
        } else {
            setExpandedWebhook(id);
            fetchWebhookLogs(id);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-gray-400" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Webhooks Sortants</h1>
                    <p className="text-gray-500 mt-1">Envoyez des notifications vers vos systèmes externes</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                    <Plus size={18} />
                    Nouveau webhook
                </button>
            </div>

            {/* Webhooks List */}
            {webhooks.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <Webhook className="mx-auto text-gray-300 mb-4" size={48} />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun webhook configuré</h3>
                    <p className="text-gray-500 mb-4">Les webhooks permettent de notifier vos systèmes externes lors d'événements</p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                    >
                        Créer un webhook
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {webhooks.map(webhook => (
                        <div key={webhook.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            {/* Webhook Header */}
                            <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <button onClick={() => toggleExpand(webhook.id)} className="text-gray-400 hover:text-gray-600">
                                        {expandedWebhook === webhook.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                    </button>

                                    <div className={`w-3 h-3 rounded-full ${webhook.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />

                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-medium text-gray-900">{webhook.name}</h3>
                                            {webhook.tenantId && (
                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">Tenant</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 font-mono truncate max-w-md">{webhook.url}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    {/* Stats */}
                                    <div className="flex items-center gap-3 text-sm">
                                        <span className="flex items-center gap-1 text-green-600">
                                            <CheckCircle2 size={14} />
                                            {webhook.successCount}
                                        </span>
                                        <span className="flex items-center gap-1 text-red-600">
                                            <AlertCircle size={14} />
                                            {webhook.failureCount}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleTest(webhook.id)}
                                            disabled={testing === webhook.id}
                                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                                            title="Tester"
                                        >
                                            {testing === webhook.id ? (
                                                <Loader2 size={18} className="animate-spin" />
                                            ) : (
                                                <Play size={18} />
                                            )}
                                        </button>

                                        <button
                                            onClick={() => handleToggleActive(webhook)}
                                            className={`p-2 rounded-lg transition ${webhook.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                                            title={webhook.isActive ? 'Désactiver' : 'Activer'}
                                        >
                                            {webhook.isActive ? <Check size={18} /> : <X size={18} />}
                                        </button>

                                        <button
                                            onClick={() => handleDelete(webhook.id)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                                            title="Supprimer"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Content */}
                            {expandedWebhook === webhook.id && (
                                <div className="border-t border-gray-100 bg-gray-50 p-4">
                                    <div className="grid grid-cols-2 gap-6">
                                        {/* Events */}
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-700 mb-2">Événements écoutés</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {webhook.events.map(event => (
                                                    <span key={event} className="px-2 py-1 bg-white border border-gray-200 text-gray-700 text-xs rounded">
                                                        {event}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Info */}
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Dernier appel:</span>
                                                <span className="text-gray-700">
                                                    {webhook.lastTriggeredAt
                                                        ? new Date(webhook.lastTriggeredAt).toLocaleString('fr-FR')
                                                        : 'Jamais'
                                                    }
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Total logs:</span>
                                                <span className="text-gray-700">{webhook._count.logs}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Recent Logs */}
                                    {webhookLogs.length > 0 && (
                                        <div className="mt-4">
                                            <h4 className="text-sm font-medium text-gray-700 mb-2">Dernières exécutions</h4>
                                            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left text-gray-600">Date</th>
                                                            <th className="px-3 py-2 text-left text-gray-600">Événement</th>
                                                            <th className="px-3 py-2 text-left text-gray-600">Status</th>
                                                            <th className="px-3 py-2 text-left text-gray-600">Durée</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {webhookLogs.slice(0, 5).map(log => (
                                                            <tr key={log.id} className="border-t border-gray-100">
                                                                <td className="px-3 py-2 text-gray-500">
                                                                    {new Date(log.createdAt).toLocaleString('fr-FR')}
                                                                </td>
                                                                <td className="px-3 py-2 font-mono text-gray-700">{log.eventType}</td>
                                                                <td className="px-3 py-2">
                                                                    {log.error ? (
                                                                        <span className="text-red-600">{log.statusCode || 'Error'}</span>
                                                                    ) : (
                                                                        <span className="text-green-600">{log.statusCode}</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-2 text-gray-500">
                                                                    {log.duration ? `${log.duration}ms` : '-'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200">
                            <h2 className="text-xl font-bold text-gray-900">Nouveau Webhook</h2>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    placeholder="Ex: Intégration Zapier"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                />
                            </div>

                            {/* URL */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">URL de destination</label>
                                <input
                                    type="url"
                                    value={form.url}
                                    onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                                    placeholder="https://example.com/webhook"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono text-sm"
                                />
                            </div>

                            {/* Events */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Événements</label>
                                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                                    {events.map(event => (
                                        <label
                                            key={event.value}
                                            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition ${form.events.includes(event.value)
                                                ? 'bg-red-50 border border-red-200'
                                                : 'hover:bg-gray-50 border border-transparent'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={form.events.includes(event.value)}
                                                onChange={() => toggleEventSelection(event.value)}
                                                className="rounded text-red-600 focus:ring-red-500"
                                            />
                                            <div>
                                                <div className="text-sm font-medium text-gray-700">{event.value}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Secret */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="generateSecret"
                                    checked={form.generateSecret}
                                    onChange={e => setForm(p => ({ ...p, generateSecret: e.target.checked }))}
                                    className="rounded text-red-600 focus:ring-red-500"
                                />
                                <label htmlFor="generateSecret" className="text-sm text-gray-700">
                                    Générer un secret (signature HMAC-SHA256)
                                </label>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                onClick={() => { setShowModal(false); resetForm(); }}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!form.name || !form.url || form.events.length === 0}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Créer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
