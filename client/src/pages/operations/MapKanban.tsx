import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import {
    Map as MapIcon, Columns3, Clock,
    Building2, User, MapPin, Filter, X,
    ChevronRight, ChevronLeft, ArrowRight
} from 'lucide-react';

// ─── Types ───────────────────────────────

interface Intervention {
    id: string;
    title: string;
    description?: string;
    status: string;
    scheduledStart: string;
    scheduledEnd: string;
    realStart?: string;
    realEnd?: string;
    customer?: { id: string; companyName: string; contactName: string; address?: string; phone?: string };
    customerSite?: { id: string; name: string; address: string; city: string; postalCode: string; latitude?: number; longitude?: number };
    interventionType?: { id: string; name: string; color: string; icon?: string | null };
    employee?: { id: string; name: string };
}

interface Employee {
    id: string;
    name: string;
}

// ─── Constants ───────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    SCHEDULED: { label: 'Planifié', color: '#475569', bg: '#f1f5f9', border: '#94a3b8' },
    EN_ROUTE: { label: 'En route', color: '#1d4ed8', bg: '#dbeafe', border: '#3b82f6' },
    IN_PROGRESS: { label: 'En cours', color: '#b45309', bg: '#fef3c7', border: '#f59e0b' },
    COMPLETED: { label: 'Terminé', color: '#166534', bg: '#dcfce7', border: '#22c55e' },
    CANCELED: { label: 'Annulé', color: '#991b1b', bg: '#fee2e2', border: '#ef4444' },
};

const KANBAN_COLUMNS = ['SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED'];

// ─── Component ───────────────────────────

export default function MapKanban() {
    const [interventions, setInterventions] = useState<Intervention[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [view, setView] = useState<'kanban' | 'map'>('kanban');
    const [loading, setLoading] = useState(true);
    const [filterEmployee, setFilterEmployee] = useState('');
    const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [showFilters, setShowFilters] = useState(false);

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => { fetchData(); }, [filterDate, filterEmployee]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const from = `${filterDate}T00:00:00`;
            const to = `${filterDate}T23:59:59`;
            const params: any = { from, to };
            if (filterEmployee) params.employeeId = filterEmployee;

            const [intRes, empRes] = await Promise.all([
                axios.get('/api/interventions', { headers, params }),
                axios.get('/api/employees', { headers }),
            ]);
            setInterventions(intRes.data);
            setEmployees(empRes.data);
        } catch (err) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        try {
            await axios.patch(`/api/interventions/${id}/status`, { status: newStatus }, { headers });
            fetchData();
        } catch (err) {
            console.error('Error changing status:', err);
        }
    };

    // Navigation dates
    const prevDay = () => {
        const d = new Date(filterDate);
        d.setDate(d.getDate() - 1);
        setFilterDate(format(d, 'yyyy-MM-dd'));
    };
    const nextDay = () => {
        const d = new Date(filterDate);
        d.setDate(d.getDate() + 1);
        setFilterDate(format(d, 'yyyy-MM-dd'));
    };

    // Kanban columns
    const columns = useMemo(() => {
        const result: Record<string, Intervention[]> = {};
        KANBAN_COLUMNS.forEach(s => { result[s] = []; });
        interventions.forEach(i => {
            if (result[i.status]) result[i.status].push(i);
            else if (i.status === 'CANCELED') { /* skip canceled from kanban */ }
        });
        return result;
    }, [interventions]);

    // ─── MAP VIEW ───
    const interventionsWithCoords = useMemo(() =>
        interventions.filter(i => i.customerSite?.latitude && i.customerSite?.longitude),
        [interventions]);

    return (
        <div className="p-6">
            {/* ── TOP BAR ── */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">
                        {view === 'kanban' ? 'Kanban Interventions' : 'Carte Interventions'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {interventions.length} intervention(s) • {format(new Date(filterDate), 'EEEE dd/MM/yyyy')}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Date nav */}
                    <div className="flex items-center gap-1 bg-white border rounded-xl px-1 py-1">
                        <button onClick={prevDay} className="p-2 rounded-lg hover:bg-gray-100 transition">
                            <ChevronLeft size={16} />
                        </button>
                        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                            className="px-2 py-1 text-sm border-0 focus:outline-none" />
                        <button onClick={nextDay} className="p-2 rounded-lg hover:bg-gray-100 transition">
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Filter toggle */}
                    <button onClick={() => setShowFilters(!showFilters)}
                        className={`p-2.5 rounded-xl border transition ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-600' : 'bg-white hover:bg-gray-50'}`}>
                        <Filter size={18} />
                    </button>

                    {/* View toggle */}
                    <div className="flex bg-white border rounded-xl overflow-hidden">
                        <button onClick={() => setView('kanban')}
                            className={`px-4 py-2 text-sm font-medium flex items-center gap-2 transition ${view === 'kanban' ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'}`}>
                            <Columns3 size={16} /> Kanban
                        </button>
                        <button onClick={() => setView('map')}
                            className={`px-4 py-2 text-sm font-medium flex items-center gap-2 transition ${view === 'map' ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'}`}>
                            <MapIcon size={16} /> Carte
                        </button>
                    </div>
                </div>
            </div>

            {/* ── FILTERS ── */}
            {showFilters && (
                <div className="bg-white rounded-xl border p-4 mb-6 flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <User size={16} className="text-gray-400" />
                        <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}
                            className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                            <option value="">Tous les techniciens</option>
                            {employees.map(e => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                            ))}
                        </select>
                    </div>
                    {filterEmployee && (
                        <button onClick={() => setFilterEmployee('')} className="text-sm text-gray-500 hover:text-red-500 flex items-center gap-1">
                            <X size={14} /> Réinitialiser
                        </button>
                    )}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
            ) : view === 'kanban' ? (
                /* ══════════════════ KANBAN VIEW ══════════════════ */
                <div className="grid grid-cols-4 gap-4 min-h-[60vh]">
                    {KANBAN_COLUMNS.map(status => {
                        const cfg = STATUS_CONFIG[status];
                        const items = columns[status] || [];
                        return (
                            <div key={status} className="flex flex-col">
                                {/* Column header */}
                                <div className="rounded-t-xl px-4 py-3 flex items-center justify-between"
                                    style={{ backgroundColor: cfg.bg, borderTop: `3px solid ${cfg.border}` }}>
                                    <span className="text-sm font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                                    <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                                        style={{ backgroundColor: cfg.border, color: '#fff' }}>
                                        {items.length}
                                    </span>
                                </div>

                                {/* Cards */}
                                <div className="flex-1 bg-gray-50 rounded-b-xl p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-300px)]">
                                    {items.length === 0 && (
                                        <p className="text-xs text-gray-400 text-center py-8">Aucune intervention</p>
                                    )}
                                    {items.map(int => (
                                        <KanbanCard key={int.id} intervention={int} onStatusChange={handleStatusChange} />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* ══════════════════ MAP VIEW ══════════════════ */
                <div className="bg-white rounded-xl border overflow-hidden">
                    {interventionsWithCoords.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
                            <MapPin size={48} className="mb-4 text-gray-300" />
                            <p className="text-lg font-medium">Aucune intervention géolocalisée</p>
                            <p className="text-sm mt-1">Ajoutez des coordonnées GPS aux sites clients pour les voir ici</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 h-[70vh]">
                            {/* Map placeholder — static tiles */}
                            <div className="col-span-2 relative bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
                                <div className="text-center">
                                    <MapIcon size={64} className="mx-auto mb-4 text-blue-300" />
                                    <p className="text-lg font-medium text-blue-600">Carte interactive</p>
                                    <p className="text-sm text-gray-500 mt-2 max-w-sm">
                                        {interventionsWithCoords.length} intervention(s) avec coordonnées GPS.
                                        Intégrez Leaflet ou Google Maps pour afficher la carte.
                                    </p>
                                </div>

                                {/* Pin badges overlay */}
                                <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                                    {interventionsWithCoords.map(i => (
                                        <div key={i.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium shadow-sm"
                                            style={{
                                                backgroundColor: STATUS_CONFIG[i.status]?.bg || '#f1f5f9',
                                                color: STATUS_CONFIG[i.status]?.color || '#475569',
                                                border: `1px solid ${STATUS_CONFIG[i.status]?.border || '#94a3b8'}`
                                            }}>
                                            <MapPin size={12} />
                                            {i.customer?.companyName?.slice(0, 15)}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Side list */}
                            <div className="border-l overflow-y-auto">
                                <div className="p-4 border-b bg-gray-50">
                                    <h3 className="font-semibold text-gray-700">Interventions du jour</h3>
                                </div>
                                {interventions.map(i => (
                                    <div key={i.id} className="p-4 border-b hover:bg-gray-50 transition cursor-pointer">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-800 truncate">{i.title}</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full"
                                                style={{
                                                    backgroundColor: STATUS_CONFIG[i.status]?.bg,
                                                    color: STATUS_CONFIG[i.status]?.color
                                                }}>
                                                {STATUS_CONFIG[i.status]?.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                            <Clock size={12} />
                                            {format(new Date(i.scheduledStart), 'HH:mm')} — {format(new Date(i.scheduledEnd), 'HH:mm')}
                                        </div>
                                        {i.customer && (
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                <Building2 size={12} />
                                                {i.customer.companyName}
                                            </div>
                                        )}
                                        {i.customerSite && (
                                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                                                <MapPin size={12} />
                                                {i.customerSite.address}, {i.customerSite.city}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Kanban Card ─────────────────────────

function KanbanCard({ intervention, onStatusChange }: {
    intervention: Intervention;
    onStatusChange: (id: string, status: string) => void;
}) {
    const statusIndex = KANBAN_COLUMNS.indexOf(intervention.status);
    const nextStatus = statusIndex < KANBAN_COLUMNS.length - 1 ? KANBAN_COLUMNS[statusIndex + 1] : null;

    return (
        <div className="bg-white rounded-xl border shadow-sm p-3 hover:shadow-md transition group">
            {/* Type badge */}
            {intervention.interventionType && (
                <span className="inline-block text-xs px-2 py-0.5 rounded-full mb-2 font-medium"
                    style={{
                        backgroundColor: intervention.interventionType.color + '20',
                        color: intervention.interventionType.color
                    }}>
                    {intervention.interventionType.name}
                </span>
            )}

            <h4 className="text-sm font-semibold text-gray-800 mb-1 line-clamp-2">{intervention.title}</h4>

            {/* Time */}
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                <Clock size={12} />
                {format(new Date(intervention.scheduledStart), 'HH:mm')} — {format(new Date(intervention.scheduledEnd), 'HH:mm')}
            </div>

            {/* Customer */}
            {intervention.customer && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <Building2 size={12} />
                    <span className="truncate">{intervention.customer.companyName}</span>
                </div>
            )}

            {/* Technician */}
            {intervention.employee && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                    <User size={12} />
                    {intervention.employee.name}
                </div>
            )}

            {/* Site */}
            {intervention.customerSite && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
                    <MapPin size={12} />
                    <span className="truncate">{intervention.customerSite.city}</span>
                </div>
            )}

            {/* Next status action */}
            {nextStatus && (
                <button
                    onClick={() => onStatusChange(intervention.id, nextStatus)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition opacity-0 group-hover:opacity-100"
                    style={{
                        backgroundColor: STATUS_CONFIG[nextStatus]?.bg,
                        color: STATUS_CONFIG[nextStatus]?.color,
                        border: `1px solid ${STATUS_CONFIG[nextStatus]?.border}`
                    }}>
                    <ArrowRight size={12} />
                    {STATUS_CONFIG[nextStatus]?.label}
                </button>
            )}
        </div>
    );
}
