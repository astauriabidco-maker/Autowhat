import { useState, useEffect } from 'react';
import { History, RefreshCw, User, Building2, ChevronLeft, ChevronRight } from 'lucide-react';

interface ActionLog {
    id: string;
    superAdminId: string;
    action: string;
    targetType: string;
    targetId: string;
    targetName: string | null;
    details: {
        oldPlan?: string;
        newPlan?: string;
        days?: number;
        newTrialEndsAt?: string;
        adminId?: string;
        adminName?: string;
    } | null;
    createdAt: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
    IMPERSONATE: { label: 'Impersonation', color: 'bg-red-100 text-red-700' },
    EXTEND_TRIAL: { label: 'Extension Trial', color: 'bg-yellow-100 text-yellow-700' },
    CHANGE_PLAN: { label: 'Changement Plan', color: 'bg-blue-100 text-blue-700' },
    SUSPEND: { label: 'Suspension', color: 'bg-orange-100 text-orange-700' },
    DELETE: { label: 'Suppression', color: 'bg-gray-100 text-gray-700' },
};

export default function Logs() {
    const [logs, setLogs] = useState<ActionLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        fetchLogs();
    }, [page]);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('superadmin_token');
            const response = await fetch(`/admin/logs?page=${page}&limit=25`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setLogs(data.logs);
                setTotalPages(data.pagination.totalPages);
            }
        } catch (error) {
            console.error('Error fetching logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getActionDetails = (log: ActionLog) => {
        if (!log.details) return '-';

        switch (log.action) {
            case 'CHANGE_PLAN':
                return `${log.details.oldPlan} → ${log.details.newPlan}`;
            case 'EXTEND_TRIAL':
                return `+${log.details.days} jours`;
            case 'IMPERSONATE':
                return `Admin: ${log.details.adminName || log.details.adminId}`;
            default:
                return JSON.stringify(log.details);
        }
    };

    if (loading && logs.length === 0) {
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
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <History size={24} />
                        Journal d'Actions
                    </h1>
                    <p className="text-gray-500">Historique des actions SuperAdmin</p>
                </div>
                <button
                    onClick={fetchLogs}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                >
                    <RefreshCw size={16} />
                    Actualiser
                </button>
            </div>

            {/* Logs Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 text-left">
                            <tr>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Cible</th>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Détails</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {logs.map((log) => {
                                const actionConfig = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-700' };

                                return (
                                    <tr key={log.id} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                                            {formatDate(log.createdAt)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${actionConfig.color}`}>
                                                {actionConfig.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {log.targetType === 'TENANT' ? (
                                                    <Building2 size={14} className="text-gray-400" />
                                                ) : (
                                                    <User size={14} className="text-gray-400" />
                                                )}
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {log.targetName || log.targetId.slice(0, 8)}
                                                    </p>
                                                    <p className="text-xs text-gray-400">
                                                        {log.targetType}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {getActionDetails(log)}
                                        </td>
                                    </tr>
                                );
                            })}
                            {logs.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        <History className="mx-auto mb-2 text-gray-400" size={24} />
                                        Aucune action enregistrée
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
