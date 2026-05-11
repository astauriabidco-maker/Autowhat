import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import {
    FileSpreadsheet, Plus, Search, Edit3, Trash2, X, Check,
    Building2, Calendar, DollarSign, ArrowRight, Download,
    FileText, ChevronDown, ChevronUp,
    Clock, CheckCircle2, TrendingUp
} from 'lucide-react';
import { getErrorMessage } from '../../utils/errors';

interface QuoteLineItem {
    id?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    partId?: string | null;
    part?: { id: string; name: string; reference: string } | null;
}

interface Quote {
    id: string;
    quoteNumber: string;
    title: string;
    status: string;
    customerId: string;
    customer: { id: string; companyName: string; contactName: string };
    customerSiteId?: string | null;
    customerSite?: { id: string; name: string } | null;
    validUntil?: string | null;
    notes?: string | null;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    discount: number;
    totalAmount: number;
    lineItems: QuoteLineItem[];
    interventionId?: string | null;
    createdAt: string;
}

interface Customer { id: string; companyName: string; contactName: string; sites?: { id: string; name: string }[] }
interface Part { id: string; name: string; reference: string; unitPrice: number }

const STATUS_BADGE: Record<string, { color: string; bg: string; label: string }> = {
    DRAFT: { color: '#64748b', bg: '#f1f5f9', label: 'Brouillon' },
    SENT: { color: '#1d4ed8', bg: '#dbeafe', label: 'Envoyé' },
    ACCEPTED: { color: '#15803d', bg: '#dcfce7', label: 'Accepté' },
    REJECTED: { color: '#b91c1c', bg: '#fee2e2', label: 'Refusé' },
    EXPIRED: { color: '#92400e', bg: '#fef3c7', label: 'Expiré' },
    CONVERTED: { color: '#7c3aed', bg: '#ede9fe', label: 'Converti' },
};

const emptyLine: QuoteLineItem = { description: '', quantity: 1, unitPrice: 0, totalPrice: 0, partId: null };
const emptyForm = {
    title: '', customerId: '', customerSiteId: '', validUntil: '',
    notes: '', taxRate: '20', discount: '0', status: 'DRAFT',
};

export default function Quotes() {
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [lines, setLines] = useState<QuoteLineItem[]>([{ ...emptyLine }]);
    const [saving, setSaving] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [parts, setParts] = useState<Part[]>([]);

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        try {
            setLoading(true);
            const [qRes, cRes, pRes] = await Promise.all([
                axios.get('/api/quotes', { headers }),
                axios.get('/api/customers', { headers }),
                axios.get('/api/parts', { headers }).catch(() => ({ data: [] })),
            ]);
            setQuotes(qRes.data);
            setCustomers(cRes.data);
            setParts(pRes.data);
        } catch (e) { console.error('Error', e); }
        finally { setLoading(false); }
    };

    const filtered = useMemo(() => {
        return quotes.filter(q => {
            const matchSearch = !search ||
                q.title.toLowerCase().includes(search.toLowerCase()) ||
                q.quoteNumber.toLowerCase().includes(search.toLowerCase()) ||
                q.customer.companyName.toLowerCase().includes(search.toLowerCase());
            const matchStatus = filterStatus === 'ALL' || q.status === filterStatus;
            return matchSearch && matchStatus;
        });
    }, [quotes, search, filterStatus]);

    const stats = useMemo(() => {
        const total = quotes.length;
        const draft = quotes.filter(q => q.status === 'DRAFT').length;
        const accepted = quotes.filter(q => q.status === 'ACCEPTED').length;
        const totalAmount = quotes.filter(q => q.status !== 'REJECTED' && q.status !== 'EXPIRED')
            .reduce((s, q) => s + q.totalAmount, 0);
        return { total, draft, accepted, totalAmount };
    }, [quotes]);

    const openCreate = () => {
        setForm(emptyForm);
        setLines([{ ...emptyLine }]);
        setEditingId(null);
        setShowModal(true);
    };

    const openEdit = async (id: string) => {
        try {
            const res = await axios.get(`/api/quotes/${id}`, { headers });
            const q: Quote = res.data;
            setForm({
                title: q.title, customerId: q.customerId,
                customerSiteId: q.customerSiteId || '',
                validUntil: q.validUntil ? format(new Date(q.validUntil), 'yyyy-MM-dd') : '',
                notes: q.notes || '', taxRate: String(q.taxRate),
                discount: String(q.discount), status: q.status,
            });
            setLines(q.lineItems.length > 0 ? q.lineItems : [{ ...emptyLine }]);
            setEditingId(id);
            setShowModal(true);
        } catch (e) { console.error(e); }
    };

    const updateLine = <K extends keyof QuoteLineItem>(idx: number, field: K, value: QuoteLineItem[K]) => {
        const updated = [...lines];
        updated[idx] = { ...updated[idx], [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
            updated[idx].totalPrice = (updated[idx].quantity || 0) * (updated[idx].unitPrice || 0);
        }
        if (field === 'partId' && value) {
            const part = parts.find(p => p.id === value);
            if (part) {
                updated[idx].unitPrice = part.unitPrice;
                updated[idx].description = updated[idx].description || part.name;
                updated[idx].totalPrice = (updated[idx].quantity || 1) * part.unitPrice;
            }
        }
        setLines(updated);
    };

    const addLine = () => setLines([...lines, { ...emptyLine }]);
    const removeLine = (idx: number) => {
        if (lines.length <= 1) return;
        setLines(lines.filter((_, i) => i !== idx));
    };

    const lineSubtotal = useMemo(() => lines.reduce((s, l) => s + (l.totalPrice || 0), 0), [lines]);
    const taxAmt = useMemo(() => lineSubtotal * (parseFloat(form.taxRate) || 0) / 100, [lineSubtotal, form.taxRate]);
    const discountAmt = useMemo(() => parseFloat(form.discount) || 0, [form.discount]);
    const total = useMemo(() => lineSubtotal + taxAmt - discountAmt, [lineSubtotal, taxAmt, discountAmt]);

    const handleSave = async () => {
        if (!form.title || !form.customerId || lines.every(l => !l.description)) return;
        setSaving(true);
        try {
            const payload = {
                ...form,
                taxRate: parseFloat(form.taxRate) || 0,
                discount: parseFloat(form.discount) || 0,
                validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : null,
                customerSiteId: form.customerSiteId || null,
                lineItems: lines.filter(l => l.description).map(l => ({
                    description: l.description,
                    quantity: l.quantity || 1,
                    unitPrice: l.unitPrice || 0,
                    partId: l.partId || null,
                })),
            };
            if (editingId) {
                await axios.put(`/api/quotes/${editingId}`, payload, { headers });
            } else {
                await axios.post('/api/quotes', payload, { headers });
            }
            setShowModal(false);
            fetchAll();
        } catch (e: unknown) {
            alert(getErrorMessage(e, 'Erreur'));
        } finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Supprimer ce devis ?')) return;
        try {
            await axios.delete(`/api/quotes/${id}`, { headers });
            fetchAll();
        } catch (e) { console.error(e); }
    };

    const handleConvert = async (id: string) => {
        if (!confirm('Convertir ce devis en intervention planifiée ?')) return;
        try {
            await axios.post(`/api/quotes/${id}/convert`, {}, { headers });
            fetchAll();
        } catch (e: unknown) {
            alert(getErrorMessage(e, 'Erreur'));
        }
    };

    const downloadPdf = async (id: string) => {
        const response = await axios.get(`/api/quotes/${id}/pdf`, {
            headers,
            responseType: 'blob'
        });
        const url = URL.createObjectURL(response.data);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 30000);
    };

    const selectedCustomerSites = useMemo(() => {
        const c = customers.find(c => c.id === form.customerId);
        return c?.sites || [];
    }, [form.customerId, customers]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <FileSpreadsheet className="text-blue-600" size={28} />
                        Devis
                    </h2>
                    <p className="text-gray-500 mt-1">Création et suivi des devis clients</p>
                </div>
                <button onClick={openCreate}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-blue-200 transition-all duration-300"
                >
                    <Plus size={18} /> Nouveau devis
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total devis', value: stats.total, icon: <FileText size={20} />, color: 'from-blue-500 to-indigo-500' },
                    { label: 'Brouillons', value: stats.draft, icon: <Clock size={20} />, color: 'from-amber-500 to-orange-500' },
                    { label: 'Acceptés', value: stats.accepted, icon: <CheckCircle2 size={20} />, color: 'from-green-500 to-emerald-500' },
                    { label: 'Montant total', value: `${stats.totalAmount.toFixed(0)}€`, icon: <TrendingUp size={20} />, color: 'from-purple-500 to-pink-500' },
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
                    <input type="text" placeholder="Rechercher par titre, n° ou client..."
                        value={search} onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="ALL">Tous les statuts</option>
                    {Object.entries(STATUS_BADGE).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                    ))}
                </select>
            </div>

            {/* List */}
            {loading ? (
                <div className="text-center py-20 text-gray-400">Chargement...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20">
                    <FileSpreadsheet size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">Aucun devis trouvé</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((q) => (
                        <div key={q.id} className="bg-white rounded-2xl border border-gray-100 hover:shadow-lg transition-all duration-300 overflow-hidden">
                            <div className="p-5">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1" >
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="font-mono text-xs text-gray-400">{q.quoteNumber}</span>
                                            <h3 className="font-semibold text-gray-900">{q.title}</h3>
                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                                                style={{ backgroundColor: STATUS_BADGE[q.status]?.bg, color: STATUS_BADGE[q.status]?.color }}
                                            >{STATUS_BADGE[q.status]?.label || q.status}</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                            <span className="flex items-center gap-1.5"><Building2 size={14} /> {q.customer.companyName}</span>
                                            <span className="flex items-center gap-1.5"><Calendar size={14} /> {format(new Date(q.createdAt), 'dd/MM/yyyy')}</span>
                                            {q.validUntil && (
                                                <span className="flex items-center gap-1.5"><Clock size={14} /> Valide jusqu'au {format(new Date(q.validUntil), 'dd/MM/yyyy')}</span>
                                            )}
                                            <span className="flex items-center gap-1.5 font-semibold text-gray-900"><DollarSign size={14} /> {q.totalAmount.toFixed(2)} € TTC</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 ml-4">
                                        <button onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition">
                                            {expandedId === q.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </button>
                                        {q.status === 'ACCEPTED' && !q.interventionId && (
                                            <button onClick={() => handleConvert(q.id)}
                                                className="p-2 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition" title="Convertir en intervention">
                                                <ArrowRight size={16} />
                                            </button>
                                        )}
                                        <button onClick={() => downloadPdf(q.id)}
                                            className="p-2 rounded-lg hover:bg-purple-50 text-gray-400 hover:text-purple-600 transition" title="Télécharger PDF">
                                            <Download size={16} />
                                        </button>
                                        <button onClick={() => openEdit(q.id)} className="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition"><Edit3 size={16} /></button>
                                        <button onClick={() => handleDelete(q.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded details */}
                            {expandedId === q.id && (
                                <div className="border-t border-gray-100 bg-gray-50/50 p-5">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-200">
                                                <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Description</th>
                                                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Qté</th>
                                                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Prix unit.</th>
                                                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {q.lineItems.map((l, idx) => (
                                                <tr key={idx} className="border-b border-gray-100">
                                                    <td className="py-2 text-gray-700">{l.description}</td>
                                                    <td className="py-2 text-right text-gray-600">{l.quantity}</td>
                                                    <td className="py-2 text-right text-gray-600">{l.unitPrice.toFixed(2)}€</td>
                                                    <td className="py-2 text-right font-medium text-gray-900">{l.totalPrice.toFixed(2)}€</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t border-gray-200">
                                                <td colSpan={3} className="py-2 text-right text-gray-500">Sous-total HT</td>
                                                <td className="py-2 text-right font-medium">{q.subtotal.toFixed(2)}€</td>
                                            </tr>
                                            <tr>
                                                <td colSpan={3} className="py-1 text-right text-gray-500">TVA ({q.taxRate}%)</td>
                                                <td className="py-1 text-right">{q.taxAmount.toFixed(2)}€</td>
                                            </tr>
                                            {q.discount > 0 && (
                                                <tr>
                                                    <td colSpan={3} className="py-1 text-right text-gray-500">Remise</td>
                                                    <td className="py-1 text-right text-red-500">-{q.discount.toFixed(2)}€</td>
                                                </tr>
                                            )}
                                            <tr className="border-t border-gray-300">
                                                <td colSpan={3} className="py-2 text-right font-bold text-gray-900">Total TTC</td>
                                                <td className="py-2 text-right font-bold text-lg text-gray-900">{q.totalAmount.toFixed(2)}€</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                    {q.notes && (
                                        <p className="mt-3 text-xs text-gray-500 italic">Notes : {q.notes}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">{editingId ? 'Modifier le devis' : 'Nouveau devis'}</h3>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" placeholder="Devis maintenance annuelle" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
                                    <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value, customerSiteId: '' })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
                                        <option value="">Sélectionner...</option>
                                        {customers.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Site</label>
                                    <select value={form.customerSiteId} onChange={(e) => setForm({ ...form, customerSiteId: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
                                        <option value="">Aucun</option>
                                        {selectedCustomerSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
                                        {Object.entries(STATUS_BADGE).map(([key, val]) => (
                                            <option key={key} value={key}>{val.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Valide jusqu'au</label>
                                    <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>

                            {/* Line Items */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-gray-700">Lignes du devis</label>
                                    <button onClick={addLine} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                                        <Plus size={14} /> Ajouter une ligne
                                    </button>
                                </div>
                                <div className="space-y-2 bg-gray-50 rounded-xl p-3">
                                    {lines.map((line, idx) => (
                                        <div key={idx} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-gray-100">
                                            {parts.length > 0 && (
                                                <select value={line.partId || ''} onChange={(e) => updateLine(idx, 'partId', e.target.value || null)}
                                                    className="w-28 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500">
                                                    <option value="">— Pièce</option>
                                                    {parts.map(p => <option key={p.id} value={p.id}>{p.reference}</option>)}
                                                </select>
                                            )}
                                            <input type="text" value={line.description} onChange={(e) => updateLine(idx, 'description', e.target.value)}
                                                className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500" placeholder="Description" />
                                            <input type="number" value={line.quantity || ''} onChange={(e) => updateLine(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                                className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-right focus:ring-1 focus:ring-blue-500" placeholder="Qté" />
                                            <input type="number" step="0.01" value={line.unitPrice || ''} onChange={(e) => updateLine(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-right focus:ring-1 focus:ring-blue-500" placeholder="P.U." />
                                            <span className="w-20 text-xs font-semibold text-gray-700 text-right">{(line.totalPrice || 0).toFixed(2)}€</span>
                                            <button onClick={() => removeLine(idx)} className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Totals */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">TVA (%)</label>
                                    <input type="number" step="0.1" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Remise (€)</label>
                                    <input type="number" step="0.01" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div className="flex flex-col justify-end">
                                    <p className="text-xs text-gray-500">Sous-total: {lineSubtotal.toFixed(2)}€</p>
                                    <p className="text-xs text-gray-500">TVA: {taxAmt.toFixed(2)}€</p>
                                    <p className="text-lg font-bold text-gray-900">Total: {total.toFixed(2)}€</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 resize-none" />
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
        </div>
    );
}
