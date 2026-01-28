import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import clsx from 'clsx';
import { Download, Camera, MapPin, Clock, AlertCircle } from 'lucide-react';

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
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
            return;
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
                    headers: { Authorization: `Bearer ${token}` }
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

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PRESENT':
                return { label: 'Présent', bg: 'bg-green-100', text: 'text-green-700' };
            case 'LATE':
                return { label: 'En retard', bg: 'bg-amber-100', text: 'text-amber-700' };
            case 'ABSENT':
                return { label: 'Absent', bg: 'bg-red-100', text: 'text-red-700' };
            default:
                return { label: status, bg: 'bg-gray-100', text: 'text-gray-700' };
        }
    };

    // Stats
    const presentCount = attendances.filter(a => a.status === 'PRESENT' || a.checkIn).length;
    const withPhotoCount = attendances.filter(a => a.photoUrl).length;
    const withGpsCount = attendances.filter(a => a.latitude && a.longitude).length;

    return (
        <div className="space-y-6">
            {/* Controls Bar */}
            <div className="flex flex-wrap gap-4 items-center justify-between">
                {/* Period Tabs */}
                <div className="flex bg-white rounded-lg border border-gray-200 p-1">
                    {[
                        { key: 'today', label: "Aujourd'hui" },
                        { key: 'week', label: 'Cette semaine' },
                        { key: 'month', label: 'Ce mois' }
                    ].map((p) => (
                        <button
                            key={p.key}
                            onClick={() => setPeriod(p.key)}
                            className={clsx(
                                'px-4 py-2 rounded-md text-sm font-medium transition',
                                period === p.key
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-600 hover:bg-gray-100'
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* Export Button */}
                <button
                    onClick={exportToCSV}
                    disabled={attendances.length === 0}
                    className={clsx(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition',
                        attendances.length === 0
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-green-600 text-white hover:bg-green-700'
                    )}
                >
                    <Download size={16} />
                    Exporter CSV
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                        <Clock size={20} className="text-blue-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Pointages</p>
                        <p className="text-2xl font-bold text-gray-900">{presentCount}</p>
                    </div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
                    <div className="p-3 bg-purple-100 rounded-lg">
                        <Camera size={20} className="text-purple-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Avec photo</p>
                        <p className="text-2xl font-bold text-gray-900">{withPhotoCount}</p>
                    </div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                        <MapPin size={20} className="text-green-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Avec GPS</p>
                        <p className="text-2xl font-bold text-gray-900">{withGpsCount}</p>
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-500">
                        Chargement des pointages...
                    </div>
                ) : attendances.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <Clock size={32} className="mx-auto mb-2 text-gray-300" />
                        <p>Aucun pointage pour cette période</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employé</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Arrivée</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Départ</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durée</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Preuve</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Lieu</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {attendances.map((a) => {
                                    const statusBadge = getStatusBadge(a.status);
                                    return (
                                        <tr key={a.id} className="hover:bg-gray-50 transition">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                                        {a.employee.name?.charAt(0)?.toUpperCase() || '?'}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{a.employee.name}</p>
                                                        <p className="text-xs text-gray-500">{a.employee.phoneNumber}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{a.date}</td>
                                            <td className="px-4 py-3 text-sm font-mono text-gray-900">{a.checkIn}</td>
                                            <td className="px-4 py-3 text-sm font-mono text-gray-600">{a.checkOut || '—'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{a.duration}</td>
                                            <td className="px-4 py-3">
                                                <span className={clsx(
                                                    'inline-flex px-2.5 py-1 text-xs font-medium rounded-full',
                                                    statusBadge.bg,
                                                    statusBadge.text
                                                )}>
                                                    {statusBadge.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {a.photoUrl ? (
                                                    <a
                                                        href={a.photoUrl.startsWith('http') ? a.photoUrl : `http://localhost:3000${a.photoUrl}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                                                    >
                                                        <Camera size={16} />
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-300">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {a.latitude && a.longitude ? (
                                                    <a
                                                        href={`https://www.google.com/maps/search/?api=1&query=${a.latitude},${a.longitude}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                                                        title={a.distanceFromSite ? `${a.distanceFromSite}m du site` : 'Voir sur la carte'}
                                                    >
                                                        <MapPin size={16} />
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-300">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Summary Footer */}
            {!loading && attendances.length > 0 && (
                <div className="text-sm text-gray-500 text-right">
                    Total: {attendances.length} pointage(s) sur la période
                </div>
            )}
        </div>
    );
}
