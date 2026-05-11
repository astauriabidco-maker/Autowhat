import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import {
    RefreshCw, Plus, Search, Edit3, Trash2, X, Check,
    CalendarClock, User, Building2, SquareStack,
    Pause, Play, Zap, Clock, ChevronRight
} from 'lucide-react';
import { getErrorMessage } from '../../utils/errors';

interface RecurringIntervention {
    id: string;
    title: string;
    description?: string;
    frequency: string;
    intervalValue: number;
    dayOfWeek?: number | null;
    dayOfMonth?: number | null;
    preferredTime: string;
    startDate: string;
    endDate?: string | null;
    nextOccurrence?: string | null;
    lastGenerated?: string | null;
    isActive: boolean;
    autoAssign: boolean;
    interventionTypeId?: string | null;
    interventionType?: { id: string; name: string; color: string } | null;
    customerId: string;
    customer: { id: string; companyName: string; contactName: string };
    customerSiteId?: string | null;
    customerSite?: { id: string; name: string } | null;
    employeeId: string;
    employee: { id: string; name: string };
    _count?: { interventions: number };
}

interface Employee { id: string; name: string; phoneNumber: string }
interface Customer { id: string; companyName: string; contactName: string }
interface IntType { id: string; name: string; color: string; icon?: string | null; defaultDuration: number }

const FREQUENCIES = [
    { value: 'DAILY', label: 'Quotidien' },
    { value: 'WEEKLY', label: 'Hebdomadaire' },
    { value: 'BIWEEKLY', label: 'Bi-hebdomadaire' },
    { value: 'MONTHLY', label: 'Mensuel' },
    { value: 'QUARTERLY', label: 'Trimestriel' },
    { value: 'BIANNUAL', label: 'Semestriel' },
    { value: 'ANNUAL', label: 'Annuel' },
];

const DAYS_OF_WEEK = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const emptyForm = {
    title: '', description: '', frequency: 'MONTHLY', intervalValue: '1',
    dayOfWeek: '', dayOfMonth: '', preferredTime: '09:00',
    startDate: '', endDate: '', autoAssign: true,
    interventionTypeId: '', customerId: '', customerSiteId: '', employeeId: '',
};

export default function Recurring() {
    const [items, setItems] = useState<RecurringIntervention[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterActive, setFilterActive] = useState('ALL');
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState<string | null>(null);

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [types, setTypes] = useState<IntType[]>([]);

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        try {
            setLoading(true);
            const [recRes, empRes, custRes, typeRes] = await Promise.all([
                axios.get('/api/recurring-interventions', { headers }),
                axios.get('/api/employees', { headers }),
                axios.get('/api/customers', { headers }),
                axios.get('/api/intervention-types', { headers }),
            ]);
            setItems(recRes.data);
            setEmployees(empRes.data);
            setCustomers(custRes.data);
            setTypes(typeRes.data);
        } catch (e) { console.error('Error', e); }
        finally { setLoading(false); }
    };

    const filtered = useMemo(() => {
        return items.filter(r => {
            const matchSearch = !search ||
                r.title.toLowerCase().includes(search.toLowerCase()) ||
                r.customer.companyName.toLowerCase().includes(search.toLowerCase());
            const matchActive = filterActive === 'ALL' ||
                (filterActive === 'ACTIVE' && r.isActive) ||
                (filterActive === 'INACTIVE' && !r.isActive);
            return matchSearch && matchActive;
        });
    }, [items, search, filterActive]);

    const stats = useMemo(() => {
        const total = items.length;
        const active = items.filter(r => r.isActive).length;
        const inactive = items.filter(r => !r.isActive).length;
        const totalGenerated = items.reduce((s, r) => s + (r._count?.interventions || 0), 0);
        return { total, active, inactive, totalGenerated };
    }, [items]);

    const openCreate = () => {
        setForm(emptyForm);
        setEditingId(null);
        setShowModal(true);
    };

    const openEdit = (r: RecurringIntervention) => {
        setForm({
            title: r.title, description: r.description || '',
            frequency: r.frequency, intervalValue: String(r.intervalValue),
            dayOfWeek: r.dayOfWeek !== null && r.dayOfWeek !== undefined ? String(r.dayOfWeek) : '',
            dayOfMonth: r.dayOfMonth !== null && r.dayOfMonth !== undefined ? String(r.dayOfMonth) : '',
            preferredTime: r.preferredTime,
            startDate: r.startDate ? format(new Date(r.startDate), "yyyy-MM-dd'T'HH:mm") : '',
            endDate: r.endDate ? format(new Date(r.endDate), "yyyy-MM-dd'T'HH:mm") : '',
            autoAssign: r.autoAssign,
            interventionTypeId: r.interventionTypeId || '',
            customerId: r.customerId,
            customerSiteId: r.customerSiteId || '',
            employeeId: r.employeeId,
        });
        setEditingId(r.id);
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.title || !form.customerId || !form.employeeId || !form.startDate) return;
        setSaving(true);
        try {
            const payload = {
                ...form,
                intervalValue: parseInt(form.intervalValue) || 1,
                dayOfWeek: form.dayOfWeek !== '' ? parseInt(form.dayOfWeek) : null,
                dayOfMonth: form.dayOfMonth !== '' ? parseInt(form.dayOfMonth) : null,
                startDate: new Date(form.startDate).toISOString(),
                endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
                interventionTypeId: form.interventionTypeId || null,
                customerSiteId: form.customerSiteId || null,
            };
            if (editingId) {
                await axios.put(`/api/recurring-interventions/${editingId}`, payload, { headers });
            } else {
                await axios.post('/api/recurring-interventions', payload, { headers });
            }
            setShowModal(false);
            fetchAll();
        } catch (e: unknown) {
            alert(getErrorMessage(e, 'Erreur'));
        } finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Supprimer cette récurrence ?')) return;
        try {
            await axios.delete(`/api/recurring-interventions/${id}`, { headers });
            fetchAll();
        } catch (e) { console.error(e); }
    };

    const handleGenerate = async (id: string) => {
        setGenerating(id);
        try {
            await axios.post(`/api/recurring-interventions/${id}/generate`, {}, { headers });
            fetchAll();
        } catch (e: unknown) {
            alert(getErrorMessage(e, 'Erreur'));
        } finally { setGenerating(null); }
    };

    const handleToggleActive = async (r: RecurringIntervention) => {
        try {
            await axios.put(`/api/recurring-interventions/${r.id}`, { isActive: !r.isActive }, { headers });
            fetchAll();
        } catch (e) { console.error(e); }
    };

    const getFreqLabel = (freq: string) => FREQUENCIES.find(f => f.value === freq)?.label || freq;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <RefreshCw className="text-blue-600" size={28} />
                        Récurrences
                    </h2>
                    <p className="text-gray-500 mt-1">Interventions récurrentes planifiées automatiquement</p>
                </div>
                <button onClick={openCreate}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-blue-200 transition-all duration-300"
                >
                    <Plus size={18} /> Nouvelle récurrence
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total', value: stats.total, icon: <SquareStack size={20} />, color: 'from-blue-500 to-indigo-500' },
                    { label: 'Actives', value: stats.active, icon: <Play size={20} />, color: 'from-green-500 to-emerald-500' },
                    { label: 'Inactives', value: stats.inactive, icon: <Pause size={20} />, color: 'from-gray-400 to-gray-500' },
                    { label: 'Interventions générées', value: stats.totalGenerated, icon: <Zap size={20} />, color: 'from-purple-500 to-pink-500' },
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
                    <input type="text" placeholder="Rechercher..."
                        value={search} onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                <select value={filterActive} onChange={(e) => setFilterActive(e.target.value)}
                    className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="ALL">Toutes</option>
                    <option value="ACTIVE">Actives</option>
                    <option value="INACTIVE">Inactives</option>
                </select>
            </div>

            {/* List */}
            {loading ? (
                <div className="text-center py-20 text-gray-400">Chargement...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20">
                    <RefreshCw size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">Aucune récurrence trouvée</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((r) => (
                        <div key={r.id} className={`bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg transition-all duration-300 ${!r.isActive ? 'opacity-60' : ''}`}>
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="font-semibold text-gray-900">{r.title}</h3>
                                        {r.interventionType && (
                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                                                style={{ backgroundColor: r.interventionType.color + '20', color: r.interventionType.color }}
                                            >{r.interventionType.name}</span>
                                        )}
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${r.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                                            {r.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                        <span className="flex items-center gap-1.5"><CalendarClock size={14} /> {getFreqLabel(r.frequency)} {r.intervalValue > 1 ? `(x${r.intervalValue})` : ''}</span>
                                        <span className="flex items-center gap-1.5"><Clock size={14} /> {r.preferredTime}</span>
                                        <span className="flex items-center gap-1.5"><Building2 size={14} /> {r.customer.companyName}</span>
                                        <span className="flex items-center gap-1.5"><User size={14} /> {r.employee.name}</span>
                                        <span className="flex items-center gap-1.5"><Zap size={14} /> {r._count?.interventions || 0} générées</span>
                                    </div>
                                    {r.nextOccurrence && (
                                        <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                                            <ChevronRight size={12} /> Prochaine : {format(new Date(r.nextOccurrence), 'dd/MM/yyyy HH:mm')}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 ml-4">
                                    {r.isActive && (
                                        <button onClick={() => handleGenerate(r.id)} disabled={generating === r.id}
                                            className="p-2 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition"
                                            title="Générer maintenant">
                                            {generating === r.id ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                                        </button>
                                    )}
                                    <button onClick={() => handleToggleActive(r)}
                                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
                                        title={r.isActive ? 'Désactiver' : 'Activer'}>
                                        {r.isActive ? <Pause size={16} /> : <Play size={16} />}
                                    </button>
                                    <button onClick={() => openEdit(r)} className="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition"><Edit3 size={16} /></button>
                                    <button onClick={() => handleDelete(r.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">{editingId ? 'Modifier la récurrence' : 'Nouvelle récurrence'}</h3>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" placeholder="Maintenance climatisation" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 resize-none" />
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
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Technicien *</label>
                                    <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
                                        <option value="">Sélectionner...</option>
                                        {employees.map(e => <option key={e.id} value={e.id}>{e.name || e.phoneNumber}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Type d'intervention</label>
                                <select value={form.interventionTypeId} onChange={(e) => setForm({ ...form, interventionTypeId: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
                                    <option value="">Aucun</option>
                                    {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fréquence *</label>
                                    <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
                                        {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Intervalle</label>
                                    <input type="number" min={1} value={form.intervalValue} onChange={(e) => setForm({ ...form, intervalValue: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Heure</label>
                                    <input type="time" value={form.preferredTime} onChange={(e) => setForm({ ...form, preferredTime: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>
                            {(form.frequency === 'WEEKLY' || form.frequency === 'BIWEEKLY') && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Jour de la semaine</label>
                                    <select value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
                                        <option value="">Auto</option>
                                        {DAYS_OF_WEEK.map((d, i) => <option key={i} value={i}>{d}</option>)}
                                    </select>
                                </div>
                            )}
                            {['MONTHLY', 'QUARTERLY', 'BIANNUAL', 'ANNUAL'].includes(form.frequency) && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Jour du mois</label>
                                    <input type="number" min={1} max={31} value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" placeholder="1-31" />
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date de début *</label>
                                    <input type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
                                    <input type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
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
        </div>
    );
}
