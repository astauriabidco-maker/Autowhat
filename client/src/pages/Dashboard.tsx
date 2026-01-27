import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface AttendanceRecord {
    id: string;
    employee: {
        id: string;
        name: string;
        phoneNumber: string;
        role: string;
    };
    date: string;
    checkIn: string;
    checkOut: string | null;
    status: string;
    duration: string;
    photoUrl: string | null;
    latitude: number | null;
    longitude: number | null;
    distanceFromSite: number | null;
}

interface AttendanceResponse {
    period: string;
    count: number;
    attendances: AttendanceRecord[];
}

export default function Dashboard() {
    const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [period, setPeriod] = useState('today');
    const [user, setUser] = useState<{ name: string; tenant: string } | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        // Check authentication
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');

        if (!token) {
            navigate('/');
            return;
        }

        if (userData) {
            setUser(JSON.parse(userData));
        }

        fetchAttendances(period);
    }, [period, navigate]);

    const fetchAttendances = async (selectedPeriod: string) => {
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            const response = await axios.get<AttendanceResponse>(
                `/api/attendance?period=${selectedPeriod}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
            setAttendances(response.data.attendances);
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

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    const exportToCSV = () => {
        const headers = ['Employé', 'Téléphone', 'Date', 'Arrivée', 'Départ', 'Durée', 'Statut'];
        const rows = attendances.map(a => [
            a.employee.name,
            a.employee.phoneNumber,
            a.date,
            a.checkIn,
            a.checkOut || '-',
            a.duration,
            a.status,
        ]);

        const csvContent = [
            headers.join(';'),
            ...rows.map(row => row.join(';'))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `presences_${period}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            📊 Dashboard RH
                        </h1>
                        {user && (
                            <p className="text-sm text-gray-500">
                                {user.name} • {user.tenant}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={handleLogout}
                        className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                    >
                        Déconnexion
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Controls */}
                <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex gap-2">
                        {['today', 'week', 'month'].map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${period === p
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {p === 'today' ? "Aujourd'hui" : p === 'week' ? 'Cette semaine' : 'Ce mois'}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={exportToCSV}
                        disabled={attendances.length === 0}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                    >
                        📥 Exporter CSV
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-6">
                        ⚠️ {error}
                    </div>
                )}

                {/* Table */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">
                            Chargement...
                        </div>
                    ) : attendances.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            Aucun pointage pour cette période
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                            Employé
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                            Date
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                            Arrivée
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                            Départ
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                            Durée
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                            Statut
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                            Preuve
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                            Lieu
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {attendances.map((a) => (
                                        <tr key={a.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">
                                                    {a.employee.name}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {a.employee.phoneNumber}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-700">
                                                {a.date}
                                            </td>
                                            <td className="px-6 py-4 text-gray-700 font-mono">
                                                {a.checkIn}
                                            </td>
                                            <td className="px-6 py-4 text-gray-700 font-mono">
                                                {a.checkOut || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-gray-700">
                                                {a.duration}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${a.status === 'PRESENT'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {a.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {a.photoUrl ? (
                                                    <a
                                                        href={a.photoUrl.startsWith('http') ? a.photoUrl : `http://localhost:3000${a.photoUrl}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-2xl hover:scale-110 transition-transform inline-block"
                                                        title="Voir la photo de preuve"
                                                    >
                                                        📷
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-300 text-xs">Aucune</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {a.latitude && a.longitude ? (
                                                    <a
                                                        href={`https://www.google.com/maps/search/?api=1&query=${a.latitude},${a.longitude}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-2xl hover:scale-110 transition-transform inline-block"
                                                        title={`Voir sur la carte (${a.distanceFromSite || '?'}m du site)`}
                                                    >
                                                        📍
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-300 text-xs">Inconnu</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Summary */}
                {!loading && attendances.length > 0 && (
                    <div className="mt-4 text-sm text-gray-500 text-right">
                        Total: {attendances.length} pointage(s)
                    </div>
                )}
            </main>
        </div>
    );
}
