import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Key,
    CreditCard,
    Mail,
    MessageSquare,
    Database,
    Map,
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

// Icon mapping
const ICONS: Record<string, React.ElementType> = {
    CreditCard,
    Mail,
    MessageSquare,
    Database,
    Map,
    Key,
};

export default function Integrations() {
    const [loading, setLoading] = useState(true);
    const [integrations, setIntegrations] = useState<IntegrationsData>({});
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [newValue, setNewValue] = useState('');
    const [saving, setSaving] = useState(false);
    const [showAddCustom, setShowAddCustom] = useState(false);
    const [customKey, setCustomKey] = useState({ provider: '', key: '', value: '' });

    const token = localStorage.getItem('superadmin_token');

    useEffect(() => {
        fetchIntegrations();
    }, []);

    const fetchIntegrations = async () => {
        try {
            const res = await axios.get('/admin/integrations', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIntegrations(res.data);
        } catch (error) {
            console.error('Error fetching integrations:', error);
        } finally {
            setLoading(false);
        }
    };

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
