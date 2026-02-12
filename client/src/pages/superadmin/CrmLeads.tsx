import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Users,
    Phone,
    Mail,
    MessageSquare,
    Flame,
    Thermometer,
    Snowflake,
    RefreshCw,
    Plus,
    X,
    UserPlus,
    Building2,
    Tag,
    Zap,
    Settings,
    Play,
    Trash2,
    Clock,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    CheckCircle2,
    Edit2,
    Timer
} from 'lucide-react';

// ============ TYPES ============

interface Lead {
    id: string;
    name?: string;
    companyName?: string;
    contactName?: string;
    createdAt: string;
    plan?: string;
    status: string;
    trialEndsAt?: string | null;
    subscriptionStatus?: string | null;
    lastLoginAt?: string | null;
    leadStatus: 'HOT' | 'WARM' | 'COLD';
    type?: 'TENANT' | 'EXTERNAL';
    source?: string;
    admin: {
        id?: string;
        name: string;
        phoneNumber?: string;
    } | null;
    notes: Array<{
        id: string;
        content: string;
        createdAt: string;
    }>;
}

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

// ============ CONSTANTS ============

const SOURCES = [
    { value: 'MANUAL', label: 'Saisie manuelle' },
    { value: 'SALON', label: 'Salon / Événement' },
    { value: 'REFERRAL', label: 'Parrainage' },
    { value: 'INBOUND', label: 'Demande entrante' },
    { value: 'OUTBOUND', label: 'Prospection sortante' },
    { value: 'LINKEDIN', label: 'LinkedIn' },
];

const TRIGGERS = [
    { value: 'DAYS_SINCE_SIGNUP', label: 'Jours depuis inscription', icon: '📝' },
    { value: 'TRIAL_EXPIRES_IN', label: 'Trial expire dans', icon: '⏳' },
    { value: 'TRIAL_EXPIRED_DAYS', label: 'Trial expiré depuis', icon: '❌' },
    { value: 'NO_ACTIVITY_DAYS', label: 'Inactif depuis', icon: '💤' },
    { value: 'NO_SUBSCRIPTION', label: 'Sans abo depuis', icon: '💳' }
];

const CHANNELS = [
    { value: 'EMAIL', label: 'Email' },
    { value: 'WHATSAPP', label: 'WhatsApp' }
];

const VARIABLES = [
    { key: '{{nom}}', desc: 'Nom du contact' },
    { key: '{{entreprise}}', desc: 'Nom entreprise' },
    { key: '{{email}}', desc: 'Email' },
    { key: '{{daysLeft}}', desc: 'Jours restants trial' },
    { key: '{{trialEndDate}}', desc: 'Date fin trial' },
    { key: '{{loginUrl}}', desc: 'URL connexion' }
];

// ============ MAIN COMPONENT ============

export default function CrmLeads() {
    const [activeTab, setActiveTab] = useState<'tenants' | 'external' | 'automations'>('tenants');

    // Leads State
    const [tenantLeads, setTenantLeads] = useState<Lead[]>([]);
    const [externalLeads, setExternalLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<'all' | 'HOT' | 'WARM' | 'COLD'>('all');
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [noteContent, setNoteContent] = useState('');
    const [sendingEmail, setSendingEmail] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newLead, setNewLead] = useState({
        companyName: '',
        contactName: '',
        email: '',
        phone: '',
        source: 'MANUAL',
        temperature: 'COLD'
    });

    // Automations State
    const [rules, setRules] = useState<AutomationRule[]>([]);
    const [stats, setStats] = useState<AutomationStats | null>(null);
    const [showRuleModal, setShowRuleModal] = useState(false);
    const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
    const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [ruleForm, setRuleForm] = useState({
        name: '',
        description: '',
        trigger: 'DAYS_SINCE_SIGNUP',
        triggerValue: 1,
        channel: 'EMAIL',
        templateSubject: '',
        templateBody: '',
        executionTime: '10:00'
    });

    const token = localStorage.getItem('superadmin_token');
    const headers = { Authorization: `Bearer ${token}` };

    // ============ FETCH FUNCTIONS ============

    const fetchLeads = async () => {
        try {
            setLoading(true);
            const [tenantRes, externalRes] = await Promise.all([
                axios.get('/superadmin/leads', { headers }),
                axios.get('/superadmin/external-leads', { headers })
            ]);
            setTenantLeads((tenantRes.data.leads || []).map((l: Lead) => ({ ...l, type: 'TENANT' as const })));
            setExternalLeads((externalRes.data.leads || []).map((l: Lead) => ({
                ...l,
                type: 'EXTERNAL' as const,
                name: l.companyName
            })));
        } catch (error) {
            console.error('Error fetching leads:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAutomations = async () => {
        try {
            const [rulesRes, statsRes] = await Promise.all([
                axios.get('/superadmin/automations', { headers }),
                axios.get('/superadmin/automations/stats', { headers })
            ]);
            setRules(rulesRes.data);
            setStats(statsRes.data);
        } catch (error) {
            console.error('Error fetching automations:', error);
        }
    };

    useEffect(() => {
        fetchLeads();
        fetchAutomations();
    }, []);

    // ============ LEADS HANDLERS ============

    const currentLeads = activeTab === 'tenants' ? tenantLeads : externalLeads;
    const filteredLeads = activeFilter === 'all'
        ? currentLeads
        : currentLeads.filter(l => l.leadStatus === activeFilter);

    const getStatusBadge = (status: Lead['leadStatus']) => {
        switch (status) {
            case 'HOT':
                return <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium"><Flame size={12} /> HOT</span>;
            case 'WARM':
                return <span className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium"><Thermometer size={12} /> WARM</span>;
            case 'COLD':
                return <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"><Snowflake size={12} /> COLD</span>;
        }
    };

    const formatDate = (date: string | null | undefined) => {
        if (!date) return 'Jamais';
        return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const handleSendRelance = async (lead: Lead, templateType: 'help' | 'expiring' | 'extension') => {
        try {
            setSendingEmail(true);
            await axios.post(`/superadmin/leads/${lead.id}/relance`, { templateType }, { headers });
            alert('Email de relance envoyé !');
            fetchLeads();
        } catch (error) {
            console.error('Error sending relance:', error);
            alert('Erreur lors de l\'envoi');
        } finally {
            setSendingEmail(false);
        }
    };

    const handleAddNote = async () => {
        if (!selectedLead || !noteContent.trim()) return;
        try {
            const endpoint = selectedLead.type === 'EXTERNAL'
                ? `/superadmin/external-leads/${selectedLead.id}/notes`
                : `/superadmin/leads/${selectedLead.id}/notes`;
            await axios.post(endpoint, { content: noteContent }, { headers });
            setNoteContent('');
            setSelectedLead(null);
            fetchLeads();
        } catch (error) {
            console.error('Error adding note:', error);
        }
    };

    const handleCreateLead = async () => {
        if (!newLead.companyName || !newLead.contactName) return;
        try {
            await axios.post('/superadmin/external-leads', newLead, { headers });
            setShowCreateModal(false);
            setNewLead({ companyName: '', contactName: '', email: '', phone: '', source: 'MANUAL', temperature: 'COLD' });
            setActiveTab('external');
            fetchLeads();
        } catch (error) {
            console.error('Error creating lead:', error);
            alert('Erreur lors de la création');
        }
    };

    // ============ AUTOMATION HANDLERS ============

    const handleToggleRule = async (id: string) => {
        try {
            await axios.patch(`/superadmin/automations/${id}/toggle`, {}, { headers });
            fetchAutomations();
        } catch (error) {
            console.error('Error toggling rule:', error);
        }
    };

    const handleDeleteRule = async (id: string) => {
        if (!confirm('Supprimer cette règle ?')) return;
        try {
            await axios.delete(`/superadmin/automations/${id}`, { headers });
            fetchAutomations();
        } catch (error) {
            console.error('Error deleting rule:', error);
        }
    };

    const handleEditRule = (rule: AutomationRule) => {
        setEditingRule(rule);
        setRuleForm({
            name: rule.name,
            description: rule.description || '',
            trigger: rule.trigger,
            triggerValue: rule.triggerValue,
            channel: rule.channel,
            templateSubject: rule.templateSubject || '',
            templateBody: rule.templateBody,
            executionTime: rule.executionTime
        });
        setShowRuleModal(true);
    };

    const handleCreateRule = () => {
        setEditingRule(null);
        setRuleForm({
            name: '',
            description: '',
            trigger: 'DAYS_SINCE_SIGNUP',
            triggerValue: 1,
            channel: 'EMAIL',
            templateSubject: '',
            templateBody: '',
            executionTime: '10:00'
        });
        setShowRuleModal(true);
    };

    const handleSubmitRule = async () => {
        try {
            if (editingRule) {
                await axios.put(`/superadmin/automations/${editingRule.id}`, ruleForm, { headers });
            } else {
                await axios.post('/superadmin/automations', ruleForm, { headers });
            }
            setShowRuleModal(false);
            fetchAutomations();
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
            const res = await axios.get(`/superadmin/automations/${ruleId}/logs?limit=10`, { headers });
            setLogs(res.data);
            setExpandedLogs(ruleId);
        } catch (error) {
            console.error('Error fetching logs:', error);
        }
    };

    const getTriggerLabel = (trigger: string) => TRIGGERS.find(t => t.value === trigger)?.label || trigger;

    const leadStats = {
        total: currentLeads.length,
        hot: currentLeads.filter(l => l.leadStatus === 'HOT').length,
        warm: currentLeads.filter(l => l.leadStatus === 'WARM').length,
        cold: currentLeads.filter(l => l.leadStatus === 'COLD').length
    };

    // ============ RENDER ============

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">CRM & Automatisations</h2>
                    <p className="text-sm text-gray-500">Leads + workflows de relance automatique</p>
                </div>
                <div className="flex items-center gap-2">
                    {activeTab !== 'automations' && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                            <UserPlus size={16} />
                            Nouveau Lead
                        </button>
                    )}
                    {activeTab === 'automations' && (
                        <button
                            onClick={handleCreateRule}
                            className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                        >
                            <Plus size={16} />
                            Nouvelle Règle
                        </button>
                    )}
                    <button
                        onClick={() => { fetchLeads(); fetchAutomations(); }}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab('tenants')}
                    className={`px-4 py-2 text-sm rounded-md transition ${activeTab === 'tenants' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
                >
                    <span className="flex items-center gap-2">
                        <Users size={16} />
                        Inscrits ({tenantLeads.length})
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('external')}
                    className={`px-4 py-2 text-sm rounded-md transition ${activeTab === 'external' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
                >
                    <span className="flex items-center gap-2">
                        <Building2 size={16} />
                        Prospects ({externalLeads.length})
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('automations')}
                    className={`px-4 py-2 text-sm rounded-md transition ${activeTab === 'automations' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
                >
                    <span className="flex items-center gap-2">
                        <Zap size={16} className="text-amber-500" />
                        Automatisations ({stats?.activeRules || 0})
                    </span>
                </button>
            </div>

            {/* ============ LEADS VIEW ============ */}
            {activeTab !== 'automations' && (
                <>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-4 gap-4">
                        {[
                            { key: 'all', label: 'Total', value: leadStats.total, icon: Users, color: 'indigo' },
                            { key: 'HOT', label: 'HOT', value: leadStats.hot, icon: Flame, color: 'red' },
                            { key: 'WARM', label: 'WARM', value: leadStats.warm, icon: Thermometer, color: 'orange' },
                            { key: 'COLD', label: 'COLD', value: leadStats.cold, icon: Snowflake, color: 'blue' }
                        ].map(item => (
                            <div
                                key={item.key}
                                onClick={() => setActiveFilter(item.key as any)}
                                className={`p-4 rounded-xl cursor-pointer transition ${activeFilter === item.key ? `bg-${item.color}-50 border-2 border-${item.color}-500` : 'bg-white border border-gray-200 hover:border-gray-300'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 bg-${item.color}-100 rounded-lg flex items-center justify-center`}>
                                        <item.icon className={`text-${item.color}-600`} size={20} />
                                    </div>
                                    <div>
                                        <p className={`text-2xl font-bold ${item.key !== 'all' ? `text-${item.color}-600` : 'text-gray-900'}`}>{item.value}</p>
                                        <p className="text-xs text-gray-500">{item.label}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Leads Table */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <RefreshCw className="animate-spin text-gray-400" size={32} />
                            </div>
                        ) : filteredLeads.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <Users size={48} className="mx-auto mb-4 text-gray-300" />
                                <p>Aucun lead dans cette catégorie</p>
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            {activeTab === 'external' ? 'Source' : 'Inscription'}
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredLeads.map((lead) => (
                                        <tr key={lead.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="font-medium text-gray-900">{lead.name || lead.companyName}</p>
                                                    {lead.admin && (
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className="text-sm text-gray-500">{lead.admin.name}</span>
                                                            {lead.admin.phoneNumber && (
                                                                <a href={`tel:${lead.admin.phoneNumber}`} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800">
                                                                    <Phone size={12} />
                                                                    {lead.admin.phoneNumber}
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {activeTab === 'external' ? (
                                                    <span className="flex items-center gap-1">
                                                        <Tag size={14} />
                                                        {SOURCES.find(s => s.value === lead.source)?.label || lead.source}
                                                    </span>
                                                ) : formatDate(lead.createdAt)}
                                            </td>
                                            <td className="px-6 py-4">{getStatusBadge(lead.leadStatus)}</td>
                                            <td className="px-6 py-4">
                                                {lead.notes.length > 0 ? (
                                                    <div className="text-sm text-gray-600 max-w-[200px] truncate">{lead.notes[0].content}</div>
                                                ) : (
                                                    <span className="text-xs text-gray-400">Aucune note</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    {activeTab === 'tenants' && (
                                                        <button
                                                            onClick={() => handleSendRelance(lead, 'help')}
                                                            disabled={sendingEmail}
                                                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                                            title="Envoyer email de relance"
                                                        >
                                                            <Mail size={18} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setSelectedLead(lead)}
                                                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                                        title="Ajouter une note"
                                                    >
                                                        <MessageSquare size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}

            {/* ============ AUTOMATIONS VIEW ============ */}
            {activeTab === 'automations' && (
                <>
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
                        {rules.length === 0 ? (
                            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                                <Zap size={48} className="mx-auto text-gray-300 mb-4" />
                                <p className="text-gray-500 mb-4">Aucune règle d'automatisation</p>
                                <button onClick={handleCreateRule} className="text-amber-600 hover:text-amber-800">
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
                                                        onClick={() => handleToggleRule(rule.id)}
                                                        className={`w-12 h-6 rounded-full transition-colors relative ${rule.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                                                    >
                                                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${rule.isActive ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                                    </button>
                                                    <h3 className="font-semibold text-gray-900">{rule.name}</h3>
                                                    <span className={`px-2 py-0.5 text-xs rounded-full ${rule.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {rule.isActive ? 'Actif' : 'Inactif'}
                                                    </span>
                                                </div>
                                                {rule.description && <p className="text-sm text-gray-500 mt-1 ml-15">{rule.description}</p>}
                                                <div className="flex flex-wrap gap-4 mt-3 ml-15 text-sm">
                                                    <span className="flex items-center gap-1 text-gray-600">
                                                        <Timer size={14} />
                                                        {getTriggerLabel(rule.trigger)} = {rule.triggerValue}j
                                                    </span>
                                                    <span className="flex items-center gap-1 text-gray-600">
                                                        {rule.channel === 'EMAIL' ? <Mail size={14} /> : <MessageSquare size={14} />}
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
                                                <button onClick={() => fetchLogs(rule.id)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Voir logs">
                                                    {expandedLogs === rule.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                </button>
                                                <button onClick={() => handleEditRule(rule)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Modifier">
                                                    <Edit2 size={18} />
                                                </button>
                                                <button onClick={() => handleDeleteRule(rule.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Supprimer">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    {expandedLogs === rule.id && (
                                        <div className="border-t border-gray-100 bg-gray-50 p-4">
                                            <p className="text-xs font-medium text-gray-500 mb-2">Dernières exécutions</p>
                                            {logs.length === 0 ? (
                                                <p className="text-sm text-gray-400">Aucune exécution</p>
                                            ) : (
                                                <div className="space-y-1">
                                                    {logs.map(log => (
                                                        <div key={log.id} className="flex items-center gap-3 text-sm">
                                                            {log.status === 'SUCCESS' ? <CheckCircle2 size={14} className="text-green-500" /> : <AlertCircle size={14} className="text-red-500" />}
                                                            <span className="text-gray-600">{log.recipient}</span>
                                                            <span className="text-gray-400">{formatDate(log.createdAt)}</span>
                                                            {log.error && <span className="text-red-500 text-xs">{log.error}</span>}
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
                </>
            )}

            {/* ============ MODALS ============ */}

            {/* Create Lead Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold flex items-center gap-2"><UserPlus size={20} />Nouveau Lead</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Entreprise *</label>
                                    <input type="text" value={newLead.companyName} onChange={(e) => setNewLead({ ...newLead, companyName: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg" placeholder="Nom de l'entreprise" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact *</label>
                                    <input type="text" value={newLead.contactName} onChange={(e) => setNewLead({ ...newLead, contactName: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg" placeholder="Nom du contact" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input type="email" value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg" placeholder="email@exemple.com" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                                    <input type="tel" value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg" placeholder="+33 6 12 34 56 78" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                                    <select value={newLead.source} onChange={(e) => setNewLead({ ...newLead, source: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg">
                                        {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Température</label>
                                    <select value={newLead.temperature} onChange={(e) => setNewLead({ ...newLead, temperature: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg">
                                        <option value="HOT">🔥 HOT</option>
                                        <option value="WARM">🌡️ WARM</option>
                                        <option value="COLD">❄️ COLD</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
                            <button onClick={handleCreateLead} disabled={!newLead.companyName || !newLead.contactName} className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                                <Plus size={16} />Créer le lead
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Note Modal */}
            {selectedLead && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Noter : {selectedLead.name || selectedLead.companyName}</h3>
                            <button onClick={() => setSelectedLead(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        {selectedLead.notes.length > 0 && (
                            <div className="mb-4 space-y-2 max-h-40 overflow-y-auto">
                                {selectedLead.notes.map(note => (
                                    <div key={note.id} className="p-2 bg-gray-50 rounded text-sm">
                                        <p className="text-gray-700">{note.content}</p>
                                        <p className="text-xs text-gray-400 mt-1">{formatDate(note.createdAt)}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                        <textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Ex: Je l'ai eu au tel, il attend la validation de son chef..." className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none h-24" />
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setSelectedLead(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
                            <button onClick={handleAddNote} disabled={!noteContent.trim()} className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                                <Plus size={16} />Ajouter
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rule Modal */}
            {showRuleModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{editingRule ? 'Modifier la règle' : 'Nouvelle règle'}</h3>
                            <button onClick={() => setShowRuleModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                                    <input type="text" value={ruleForm.name} onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg" placeholder="Ex: Relance J+1" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <input type="text" value={ruleForm.description} onChange={e => setRuleForm({ ...ruleForm, description: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg" placeholder="Description optionnelle" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Déclencheur *</label>
                                    <select value={ruleForm.trigger} onChange={e => setRuleForm({ ...ruleForm, trigger: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg">
                                        {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de jours *</label>
                                    <input type="number" min="1" value={ruleForm.triggerValue} onChange={e => setRuleForm({ ...ruleForm, triggerValue: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-200 rounded-lg" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Canal</label>
                                    <select value={ruleForm.channel} onChange={e => setRuleForm({ ...ruleForm, channel: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg">
                                        {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Heure d'exécution</label>
                                    <input type="time" value={ruleForm.executionTime} onChange={e => setRuleForm({ ...ruleForm, executionTime: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg" />
                                </div>
                            </div>
                            {ruleForm.channel === 'EMAIL' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Sujet de l'email</label>
                                    <input type="text" value={ruleForm.templateSubject} onChange={e => setRuleForm({ ...ruleForm, templateSubject: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg" placeholder="Ex: {{entreprise}} - Besoin d'aide ?" />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Contenu du message *</label>
                                <textarea value={ruleForm.templateBody} onChange={e => setRuleForm({ ...ruleForm, templateBody: e.target.value })} rows={6} className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none" placeholder="Bonjour {{nom}},&#10;&#10;Nous avons remarqué que vous n'avez pas encore finalisé..." />
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs font-medium text-gray-500 mb-2">Variables disponibles :</p>
                                <div className="flex flex-wrap gap-2">
                                    {VARIABLES.map(v => (
                                        <button key={v.key} type="button" onClick={() => setRuleForm({ ...ruleForm, templateBody: ruleForm.templateBody + v.key })} className="px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:border-amber-500 hover:text-amber-600" title={v.desc}>
                                            {v.key}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-100 p-4 flex justify-end gap-2">
                            <button onClick={() => setShowRuleModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
                            <button onClick={handleSubmitRule} disabled={!ruleForm.name || !ruleForm.templateBody} className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50">
                                <Zap size={16} />{editingRule ? 'Enregistrer' : 'Créer la règle'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
