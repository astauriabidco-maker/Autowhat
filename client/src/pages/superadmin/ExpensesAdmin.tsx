import { useEffect, useState } from 'react';
import axios from 'axios';
import {
    Receipt,
    Building2,
    Clock,
    CheckCircle,
    XCircle,
    TrendingUp,
    Filter,
    Loader2,
    Image,
    X
} from 'lucide-react';

interface Expense {
    id: string;
    date: string;
    amount: number | null;
    category: string;
    description: string | null;
    photoUrl: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    currency: string;
    employee: { id: string; name: string | null; phoneNumber: string } | null;
    tenant: { id: string; companyName: string } | null;
}

interface Stats {
    pending: number;
    approved: number;
    rejected: number;
    monthlyTotal: number;
    tenantsCount: number;
}

interface Tenant {
    id: string;
    companyName: string;
}

const CATEGORY_ICONS: Record<string, string> = {
    MEAL: '🍔',
    FUEL: '⛽',
    PARKING: '🅿️',
    TRANSPORT: '🚗',
    HOTEL: '🏨',
    OTHER: '📋'
};

function ImageModal({ src, onClose }: { src: string; onClose: () => void }) {
    return (
        <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div className="relative max-w-3xl max-h-[90vh]">
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 text-white hover:text-gray-300 transition"
                >
                    <X size={32} />
                </button>
                <img
                    src={src}
                    alt="Ticket"
                    className="max-w-full max-h-[85vh] object-contain rounded-lg"
                />
            </div>
        </div>
    );
}

export default function ExpensesAdmin() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // Filters
    const [filterTenant, setFilterTenant] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    useEffect(() => {
        fetchData();
    }, [filterTenant, filterStatus]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('superadmin_token');
            const headers = { Authorization: `Bearer ${token}` };

            // Fetch stats
            const statsRes = await axios.get<Stats>('/superadmin/expenses/stats', { headers });
            setStats(statsRes.data);

            // Fetch expenses with filters
            const params = new URLSearchParams();
            if (filterTenant) params.append('tenantId', filterTenant);
            if (filterStatus !== 'all') params.append('status', filterStatus);

            const expensesRes = await axios.get<{ expenses: Expense[]; total: number }>(
                `/superadmin/expenses?${params.toString()}`,
                { headers }
            );
            setExpenses(expensesRes.data.expenses);

            // Fetch tenants for filter
            const tenantsRes = await axios.get<{ tenants: Tenant[] }>('/admin/tenants', { headers });
            setTenants(tenantsRes.data.tenants || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatPhotoUrl = (url: string | null | undefined) => {
        if (!url) return '';
        return url;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900">Notes de Frais - Vue Globale</h2>
                <p className="text-sm text-gray-500">Toutes les notes de frais de tous les tenants</p>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-5 text-white shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-amber-100 text-sm">En attente</p>
                                <p className="text-3xl font-bold mt-1">{stats.pending}</p>
                            </div>
                            <Clock size={24} className="opacity-70" />
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl p-5 text-white shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-emerald-100 text-sm">Validés ce mois</p>
                                <p className="text-3xl font-bold mt-1">{stats.approved}</p>
                            </div>
                            <CheckCircle size={24} className="opacity-70" />
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl p-5 text-white shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-indigo-100 text-sm">Total validé</p>
                                <p className="text-3xl font-bold mt-1">{(stats.monthlyTotal || 0).toFixed(0)}€</p>
                            </div>
                            <TrendingUp size={24} className="opacity-70" />
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl p-5 text-white shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-slate-300 text-sm">Entreprises actives</p>
                                <p className="text-3xl font-bold mt-1">{stats.tenantsCount}</p>
                            </div>
                            <Building2 size={24} className="opacity-70" />
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex gap-4 items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <Filter size={20} className="text-gray-400" />

                <select
                    value={filterTenant}
                    onChange={(e) => setFilterTenant(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="">Toutes les entreprises</option>
                    {tenants.map(t => (
                        <option key={t.id} value={t.id}>{t.companyName}</option>
                    ))}
                </select>

                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="all">Tous les statuts</option>
                    <option value="PENDING">En attente</option>
                    <option value="APPROVED">Validés</option>
                    <option value="REJECTED">Rejetés</option>
                </select>
            </div>

            {/* Expenses Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="animate-spin text-gray-400" size={32} />
                    </div>
                ) : expenses.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                        <Receipt size={48} className="mx-auto mb-3 opacity-50" />
                        <p className="font-medium">Aucune note de frais</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr className="text-sm text-gray-500">
                                <th className="px-6 py-3 text-left font-medium">Entreprise</th>
                                <th className="px-6 py-3 text-left font-medium">Employé</th>
                                <th className="px-6 py-3 text-left font-medium">Date</th>
                                <th className="px-6 py-3 text-left font-medium">Catégorie</th>
                                <th className="px-6 py-3 text-left font-medium">Photo</th>
                                <th className="px-6 py-3 text-right font-medium">Montant</th>
                                <th className="px-6 py-3 text-center font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {expenses.map((expense) => (
                                <tr key={expense.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Building2 size={16} className="text-gray-400" />
                                            <span className="font-medium text-gray-900">
                                                {expense.tenant?.companyName || 'N/A'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-700">
                                        {expense.employee?.name || 'Inconnu'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-sm">
                                        {formatDate(expense.date)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xl mr-2">{CATEGORY_ICONS[expense.category] || '📋'}</span>
                                        <span className="text-gray-700">{expense.category}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {expense.photoUrl ? (
                                            <div
                                                className="relative group cursor-pointer"
                                                onClick={() => setPreviewImage(formatPhotoUrl(expense.photoUrl))}
                                            >
                                                <img
                                                    src={formatPhotoUrl(expense.photoUrl)}
                                                    alt="Ticket"
                                                    className="w-12 h-12 object-cover rounded-lg border-2 border-gray-200 group-hover:border-indigo-400 transition"
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition-opacity">
                                                    <Image size={16} className="text-white" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                                                <Receipt size={16} />
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="text-xl font-bold text-gray-900">
                                            {expense.amount?.toFixed(2) || '0.00'}
                                        </span>
                                        <span className="text-gray-500 ml-1">{expense.currency}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${expense.status === 'PENDING'
                                            ? 'bg-amber-100 text-amber-700'
                                            : expense.status === 'APPROVED'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                            }`}>
                                            {expense.status === 'PENDING' && <Clock size={12} />}
                                            {expense.status === 'APPROVED' && <CheckCircle size={12} />}
                                            {expense.status === 'REJECTED' && <XCircle size={12} />}
                                            {expense.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Image Preview Modal */}
            {previewImage && (
                <ImageModal src={previewImage} onClose={() => setPreviewImage(null)} />
            )}
        </div>
    );
}
