import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import {
    FileText, Search, Building2, User, Calendar,
    CheckCircle2, Clock, AlertCircle, TrendingUp
} from 'lucide-react';

interface Intervention {
    id: string;
    title: string;
    status: string;
    scheduledStart: string;
    scheduledEnd: string;
    realStart?: string;
    realEnd?: string;
    reportContent?: string;
    signatureUrl?: string;
    pdfUrl?: string;
    customer: { companyName: string; contactName: string };
    employee: { name: string };
}

const STATUS_BADGE: Record<string, { color: string; bg: string; label: string }> = {
    SCHEDULED: { color: '#475569', bg: '#f1f5f9', label: 'Prévu' },
    EN_ROUTE: { color: '#1d4ed8', bg: '#dbeafe', label: 'En route' },
    IN_PROGRESS: { color: '#b45309', bg: '#fef3c7', label: 'En cours' },
    COMPLETED: { color: '#15803d', bg: '#dcfce7', label: 'Terminé' },
    CANCELED: { color: '#b91c1c', bg: '#fee2e2', label: 'Annulé' },
};

export default function Reports() {
    const [interventions, setInterventions] = useState<Intervention[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        const fetch = async () => {
            try {
                setLoading(true);
                const res = await axios.get('/api/interventions', { headers });
                setInterventions(res.data);
            } catch (e) {
                console.error('Error', e);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    const filtered = useMemo(() => {
        return interventions.filter(i => {
            const matchSearch = !search ||
                i.title.toLowerCase().includes(search.toLowerCase()) ||
                i.customer.companyName.toLowerCase().includes(search.toLowerCase()) ||
                i.employee.name?.toLowerCase().includes(search.toLowerCase());
            const matchStatus = filterStatus === 'ALL' || i.status === filterStatus;
            return matchSearch && matchStatus;
        });
    }, [interventions, search, filterStatus]);

    const stats = useMemo(() => {
        const total = interventions.length;
        const completed = interventions.filter(i => i.status === 'COMPLETED').length;
        const inProgress = interventions.filter(i => i.status === 'IN_PROGRESS').length;
        const signed = interventions.filter(i => i.signatureUrl).length;
        return { total, completed, inProgress, signed };
    }, [interventions]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <FileText className="text-blue-600" size={28} />
                    Rapports d'Interventions
                </h2>
                <p className="text-gray-500 mt-1">Historique et suivi de toutes les interventions</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total', value: stats.total, icon: <Calendar size={20} />, color: 'from-blue-500 to-indigo-500' },
                    { label: 'Terminées', value: stats.completed, icon: <CheckCircle2 size={20} />, color: 'from-green-500 to-emerald-500' },
                    { label: 'En cours', value: stats.inProgress, icon: <Clock size={20} />, color: 'from-amber-500 to-orange-500' },
                    { label: 'Signées', value: stats.signed, icon: <TrendingUp size={20} />, color: 'from-purple-500 to-pink-500' },
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
                    <input
                        type="text"
                        placeholder="Rechercher..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    <option value="ALL">Tous les statuts</option>
                    {Object.entries(STATUS_BADGE).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                    ))}
                </select>
            </div>

            {/* Interventions List */}
            {loading ? (
                <div className="text-center py-20 text-gray-400">Chargement...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20">
                    <AlertCircle size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">Aucune intervention trouvée</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Intervention</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Technicien</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Signature</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((i) => (
                                <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                                    <td className="py-3 px-4">
                                        <p className="font-medium text-gray-900 text-sm">{i.title}</p>
                                        {i.reportContent && (
                                            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">
                                                {i.reportContent.substring(0, 60)}...
                                            </p>
                                        )}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <Building2 size={14} className="text-gray-400" />
                                            <span className="text-sm text-gray-700">{i.customer.companyName}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <User size={14} className="text-gray-400" />
                                            <span className="text-sm text-gray-700">{i.employee.name || '—'}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-500">
                                        {format(new Date(i.scheduledStart), 'dd/MM/yyyy HH:mm')}
                                    </td>
                                    <td className="py-3 px-4">
                                        <span
                                            className="px-2.5 py-1 rounded-full text-xs font-bold"
                                            style={{
                                                backgroundColor: STATUS_BADGE[i.status]?.bg,
                                                color: STATUS_BADGE[i.status]?.color,
                                            }}
                                        >
                                            {STATUS_BADGE[i.status]?.label || i.status}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        {i.signatureUrl ? (
                                            <CheckCircle2 size={18} className="text-green-500 mx-auto" />
                                        ) : (
                                            <span className="text-gray-300 text-xs">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
