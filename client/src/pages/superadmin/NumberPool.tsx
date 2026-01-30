import { useState, useEffect } from 'react';
import axios from 'axios';
import { Phone, Plus, Trash2, Power, PowerOff, Users, Globe, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';

// Country flag emoji mapping
const COUNTRY_FLAGS: Record<string, string> = {
    FR: '🇫🇷',
    US: '🇺🇸',
    ES: '🇪🇸',
    DE: '🇩🇪',
    GB: '🇬🇧',
    IT: '🇮🇹',
    CA: '🇨🇦',
    CM: '🇨🇲',
    BE: '🇧🇪',
    CH: '🇨🇭',
    DEFAULT: '🌍'
};

interface SystemPhoneNumber {
    id: string;
    phoneNumberId: string;
    displayNumber: string;
    countryCode: string;
    wabaId: string;
    isActive: boolean;
    tenantCount: number;
    actualTenantCount: number;
    createdAt: string;
    hasToken: boolean;
}

interface PoolStats {
    totalNumbers: number;
    activeNumbers: number;
    totalTenants: number;
    byCountry: Array<{ country: string; count: number; load: number }>;
}

export default function NumberPool() {
    const [numbers, setNumbers] = useState<SystemPhoneNumber[]>([]);
    const [stats, setStats] = useState<PoolStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [formData, setFormData] = useState({
        phoneNumberId: '',
        displayNumber: '',
        countryCode: 'FR',
        accessToken: '',
        wabaId: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const token = localStorage.getItem('superadmin_token');
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        loadNumbers();
    }, []);

    const loadNumbers = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/admin/number-pool', { headers });
            setNumbers(response.data.numbers);
            setStats(response.data.stats);
        } catch (err) {
            console.error('Error loading number pool:', err);
            setError('Erreur lors du chargement du pool');
        } finally {
            setLoading(false);
        }
    };

    const handleAddNumber = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            await axios.post('/admin/number-pool', formData, { headers });
            setShowAddModal(false);
            setFormData({
                phoneNumberId: '',
                displayNumber: '',
                countryCode: 'FR',
                accessToken: '',
                wabaId: ''
            });
            loadNumbers();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Erreur lors de l\'ajout');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleActive = async (id: string, currentStatus: boolean) => {
        try {
            await axios.put(`/admin/number-pool/${id}`, { isActive: !currentStatus }, { headers });
            loadNumbers();
        } catch (err) {
            console.error('Error toggling number:', err);
        }
    };

    const deleteNumber = async (id: string) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce numéro ?')) return;

        try {
            await axios.delete(`/admin/number-pool/${id}`, { headers });
            loadNumbers();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Erreur lors de la suppression');
        }
    };

    const getFlag = (countryCode: string) => COUNTRY_FLAGS[countryCode] || COUNTRY_FLAGS.DEFAULT;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <Phone className="h-7 w-7 text-indigo-600" />
                        Pool de Numéros WhatsApp
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Gérez les numéros système partagés par pays
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={loadNumbers}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Actualiser
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                        <Plus className="h-4 w-4" />
                        Ajouter un numéro
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-indigo-100 rounded-lg">
                                <Phone className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{stats.totalNumbers}</p>
                                <p className="text-sm text-gray-500">Numéros total</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-green-100 rounded-lg">
                                <Power className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{stats.activeNumbers}</p>
                                <p className="text-sm text-gray-500">Actifs</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-100 rounded-lg">
                                <Users className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{stats.totalTenants}</p>
                                <p className="text-sm text-gray-500">Clients assignés</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-purple-100 rounded-lg">
                                <Globe className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{stats.byCountry.length}</p>
                                <p className="text-sm text-gray-500">Pays couverts</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Country Distribution */}
            {stats && stats.byCountry.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribution par Pays</h3>
                    <div className="flex flex-wrap gap-3">
                        {stats.byCountry.map(item => (
                            <div
                                key={item.country}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200"
                            >
                                <span className="text-xl">{getFlag(item.country)}</span>
                                <span className="font-medium text-gray-900">{item.country}</span>
                                <span className="text-sm text-gray-500">
                                    {item.count} num. • {item.load} clients
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Numbers Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Pays
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Numéro
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Meta ID
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Charge
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Statut
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {numbers.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <AlertTriangle className="h-10 w-10 text-gray-400" />
                                        <p className="text-gray-500">Aucun numéro dans le pool</p>
                                        <button
                                            onClick={() => setShowAddModal(true)}
                                            className="text-indigo-600 hover:text-indigo-700 font-medium"
                                        >
                                            Ajouter votre premier numéro
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            numbers.map(num => (
                                <tr key={num.id} className={!num.isActive ? 'bg-gray-50 opacity-60' : ''}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">{getFlag(num.countryCode)}</span>
                                            <span className="font-medium text-gray-900">{num.countryCode}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="font-mono text-gray-900">{num.displayNumber}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="font-mono text-sm text-gray-500">{num.phoneNumberId}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4 text-gray-400" />
                                            <span className="font-medium text-gray-900">{num.tenantCount}</span>
                                            <span className="text-gray-500">clients</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${num.isActive
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-red-100 text-red-800'
                                            }`}>
                                            {num.isActive ? 'Actif' : 'Inactif'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => toggleActive(num.id, num.isActive)}
                                                className={`p-2 rounded-lg transition ${num.isActive
                                                        ? 'text-orange-600 hover:bg-orange-50'
                                                        : 'text-green-600 hover:bg-green-50'
                                                    }`}
                                                title={num.isActive ? 'Désactiver' : 'Activer'}
                                            >
                                                {num.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                                            </button>
                                            <button
                                                onClick={() => deleteNumber(num.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                                title="Supprimer"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add Number Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">
                            Ajouter un numéro au pool
                        </h2>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleAddNumber} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Pays
                                </label>
                                <select
                                    value={formData.countryCode}
                                    onChange={e => setFormData({ ...formData, countryCode: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="FR">🇫🇷 France (FR)</option>
                                    <option value="US">🇺🇸 États-Unis (US)</option>
                                    <option value="ES">🇪🇸 Espagne (ES)</option>
                                    <option value="DE">🇩🇪 Allemagne (DE)</option>
                                    <option value="GB">🇬🇧 Royaume-Uni (GB)</option>
                                    <option value="IT">🇮🇹 Italie (IT)</option>
                                    <option value="CA">🇨🇦 Canada (CA)</option>
                                    <option value="CM">🇨🇲 Cameroun (CM)</option>
                                    <option value="BE">🇧🇪 Belgique (BE)</option>
                                    <option value="CH">🇨🇭 Suisse (CH)</option>
                                    <option value="DEFAULT">🌍 Par défaut (DEFAULT)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Numéro (format international)
                                </label>
                                <input
                                    type="text"
                                    value={formData.displayNumber}
                                    onChange={e => setFormData({ ...formData, displayNumber: e.target.value })}
                                    placeholder="+33612345678"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Phone Number ID (Meta)
                                </label>
                                <input
                                    type="text"
                                    value={formData.phoneNumberId}
                                    onChange={e => setFormData({ ...formData, phoneNumberId: e.target.value })}
                                    placeholder="123456789012345"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    WABA ID
                                </label>
                                <input
                                    type="text"
                                    value={formData.wabaId}
                                    onChange={e => setFormData({ ...formData, wabaId: e.target.value })}
                                    placeholder="123456789012345"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Access Token
                                </label>
                                <input
                                    type="password"
                                    value={formData.accessToken}
                                    onChange={e => setFormData({ ...formData, accessToken: e.target.value })}
                                    placeholder="EAAG..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                                    required
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                                >
                                    {submitting ? 'Ajout...' : 'Ajouter'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
