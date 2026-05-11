import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import {
    MessageCircle, Search, Check, X, ArrowRight, Clock,
    Building2, User, Phone, AlertTriangle,
    Calendar, ChevronDown, ChevronUp, Trash2, MapPin,
    Tag, Image,
    type LucideIcon
} from 'lucide-react';
import { getErrorMessage } from '../../utils/errors';

interface IntRequest {
    id: string;
    message: string;
    photoUrl?: string | null;
    urgency: string;
    senderPhone: string;
    senderName?: string | null;
    customerId?: string | null;
    customerSiteId?: string | null;
    interventionTypeId?: string | null;
    status: string;
    managerNotes?: string | null;
    rejectionReason?: string | null;
    interventionId?: string | null;
    createdAt: string;
    customer?: { id: string; companyName: string; contactName: string; phone?: string | null } | null;
    customerSite?: { id: string; name: string; address: string; city: string } | null;
    interventionType?: { id: string; name: string; color: string } | null;
    intervention?: { id: string; title: string; status: string; scheduledStart: string } | null;
}

interface Stats {
    pending: number;
    approved: number;
    planned: number;
    rejected: number;
    total: number;
}

interface Customer { id: string; companyName: string; contactName: string; sites?: { id: string; name: string; address: string; city: string }[] }
interface Employee { id: string; name: string; phoneNumber: string; }
interface IntType { id: string; name: string; color: string; }

const STATUS_CONFIG: Record<string, { bg: string; border: string; text: string; label: string; icon: LucideIcon }> = {
    PENDING: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', label: 'En attente', icon: Clock },
    APPROVED: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', label: 'Approuvée', icon: Check },
    PLANNED: { bg: '#dcfce7', border: '#22c55e', text: '#166534', label: 'Planifiée', icon: Calendar },
    REJECTED: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', label: 'Refusée', icon: X },
};

export default function InterventionRequests() {
    const [requests, setRequests] = useState<IntRequest[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [intTypes, setIntTypes] = useState<IntType[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);

    // Plan modal
    const [planModal, setPlanModal] = useState<IntRequest | null>(null);
    const [planForm, setPlanForm] = useState({ employeeId: '', scheduledStart: '', scheduledEnd: '', title: '', description: '' });
    const [planSaving, setPlanSaving] = useState(false);

    // Reject modal
    const [rejectModal, setRejectModal] = useState<IntRequest | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    const fetchAll = async () => {
        try {
            setLoading(true);
            const [reqRes, statsRes, custRes, empRes, typesRes] = await Promise.all([
                axios.get('/api/intervention-requests', { headers }),
                axios.get('/api/intervention-requests/stats', { headers }),
                axios.get('/api/customers', { headers }),
                axios.get('/api/employees', { headers }),
                axios.get('/api/intervention-types', { headers }),
            ]);
            setRequests(Array.isArray(reqRes.data) ? reqRes.data : []);
            setStats(statsRes.data);
            setCustomers(Array.isArray(custRes.data) ? custRes.data : []);
            setEmployees(Array.isArray(empRes.data) ? empRes.data : empRes.data?.employees || []);
            setIntTypes(Array.isArray(typesRes.data) ? typesRes.data : []);
        } catch (e) {
            console.error('Error fetching data', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const filtered = useMemo(() => {
        return requests.filter(r => {
            if (filterStatus && r.status !== filterStatus) return false;
            if (search) {
                const s = search.toLowerCase();
                return (
                    r.message.toLowerCase().includes(s) ||
                    r.senderPhone.includes(s) ||
                    r.senderName?.toLowerCase().includes(s) ||
                    r.customer?.companyName.toLowerCase().includes(s) ||
                    r.customer?.contactName.toLowerCase().includes(s)
                );
            }
            return true;
        });
    }, [requests, filterStatus, search]);

    const handleApprove = async (id: string) => {
        try {
            await axios.post(`/api/intervention-requests/${id}/approve`, {}, { headers });
            fetchAll();
        } catch (e: unknown) {
            alert(getErrorMessage(e, 'Erreur'));
        }
    };

    const handleReject = async () => {
        if (!rejectModal) return;
        try {
            await axios.post(`/api/intervention-requests/${rejectModal.id}/reject`, { rejectionReason: rejectReason }, { headers });
            setRejectModal(null);
            setRejectReason('');
            fetchAll();
        } catch (e: unknown) {
            alert(getErrorMessage(e, 'Erreur'));
        }
    };

    const handlePlan = async () => {
        if (!planModal || !planForm.employeeId || !planForm.scheduledStart || !planForm.scheduledEnd) return;
        setPlanSaving(true);
        try {
            await axios.post(`/api/intervention-requests/${planModal.id}/plan`, planForm, { headers });
            setPlanModal(null);
            setPlanForm({ employeeId: '', scheduledStart: '', scheduledEnd: '', title: '', description: '' });
            fetchAll();
        } catch (e: unknown) {
            alert(getErrorMessage(e, 'Erreur'));
        } finally {
            setPlanSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Supprimer cette demande ?')) return;
        try {
            await axios.delete(`/api/intervention-requests/${id}`, { headers });
            fetchAll();
        } catch (e: unknown) {
            alert(getErrorMessage(e, 'Erreur'));
        }
    };

    const handleAssignCustomer = async (reqId: string, customerId: string) => {
        try {
            await axios.put(`/api/intervention-requests/${reqId}`, { customerId }, { headers });
            fetchAll();
        } catch (e: unknown) {
            alert(getErrorMessage(e, 'Erreur'));
        }
    };

    const handleAssignType = async (reqId: string, interventionTypeId: string) => {
        try {
            await axios.put(`/api/intervention-requests/${reqId}`, { interventionTypeId: interventionTypeId || null }, { headers });
            fetchAll();
        } catch (e: unknown) {
            alert(getErrorMessage(e, 'Erreur'));
        }
    };

    const openPlan = (req: IntRequest) => {
        const now = new Date();
        const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        setPlanForm({
            employeeId: '',
            scheduledStart: format(now, "yyyy-MM-dd'T'HH:mm"),
            scheduledEnd: format(in2h, "yyyy-MM-dd'T'HH:mm"),
            title: `Demande — ${req.customer?.companyName || req.senderName || req.senderPhone}`,
            description: `📩 Demande WhatsApp:\n${req.message}`,
        });
        setPlanModal(req);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-400">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mr-3" />
                Chargement des demandes...
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <MessageCircle className="text-orange-500" size={28} />
                        Demandes d'intervention
                    </h2>
                    <p className="text-gray-500 mt-1">
                        Demandes reçues par WhatsApp · Validez et planifiez
                    </p>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                        { key: 'pending', label: 'En attente', color: 'orange', icon: Clock, count: stats.pending },
                        { key: 'approved', label: 'Approuvées', color: 'blue', icon: Check, count: stats.approved },
                        { key: 'planned', label: 'Planifiées', color: 'green', icon: Calendar, count: stats.planned },
                        { key: 'rejected', label: 'Refusées', color: 'red', icon: X, count: stats.rejected },
                        { key: '', label: 'Total', color: 'gray', icon: MessageCircle, count: stats.total },
                    ].map(s => (
                        <button
                            key={s.key}
                            onClick={() => setFilterStatus(filterStatus === s.key ? '' : s.key)}
                            className={`p-4 rounded-2xl border transition-all hover:scale-[1.02] text-left ${filterStatus === s.key
                                ? `bg-${s.color}-50 border-${s.color}-300 ring-2 ring-${s.color}-200`
                                : 'bg-white border-gray-100 hover:border-gray-200'
                                }`}
                            style={filterStatus === s.key ? {
                                backgroundColor: STATUS_CONFIG[s.key]?.bg || '#f9fafb',
                                borderColor: STATUS_CONFIG[s.key]?.border || '#e5e7eb',
                            } : {}}
                        >
                            <div className="flex items-center justify-between">
                                <s.icon size={18} style={{ color: STATUS_CONFIG[s.key]?.border || '#6b7280' }} />
                                <span className="text-2xl font-bold" style={{ color: STATUS_CONFIG[s.key]?.text || '#374151' }}>
                                    {s.count}
                                </span>
                            </div>
                            <p className="text-xs font-medium text-gray-500 mt-1">{s.label}</p>
                        </button>
                    ))}
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher par message, client, téléphone..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                />
            </div>

            {/* Requests list */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                    <MessageCircle size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 font-medium">Aucune demande {filterStatus ? `(${STATUS_CONFIG[filterStatus]?.label})` : ''}</p>
                    <p className="text-gray-400 text-sm mt-1">Les demandes WhatsApp des clients apparaîtront ici</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(req => {
                        const isExpanded = expanded === req.id;
                        const sc = STATUS_CONFIG[req.status] || STATUS_CONFIG.PENDING;
                        const StatusIcon = sc.icon;

                        return (
                            <div
                                key={req.id}
                                className={`bg-white rounded-2xl border transition-all ${req.urgency === 'URGENT'
                                    ? 'border-red-200 shadow-md shadow-red-100'
                                    : 'border-gray-100 hover:border-gray-200'
                                    }`}
                            >
                                {/* Card header */}
                                <div
                                    className="p-4 cursor-pointer flex items-start gap-4"
                                    onClick={() => setExpanded(isExpanded ? null : req.id)}
                                >
                                    {/* Status badge */}
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{ backgroundColor: sc.bg, border: `1px solid ${sc.border}` }}
                                    >
                                        <StatusIcon size={18} style={{ color: sc.text }} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            {req.urgency === 'URGENT' && (
                                                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full flex items-center gap-1">
                                                    <AlertTriangle size={10} /> URGENT
                                                </span>
                                            )}
                                            <span
                                                className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                                                style={{ backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}
                                            >
                                                {sc.label}
                                            </span>
                                            {req.interventionType && (
                                                <span
                                                    className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                                                    style={{ backgroundColor: req.interventionType.color }}
                                                >
                                                    {req.interventionType.name}
                                                </span>
                                            )}
                                            {req.photoUrl && (
                                                <span className="text-xs text-blue-500 flex items-center gap-0.5">
                                                    <Image size={10} /> Photo
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-sm text-gray-800 font-medium line-clamp-2">
                                            {req.message}
                                        </p>

                                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                            {req.customer ? (
                                                <span className="flex items-center gap-1">
                                                    <Building2 size={12} /> {req.customer.companyName}
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-orange-500">
                                                    <Building2 size={12} /> Client non identifié
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <Phone size={12} /> +{req.senderPhone}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock size={12} /> {format(new Date(req.createdAt), 'dd/MM HH:mm')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions + expand */}
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {req.status === 'PENDING' && (
                                            <>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleApprove(req.id); }}
                                                    className="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition"
                                                    title="Approuver"
                                                >
                                                    <Check size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setRejectModal(req); }}
                                                    className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition"
                                                    title="Refuser"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </>
                                        )}
                                        {(req.status === 'PENDING' || req.status === 'APPROVED') && req.customerId && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openPlan(req); }}
                                                className="p-2 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition"
                                                title="Planifier"
                                            >
                                                <ArrowRight size={16} />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(req.id); }}
                                            className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
                                            title="Supprimer"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                        {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                                    </div>
                                </div>

                                {/* Expanded content */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3 animate-in slide-in-from-top duration-200">
                                        {/* Full message */}
                                        <div className="bg-gray-50 rounded-xl p-3">
                                            <p className="text-xs font-medium text-gray-400 mb-1 flex items-center gap-1">
                                                <MessageCircle size={12} /> MESSAGE COMPLET
                                            </p>
                                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{req.message}</p>
                                        </div>

                                        {/* Photo */}
                                        {req.photoUrl && (
                                            <div>
                                                <p className="text-xs font-medium text-gray-400 mb-1 flex items-center gap-1">
                                                    <Image size={12} /> PHOTO JOINTE
                                                </p>
                                                <img
                                                    src={req.photoUrl}
                                                    alt="Photo jointe"
                                                    className="rounded-xl max-h-48 border border-gray-200"
                                                />
                                            </div>
                                        )}

                                        {/* Assign customer */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-400 mb-1 flex items-center gap-1">
                                                    <Building2 size={12} /> Client
                                                </label>
                                                <select
                                                    value={req.customerId || ''}
                                                    onChange={(e) => handleAssignCustomer(req.id, e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                                                    disabled={req.status === 'PLANNED'}
                                                >
                                                    <option value="">Non identifié</option>
                                                    {customers.map(c => (
                                                        <option key={c.id} value={c.id}>{c.companyName} — {c.contactName}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-400 mb-1 flex items-center gap-1">
                                                    <Tag size={12} /> Type d'intervention
                                                </label>
                                                <select
                                                    value={req.interventionTypeId || ''}
                                                    onChange={(e) => handleAssignType(req.id, e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                                                    disabled={req.status === 'PLANNED'}
                                                >
                                                    <option value="">Non classée</option>
                                                    {intTypes.map(t => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Info contact */}
                                        <div className="flex items-center gap-4 text-xs text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <User size={12} /> {req.senderName || 'Inconnu'}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Phone size={12} /> +{req.senderPhone}
                                            </span>
                                            {req.customerSite && (
                                                <span className="flex items-center gap-1">
                                                    <MapPin size={12} /> {req.customerSite.name} — {req.customerSite.city}
                                                </span>
                                            )}
                                        </div>

                                        {/* Intervention link */}
                                        {req.intervention && (
                                            <div className="bg-green-50 rounded-xl p-3 text-sm">
                                                <p className="font-semibold text-green-800 flex items-center gap-1.5">
                                                    <Calendar size={14} /> Intervention planifiée
                                                </p>
                                                <p className="text-green-700 text-xs mt-1">
                                                    {req.intervention.title} — {format(new Date(req.intervention.scheduledStart), 'dd/MM/yyyy HH:mm')}
                                                </p>
                                            </div>
                                        )}

                                        {/* Rejection reason */}
                                        {req.status === 'REJECTED' && req.rejectionReason && (
                                            <div className="bg-red-50 rounded-xl p-3 text-sm">
                                                <p className="font-semibold text-red-800">Motif de refus :</p>
                                                <p className="text-red-700 text-xs mt-1">{req.rejectionReason}</p>
                                            </div>
                                        )}

                                        {/* Action buttons for expanded */}
                                        {(req.status === 'PENDING' || req.status === 'APPROVED') && (
                                            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                                                {req.status === 'PENDING' && (
                                                    <button
                                                        onClick={() => handleApprove(req.id)}
                                                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-100 transition border border-blue-200"
                                                    >
                                                        <Check size={14} /> Approuver
                                                    </button>
                                                )}
                                                {req.customerId && (
                                                    <button
                                                        onClick={() => openPlan(req)}
                                                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-medium hover:from-green-600 hover:to-emerald-700 transition shadow-lg shadow-green-500/25"
                                                    >
                                                        <ArrowRight size={14} /> Planifier l'intervention
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setRejectModal(req)}
                                                    className="flex items-center gap-1.5 px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition border border-red-200"
                                                >
                                                    <X size={14} /> Refuser
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Reject Modal */}
            {rejectModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">Refuser la demande</h3>
                            <button onClick={() => setRejectModal(null)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-red-50 rounded-xl p-3 text-sm text-red-700">
                                Le client recevra un message WhatsApp l'informant du refus.
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Motif du refus (optionnel)</label>
                                <textarea
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                                    placeholder="Ex: Hors périmètre de nos services..."
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setRejectModal(null)} className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition">
                                Annuler
                            </button>
                            <button
                                onClick={handleReject}
                                className="px-6 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition font-medium shadow-lg shadow-red-500/25"
                            >
                                Refuser la demande
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Plan Modal */}
            {planModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">Planifier l'intervention</h3>
                            <button onClick={() => setPlanModal(null)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Original request */}
                            <div className="bg-orange-50 rounded-xl p-3 text-sm border border-orange-200">
                                <p className="font-medium text-orange-800 flex items-center gap-1.5">
                                    <MessageCircle size={14} /> Demande originale
                                </p>
                                <p className="text-orange-700 mt-1 text-xs italic">"{planModal.message.slice(0, 150)}"</p>
                                <p className="text-orange-600 mt-1 text-xs">
                                    {planModal.customer?.companyName} · {planModal.senderName || planModal.senderPhone}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Titre de l'intervention</label>
                                <input
                                    value={planForm.title}
                                    onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={planForm.description}
                                    onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Technicien *</label>
                                <select
                                    value={planForm.employeeId}
                                    onChange={(e) => setPlanForm({ ...planForm, employeeId: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                                        value={planForm.scheduledStart}
                                        onChange={(e) => setPlanForm({ ...planForm, scheduledStart: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fin *</label>
                                    <input
                                        type="datetime-local"
                                        value={planForm.scheduledEnd}
                                        onChange={(e) => setPlanForm({ ...planForm, scheduledEnd: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setPlanModal(null)} className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition">
                                Annuler
                            </button>
                            <button
                                onClick={handlePlan}
                                disabled={planSaving || !planForm.employeeId || !planForm.scheduledStart || !planForm.scheduledEnd}
                                className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition font-medium disabled:opacity-50 shadow-lg shadow-green-500/25"
                            >
                                {planSaving ? 'Planification...' : 'Planifier & Notifier le client'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
