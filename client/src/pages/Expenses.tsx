import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface ExpenseRecord {
    id: string;
    date: string;
    amount: number;
    category: string;
    categoryLabel: string;
    photoUrl: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    employee: {
        id: string;
        name: string;
        phoneNumber: string;
    };
}

const STATUS_STYLES = {
    PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
    APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    REJECTED: 'bg-red-100 text-red-800 border-red-200'
};

const STATUS_LABELS = {
    PENDING: 'En attente',
    APPROVED: 'Approuvée',
    REJECTED: 'Refusée'
};

export default function Expenses() {
    const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [user, setUser] = useState<{ name: string; tenant: string } | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');

        if (!token) {
            navigate('/');
            return;
        }

        if (userData) {
            setUser(JSON.parse(userData));
        }

        fetchExpenses();
    }, [navigate]);

    const fetchExpenses = async () => {
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            const response = await axios.get<{ expenses: ExpenseRecord[] }>(
                '/api/expenses',
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setExpenses(response.data.expenses);
        } catch (err: any) {
            if (err.response?.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                navigate('/');
            } else {
                setError(err.response?.data?.error || 'Erreur lors du chargement');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (id: string, status: 'APPROVED' | 'REJECTED') => {
        setUpdatingId(id);
        try {
            const token = localStorage.getItem('token');
            await axios.patch(
                `/api/expenses/${id}/status`,
                { status },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Optimistic UI update
            setExpenses(prev =>
                prev.map(exp =>
                    exp.id === id ? { ...exp, status } : exp
                )
            );
        } catch (err: any) {
            setError(err.response?.data?.error || 'Erreur lors de la mise à jour');
        } finally {
            setUpdatingId(null);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    const pendingCount = expenses.filter(e => e.status === 'PENDING').length;
    const totalPending = expenses
        .filter(e => e.status === 'PENDING')
        .reduce((sum, e) => sum + e.amount, 0);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-6">
                        <div>
                            <h1 className="text-xl font-semibold text-slate-900">
                                🧾 Notes de Frais
                            </h1>
                            {user && (
                                <p className="text-sm text-slate-500">
                                    {user.name} • {user.tenant}
                                </p>
                            )}
                        </div>
                        <nav className="hidden md:flex gap-4 ml-8">
                            <a
                                href="/dashboard"
                                className="text-sm text-slate-600 hover:text-slate-900 transition"
                            >
                                📊 Pointages
                            </a>
                            <span className="text-sm text-slate-900 font-medium border-b-2 border-slate-900 pb-1">
                                🧾 Frais
                            </span>
                        </nav>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="text-slate-600 hover:text-slate-900 text-sm font-medium"
                    >
                        Déconnexion
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <p className="text-sm text-slate-500 mb-1">En attente</p>
                        <p className="text-2xl font-semibold text-amber-600">{pendingCount}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <p className="text-sm text-slate-500 mb-1">Montant à traiter</p>
                        <p className="text-2xl font-semibold text-slate-900">{totalPending.toFixed(2)} €</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <p className="text-sm text-slate-500 mb-1">Total</p>
                        <p className="text-2xl font-semibold text-slate-900">{expenses.length}</p>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-6 border border-red-200">
                        ⚠️ {error}
                    </div>
                )}

                {/* Table */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center text-slate-500">
                            <div className="animate-pulse">Chargement...</div>
                        </div>
                    ) : expenses.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">
                            <p className="text-4xl mb-3">🧾</p>
                            <p>Aucune note de frais</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                            Date
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                            Employé
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                            Catégorie
                                        </th>
                                        <th className="px-6 py-4 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                                            Montant
                                        </th>
                                        <th className="px-6 py-4 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                                            Preuve
                                        </th>
                                        <th className="px-6 py-4 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                                            Statut
                                        </th>
                                        <th className="px-6 py-4 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {expenses.map((expense) => (
                                        <tr
                                            key={expense.id}
                                            className="hover:bg-slate-50/50 transition"
                                        >
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {expense.date}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-slate-900 text-sm">
                                                    {expense.employee.name}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    {expense.employee.phoneNumber}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                {expense.categoryLabel}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="font-semibold text-slate-900">
                                                    {expense.amount.toFixed(2)} €
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {expense.photoUrl ? (
                                                    <a
                                                        href={expense.photoUrl.startsWith('http')
                                                            ? expense.photoUrl
                                                            : `http://localhost:3000${expense.photoUrl}`
                                                        }
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-block"
                                                    >
                                                        <img
                                                            src={expense.photoUrl.startsWith('http')
                                                                ? expense.photoUrl
                                                                : `http://localhost:3000${expense.photoUrl}`
                                                            }
                                                            alt="Ticket"
                                                            className="w-10 h-10 object-cover rounded-lg border border-slate-200 hover:scale-105 transition cursor-pointer"
                                                        />
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span
                                                    className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border ${STATUS_STYLES[expense.status]}`}
                                                >
                                                    {STATUS_LABELS[expense.status]}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {expense.status === 'PENDING' ? (
                                                    <div className="flex justify-center gap-2">
                                                        <button
                                                            onClick={() => handleStatusUpdate(expense.id, 'APPROVED')}
                                                            disabled={updatingId === expense.id}
                                                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                                        >
                                                            ✓ Valider
                                                        </button>
                                                        <button
                                                            onClick={() => handleStatusUpdate(expense.id, 'REJECTED')}
                                                            disabled={updatingId === expense.id}
                                                            className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                                        >
                                                            ✗ Refuser
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
