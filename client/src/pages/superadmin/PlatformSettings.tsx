import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Settings,
    Users,
    Activity,
    Save,
    Plus,
    AlertTriangle,
    Lock,
    UserX,
    Database,
    CreditCard,
    Mail,
    MessageSquare,
    Server,
    CheckCircle,
    XCircle,
    Loader2
} from 'lucide-react';

type TabType = 'general' | 'team' | 'health';

interface PlatformConfig {
    platformName: string;
    supportEmail: string;
    defaultTrialDays: number;
    maintenanceMode: boolean;
    allowRegistrations: boolean;
}

interface SuperAdmin {
    id: string;
    email: string;
    name: string;
    createdAt: string;
}

interface HealthStatus {
    status: string;
    version: string;
    environment: string;
    services: {
        database: { status: string; configured: boolean };
        stripe: { status: string; configured: boolean };
        smtp: { status: string; configured: boolean };
        whatsapp: { status: string; configured: boolean };
        redis: { status: string; configured: boolean };
    };
}

export default function PlatformSettings() {
    const [activeTab, setActiveTab] = useState<TabType>('general');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Config state
    const [config, setConfig] = useState<PlatformConfig>({
        platformName: '',
        supportEmail: '',
        defaultTrialDays: 14,
        maintenanceMode: false,
        allowRegistrations: true
    });

    // Admins state
    const [admins, setAdmins] = useState<SuperAdmin[]>([]);
    const [showAddAdmin, setShowAddAdmin] = useState(false);
    const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '' });

    // Health state
    const [health, setHealth] = useState<HealthStatus | null>(null);

    const token = localStorage.getItem('superadmin_token');

    useEffect(() => {
        fetchConfig();
        fetchAdmins();
        fetchHealth();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await axios.get('/admin/config', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setConfig(res.data);
        } catch (error) {
            console.error('Error fetching config:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAdmins = async () => {
        try {
            const res = await axios.get('/admin/admins', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAdmins(res.data);
        } catch (error) {
            console.error('Error fetching admins:', error);
        }
    };

    const fetchHealth = async () => {
        try {
            const res = await axios.get('/admin/health', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setHealth(res.data);
        } catch (error) {
            console.error('Error fetching health:', error);
        }
    };

    const saveConfig = async () => {
        setSaving(true);
        try {
            await axios.put('/admin/config', config, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Configuration sauvegardée !');
        } catch (error) {
            console.error('Error saving config:', error);
            alert('Erreur lors de la sauvegarde');
        } finally {
            setSaving(false);
        }
    };

    const createAdmin = async () => {
        if (!newAdmin.name || !newAdmin.email || !newAdmin.password) {
            alert('Tous les champs sont requis');
            return;
        }

        try {
            await axios.post('/admin/admins', newAdmin, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNewAdmin({ name: '', email: '', password: '' });
            setShowAddAdmin(false);
            fetchAdmins();
        } catch (error: any) {
            alert(error.response?.data?.error || 'Erreur lors de la création');
        }
    };

    const tabs = [
        { id: 'general' as TabType, label: 'Général & Business', icon: Settings },
        { id: 'team' as TabType, label: 'Équipe Admin', icon: Users },
        { id: 'health' as TabType, label: 'État du Système', icon: Activity }
    ];

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
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Paramètres de la Plateforme</h1>
                <p className="text-gray-500 mt-1">Configuration globale, équipe admin et état du système</p>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-4">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition ${activeTab === tab.id
                                ? 'border-red-600 text-red-600'
                                : 'border-transparent text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                {/* General & Business Tab */}
                {activeTab === 'general' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Platform Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Nom de la Plateforme
                                </label>
                                <input
                                    type="text"
                                    value={config.platformName}
                                    onChange={(e) => setConfig({ ...config, platformName: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                />
                            </div>

                            {/* Support Email */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Email Support
                                </label>
                                <input
                                    type="email"
                                    value={config.supportEmail}
                                    onChange={(e) => setConfig({ ...config, supportEmail: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                />
                            </div>

                            {/* Trial Days */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Durée d'Essai (Jours)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="90"
                                    value={config.defaultTrialDays}
                                    onChange={(e) => setConfig({ ...config, defaultTrialDays: parseInt(e.target.value) || 14 })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                />
                            </div>
                        </div>

                        {/* Critical Switches */}
                        <div className="pt-6 border-t border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">⚠️ Actions Critiques</h3>

                            {/* Maintenance Mode */}
                            <div className={`p-4 rounded-lg border-2 mb-4 ${config.maintenanceMode ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Lock className={config.maintenanceMode ? 'text-red-600' : 'text-gray-400'} size={24} />
                                        <div>
                                            <p className="font-semibold text-gray-900">🔒 Mode Maintenance</p>
                                            <p className="text-sm text-gray-500">Bloque l'accès aux clients (seuls les SuperAdmins peuvent se connecter)</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={config.maintenanceMode}
                                            onChange={(e) => setConfig({ ...config, maintenanceMode: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-600"></div>
                                    </label>
                                </div>
                                {config.maintenanceMode && (
                                    <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
                                        <AlertTriangle size={16} />
                                        <span>ATTENTION: Les clients ne peuvent plus se connecter !</span>
                                    </div>
                                )}
                            </div>

                            {/* Allow Registrations */}
                            <div className={`p-4 rounded-lg border-2 ${!config.allowRegistrations ? 'border-orange-500 bg-orange-50' : 'border-gray-200'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <UserX className={!config.allowRegistrations ? 'text-orange-600' : 'text-gray-400'} size={24} />
                                        <div>
                                            <p className="font-semibold text-gray-900">🚫 Fermer les Inscriptions</p>
                                            <p className="text-sm text-gray-500">Cache le bouton "S'inscrire" pour les nouveaux utilisateurs</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={!config.allowRegistrations}
                                            onChange={(e) => setConfig({ ...config, allowRegistrations: !e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-orange-600"></div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="pt-6 border-t border-gray-200">
                            <button
                                onClick={saveConfig}
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition disabled:opacity-50"
                            >
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                Sauvegarder la Configuration
                            </button>
                        </div>
                    </div>
                )}

                {/* Team Admin Tab */}
                {activeTab === 'team' && (
                    <div className="space-y-6">
                        {/* Add Admin Button */}
                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowAddAdmin(!showAddAdmin)}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                            >
                                <Plus size={18} />
                                Ajouter un Admin
                            </button>
                        </div>

                        {/* Add Admin Form */}
                        {showAddAdmin && (
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <h4 className="font-medium text-gray-900 mb-4">Nouvel Administrateur</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <input
                                        type="text"
                                        placeholder="Nom"
                                        value={newAdmin.name}
                                        onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                                        className="px-4 py-2 border border-gray-300 rounded-lg"
                                    />
                                    <input
                                        type="email"
                                        placeholder="Email"
                                        value={newAdmin.email}
                                        onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                                        className="px-4 py-2 border border-gray-300 rounded-lg"
                                    />
                                    <input
                                        type="password"
                                        placeholder="Mot de passe temporaire"
                                        value={newAdmin.password}
                                        onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                                        className="px-4 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={createAdmin}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                                    >
                                        Créer
                                    </button>
                                    <button
                                        onClick={() => setShowAddAdmin(false)}
                                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg"
                                    >
                                        Annuler
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Admins Table */}
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Nom</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Email</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Ajouté le</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {admins.map((admin) => (
                                    <tr key={admin.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-900">{admin.name}</td>
                                        <td className="px-4 py-3 text-gray-600">{admin.email}</td>
                                        <td className="px-4 py-3 text-gray-500 text-sm">
                                            {new Date(admin.createdAt).toLocaleDateString('fr-FR')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Health Tab */}
                {activeTab === 'health' && health && (
                    <div className="space-y-6">
                        {/* Status Header */}
                        <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full ${health.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                            <span className="text-lg font-medium">
                                Système {health.status === 'healthy' ? 'Opérationnel' : 'Dégradé'}
                            </span>
                            <span className="text-sm text-gray-500">v{health.version} • {health.environment}</span>
                        </div>

                        {/* Services Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Database */}
                            <ServiceCard
                                icon={Database}
                                name="Base de Données"
                                status={health.services.database.status}
                                configured={health.services.database.configured}
                            />

                            {/* Stripe */}
                            <ServiceCard
                                icon={CreditCard}
                                name="Stripe Paiements"
                                status={health.services.stripe.status}
                                configured={health.services.stripe.configured}
                            />

                            {/* SMTP */}
                            <ServiceCard
                                icon={Mail}
                                name="Emails (SMTP)"
                                status={health.services.smtp.status}
                                configured={health.services.smtp.configured}
                            />

                            {/* WhatsApp */}
                            <ServiceCard
                                icon={MessageSquare}
                                name="WhatsApp API"
                                status={health.services.whatsapp.status}
                                configured={health.services.whatsapp.configured}
                            />

                            {/* Redis */}
                            <ServiceCard
                                icon={Server}
                                name="Redis Cache"
                                status={health.services.redis.status}
                                configured={health.services.redis.configured}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Service Card Component
function ServiceCard({ icon: Icon, name, status, configured }: {
    icon: React.ElementType;
    name: string;
    status: string;
    configured: boolean;
}) {
    const isOk = status === 'connected' || status === 'configured';

    return (
        <div className={`p-4 rounded-lg border-2 ${isOk ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <div className="flex items-center gap-3">
                <Icon className={isOk ? 'text-green-600' : 'text-red-500'} size={24} />
                <div>
                    <p className="font-medium text-gray-900">{name}</p>
                    <div className="flex items-center gap-1 text-sm">
                        {isOk ? (
                            <>
                                <CheckCircle size={14} className="text-green-600" />
                                <span className="text-green-600">
                                    {status === 'connected' ? 'Connecté' : 'Configuré'}
                                </span>
                            </>
                        ) : (
                            <>
                                <XCircle size={14} className="text-red-500" />
                                <span className="text-red-500">
                                    {status === 'disconnected' ? 'Déconnecté' : 'Manquant'}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
