import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Zap,
    Plus,
    Settings,
    Play,
    Trash2,
    Clock,
    Mail,
    MessageSquare,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    CheckCircle2,
    RefreshCw,
    X,
    Edit2,
    Timer
} from 'lucide-react';

interface AutomationRule {
    id: string;
    name: string;
    description: string | null;
    trigger: string;
    triggerValue: number;
    channel: string;
    templateSubject: string | null;
    templateBody: string;
    isActive: boolean;
    executionTime: string;
    lastExecutedAt: string | null;
    createdAt: string;
    _count?: { executions: number };
}

interface AutomationStats {
    totalRules: number;
    activeRules: number;
    todayExecutions: number;
    failedToday: number;
    successRate: number;
}

interface AutomationLog {
    id: string;
    status: string;
    recipient: string;
    createdAt: string;
    error?: string | null;
}

const TRIGGERS = [
    { value: 'DAYS_SINCE_SIGNUP', label: 'Jours depuis inscription', icon: '📝' },
    { value: 'TRIAL_EXPIRES_IN', label: 'Trial expire dans', icon: '⏳' },
    { value: 'TRIAL_EXPIRED_DAYS', label: 'Trial expiré depuis', icon: '❌' },
    { value: 'NO_ACTIVITY_DAYS', label: 'Inactif depuis', icon: '💤' },
    { value: 'NO_SUBSCRIPTION', label: 'Sans abo depuis', icon: '💳' }
];

const CHANNELS = [
    { value: 'EMAIL', label: 'Email', icon: Mail },
    { value: 'WHATSAPP', label: 'WhatsApp', icon: MessageSquare }
];

const VARIABLES = [
    { key: '{{nom}}', desc: 'Nom du contact' },
    { key: '{{entreprise}}', desc: 'Nom entreprise' },
    { key: '{{email}}', desc: 'Email' },
    { key: '{{daysLeft}}', desc: 'Jours restants trial' },
    { key: '{{trialEndDate}}', desc: 'Date fin trial' },
    { key: '{{loginUrl}}', desc: 'URL connexion' }
];

export default function AutomationCockpit() {
    const [rules, setRules] = useState<AutomationRule[]>([]);
    const [stats, setStats] = useState<AutomationStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
    const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
    const [logs, setLogs] = useState<AutomationLog[]>([]);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        trigger: 'DAYS_SINCE_SIGNUP',
        triggerValue: 1,
        channel: 'EMAIL',
        templateSubject: '',
        templateBody: '',
        executionTime: '10:00'
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('superadmin_token');
            const headers = { Authorization: `Bearer ${token}` };

            const [rulesRes, statsRes] = await Promise.all([
                axios.get('/superadmin/automations', { headers }),
                axios.get('/superadmin/automations/stats', { headers })
            ]);

            setRules(rulesRes.data);
            setStats(statsRes.data);
        } catch (error) {
            console.error('Error fetching automations:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleToggle = async (id: string) => {
        try {
            const token = localStorage.getItem('superadmin_token');
            await axios.patch(`/superadmin/automations/${id}/toggle`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchData();
        } catch (error) {
            console.error('Error toggling rule:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Supprimer cette règle ?')) return;
        try {
            const token = localStorage.getItem('superadmin_token');
            await axios.delete(`/superadmin/automations/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchData();
        } catch (error) {
            console.error('Error deleting rule:', error);
        }
    };

    const handleEdit = (rule: AutomationRule) => {
        setEditingRule(rule);
        setFormData({
            name: rule.name,
            description: rule.description || '',
            trigger: rule.trigger,
            triggerValue: rule.triggerValue,
            channel: rule.channel,
            templateSubject: rule.templateSubject || '',
            templateBody: rule.templateBody,
            executionTime: rule.executionTime
        });
        setShowModal(true);
    };

    const handleCreate = () => {
        setEditingRule(null);
        setFormData({
            name: '',
            description: '',
            trigger: 'DAYS_SINCE_SIGNUP',
            triggerValue: 1,
            channel: 'EMAIL',
            templateSubject: '',
            templateBody: '',
            executionTime: '10:00'
        });
        setShowModal(true);
    };

    const handleSubmit = async () => {
        try {
            const token = localStorage.getItem('superadmin_token');
            const headers = { Authorization: `Bearer ${token}` };

            if (editingRule) {
                await axios.put(`/superadmin/automations/${editingRule.id}`, formData, { headers });
            } else {
                await axios.post('/superadmin/automations', formData, { headers });
            }

            setShowModal(false);
            fetchData();
        } catch (error) {
            console.error('Error saving rule:', error);
            alert('Erreur lors de la sauvegarde');
        }
    };

    const fetchLogs = async (ruleId: string) => {
        if (expandedLogs === ruleId) {
            setExpandedLogs(null);
            return;
        }

        try {
            const token = localStorage.getItem('superadmin_token');
            const res = await axios.get(`/superadmin/automations/${ruleId}/logs?limit=10`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLogs(res.data);
            setExpandedLogs(ruleId);
        } catch (error) {
            console.error('Error fetching logs:', error);
        }
    };

    const getTriggerLabel = (trigger: string) => {
        return TRIGGERS.find(t => t.value === trigger)?.label || trigger;
    };

    const formatDate = (date: string | null) => {
        if (!date) return 'Jamais';
        return new Date(date).toLocaleString('fr-FR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Zap className="text-amber-500" size={24} />
                        Cockpit Automatisation
                    </h2>
                    <p className="text-sm text-gray-500">Configurez vos workflows de relance automatique</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchData}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                    >
                        <RefreshCw size={18} />
                    </button>
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                    >
                        <Plus size={18} />
                        Nouvelle Règle
                    </button>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                                <Settings className="text-amber-600" size={20} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.totalRules}</p>
                                <p className="text-xs text-gray-500">Règles totales</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                <Play className="text-green-600" size={20} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-green-600">{stats.activeRules}</p>
                                <p className="text-xs text-gray-500">Actives</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Mail className="text-blue-600" size={20} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-blue-600">{stats.todayExecutions}</p>
                                <p className="text-xs text-gray-500">Envois aujourd'hui</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                                <CheckCircle2 className="text-emerald-600" size={20} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-emerald-600">{stats.successRate}%</p>
                                <p className="text-xs text-gray-500">Taux de succès</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Rules List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <RefreshCw className="animate-spin text-gray-400" size={32} />
                    </div>
                ) : rules.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                        <Zap size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500 mb-4">Aucune règle d'automatisation</p>
                        <button
                            onClick={handleCreate}
                            className="text-amber-600 hover:text-amber-800"
                        >
                            + Créer votre première règle
                        </button>
                    </div>
                ) : (
                    rules.map(rule => (
                        <div key={rule.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className="p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => handleToggle(rule.id)}
                                                className={`w-12 h-6 rounded-full transition-colors relative ${rule.isActive ? 'bg-green-500' : 'bg-gray-300'
                                                    }`}
                                            >
                                                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${rule.isActive ? 'translate-x-6' : 'translate-x-0.5'
                                                    }`} />
                                            </button>
                                            <h3 className="font-semibold text-gray-900">{rule.name}</h3>
                                            <span className={`px-2 py-0.5 text-xs rounded-full ${rule.isActive
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                {rule.isActive ? 'Actif' : 'Inactif'}
                                            </span>
                                        </div>
                                        {rule.description && (
                                            <p className="text-sm text-gray-500 mt-1 ml-15">{rule.description}</p>
                                        )}
                                        <div className="flex flex-wrap gap-4 mt-3 ml-15 text-sm">
                                            <span className="flex items-center gap-1 text-gray-600">
                                                <Timer size={14} />
                                                {getTriggerLabel(rule.trigger)} = {rule.triggerValue}j
                                            </span>
                                            <span className="flex items-center gap-1 text-gray-600">
                                                {rule.channel === 'EMAIL'
                                                    ? <Mail size={14} />
                                                    : <MessageSquare size={14} />
                                                }
                                                {rule.channel}
                                            </span>
                                            <span className="flex items-center gap-1 text-gray-600">
                                                <Clock size={14} />
                                                {rule.executionTime}
                                            </span>
                                            <span className="text-gray-400">
                                                Dernier run: {formatDate(rule.lastExecutedAt)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => fetchLogs(rule.id)}
                                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                                            title="Voir logs"
                                        >
                                            {expandedLogs === rule.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </button>
                                        <button
                                            onClick={() => handleEdit(rule)}
                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                            title="Modifier"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(rule.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                            title="Supprimer"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Logs */}
                            {expandedLogs === rule.id && (
                                <div className="border-t border-gray-100 bg-gray-50 p-4">
                                    <p className="text-xs font-medium text-gray-500 mb-2">Dernières exécutions</p>
                                    {logs.length === 0 ? (
                                        <p className="text-sm text-gray-400">Aucune exécution</p>
                                    ) : (
                                        <div className="space-y-1">
                                            {logs.map(log => (
                                                <div key={log.id} className="flex items-center gap-3 text-sm">
                                                    {log.status === 'SUCCESS' ? (
                                                        <CheckCircle2 size={14} className="text-green-500" />
                                                    ) : (
                                                        <AlertCircle size={14} className="text-red-500" />
                                                    )}
                                                    <span className="text-gray-600">{log.recipient}</span>
                                                    <span className="text-gray-400">{formatDate(log.createdAt)}</span>
                                                    {log.error && (
                                                        <span className="text-red-500 text-xs">{log.error}</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold">
                                {editingRule ? 'Modifier la règle' : 'Nouvelle règle'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Basic Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                                        placeholder="Ex: Relance J+1"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                                        placeholder="Description optionnelle"
                                    />
                                </div>
                            </div>

                            {/* Trigger */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Déclencheur *</label>
                                    <select
                                        value={formData.trigger}
                                        onChange={e => setFormData({ ...formData, trigger: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                                    >
                                        {TRIGGERS.map(t => (
                                            <option key={t.value} value={t.value}>
                                                {t.icon} {t.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de jours *</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.triggerValue}
                                        onChange={e => setFormData({ ...formData, triggerValue: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                            </div>

                            {/* Channel & Time */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Canal</label>
                                    <select
                                        value={formData.channel}
                                        onChange={e => setFormData({ ...formData, channel: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                                    >
                                        {CHANNELS.map(c => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Heure d'exécution</label>
                                    <input
                                        type="time"
                                        value={formData.executionTime}
                                        onChange={e => setFormData({ ...formData, executionTime: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                            </div>

                            {/* Template */}
                            {formData.channel === 'EMAIL' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Sujet de l'email</label>
                                    <input
                                        type="text"
                                        value={formData.templateSubject}
                                        onChange={e => setFormData({ ...formData, templateSubject: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                                        placeholder="Ex: {{entreprise}} - Besoin d'aide ?"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Contenu du message *</label>
                                <textarea
                                    value={formData.templateBody}
                                    onChange={e => setFormData({ ...formData, templateBody: e.target.value })}
                                    rows={6}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 resize-none"
                                    placeholder="Bonjour {{nom}},\n\nNous avons remarqué que vous n'avez pas encore finalisé..."
                                />
                            </div>

                            {/* Variables Helper */}
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs font-medium text-gray-500 mb-2">Variables disponibles :</p>
                                <div className="flex flex-wrap gap-2">
                                    {VARIABLES.map(v => (
                                        <button
                                            key={v.key}
                                            type="button"
                                            onClick={() => setFormData({
                                                ...formData,
                                                templateBody: formData.templateBody + v.key
                                            })}
                                            className="px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:border-amber-500 hover:text-amber-600"
                                            title={v.desc}
                                        >
                                            {v.key}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-100 p-4 flex justify-end gap-2">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={!formData.name || !formData.templateBody}
                                className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                            >
                                <Zap size={16} />
                                {editingRule ? 'Enregistrer' : 'Créer la règle'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
