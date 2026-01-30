import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Plus,
    Pencil,
    Trash2,
    Archive,
    Check,
    X,
    Loader2,
    Package,
    Star,
    Users,
    DollarSign,
    Save,
    AlertTriangle,
    Info
} from 'lucide-react';

interface Plan {
    id: string;
    stripePriceId: string;
    name: string;
    description: string | null;
    price: number;
    currency: string;
    maxEmployees: number;
    features: string;
    isPopular: boolean;
    isActive: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

export default function PlansManager() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        stripePriceId: '',
        name: '',
        description: '',
        price: '',
        currency: 'EUR',
        maxEmployees: '',
        features: '',
        isPopular: false,
        isActive: true,
        sortOrder: ''
    });

    const token = localStorage.getItem('superadmin_token');

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const res = await axios.get('/admin/plans', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPlans(res.data);
        } catch (error) {
            console.error('Error fetching plans:', error);
        } finally {
            setLoading(false);
        }
    };

    const openNewForm = () => {
        setEditingPlan(null);
        setForm({
            stripePriceId: '',
            name: '',
            description: '',
            price: '',
            currency: 'EUR',
            maxEmployees: '',
            features: '',
            isPopular: false,
            isActive: true,
            sortOrder: String(plans.length + 1)
        });
        setShowForm(true);
    };

    const openEditForm = (plan: Plan) => {
        setEditingPlan(plan);
        setForm({
            stripePriceId: plan.stripePriceId,
            name: plan.name,
            description: plan.description || '',
            price: String(plan.price),
            currency: plan.currency,
            maxEmployees: String(plan.maxEmployees),
            features: plan.features,
            isPopular: plan.isPopular,
            isActive: plan.isActive,
            sortOrder: String(plan.sortOrder)
        });
        setShowForm(true);
    };

    const savePlan = async () => {
        if (!form.name || !form.price || !form.maxEmployees) {
            alert('Nom, prix et limite employés sont requis');
            return;
        }

        setSaving(true);
        try {
            if (editingPlan) {
                // Update (can't change stripePriceId or price)
                await axios.put(`/admin/plans/${editingPlan.id}`, {
                    name: form.name,
                    description: form.description || null,
                    maxEmployees: parseInt(form.maxEmployees),
                    features: form.features,
                    isPopular: form.isPopular,
                    isActive: form.isActive,
                    sortOrder: parseInt(form.sortOrder) || 0
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                // Create new
                if (!form.stripePriceId) {
                    alert('ID Stripe requis pour un nouveau plan');
                    setSaving(false);
                    return;
                }
                await axios.post('/admin/plans', {
                    ...form,
                    price: parseFloat(form.price),
                    maxEmployees: parseInt(form.maxEmployees),
                    sortOrder: parseInt(form.sortOrder) || 0
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }

            setShowForm(false);
            await fetchPlans();
        } catch (error: any) {
            console.error('Error saving plan:', error);
            alert(error.response?.data?.error || 'Erreur lors de la sauvegarde');
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (plan: Plan) => {
        try {
            await axios.put(`/admin/plans/${plan.id}`, {
                isActive: !plan.isActive
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchPlans();
        } catch (error) {
            console.error('Error toggling plan:', error);
        }
    };

    const deletePlan = async (plan: Plan) => {
        if (!confirm(`Supprimer le plan "${plan.name}" ? Cette action est irréversible.`)) {
            return;
        }
        try {
            await axios.delete(`/admin/plans/${plan.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchPlans();
        } catch (error) {
            console.error('Error deleting plan:', error);
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
                    <h1 className="text-2xl font-bold text-gray-900">Gestion des Plans</h1>
                    <p className="text-gray-500 mt-1">Configurez les abonnements et tarifs SaaS</p>
                </div>
                <button
                    onClick={openNewForm}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                    <Plus size={18} />
                    Nouveau Plan
                </button>
            </div>

            {/* Important Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <Info className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                    <div>
                        <p className="font-medium text-amber-900">ℹ️ Note importante</p>
                        <p className="text-sm text-amber-700 mt-1">
                            Pour changer un prix, créez d'abord le nouveau prix dans <strong>Stripe Dashboard</strong>,
                            puis ajoutez-le ici comme un nouveau Plan, et archivez l'ancien. L'ID Stripe et le prix
                            ne sont pas modifiables après création pour maintenir la cohérence avec Stripe.
                        </p>
                    </div>
                </div>
            </div>

            {/* Plans Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Ordre</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Nom</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">ID Stripe</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Prix</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Limite</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Badges</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Statut</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {plans.map((plan) => (
                            <tr key={plan.id} className={`hover:bg-gray-50 ${!plan.isActive ? 'opacity-50' : ''}`}>
                                <td className="px-4 py-3 text-sm text-gray-500">
                                    {plan.sortOrder}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <Package className="text-gray-400" size={18} />
                                        <span className="font-medium text-gray-900">{plan.name}</span>
                                    </div>
                                    {plan.description && (
                                        <p className="text-xs text-gray-500 mt-0.5">{plan.description}</p>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                                        {plan.stripePriceId.length > 20
                                            ? plan.stripePriceId.slice(0, 20) + '...'
                                            : plan.stripePriceId}
                                    </code>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-1">
                                        <DollarSign size={14} className="text-green-600" />
                                        <span className="font-medium">{plan.price.toFixed(2)} {plan.currency}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-1">
                                        <Users size={14} className="text-blue-600" />
                                        <span>{plan.maxEmployees} empl.</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-1">
                                        {plan.isPopular && (
                                            <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                                                <Star size={12} />
                                                Populaire
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <button
                                        onClick={() => toggleActive(plan)}
                                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${plan.isActive
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-500'
                                            }`}
                                    >
                                        {plan.isActive ? <Check size={12} /> : <X size={12} />}
                                        {plan.isActive ? 'Actif' : 'Archivé'}
                                    </button>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => openEditForm(plan)}
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                            title="Modifier"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            onClick={() => toggleActive(plan)}
                                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded"
                                            title={plan.isActive ? 'Archiver' : 'Réactiver'}
                                        >
                                            <Archive size={16} />
                                        </button>
                                        <button
                                            onClick={() => deletePlan(plan)}
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                            title="Supprimer"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {plans.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                    Aucun plan configuré. Cliquez sur "Nouveau Plan" pour en créer un.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal Form */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-900">
                                {editingPlan ? `Modifier: ${editingPlan.name}` : 'Nouveau Plan'}
                            </h2>
                            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Stripe Price ID */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    ID Stripe (price_...) *
                                </label>
                                <input
                                    type="text"
                                    value={form.stripePriceId}
                                    onChange={(e) => setForm({ ...form, stripePriceId: e.target.value })}
                                    disabled={!!editingPlan}
                                    placeholder="price_1MqQs..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                                />
                                {editingPlan && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        🔒 L'ID Stripe n'est pas modifiable après création
                                    </p>
                                )}
                            </div>

                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nom du plan *
                                </label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="ex: Medium"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <input
                                    type="text"
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="ex: Pour les PME en croissance"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>

                            {/* Price & Currency */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Prix (affichage) *
                                    </label>
                                    <input
                                        type="number"
                                        value={form.price}
                                        onChange={(e) => setForm({ ...form, price: e.target.value })}
                                        disabled={!!editingPlan}
                                        placeholder="99.00"
                                        step="0.01"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Devise
                                    </label>
                                    <select
                                        value={form.currency}
                                        onChange={(e) => setForm({ ...form, currency: e.target.value })}
                                        disabled={!!editingPlan}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                                    >
                                        <option value="EUR">EUR</option>
                                        <option value="USD">USD</option>
                                        <option value="XAF">XAF</option>
                                    </select>
                                </div>
                            </div>

                            {/* Max Employees & Sort Order */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Limite employés *
                                    </label>
                                    <input
                                        type="number"
                                        value={form.maxEmployees}
                                        onChange={(e) => setForm({ ...form, maxEmployees: e.target.value })}
                                        placeholder="20"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Ordre d'affichage
                                    </label>
                                    <input
                                        type="number"
                                        value={form.sortOrder}
                                        onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                                        placeholder="1"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                            </div>

                            {/* Features */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Features (séparées par des virgules)
                                </label>
                                <textarea
                                    value={form.features}
                                    onChange={(e) => setForm({ ...form, features: e.target.value })}
                                    placeholder="Feature 1, Feature 2, Feature 3..."
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                                />
                            </div>

                            {/* Toggles */}
                            <div className="flex items-center gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.isPopular}
                                        onChange={(e) => setForm({ ...form, isPopular: e.target.checked })}
                                        className="w-4 h-4 text-yellow-600 rounded"
                                    />
                                    <span className="text-sm text-gray-700">⭐ Populaire (badge)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.isActive}
                                        onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                                        className="w-4 h-4 text-green-600 rounded"
                                    />
                                    <span className="text-sm text-gray-700">✅ Actif sur le site</span>
                                </label>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={savePlan}
                                disabled={saving}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {editingPlan ? 'Mettre à jour' : 'Créer le plan'}
                            </button>
                            <button
                                onClick={() => setShowForm(false)}
                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg"
                            >
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
