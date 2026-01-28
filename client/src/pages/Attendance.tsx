import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import {
    Calendar,
    User,
    MapPin,
    Camera,
    Clock,
    Download,
    Filter,
    X,
    ExternalLink,
    Loader2
} from 'lucide-react';
import { useSiteContext } from '../context/SiteContext';

interface Employee {
    id: string;
    name: string;
    phoneNumber: string;
    role: string;
}

interface AttendanceRecord {
    id: string;
    employee: Employee;
    date: string;
    checkIn: string;
    checkOut: string | null;
    status: string;
    photoUrl: string | null;
    latitude: number | null;
    longitude: number | null;
    distanceFromSite: number | null;
    duration: string;
}

interface DetailModalProps {
    record: AttendanceRecord;
    onClose: () => void;
}

function DetailModal({ record, onClose }: DetailModalProps) {
    const hasLocation = record.latitude && record.longitude;
    const mapUrl = hasLocation
        ? `https://www.google.com/maps?q=${record.latitude},${record.longitude}`
        : null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                            {record.employee.name?.charAt(0) || '?'}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{record.employee.name}</h2>
                            <p className="text-gray-500">{record.date} • {record.checkIn} - {record.checkOut || 'En cours'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Photo */}
                    <div className="space-y-3">
                        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                            <Camera size={18} />
                            Preuve Photo
                        </h3>
                        {record.photoUrl ? (
                            <div className="relative aspect-video bg-gray-100 rounded-xl overflow-hidden">
                                <img
                                    src={record.photoUrl}
                                    alt="Preuve de présence"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ) : (
                            <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                                <div className="text-center">
                                    <Camera size={48} className="mx-auto mb-2 opacity-50" />
                                    <p>Aucune photo</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Map */}
                    <div className="space-y-3">
                        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                            <MapPin size={18} />
                            Localisation
                        </h3>
                        {hasLocation ? (
                            <div className="space-y-3">
                                <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden relative">
                                    <iframe
                                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${record.longitude! - 0.01},${record.latitude! - 0.01},${record.longitude! + 0.01},${record.latitude! + 0.01}&layer=mapnik&marker=${record.latitude},${record.longitude}`}
                                        className="w-full h-full border-0"
                                        title="Localisation"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">
                                        {record.latitude?.toFixed(6)}, {record.longitude?.toFixed(6)}
                                    </span>
                                    <a
                                        href={mapUrl!}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                                    >
                                        Ouvrir dans Maps
                                        <ExternalLink size={14} />
                                    </a>
                                </div>
                                {record.distanceFromSite && (
                                    <div className="bg-amber-50 text-amber-700 px-3 py-2 rounded-lg text-sm">
                                        📍 Distance du site : {record.distanceFromSite.toFixed(0)} mètres
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                                <div className="text-center">
                                    <MapPin size={48} className="mx-auto mb-2 opacity-50" />
                                    <p>Position non enregistrée</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                            <Clock size={16} />
                            Durée : <strong>{record.duration}</strong>
                        </span>
                    </div>
                    <StatusBadge status={record.checkOut ? 'COMPLETE' : (record.status || 'IN_PROGRESS')} />
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { bg: string; text: string; label: string }> = {
        COMPLETE: { bg: 'bg-green-100', text: 'text-green-800', label: 'Complet' },
        IN_PROGRESS: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'En cours' },
        INCOMPLETE: { bg: 'bg-red-100', text: 'text-red-800', label: 'Incomplet' },
        CHECKED_IN: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'En cours' }
    };

    const { bg, text, label } = config[status] || config.IN_PROGRESS;

    return (
        <span className={`${bg} ${text} px-3 py-1 rounded-full text-sm font-medium`}>
            {label}
        </span>
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

export default function Attendance() {
    const navigate = useNavigate();
    const { selectedSiteId } = useSiteContext();
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

    // Filters
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
    const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
            return;
        }
        fetchData();
    }, [navigate, period, selectedSiteId]); // Refetch on site change

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const [attendanceRes, employeesRes] = await Promise.all([
                axios.get(`/api/attendance?period=${period}`, { headers }),
                axios.get('/api/employees', { headers })
            ]);

            setRecords(attendanceRes.data.attendances || []);
            setEmployees(employeesRes.data.employees || []);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`/api/export/attendance?period=${period}`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `presences_${period}_${selectedDate}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Export failed:', err);
        }
    };

    // Filter records
    const filteredRecords = records.filter(record => {
        if (selectedEmployee !== 'all' && record.employee.id !== selectedEmployee) {
            return false;
        }
        return true;
    });

    // Stats
    const stats = {
        total: filteredRecords.length,
        complete: filteredRecords.filter(r => r.checkOut).length,
        inProgress: filteredRecords.filter(r => !r.checkOut).length
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Relevé des heures</h1>
                    <p className="text-gray-500 mt-1">Suivi des pointages et présences</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="text-sm text-gray-500">Total pointages</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="text-sm text-gray-500">Journées complètes</div>
                    <div className="text-2xl font-bold text-green-600 mt-1">{stats.complete}</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="text-sm text-gray-500">En cours</div>
                    <div className="text-2xl font-bold text-orange-600 mt-1">{stats.inProgress}</div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Period Selector */}
                    <div className="flex items-center gap-2">
                        <Filter size={18} className="text-gray-400" />
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value as any)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        >
                            <option value="today">Aujourd'hui</option>
                            <option value="week">Cette semaine</option>
                            <option value="month">Ce mois</option>
                        </select>
                    </div>

                    {/* Date Picker */}
                    <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-gray-400" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>

                    {/* Employee Filter */}
                    <div className="flex items-center gap-2">
                        <User size={18} className="text-gray-400" />
                        <select
                            value={selectedEmployee}
                            onChange={(e) => setSelectedEmployee(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white min-w-[150px]"
                        >
                            <option value="all">Tous les employés</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Export Button */}
                    <button
                        onClick={handleExport}
                        className="ml-auto flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                    >
                        <Download size={18} />
                        Exporter
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="animate-spin text-gray-400" size={32} />
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <Clock size={48} className="mx-auto mb-3 opacity-50" />
                        <p>Aucun pointage pour cette période</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={16} />
                                            Date/Heure
                                        </div>
                                    </th>
                                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <User size={16} />
                                            Employé
                                        </div>
                                    </th>
                                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <MapPin size={16} />
                                            Lieu
                                        </div>
                                    </th>
                                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <Camera size={16} />
                                            Preuve
                                        </div>
                                    </th>
                                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <Clock size={16} />
                                            Durée
                                        </div>
                                    </th>
                                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                                        Statut
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredRecords.map((record) => (
                                    <tr
                                        key={record.id}
                                        onClick={() => setSelectedRecord(record)}
                                        className="hover:bg-gray-50 cursor-pointer transition"
                                    >
                                        {/* Date/Heure */}
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">
                                                {record.date}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {record.checkIn} → {record.checkOut || '...'}
                                            </div>
                                        </td>

                                        {/* Employé */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(record.employee.name)} flex items-center justify-center text-white font-bold text-sm`}>
                                                    {getInitials(record.employee.name)}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-900">
                                                        {record.employee.name || 'Sans nom'}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        {record.employee.role}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Lieu */}
                                        <td className="px-6 py-4">
                                            {record.latitude && record.longitude ? (
                                                <a
                                                    href={`https://www.google.com/maps?q=${record.latitude},${record.longitude}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700"
                                                >
                                                    <MapPin size={16} />
                                                    Voir carte
                                                </a>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>

                                        {/* Photo */}
                                        <td className="px-6 py-4">
                                            {record.photoUrl ? (
                                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                                                    <img
                                                        src={record.photoUrl}
                                                        alt="Preuve"
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>

                                        {/* Durée */}
                                        <td className="px-6 py-4">
                                            <span className="font-medium text-gray-900">
                                                {record.duration}
                                            </span>
                                        </td>

                                        {/* Statut */}
                                        <td className="px-6 py-4">
                                            <StatusBadge status={record.checkOut ? 'COMPLETE' : 'IN_PROGRESS'} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedRecord && (
                <DetailModal
                    record={selectedRecord}
                    onClose={() => setSelectedRecord(null)}
                />
            )}
        </div>
    );
}
