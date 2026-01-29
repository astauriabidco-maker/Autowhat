import { useState, useEffect } from 'react';
import { Clock, Users, Building2, AlertCircle, RefreshCw } from 'lucide-react';

interface Session {
    id: string;
    checkIn: string;
    duration: string;
    durationMinutes: number;
    employee: {
        id: string;
        name: string | null;
        phoneNumber: string;
    };
    tenant: {
        id: string;
        name: string;
    };
}

export default function Sessions() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchSessions();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchSessions, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchSessions = async () => {
        try {
            const token = localStorage.getItem('superadmin_token');
            const response = await fetch('/admin/sessions/active', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            setSessions(data.sessions || []);
        } catch (error) {
            console.error('Error fetching sessions:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchSessions();
    };

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getDurationColor = (minutes: number) => {
        if (minutes > 600) return 'text-red-600 bg-red-100'; // > 10h
        if (minutes > 480) return 'text-orange-600 bg-orange-100'; // > 8h
        return 'text-green-600 bg-green-100';
    };

    if (loading) {
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
                    <h1 className="text-2xl font-bold text-gray-900">Sessions Actives</h1>
                    <p className="text-gray-500 text-sm">Utilisateurs actuellement en pointage</p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    Actualiser
                </button>
            </div>

            {/* Stats Card */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm p-6 text-white">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-xl">
                        <Users className="text-white" size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-blue-100">Sessions en cours</p>
                        <p className="text-3xl font-bold">{sessions.length}</p>
                        <p className="text-xs text-blue-200">Mise à jour auto toutes les 30s</p>
                    </div>
                </div>
            </div>

            {/* Sessions Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 text-left">
                            <tr>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Employé</th>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Client</th>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Début</th>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Durée</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sessions.map((session) => (
                                <tr key={session.id} className="hover:bg-gray-50 transition">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                                                {(session.employee.name || session.employee.phoneNumber).charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">
                                                    {session.employee.name || 'Sans nom'}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {session.employee.phoneNumber}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Building2 size={14} className="text-gray-400" />
                                            <span className="text-sm text-gray-700">{session.tenant.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Clock size={14} className="text-gray-400" />
                                            <span className="text-sm text-gray-700">{formatTime(session.checkIn)}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDurationColor(session.durationMinutes)}`}>
                                            {session.duration}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {sessions.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        <AlertCircle className="mx-auto mb-2 text-gray-400" size={24} />
                                        Aucune session active en ce moment
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
