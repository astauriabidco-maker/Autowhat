import { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import {
    X, Building2, Calendar, DollarSign, Clock,
    CheckCircle2, FileText, Package, RefreshCw,
    TrendingUp, User,
    Wrench, FileSpreadsheet, AlertCircle
} from 'lucide-react';

interface CustomerHistoryProps {
    customerId: string;
    customerName: string;
    onClose: () => void;
}

interface HistoryData {
    interventions: any[];
    quotes: any[];
    recurringInterventions: any[];
    stats: {
        totalInterventions: number;
        completedInterventions: number;
        canceledInterventions: number;
        completionRate: number;
        totalPartsCost: number;
        totalQuotes: number;
        acceptedQuotes: number;
        totalQuoteAmount: number;
        avgDuration: number;
        activeRecurring: number;
    };
    timeline: any[];
}

const TAB_ITEMS = ['timeline', 'interventions', 'quotes', 'recurring'] as const;
type TabType = typeof TAB_ITEMS[number];

const STATUS_BADGE: Record<string, { color: string; bg: string; label: string }> = {
    SCHEDULED: { color: '#475569', bg: '#f1f5f9', label: 'Prévu' },
    EN_ROUTE: { color: '#1d4ed8', bg: '#dbeafe', label: 'En route' },
    IN_PROGRESS: { color: '#b45309', bg: '#fef3c7', label: 'En cours' },
    COMPLETED: { color: '#15803d', bg: '#dcfce7', label: 'Terminé' },
    CANCELED: { color: '#b91c1c', bg: '#fee2e2', label: 'Annulé' },
    DRAFT: { color: '#64748b', bg: '#f1f5f9', label: 'Brouillon' },
    SENT: { color: '#1d4ed8', bg: '#dbeafe', label: 'Envoyé' },
    ACCEPTED: { color: '#15803d', bg: '#dcfce7', label: 'Accepté' },
    REJECTED: { color: '#b91c1c', bg: '#fee2e2', label: 'Refusé' },
    CONVERTED: { color: '#7c3aed', bg: '#ede9fe', label: 'Converti' },
};

export default function CustomerHistory({ customerId, customerName, onClose }: CustomerHistoryProps) {
    const [data, setData] = useState<HistoryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('timeline');

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                setLoading(true);
                const res = await axios.get(`/api/customers/${customerId}/history`, { headers });
                setData(res.data);
            } catch (e) { console.error('Error fetching history:', e); }
            finally { setLoading(false); }
        };
        fetchHistory();
    }, [customerId]);

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-12 text-center">
                    <div className="animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-gray-500">Chargement de l'historique...</p>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-12 text-center">
                    <AlertCircle size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">Impossible de charger l'historique</p>
                    <button onClick={onClose} className="mt-4 px-5 py-2 bg-gray-100 rounded-xl text-sm">Fermer</button>
                </div>
            </div>
        );
    }

    const { stats, timeline, interventions, quotes, recurringInterventions } = data;

    const tabLabels: Record<TabType, { label: string; icon: React.ReactNode; count: number }> = {
        timeline: { label: 'Timeline', icon: <Clock size={16} />, count: timeline.length },
        interventions: { label: 'Interventions', icon: <Wrench size={16} />, count: interventions.length },
        quotes: { label: 'Devis', icon: <FileSpreadsheet size={16} />, count: quotes.length },
        recurring: { label: 'Récurrences', icon: <RefreshCw size={16} />, count: recurringInterventions.length },
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Building2 className="text-blue-600" size={24} />
                            {customerName}
                        </h3>
                        <p className="text-sm text-gray-500 mt-0.5">Historique complet et analytiques du client</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/80 rounded-lg transition"><X size={20} /></button>
                </div>

                {/* Stats Row */}
                <div className="px-6 py-4 border-b border-gray-100 bg-white">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                            { label: 'Interventions', value: stats.totalInterventions, icon: <Wrench size={16} />, color: 'text-blue-600 bg-blue-50' },
                            { label: 'Taux réussite', value: `${stats.completionRate}%`, icon: <TrendingUp size={16} />, color: 'text-green-600 bg-green-50' },
                            { label: 'Durée moy.', value: `${stats.avgDuration}min`, icon: <Clock size={16} />, color: 'text-amber-600 bg-amber-50' },
                            { label: 'Devis total', value: `${stats.totalQuoteAmount?.toFixed(0) || 0}€`, icon: <DollarSign size={16} />, color: 'text-purple-600 bg-purple-50' },
                            { label: 'Récurrences', value: stats.activeRecurring, icon: <RefreshCw size={16} />, color: 'text-indigo-600 bg-indigo-50' },
                        ].map((s, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                                <div className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center`}>{s.icon}</div>
                                <div>
                                    <p className="text-lg font-bold text-gray-900 leading-tight">{s.value}</p>
                                    <p className="text-xs text-gray-500">{s.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-6 border-b border-gray-100 bg-white">
                    <div className="flex gap-1">
                        {TAB_ITEMS.map((tab) => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                {tabLabels[tab].icon}
                                {tabLabels[tab].label}
                                <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === tab ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>{tabLabels[tab].count}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'timeline' && (
                        <div className="relative">
                            {/* Timeline line */}
                            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
                            <div className="space-y-4">
                                {timeline.length === 0 ? (
                                    <div className="text-center py-10 text-gray-400">Aucun événement dans l'historique</div>
                                ) : timeline.map((item: any, idx: number) => (
                                    <div key={idx} className="relative flex items-start gap-4 pl-2">
                                        <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${item.type === 'intervention' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                            {item.type === 'intervention' ? <Wrench size={14} /> : <FileSpreadsheet size={14} />}
                                        </div>
                                        <div className="flex-1 bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-all">
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className="font-medium text-gray-900 text-sm">{item.title}</h4>
                                                <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                                                    style={{ backgroundColor: STATUS_BADGE[item.status]?.bg, color: STATUS_BADGE[item.status]?.color }}
                                                >{STATUS_BADGE[item.status]?.label || item.status}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                                <span className="flex items-center gap-1"><Calendar size={12} /> {format(new Date(item.date), 'dd/MM/yyyy HH:mm')}</span>
                                                {item.employee && <span className="flex items-center gap-1"><User size={12} /> {item.employee.name}</span>}
                                                {item.type === 'intervention' && item.partsCount > 0 && (
                                                    <span className="flex items-center gap-1"><Package size={12} /> {item.partsCount} pièce(s) — {item.partsCost?.toFixed(2)}€</span>
                                                )}
                                                {item.type === 'quote' && (
                                                    <span className="flex items-center gap-1"><DollarSign size={12} /> {item.totalAmount?.toFixed(2)}€</span>
                                                )}
                                                {item.hasSignature && <span className="flex items-center gap-1 text-green-500"><CheckCircle2 size={12} /> Signé</span>}
                                                {item.hasReport && <span className="flex items-center gap-1 text-blue-500"><FileText size={12} /> Rapport</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'interventions' && (
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                            {interventions.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">Aucune intervention</div>
                            ) : (
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-100 bg-gray-50/50">
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Intervention</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Technicien</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                                            <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Signature</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {interventions.map((i: any) => (
                                            <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                                                <td className="py-3 px-4">
                                                    <p className="font-medium text-gray-900 text-sm">{i.title}</p>
                                                    {i.interventionType && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full mt-0.5 inline-block"
                                                            style={{ backgroundColor: i.interventionType.color + '20', color: i.interventionType.color }}
                                                        >{i.interventionType.name}</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="text-sm text-gray-700 flex items-center gap-1.5"><User size={14} className="text-gray-400" /> {i.employee?.name || '—'}</span>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">{format(new Date(i.scheduledStart), 'dd/MM/yyyy HH:mm')}</td>
                                                <td className="py-3 px-4">
                                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                                                        style={{ backgroundColor: STATUS_BADGE[i.status]?.bg, color: STATUS_BADGE[i.status]?.color }}
                                                    >{STATUS_BADGE[i.status]?.label || i.status}</span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    {i.signatureUrl ? <CheckCircle2 size={18} className="text-green-500 mx-auto" /> : <span className="text-gray-300">—</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {activeTab === 'quotes' && (
                        <div className="space-y-3">
                            {quotes.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">Aucun devis</div>
                            ) : quotes.map((q: any) => (
                                <div key={q.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-all">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-mono text-xs text-gray-400">{q.quoteNumber}</span>
                                                <h4 className="font-medium text-gray-900 text-sm">{q.title}</h4>
                                                <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                                                    style={{ backgroundColor: STATUS_BADGE[q.status]?.bg, color: STATUS_BADGE[q.status]?.color }}
                                                >{STATUS_BADGE[q.status]?.label || q.status}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-gray-500">
                                                <span className="flex items-center gap-1"><Calendar size={12} /> {format(new Date(q.createdAt), 'dd/MM/yyyy')}</span>
                                                <span>{q.lineItems?.length || 0} ligne(s)</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-gray-900">{q.totalAmount?.toFixed(2) || '0.00'}€</p>
                                            <p className="text-xs text-gray-500">TTC</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'recurring' && (
                        <div className="space-y-3">
                            {recurringInterventions.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">Aucune récurrence</div>
                            ) : recurringInterventions.map((r: any) => (
                                <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-all">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-medium text-gray-900 text-sm">{r.title}</h4>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                                                    {r.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-gray-500">
                                                <span className="flex items-center gap-1"><RefreshCw size={12} /> {r.frequency}</span>
                                                <span className="flex items-center gap-1"><User size={12} /> {r.employee?.name}</span>
                                                {r.nextOccurrence && (
                                                    <span className="flex items-center gap-1 text-blue-500"><Calendar size={12} /> Prochaine: {format(new Date(r.nextOccurrence), 'dd/MM/yyyy')}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-medium text-gray-600">{r._count?.interventions || 0} générées</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
