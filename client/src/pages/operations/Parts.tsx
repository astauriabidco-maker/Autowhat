import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
    Package, Plus, Search, Edit3, Trash2, X, AlertTriangle,
    ArrowUpDown, Check, Box, TrendingDown, DollarSign,
    BarChart3
} from 'lucide-react';
import { getErrorMessage } from '../../utils/errors';

interface Part {
    id: string;
    reference: string;
    name: string;
    description?: string;
    category: string;
    unitPrice: number;
    costPrice: number;
    stockQuantity: number;
    minStock: number;
    unit: string;
    isActive: boolean;
    _count?: { interventionParts: number };
    createdAt: string;
}

const CATEGORIES = [
    { value: 'GENERAL', label: 'Général', color: '#64748b' },
    { value: 'PLUMBING', label: 'Plomberie', color: '#3b82f6' },
    { value: 'ELECTRICAL', label: 'Électricité', color: '#f59e0b' },
    { value: 'HVAC', label: 'CVC', color: '#06b6d4' },
    { value: 'OTHER', label: 'Autre', color: '#8b5cf6' },
];

const UNITS = ['pce', 'm', 'm²', 'kg', 'L', 'forfait'];

const emptyForm = {
    reference: '', name: '', description: '', category: 'GENERAL',
    unitPrice: '', costPrice: '', stockQuantity: '', minStock: '', unit: 'pce',
};

export default function Parts() {
    const [parts, setParts] = useState<Part[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [filterLowStock, setFilterLowStock] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [showStockModal, setShowStockModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [stockAdjust, setStockAdjust] = useState({ partId: '', partName: '', adjustment: '', reason: '' });
    const [saving, setSaving] = useState(false);

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => { fetchParts(); }, []);

    const fetchParts = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/parts', { headers });
            setParts(res.data);
        } catch (e) { console.error('Error', e); }
        finally { setLoading(false); }
    };

    const filtered = useMemo(() => {
        return parts.filter(p => {
            const matchSearch = !search ||
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                p.reference.toLowerCase().includes(search.toLowerCase());
            const matchCategory = filterCategory === 'ALL' || p.category === filterCategory;
            const matchLowStock = !filterLowStock || (p.stockQuantity <= p.minStock && p.minStock > 0);
            return matchSearch && matchCategory && matchLowStock;
        });
    }, [parts, search, filterCategory, filterLowStock]);

    const stats = useMemo(() => {
        const total = parts.length;
        const lowStock = parts.filter(p => p.stockQuantity <= p.minStock && p.minStock > 0).length;
        const totalValue = parts.reduce((s, p) => s + p.unitPrice * p.stockQuantity, 0);
        const totalUsed = parts.reduce((s, p) => s + (p._count?.interventionParts || 0), 0);
        return { total, lowStock, totalValue, totalUsed };
    }, [parts]);

    const openCreate = () => {
        setForm(emptyForm);
        setEditingId(null);
        setShowModal(true);
    };

    const openEdit = (part: Part) => {
        setForm({
            reference: part.reference, name: part.name, description: part.description || '',
            category: part.category, unitPrice: String(part.unitPrice), costPrice: String(part.costPrice),
            stockQuantity: String(part.stockQuantity), minStock: String(part.minStock), unit: part.unit,
        });
        setEditingId(part.id);
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.reference || !form.name) return;
        setSaving(true);
        try {
            const payload = {
                ...form,
                unitPrice: parseFloat(form.unitPrice) || 0,
                costPrice: parseFloat(form.costPrice) || 0,
                stockQuantity: parseInt(form.stockQuantity) || 0,
                minStock: parseInt(form.minStock) || 0,
            };
            if (editingId) {
                await axios.put(`/api/parts/${editingId}`, payload, { headers });
            } else {
                await axios.post('/api/parts', payload, { headers });
            }
            setShowModal(false);
            fetchParts();
        } catch (e: unknown) {
            alert(getErrorMessage(e, 'Erreur'));
        } finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Supprimer cette pièce ?')) return;
        try {
            await axios.delete(`/api/parts/${id}`, { headers });
            fetchParts();
        } catch (e) { console.error(e); }
    };

    const openStockAdjust = (part: Part) => {
        setStockAdjust({ partId: part.id, partName: part.name, adjustment: '', reason: '' });
        setShowStockModal(true);
    };

    const handleStockAdjust = async () => {
        if (!stockAdjust.adjustment) return;
        setSaving(true);
        try {
            await axios.patch(`/api/parts/${stockAdjust.partId}/stock`, {
                adjustment: parseInt(stockAdjust.adjustment),
                reason: stockAdjust.reason,
            }, { headers });
            setShowStockModal(false);
            fetchParts();
        } catch (e: unknown) {
            alert(getErrorMessage(e, 'Erreur'));
        } finally { setSaving(false); }
    };

    const getCategoryInfo = (cat: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[0];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Package className="text-blue-600" size={28} />
                        Pièces & Matériel
                    </h2>
                    <p className="text-gray-500 mt-1">Gestion du stock, tarifs et consommation</p>
                </div>
                <button onClick={openCreate}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-blue-200 transition-all duration-300"
                >
                    <Plus size={18} /> Nouvelle pièce
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total pièces', value: stats.total, icon: <Box size={20} />, color: 'from-blue-500 to-indigo-500' },
                    { label: 'Stock bas', value: stats.lowStock, icon: <TrendingDown size={20} />, color: stats.lowStock > 0 ? 'from-red-500 to-rose-500' : 'from-green-500 to-emerald-500' },
                    { label: 'Valeur stock', value: `${stats.totalValue.toFixed(0)}€`, icon: <DollarSign size={20} />, color: 'from-amber-500 to-orange-500' },
                    { label: 'Utilisations', value: stats.totalUsed, icon: <BarChart3 size={20} />, color: 'from-purple-500 to-pink-500' },
                ].map((s, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">{s.label}</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
                            </div>
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white`}>
                                {s.icon}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Rechercher par nom ou référence..."
                        value={search} onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    <option value="ALL">Toutes catégories</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <button onClick={() => setFilterLowStock(!filterLowStock)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${filterLowStock ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                    <AlertTriangle size={16} /> Stock bas
                </button>
            </div>

            {/* Table */}
            {loading ? (
                <div className="text-center py-20 text-gray-400">Chargement...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20">
                    <Package size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">Aucune pièce trouvée</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Référence</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Désignation</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Catégorie</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Prix HT</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Utilisations</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((p) => {
                                const isLow = p.minStock > 0 && p.stockQuantity <= p.minStock;
                                const cat = getCategoryInfo(p.category);
                                return (
                                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                                        <td className="py-3 px-4">
                                            <span className="font-mono text-sm font-medium text-gray-900">{p.reference}</span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <p className="font-medium text-gray-900 text-sm">{p.name}</p>
                                            {p.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{p.description}</p>}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                                                style={{ backgroundColor: cat.color + '20', color: cat.color }}
                                            >{cat.label}</span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <span className="text-sm font-semibold text-gray-900">{p.unitPrice.toFixed(2)}€</span>
                                            <span className="text-xs text-gray-400 ml-1">/{p.unit}</span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <button onClick={() => openStockAdjust(p)}
                                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-bold transition hover:shadow ${isLow ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                                            >
                                                {isLow && <AlertTriangle size={14} />}
                                                {p.stockQuantity}
                                                <ArrowUpDown size={12} className="text-gray-400 ml-1" />
                                            </button>
                                            {p.minStock > 0 && <p className="text-xs text-gray-400 mt-0.5">min: {p.minStock}</p>}
                                        </td>
                                        <td className="py-3 px-4 text-center text-sm text-gray-500">
                                            {p._count?.interventionParts || 0}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition"><Edit3 size={16} /></button>
                                                <button onClick={() => handleDelete(p.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">{editingId ? 'Modifier la pièce' : 'Nouvelle pièce'}</h3>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Référence *</label>
                                    <input type="text" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" placeholder="PLB-001" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
                                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" placeholder="Joint torique 32mm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 resize-none" />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Prix vente HT</label>
                                    <input type="number" step="0.01" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Prix achat</label>
                                    <input type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Unité</label>
                                    <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
                                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Stock initial</label>
                                    <input type="number" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" placeholder="0" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Seuil alerte</label>
                                    <input type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" placeholder="0" />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
                            <button onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
                            <button onClick={handleSave} disabled={saving}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:shadow-lg disabled:opacity-50">
                                <Check size={16} /> {saving ? 'En cours...' : editingId ? 'Modifier' : 'Créer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Stock Adjustment Modal */}
            {showStockModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">Ajuster le stock</h3>
                            <button onClick={() => setShowStockModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-600">Pièce : <strong>{stockAdjust.partName}</strong></p>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ajustement (+ ou -)</label>
                                <input type="number" value={stockAdjust.adjustment}
                                    onChange={(e) => setStockAdjust({ ...stockAdjust, adjustment: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                                    placeholder="ex: +5 ou -3" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Raison (optionnel)</label>
                                <input type="text" value={stockAdjust.reason}
                                    onChange={(e) => setStockAdjust({ ...stockAdjust, reason: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                                    placeholder="Réapprovisionnement..." />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
                            <button onClick={() => setShowStockModal(false)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
                            <button onClick={handleStockAdjust} disabled={saving}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:shadow-lg disabled:opacity-50">
                                <Check size={16} /> {saving ? 'En cours...' : 'Appliquer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
