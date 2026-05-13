import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    Gift,
    Eye,
    UserCheck,
    Ban,
    Trash2,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Plus
} from 'lucide-react';

interface Tenant {
    id: string;
    name: string;
    createdAt: string;
    plan: string;
    trialEndsAt: string | null;
    status: 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
    employeeCount: number;
    maxEmployees: number;
    admin: {
        id: string;
        name: string;
        phone: string;
    } | null;
}

export default function TenantsList() {
    const navigate = useNavigate();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [extendingId, setExtendingId] = useState<string | null>(null);

    useEffect(() => {
        fetchTenants();
    }, [page]);

    const fetchTenants = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('superadmin_token');
            const response = await fetch(`/admin/tenants/list?page=${page}&limit=20`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            setTenants(data.tenants);
            setTotalPages(data.totalPages);
        } catch (error) {
            console.error('Error fetching tenants:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExtendTrial = async (tenantId: string, days: number) => {
        try {
            setExtendingId(tenantId);
            const token = localStorage.getItem('superadmin_token');
            const response = await fetch(`/admin/tenants/${tenantId}/extend-trial`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ days })
            });

            if (response.ok) {
                alert(`✅ Trial étendu de ${days} jours`);
                fetchTenants();
            } else {
                const error = await response.json();
                alert(`❌ Erreur: ${error.error}`);
            }
        } catch (error) {
            console.error('Error extending trial:', error);
            alert('❌ Erreur lors de l\'extension');
        } finally {
            setExtendingId(null);
        }
    };

    const handleChangePlan = async (tenantId: string, tenantName: string, newPlan: string) => {
        if (!confirm(`⚠️ Changer le plan de "${tenantName}" vers ${newPlan} ?`)) {
            return;
        }

        try {
            const token = localStorage.getItem('superadmin_token');
            const response = await fetch(`/admin/tenants/${tenantId}/change-plan`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ plan: newPlan })
            });

            if (response.ok) {
                const data = await response.json();
                alert(`✅ ${data.message}`);
                fetchTenants();
            } else {
                const error = await response.json();
                alert(`❌ Erreur: ${error.error}`);
            }
        } catch (error) {
            console.error('Error changing plan:', error);
            alert('❌ Erreur lors du changement de plan');
        }
    };

    const handleImpersonate = async (tenantId: string, tenantName: string) => {
        if (!confirm(`⚠️ Prendre le contrôle de "${tenantName}" ?\n\nVous agirez en tant qu'administrateur de ce client.`)) {
            return;
        }

        try {
            const token = localStorage.getItem('superadmin_token');
            const response = await fetch(`/admin/tenants/${tenantId}/impersonate`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                await response.json();

                // Store SuperAdmin token for later restoration
                sessionStorage.setItem('superadmin_original_token', 'cookie');
                sessionStorage.setItem('impersonated_tenant_name', tenantName);

                // Keep only a non-secret marker; the impersonation JWT is held in an HttpOnly cookie.
                localStorage.setItem('token', 'cookie');

                // Redirect to client dashboard
                navigate('/dashboard');
            } else {
                const error = await response.json();
                alert(`❌ Erreur: ${error.error}`);
            }
        } catch (error) {
            console.error('Error impersonating:', error);
            alert('❌ Erreur lors de l\'impersonation');
        }
    };

    const handleSuspend = async (tenantId: string, tenantName: string, currentStatus: string) => {
        const action = currentStatus === 'SUSPENDED' ? 'reactivate' : 'suspend';
        const actionLabel = action === 'suspend' ? 'Suspendre' : 'Réactiver';

        if (!confirm(`⚠️ ${actionLabel} "${tenantName}" ?${action === 'suspend' ? '\n\nLe client ne pourra plus accéder à son compte.' : ''}`)) {
            return;
        }

        try {
            const token = localStorage.getItem('superadmin_token');
            const response = await fetch(`/admin/tenants/${tenantId}/suspend`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action })
            });

            if (response.ok) {
                const data = await response.json();
                alert(`✅ ${data.message}`);
                fetchTenants();
            } else {
                const error = await response.json();
                alert(`❌ Erreur: ${error.error}`);
            }
        } catch (error) {
            console.error('Error suspending tenant:', error);
            alert('❌ Erreur lors de la suspension');
        }
    };

    const handleDelete = async (tenantId: string, tenantName: string) => {
        if (!confirm(`🗑️ SUPPRIMER DÉFINITIVEMENT "${tenantName}" ?\n\n⚠️ ATTENTION: Cette action est IRRÉVERSIBLE.\nToutes les données seront perdues.`)) {
            return;
        }

        // Double confirmation
        if (!confirm(`🚨 DERNIÈRE CHANCE !\n\nConfirmez-vous la suppression définitive de "${tenantName}" ?`)) {
            return;
        }

        try {
            const token = localStorage.getItem('superadmin_token');
            const response = await fetch(`/admin/tenants/${tenantId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                alert(`✅ ${data.message}`);
                fetchTenants();
            } else {
                const error = await response.json();
                alert(`❌ Erreur: ${error.error}`);
            }
        } catch (error) {
            console.error('Error deleting tenant:', error);
            alert('❌ Erreur lors de la suppression');
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const filteredTenants = search
        ? tenants.filter(t =>
            t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.admin?.name?.toLowerCase().includes(search.toLowerCase())
        )
        : tenants;

    if (loading && tenants.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                    Gestion des Clients
                </h2>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/superadmin/tenants/create')}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                        <Plus size={18} />
                        Nouveau Client
                    </button>
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 text-left">
                            <tr>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Entreprise</th>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Admin</th>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Plan</th>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Fin d'essai</th>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Employés</th>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredTenants.map((tenant) => (
                                <tr key={tenant.id} className="hover:bg-gray-50 transition">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white font-bold">
                                                {tenant.name.charAt(0)}
                                            </div>
                                            <div>
                                                <button
                                                    onClick={() => navigate(`/superadmin/tenants/${tenant.id}`)}
                                                    className="font-medium text-gray-900 hover:text-indigo-600 transition"
                                                >
                                                    {tenant.name}
                                                </button>
                                                <p className="text-xs text-gray-500">ID: {tenant.id.slice(0, 8)}...</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {tenant.admin ? (
                                            <div>
                                                <p className="text-sm text-gray-900">{tenant.admin.name}</p>
                                                <p className="text-xs text-gray-500">{tenant.admin.phone}</p>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {/* Plan Dropdown */}
                                        <select
                                            value={tenant.plan}
                                            onChange={(e) => handleChangePlan(tenant.id, tenant.name, e.target.value)}
                                            className={`text-xs font-medium px-2 py-1 rounded-lg border-0 cursor-pointer ${tenant.plan === 'ENTERPRISE' ? 'bg-purple-100 text-purple-700' :
                                                tenant.plan === 'PRO' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                                }`}
                                        >
                                            <option value="TRIAL">Trial</option>
                                            <option value="PRO">Pro</option>
                                            <option value="ENTERPRISE">Enterprise</option>
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {formatDate(tenant.trialEndsAt)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm text-gray-600">
                                            {tenant.employeeCount}/{tenant.maxEmployees}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {/* Extend Trial Button */}
                                            <button
                                                onClick={() => handleExtendTrial(tenant.id, 14)}
                                                disabled={extendingId === tenant.id}
                                                className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition disabled:opacity-50 flex items-center gap-1"
                                                title="Étendre l'essai de 14 jours"
                                            >
                                                <Gift size={12} />
                                                +14j
                                            </button>

                                            {/* Impersonate Button */}
                                            <button
                                                onClick={() => handleImpersonate(tenant.id, tenant.name)}
                                                disabled={!tenant.admin}
                                                className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                                                title={tenant.admin ? 'Se connecter comme manager' : 'Aucun manager disponible'}
                                            >
                                                <UserCheck size={12} />
                                                Mode support
                                            </button>

                                            <button
                                                onClick={() => navigate(`/superadmin/tenants/${tenant.id}`)}
                                                className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition flex items-center gap-1"
                                                title="Voir la fiche client"
                                            >
                                                <Eye size={12} />
                                                Détails
                                            </button>

                                            {/* Suspend Button */}
                                            <button
                                                onClick={() => handleSuspend(tenant.id, tenant.name, tenant.status || 'ACTIVE')}
                                                className={`px-2 py-1 text-xs rounded transition flex items-center gap-1 ${tenant.status === 'SUSPENDED'
                                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                                    }`}
                                                title={tenant.status === 'SUSPENDED' ? 'Réactiver' : 'Suspendre'}
                                            >
                                                <Ban size={12} />
                                                {tenant.status === 'SUSPENDED' ? 'Activer' : 'Suspendre'}
                                            </button>

                                            {/* Delete Button */}
                                            <button
                                                onClick={() => handleDelete(tenant.id, tenant.name)}
                                                className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition flex items-center gap-1"
                                                title="Supprimer définitivement"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredTenants.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <AlertCircle className="mx-auto mb-2 text-gray-400" size={24} />
                                        Aucun client trouvé
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                            Page {page} sur {totalPages}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
