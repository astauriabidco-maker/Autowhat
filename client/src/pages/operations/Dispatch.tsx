import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay, addHours, addMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import {
    CalendarClock, Plus, X, Clock, MapPin, User, Building2, Tag, SquareStack,
    Filter, Send, MessageCircle, Check, Download, Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';

const locales = { fr };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), getDay, locales });
const DnDCalendar = withDragAndDrop(Calendar as any);

interface CustomerSite { id: string; name: string; isMainSite: boolean; address: string; city: string; postalCode: string; contactName?: string; accessCode?: string; }
interface Customer { id: string; companyName: string; contactName: string; address?: string; phone?: string; sites?: CustomerSite[]; }
interface Employee { id: string; name: string; phoneNumber: string; }
interface Intervention {
    id: string;
    title: string;
    description?: string;
    status: string;
    scheduledStart: string;
    scheduledEnd: string;
    realStart?: string;
    realEnd?: string;
    customer: { id: string; companyName: string; contactName: string; address?: string; phone?: string };
    customerSite?: { id: string; name: string; address: string; city: string; postalCode?: string; contactName?: string; accessCode?: string } | null;
    interventionType?: { id: string; name: string; color: string; icon?: string | null } | null;
    employee: { id: string; name: string; phoneNumber: string };
}

interface IntType { id: string; name: string; color: string; icon?: string | null; defaultDuration: number; }

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
    SCHEDULED: { bg: '#f1f5f9', border: '#94a3b8', text: '#475569', label: 'Prévu' },
    EN_ROUTE: { bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8', label: 'En route' },
    IN_PROGRESS: { bg: '#fef3c7', border: '#f59e0b', text: '#b45309', label: 'En cours' },
    COMPLETED: { bg: '#dcfce7', border: '#22c55e', text: '#15803d', label: 'Terminé' },
    CANCELED: { bg: '#fee2e2', border: '#ef4444', text: '#b91c1c', label: 'Annulé' },
};

const emptyForm = { title: '', description: '', customerId: '', customerSiteId: '', interventionTypeId: '', employeeId: '', scheduledStart: '', scheduledEnd: '' };

export default function Dispatch() {
    const [interventions, setInterventions] = useState<Intervention[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [interventionTypes, setInterventionTypes] = useState<IntType[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showDetail, setShowDetail] = useState<Intervention | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [currentView, setCurrentView] = useState<any>(Views.WEEK);

    // Filters
    const [filterEmployee, setFilterEmployee] = useState<string>('');
    const [filterType, setFilterType] = useState<string>('');
    const [filterCustomer, setFilterCustomer] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);

    // Notification state
    const [notifSending, setNotifSending] = useState<string | null>(null);
    const [notifSuccess, setNotifSuccess] = useState<string | null>(null);

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    const fetchAll = async () => {
        try {
            setLoading(true);
            const [intRes, custRes, empRes, typesRes] = await Promise.all([
                axios.get('/api/interventions', { headers }),
                axios.get('/api/customers', { headers }),
                axios.get('/api/employees', { headers }),
                axios.get('/api/intervention-types', { headers }),
            ]);
            setInterventions(Array.isArray(intRes.data) ? intRes.data : []);
            const custData = Array.isArray(custRes.data) ? custRes.data : [];
            setCustomers(custData);
            setEmployees(Array.isArray(empRes.data) ? empRes.data : empRes.data?.employees || []);
            setInterventionTypes(Array.isArray(typesRes.data) ? typesRes.data : []);
        } catch (e) {
            console.error('Error fetching data', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    // Filtered interventions
    const filteredInterventions = useMemo(() => {
        return interventions.filter(i => {
            if (filterEmployee && i.employee.id !== filterEmployee) return false;
            if (filterType && i.interventionType?.id !== filterType) return false;
            if (filterCustomer && i.customer.id !== filterCustomer) return false;
            if (filterStatus && i.status !== filterStatus) return false;
            return true;
        });
    }, [interventions, filterEmployee, filterType, filterCustomer, filterStatus]);

    const activeFiltersCount = [filterEmployee, filterType, filterCustomer, filterStatus].filter(Boolean).length;

    const calendarEvents = useMemo(() =>
        filteredInterventions.map(i => ({
            id: i.id,
            title: `${i.title} — ${i.customer.companyName}`,
            start: new Date(i.scheduledStart),
            end: new Date(i.scheduledEnd),
            resource: i,
        })),
        [filteredInterventions]);

    const eventStyleGetter = useCallback((event: any) => {
        const status = event.resource.status;
        const colors = STATUS_COLORS[status] || STATUS_COLORS.SCHEDULED;
        const typeColor = event.resource.interventionType?.color;
        return {
            style: {
                backgroundColor: colors.bg,
                borderLeft: `4px solid ${typeColor || colors.border}`,
                color: colors.text,
                borderRadius: '8px',
                padding: '4px 8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
            },
        };
    }, []);

    // Get sites for selected customer
    const selectedCustomerSites = customers.find(c => c.id === form.customerId)?.sites || [];

    const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
        setForm({
            ...emptyForm,
            scheduledStart: format(start, "yyyy-MM-dd'T'HH:mm"),
            scheduledEnd: format(end, "yyyy-MM-dd'T'HH:mm"),
        });
        setShowModal(true);
    }, []);

    const handleSelectEvent = useCallback((event: any) => {
        setShowDetail(event.resource);
    }, []);

    // Drag & Drop handler
    const handleEventDrop = useCallback(async ({ event, start, end }: any) => {
        try {
            await axios.put(`/api/interventions/${event.id}`, {
                scheduledStart: (start as Date).toISOString(),
                scheduledEnd: (end as Date).toISOString(),
            }, { headers });
            // Optimistic update
            setInterventions(prev => prev.map(i =>
                i.id === event.id
                    ? { ...i, scheduledStart: (start as Date).toISOString(), scheduledEnd: (end as Date).toISOString() }
                    : i
            ));
        } catch (e) {
            console.error('Error moving event', e);
            fetchAll(); // Revert on error
        }
    }, []);

    // Resize handler
    const handleEventResize = useCallback(async ({ event, start, end }: any) => {
        try {
            await axios.put(`/api/interventions/${event.id}`, {
                scheduledStart: (start as Date).toISOString(),
                scheduledEnd: (end as Date).toISOString(),
            }, { headers });
            setInterventions(prev => prev.map(i =>
                i.id === event.id
                    ? { ...i, scheduledStart: (start as Date).toISOString(), scheduledEnd: (end as Date).toISOString() }
                    : i
            ));
        } catch (e) {
            console.error('Error resizing event', e);
            fetchAll();
        }
    }, []);

    const handleSave = async () => {
        if (!form.title || !form.customerId || !form.employeeId || !form.scheduledStart || !form.scheduledEnd) return;
        setSaving(true);
        try {
            await axios.post('/api/interventions', {
                ...form,
                scheduledStart: new Date(form.scheduledStart).toISOString(),
                scheduledEnd: new Date(form.scheduledEnd).toISOString(),
            }, { headers });
            setShowModal(false);
            setForm(emptyForm);
            fetchAll();
        } catch (e) {
            console.error('Error creating intervention', e);
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (id: string, status: string) => {
        try {
            await axios.patch(`/api/interventions/${id}/status`, { status }, { headers });

            // Auto-send WhatsApp notification on status change
            if (status === 'EN_ROUTE') {
                sendNotification(id, 'en_route');
            } else if (status === 'COMPLETED') {
                sendNotification(id, 'signature');
            }

            setShowDetail(null);
            fetchAll();
        } catch (e) {
            console.error('Error updating status', e);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Supprimer cette intervention ?')) return;
        try {
            await axios.delete(`/api/interventions/${id}`, { headers });
            setShowDetail(null);
            fetchAll();
        } catch (e) {
            console.error('Error deleting intervention', e);
        }
    };

    const downloadInterventionPdf = async (id: string) => {
        const response = await axios.get(`/api/interventions/${id}/pdf`, {
            headers,
            responseType: 'blob'
        });
        const url = URL.createObjectURL(response.data);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 30000);
    };

    // WhatsApp notification
    const sendNotification = async (id: string, type: string) => {
        setNotifSending(type);
        try {
            await axios.post(`/api/interventions/${id}/notify`, { type }, { headers });
            setNotifSuccess(type);
            setTimeout(() => setNotifSuccess(null), 3000);
        } catch (e) {
            console.error('Error sending notification', e);
        } finally {
            setNotifSending(null);
        }
    };

    // Stats
    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredInterventions.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1; });
        return counts;
    }, [filteredInterventions]);

    const clearFilters = () => {
        setFilterEmployee('');
        setFilterType('');
        setFilterCustomer('');
        setFilterStatus('');
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <CalendarClock className="text-blue-600" size={28} />
                        Planning Interventions
                    </h2>
                    <p className="text-gray-500 mt-1">
                        Organisez et suivez vos interventions en temps réel · Glissez-déposez pour planifier
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition font-medium text-sm border ${activeFiltersCount > 0
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                    >
                        <Filter size={16} />
                        Filtres
                        {activeFiltersCount > 0 && (
                            <span className="bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                                {activeFiltersCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => {
                            setForm({
                                ...emptyForm,
                                scheduledStart: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
                                scheduledEnd: format(addHours(new Date(), 2), "yyyy-MM-dd'T'HH:mm"),
                            }); setShowModal(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition shadow-lg shadow-blue-500/25 font-medium"
                    >
                        <Plus size={16} />
                        Nouvelle Intervention
                    </button>
                </div>
            </div>

            {/* External Platform Suggestion */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-blue-600">
                        <Zap size={20} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-blue-900">Besoin de générer un devis ou une facture pour ces interventions ?</p>
                        <p className="text-xs text-blue-700">WhatsPoint gère le flux terrain. Pour la partie administrative et financière, connectez <strong className="text-indigo-700">Helpyx</strong>.</p>
                    </div>
                </div>
                <Link 
                    to="/settings/integrations"
                    className="px-4 py-2 bg-white text-blue-600 rounded-lg text-xs font-bold border border-blue-100 hover:bg-blue-50 transition flex items-center gap-1.5 whitespace-nowrap"
                >
                    Configurer l'export
                </Link>
            </div>

            {/* Filter Bar */}
            {showFilters && (
                <div className="bg-white rounded-2xl border border-gray-100 p-4 animate-in slide-in-from-top duration-200">
                    <div className="flex items-center gap-2 mb-3">
                        <Filter size={14} className="text-gray-400" />
                        <span className="text-sm font-semibold text-gray-700">Filtres avancés</span>
                        {activeFiltersCount > 0 && (
                            <button onClick={clearFilters} className="ml-auto text-xs text-red-500 hover:text-red-700 font-medium">
                                Tout effacer
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Technicien</label>
                            <select
                                value={filterEmployee}
                                onChange={(e) => setFilterEmployee(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                            >
                                <option value="">Tous</option>
                                {employees.map(e => (
                                    <option key={e.id} value={e.id}>{e.name || e.phoneNumber}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                            >
                                <option value="">Tous</option>
                                {interventionTypes.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
                            <select
                                value={filterCustomer}
                                onChange={(e) => setFilterCustomer(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                            >
                                <option value="">Tous</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.companyName}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Statut</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                            >
                                <option value="">Tous</option>
                                {Object.entries(STATUS_COLORS).map(([key, val]) => (
                                    <option key={key} value={key}>{val.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Legend */}
            <div className="flex flex-wrap gap-3">
                {Object.entries(STATUS_COLORS).map(([key, val]) => (
                    <div
                        key={key}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:scale-105"
                        style={{
                            backgroundColor: filterStatus === key ? val.border : val.bg,
                            color: filterStatus === key ? '#fff' : val.text,
                            border: `1px solid ${val.border}`,
                        }}
                        onClick={() => setFilterStatus(filterStatus === key ? '' : key)}
                    >
                        <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: filterStatus === key ? '#fff' : val.border }}
                        />
                        {val.label}
                        {statusCounts[key] ? ` (${statusCounts[key]})` : ''}
                    </div>
                ))}
                {activeFiltersCount > 0 && (
                    <span className="text-xs text-gray-400 flex items-center">
                        {filteredInterventions.length} résultat(s) sur {interventions.length}
                    </span>
                )}
            </div>

            {/* Calendar */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm" style={{ height: 700 }}>
                {loading ? (
                    <div className="flex items-center justify-center h-full text-gray-400">Chargement du calendrier...</div>
                ) : (
                    <DnDCalendar
                        localizer={localizer}
                        events={calendarEvents}
                        startAccessor="start"
                        endAccessor="end"
                        style={{ height: '100%' }}
                        views={[Views.MONTH, Views.WEEK, Views.DAY]}
                        defaultView={Views.WEEK}
                        view={currentView}
                        onView={setCurrentView}
                        date={currentDate}
                        onNavigate={setCurrentDate}
                        eventPropGetter={eventStyleGetter}
                        selectable
                        resizable
                        onSelectSlot={handleSelectSlot}
                        onSelectEvent={handleSelectEvent}
                        onEventDrop={handleEventDrop}
                        onEventResize={handleEventResize}
                        step={30}
                        timeslots={2}
                        min={new Date(2024, 0, 1, 6, 0, 0)}
                        max={new Date(2024, 0, 1, 22, 0, 0)}
                        draggableAccessor={() => true}
                        messages={{
                            today: "Aujourd'hui",
                            previous: 'Précédent',
                            next: 'Suivant',
                            month: 'Mois',
                            week: 'Semaine',
                            day: 'Jour',
                            noEventsInRange: 'Aucune intervention prévue',
                        }}
                        culture="fr"
                        popup
                    />
                )}
            </div>

            {/* Modal - New Intervention */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">Nouvelle Intervention</h3>
                            <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Type d'intervention selector */}
                            {interventionTypes.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                                        <Tag size={14} className="text-gray-400" /> Type d'intervention
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {interventionTypes.map(t => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => {
                                                    const isSelected = form.interventionTypeId === t.id;
                                                    if (isSelected) {
                                                        setForm({ ...form, interventionTypeId: '' });
                                                    } else {
                                                        const updates: any = { interventionTypeId: t.id };
                                                        if (!form.title) updates.title = t.name;
                                                        if (form.scheduledStart) {
                                                            const start = new Date(form.scheduledStart);
                                                            const end = addMinutes(start, t.defaultDuration);
                                                            updates.scheduledEnd = format(end, "yyyy-MM-dd'T'HH:mm");
                                                        }
                                                        setForm({ ...form, ...updates });
                                                    }
                                                }}
                                                className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-sm transition-all ${form.interventionTypeId === t.id
                                                    ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-200'
                                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <div
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                                                    style={{ backgroundColor: t.color }}
                                                >
                                                    <SquareStack size={14} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-gray-800 truncate">{t.name}</p>
                                                    <p className="text-xs text-gray-400">{t.defaultDuration} min</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                                <input
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Ex: Maintenance climatisation"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    rows={2}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
                                <select
                                    value={form.customerId}
                                    onChange={(e) => setForm({ ...form, customerId: e.target.value, customerSiteId: '' })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">Sélectionner un client...</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.companyName} — {c.contactName}</option>
                                    ))}
                                </select>
                            </div>
                            {/* Site Selection - appears when customer has sites */}
                            {form.customerId && selectedCustomerSites.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Lieu d'intervention</label>
                                    <select
                                        value={form.customerSiteId}
                                        onChange={(e) => setForm({ ...form, customerSiteId: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="">Adresse principale du client</option>
                                        {selectedCustomerSites.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.isMainSite ? '★ ' : ''}{s.name} — {s.address}, {s.postalCode} {s.city}
                                            </option>
                                        ))}
                                    </select>
                                    {form.customerSiteId && (() => {
                                        const site = selectedCustomerSites.find(s => s.id === form.customerSiteId);
                                        return site ? (
                                            <div className="mt-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                                                <p className="font-semibold">{site.name}</p>
                                                <p>{site.address}, {site.postalCode} {site.city}</p>
                                                {site.contactName && <p className="mt-1">👤 {site.contactName}</p>}
                                                {site.accessCode && <p>🔑 Code: {site.accessCode}</p>}
                                            </div>
                                        ) : null;
                                    })()}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Technicien *</label>
                                <select
                                    value={form.employeeId}
                                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">Sélectionner un technicien...</option>
                                    {employees.map(e => (
                                        <option key={e.id} value={e.id}>{e.name || e.phoneNumber}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Début *</label>
                                    <input
                                        type="datetime-local"
                                        value={form.scheduledStart}
                                        onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fin *</label>
                                    <input
                                        type="datetime-local"
                                        value={form.scheduledEnd}
                                        onChange={(e) => setForm({ ...form, scheduledEnd: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition">
                                Annuler
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !form.title || !form.customerId || !form.employeeId}
                                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition font-medium disabled:opacity-50 shadow-lg shadow-blue-500/25"
                            >
                                {saving ? 'Création...' : 'Créer l\'intervention'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal - Detail */}
            {showDetail && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">{showDetail.title}</h3>
                            <button onClick={() => setShowDetail(null)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span
                                    className="px-3 py-1 rounded-full text-xs font-bold"
                                    style={{
                                        backgroundColor: STATUS_COLORS[showDetail.status]?.bg,
                                        color: STATUS_COLORS[showDetail.status]?.text,
                                        border: `1px solid ${STATUS_COLORS[showDetail.status]?.border}`,
                                    }}
                                >
                                    {STATUS_COLORS[showDetail.status]?.label || showDetail.status}
                                </span>
                                {showDetail.interventionType && (
                                    <span
                                        className="px-3 py-1 rounded-full text-xs font-bold text-white flex items-center gap-1.5"
                                        style={{ backgroundColor: showDetail.interventionType.color }}
                                    >
                                        <SquareStack size={11} />
                                        {showDetail.interventionType.name}
                                    </span>
                                )}
                            </div>

                            {showDetail.description && (
                                <p className="text-sm text-gray-600">{showDetail.description}</p>
                            )}

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="flex items-center gap-2 text-gray-600">
                                    <Building2 size={16} className="text-blue-500" />
                                    <div>
                                        <p className="font-medium">{showDetail.customer.companyName}</p>
                                        <p className="text-xs text-gray-400">{showDetail.customer.contactName}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-gray-600">
                                    <User size={16} className="text-indigo-500" />
                                    <div>
                                        <p className="font-medium">{showDetail.employee.name || 'Tech'}</p>
                                        <p className="text-xs text-gray-400">{showDetail.employee.phoneNumber}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Site info */}
                            {showDetail.customerSite ? (
                                <div className="bg-blue-50 rounded-xl p-3 text-sm">
                                    <p className="font-semibold text-blue-800 flex items-center gap-1.5">
                                        <MapPin size={14} className="text-blue-500" />
                                        {showDetail.customerSite.name}
                                    </p>
                                    <p className="text-blue-700 text-xs mt-0.5">
                                        {showDetail.customerSite.address}, {showDetail.customerSite.postalCode} {showDetail.customerSite.city}
                                    </p>
                                    {showDetail.customerSite.contactName && (
                                        <p className="text-blue-600 text-xs mt-1">👤 {showDetail.customerSite.contactName}</p>
                                    )}
                                    {showDetail.customerSite.accessCode && (
                                        <p className="text-blue-600 text-xs">🔑 {showDetail.customerSite.accessCode}</p>
                                    )}
                                </div>
                            ) : showDetail.customer.address ? (
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <MapPin size={14} className="text-gray-400" />
                                    {showDetail.customer.address}
                                </div>
                            ) : null}

                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Clock size={14} className="text-gray-400" />
                                {format(new Date(showDetail.scheduledStart), 'dd/MM/yyyy HH:mm')} → {format(new Date(showDetail.scheduledEnd), 'HH:mm')}
                            </div>

                            {/* WhatsApp Notifications */}
                            <div className="border-t border-gray-100 pt-4">
                                <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
                                    <MessageCircle size={12} />
                                    NOTIFICATIONS WHATSAPP
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { type: 'reminder', label: '📅 Rappel J-1', disabled: !showDetail.customer.phone },
                                        { type: 'en_route', label: '🚗 En route', disabled: !showDetail.customer.phone },
                                        { type: 'signature', label: '✍️ Signature', disabled: !showDetail.customer.phone },
                                        { type: 'completed', label: '✅ Terminé', disabled: !showDetail.customer.phone },
                                    ].map(n => (
                                        <button
                                            key={n.type}
                                            onClick={() => sendNotification(showDetail.id, n.type)}
                                            disabled={n.disabled || notifSending === n.type}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border flex items-center gap-1.5 ${notifSuccess === n.type
                                                ? 'bg-green-50 border-green-200 text-green-700'
                                                : n.disabled
                                                    ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                                                    : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                                                }`}
                                        >
                                            {notifSending === n.type ? (
                                                <div className="w-3 h-3 border border-green-500 border-t-transparent rounded-full animate-spin" />
                                            ) : notifSuccess === n.type ? (
                                                <Check size={12} />
                                            ) : (
                                                <Send size={10} />
                                            )}
                                            {n.label}
                                        </button>
                                    ))}
                                </div>
                                {!showDetail.customer.phone && (
                                    <p className="text-xs text-amber-600 mt-2">⚠️ Pas de téléphone client renseigné</p>
                                )}
                            </div>

                            {/* Status Actions */}
                            <div className="border-t border-gray-100 pt-4">
                                <p className="text-xs font-medium text-gray-400 mb-2">CHANGER LE STATUT</p>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(STATUS_COLORS).map(([key, val]) => (
                                        <button
                                            key={key}
                                            onClick={() => handleStatusChange(showDetail.id, key)}
                                            disabled={showDetail.status === key}
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-30 hover:scale-105"
                                            style={{
                                                backgroundColor: val.bg,
                                                color: val.text,
                                                border: `1px solid ${val.border}`,
                                            }}
                                        >
                                            {val.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex justify-between">
                            <button
                                onClick={() => handleDelete(showDetail.id)}
                                className="px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl transition text-sm font-medium"
                            >
                                Supprimer
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => downloadInterventionPdf(showDetail.id)}
                                    className="flex items-center gap-1.5 px-4 py-2.5 text-purple-600 hover:bg-purple-50 rounded-xl transition text-sm font-medium border border-purple-200"
                                >
                                    <Download size={14} /> Rapport PDF
                                </button>
                                <button
                                    onClick={() => setShowDetail(null)}
                                    className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition text-sm"
                                >
                                    Fermer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
