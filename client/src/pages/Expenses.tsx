import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Receipt,
    Check,
    X,
    Filter,
    Loader2,
    CheckCircle,
    XCircle,
    Clock,
    Euro,
    User,
    Calendar,
    Image
} from 'lucide-react';
import { useSiteContext } from '../context/SiteContext';

interface ExpenseRecord {
    id: string;
    date: string;
    amount: number;
    category: string;
    categoryLabel: string;
    photoUrl: string | null;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    employee: {
        id: string;
        name: string;
        phoneNumber: string;
    };
}

const CATEGORY_ICONS: Record<string, string> = {
    FOOD: '🍔',
    FUEL: '⛽',
    TRANSPORT: '🚗',
    SUPPLIES: '📦',
    OTHER: '📋',
    MEAL: '🍔',
    TRAVEL: '✈️',
    MATERIAL: '🛠️'
};

interface ToastProps {
    message: string;
    type: 'success' | 'error';
    onClose: () => void;
}

function Toast({ message, type, onClose }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg text-white ${type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}>
            {type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
            {message}
        </div>
    );
}

interface ImageModalProps {
    src: string;
    onClose: () => void;
}

function ImageModal({ src, onClose }: ImageModalProps) {
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

function getInitials(name: string | null): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getAvatarColor(name: string | null): string {
    if (!name) return 'from-gray-400 to-gray-500';
    const colors = [
        'from-blue-500 to-indigo-500',
        'from-green-500 to-emerald-500',
        'from-purple-500 to-pink-500',
        'from-orange-500 to-red-500',
        'from-teal-500 to-cyan-500'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
}

function formatPhotoUrl(url: string | null): string {
    if (!url) return '';
    return url.startsWith('http') ? url : `http://localhost:3000${url}`;
}

export default function Expenses() {
    const navigate = useNavigate();
    const { selectedSiteId } = useSiteContext();
    const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending'>('pending');
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
            return;
        }
        fetchExpenses();
    }, [navigate, selectedSiteId]); // Refetch on site change

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get<{ expenses: ExpenseRecord[] }>(
                '/api/expenses',
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setExpenses(response.data.expenses);
        } catch (err: any) {
            if (err.response?.status === 401) {
                localStorage.removeItem('token');
                navigate('/');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (id: string, status: 'APPROVED' | 'REJECTED') => {
        setUpdatingId(id);

        // Optimistic UI update
        setExpenses(prev =>
            prev.map(exp =>
                exp.id === id ? { ...exp, status } : exp
            )
        );

        try {
            const token = localStorage.getItem('token');
            await axios.patch(
                `/api/expenses/${id}/status`,
                { status },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setToast({
                message: status === 'APPROVED' ? '✅ Note validée' : '❌ Note refusée',
                type: 'success'
            });
        } catch (err: any) {
            // Rollback on error
            setExpenses(prev =>
                prev.map(exp =>
                    exp.id === id ? { ...exp, status: 'PENDING' } : exp
                )
            );
            setToast({ message: 'Erreur lors de la mise à jour', type: 'error' });
        } finally {
            setUpdatingId(null);
        }
    };

    // Filter expenses
    const filteredExpenses = filter === 'pending'
        ? expenses.filter(e => e.status === 'PENDING')
        : expenses;

    // Stats
    const pendingCount = expenses.filter(e => e.status === 'PENDING').length;
    const pendingAmount = expenses
        .filter(e => e.status === 'PENDING')
        .reduce((sum, e) => sum + e.amount, 0);
    const approvedAmount = expenses
        .filter(e => e.status === 'APPROVED')
        .reduce((sum, e) => sum + e.amount, 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Notes de Frais</h1>
                    <p className="text-gray-500 mt-1">Validation rapide des dépenses</p>
                </div>
            </div>

            {/* Stats Cards - Revolut Style */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-5 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-amber-100 text-sm font-medium">En attente</p>
                            <p className="text-3xl font-bold mt-1">{pendingCount}</p>
                        </div>
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                            <Clock size={24} />
                        </div>
                    </div>
                    <p className="mt-3 text-amber-100 text-sm">{pendingAmount.toFixed(2)} € à traiter</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl p-5 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-emerald-100 text-sm font-medium">Approuvés</p>
                            <p className="text-3xl font-bold mt-1">{approvedAmount.toFixed(2)} €</p>
                        </div>
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                            <CheckCircle size={24} />
                        </div>
                    </div>
                    <p className="mt-3 text-emerald-100 text-sm">Ce mois</p>
                </div>

                <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl p-5 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-300 text-sm font-medium">Total</p>
                            <p className="text-3xl font-bold mt-1">{expenses.length}</p>
                        </div>
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                            <Receipt size={24} />
                        </div>
                    </div>
                    <p className="mt-3 text-slate-300 text-sm">Notes de frais</p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="bg-white rounded-xl border border-gray-200 p-2 shadow-sm inline-flex gap-1">
                <button
                    onClick={() => setFilter('pending')}
                    className={`px-4 py-2 rounded-lg font-medium transition ${filter === 'pending'
                        ? 'bg-amber-100 text-amber-700'
                        : 'text-gray-500 hover:bg-gray-100'
                        }`}
                >
                    <Clock size={16} className="inline mr-2" />
                    En attente ({pendingCount})
                </button>
                <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-lg font-medium transition ${filter === 'all'
                        ? 'bg-gray-100 text-gray-700'
                        : 'text-gray-500 hover:bg-gray-100'
                        }`}
                >
                    <Filter size={16} className="inline mr-2" />
                    Tous ({expenses.length})
                </button>
            </div>

            {/* Expense Cards / Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="animate-spin text-gray-400" size={32} />
                    </div>
                ) : filteredExpenses.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                        <Receipt size={48} className="mx-auto mb-3 opacity-50" />
                        <p className="font-medium">Aucune note de frais</p>
                        <p className="text-sm mt-1">
                            {filter === 'pending' ? 'Toutes les notes ont été traitées !' : 'Aucune dépense enregistrée'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {filteredExpenses.map((expense) => (
                            <div
                                key={expense.id}
                                className={`flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition ${expense.status !== 'PENDING' ? 'opacity-75' : ''
                                    }`}
                            >
                                {/* Date & Employee */}
                                <div className="flex items-center gap-3 min-w-[200px]">
                                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(expense.employee.name)} flex items-center justify-center text-white font-bold text-sm`}>
                                        {getInitials(expense.employee.name)}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">{expense.employee.name}</p>
                                        <p className="text-sm text-gray-500">{expense.date}</p>
                                    </div>
                                </div>

                                {/* Category */}
                                <div className="flex items-center gap-2 min-w-[150px]">
                                    <span className="text-2xl">{CATEGORY_ICONS[expense.category] || '📋'}</span>
                                    <span className="text-gray-700">{expense.categoryLabel}</span>
                                </div>

                                {/* Photo Preview - CRITICAL */}
                                <div className="flex-shrink-0">
                                    {expense.photoUrl ? (
                                        <div
                                            className="relative group cursor-pointer"
                                            onClick={() => setPreviewImage(formatPhotoUrl(expense.photoUrl))}
                                        >
                                            <img
                                                src={formatPhotoUrl(expense.photoUrl)}
                                                alt="Ticket"
                                                className="w-14 h-14 object-cover rounded-lg border-2 border-gray-200 group-hover:border-indigo-400 group-hover:scale-110 transition-all shadow-sm"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition-opacity">
                                                <Image size={20} className="text-white" />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                                            <Receipt size={20} />
                                        </div>
                                    )}
                                </div>

                                {/* Amount - Big & Bold */}
                                <div className="flex-1 text-right">
                                    <span className="text-2xl font-bold text-gray-900">
                                        {expense.amount.toFixed(2)}
                                    </span>
                                    <span className="text-lg text-gray-500 ml-1">€</span>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 min-w-[140px] justify-end">
                                    {expense.status === 'PENDING' ? (
                                        <>
                                            <button
                                                onClick={() => handleStatusUpdate(expense.id, 'APPROVED')}
                                                disabled={updatingId === expense.id}
                                                className="w-10 h-10 bg-green-100 hover:bg-green-500 hover:text-white text-green-600 rounded-full flex items-center justify-center transition disabled:opacity-50"
                                                title="Valider"
                                            >
                                                {updatingId === expense.id ? (
                                                    <Loader2 size={18} className="animate-spin" />
                                                ) : (
                                                    <Check size={20} strokeWidth={3} />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleStatusUpdate(expense.id, 'REJECTED')}
                                                disabled={updatingId === expense.id}
                                                className="w-10 h-10 bg-red-100 hover:bg-red-500 hover:text-white text-red-600 rounded-full flex items-center justify-center transition disabled:opacity-50"
                                                title="Refuser"
                                            >
                                                <X size={20} strokeWidth={3} />
                                            </button>
                                        </>
                                    ) : (
                                        <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${expense.status === 'APPROVED'
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-red-100 text-red-700'
                                            }`}>
                                            {expense.status === 'APPROVED' ? (
                                                <>
                                                    <CheckCircle size={14} />
                                                    Approuvé
                                                </>
                                            ) : (
                                                <>
                                                    <XCircle size={14} />
                                                    Refusé
                                                </>
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Image Preview Modal */}
            {previewImage && (
                <ImageModal src={previewImage} onClose={() => setPreviewImage(null)} />
            )}

            {/* Toast */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}
