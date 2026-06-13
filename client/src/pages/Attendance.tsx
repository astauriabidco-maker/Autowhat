import { type ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import {
    Calendar,
    User,
    MapPin,
    Camera,
    Clock,
    FileDown,
    Filter,
    X,
    ExternalLink,
    Loader2,
    CheckCircle,
    XCircle,
    AlertTriangle
} from 'lucide-react';
import { useSiteContext } from '../context/SiteContext';
import ExportModal from '../components/ExportModal';

interface Employee {
    id: string;
    name: string;
    phoneNumber: string;
    role: string;
    workProfile?: string | null;
}

interface AttendanceRecord {
    id: string;
    employee: Employee;
    date: string;
    checkIn: string;
    checkOut: string | null;
    status: string;
    photoUrl: string | null;
    proofUrl?: string | null;
    evidenceUrl?: string | null;
    latitude: number | null;
    longitude: number | null;
    distanceFromSite: number | null;
    locationWarning?: boolean;
    siteId?: string | null;
    siteName?: string | null;
    siteRadius?: number | null;
    gpsMode?: string | null;
    gpsVerdict?: string | null;
    gpsCheckedAt?: string | null;
    proofReceivedAt?: string | null;
    duration: string;
    rejectionReason?: string | null;
    verdictReason?: string | null;
    statusReason?: string | null;
    managerComment?: string | null;
}

interface DetailModalProps {
    record: AttendanceRecord;
    onClose: () => void;
}

type AttendancePeriod = 'today' | 'week' | 'month';

function hasNumber(value: number | null | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function hasLocation(record: AttendanceRecord): boolean {
    return hasNumber(record.latitude) && hasNumber(record.longitude);
}

function hasDistance(record: AttendanceRecord): boolean {
    return hasNumber(record.distanceFromSite);
}

function getProofUrl(record: AttendanceRecord): string | null {
    return record.photoUrl || record.proofUrl || record.evidenceUrl || null;
}

function getRecordStatus(record: AttendanceRecord): string {
    return record.status || (record.checkOut ? 'COMPLETE' : 'IN_PROGRESS');
}

function formatDistance(distance: number): string {
    if (Math.abs(distance) >= 1000) {
        return `${(distance / 1000).toFixed(1)} km`;
    }
    return `${distance.toFixed(0)} m`;
}

function formatCoordinates(record: AttendanceRecord): string {
    if (!hasLocation(record)) return 'Coordonnées non fournies';
    return `${record.latitude!.toFixed(6)}, ${record.longitude!.toFixed(6)}`;
}

function isAcceptedStatus(status: string): boolean {
    return ['ACCEPTED', 'APPROVED', 'VALIDATED', 'PRESENT', 'COMPLETE', 'COMPLETED'].includes(status.toUpperCase());
}

function isRejectedStatus(status: string): boolean {
    return ['REJECTED', 'REFUSED', 'DECLINED', 'ABSENT', 'INVALID'].includes(status.toUpperCase());
}

function getStatusReason(record: AttendanceRecord): string | null {
    return record.rejectionReason || record.verdictReason || record.statusReason || record.managerComment || null;
}

function getSiteLabel(record: AttendanceRecord): string {
    return record.siteName || 'Site non précisé';
}

function getRadiusLabel(record: AttendanceRecord): string {
    return hasNumber(record.siteRadius) ? `${record.siteRadius} m` : 'Rayon non précisé';
}

function getDistanceTone(record: AttendanceRecord): 'good' | 'warning' | 'muted' {
    const distanceFromSite = record.distanceFromSite;
    if (!hasNumber(distanceFromSite)) return 'muted';
    if (hasNumber(record.siteRadius) && distanceFromSite > record.siteRadius) return 'warning';
    if (record.locationWarning) return 'warning';
    return 'good';
}

function getProofExplanation(record: AttendanceRecord): string {
    const status = getRecordStatus(record);
    const reason = getStatusReason(record);
    const proofCount = [getProofUrl(record), hasLocation(record), hasDistance(record)].filter(Boolean).length;

    if (isRejectedStatus(status)) {
        return reason || 'Pointage refusé. Vérifiez la photo, la position GPS ou la distance au site.';
    }
    if (status.toUpperCase() === 'PENDING_GPS') {
        return reason || 'Position GPS attendue avant validation définitive du pointage.';
    }
    if (status.toUpperCase() === 'WARNING' || record.locationWarning) {
        return reason || 'Pointage enregistré sous réserve: contrôle GPS à vérifier.';
    }
    if (isAcceptedStatus(status)) {
        return proofCount > 0
            ? 'Pointage accepté avec les preuves disponibles ci-dessous.'
            : 'Pointage accepté. Aucune preuve complémentaire fournie par l’API.';
    }
    if (proofCount > 0) {
        return 'Pointage en cours ou à contrôler avec les preuves disponibles.';
    }
    return 'Aucune preuve complémentaire fournie pour ce pointage.';
}

function DetailModal({ record, onClose }: DetailModalProps) {
    const recordHasLocation = hasLocation(record);
    const proofUrl = getProofUrl(record);
    const status = getRecordStatus(record);
    const mapUrl = recordHasLocation
        ? `https://www.google.com/maps?q=${record.latitude},${record.longitude}`
        : null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between gap-3 p-4 sm:p-6 border-b border-gray-200">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                            {record.employee.name?.charAt(0) || '?'}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{record.employee.name}</h2>
                            <p className="text-gray-500 text-sm sm:text-base">{record.date} • {record.checkIn} - {record.checkOut || 'En cours'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="px-4 pt-4 sm:px-6">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={status} />
                            <ProofPill icon={<Camera size={14} />} label={proofUrl ? 'Photo reçue' : 'Photo absente'} active={Boolean(proofUrl)} />
                            <ProofPill icon={<MapPin size={14} />} label={recordHasLocation ? 'GPS reçu' : 'GPS absent'} active={recordHasLocation} />
                            {hasDistance(record) && (
                                <ProofPill icon={<MapPin size={14} />} label={`${formatDistance(record.distanceFromSite!)} du site`} active />
                            )}
                            {record.siteName && (
                                <ProofPill icon={<MapPin size={14} />} label={record.siteName} active />
                            )}
                        </div>
                        <p className="mt-2 text-sm text-gray-600">{getProofExplanation(record)}</p>
                    </div>
                </div>

                <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Photo */}
                    <div className="space-y-3">
                        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                            <Camera size={18} />
                            Preuve Photo
                        </h3>
                        {proofUrl ? (
                            <div className="relative aspect-video bg-gray-100 rounded-xl overflow-hidden">
                                <img
                                    src={proofUrl}
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
                        {recordHasLocation ? (
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
                                        {formatCoordinates(record)}
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
                                {hasDistance(record) && (
                                    <div className="bg-amber-50 text-amber-700 px-3 py-2 rounded-lg text-sm">
                                        Distance du site : {formatDistance(record.distanceFromSite!)}
                                        {record.siteRadius ? ` · rayon autorisé ${record.siteRadius} m` : ''}
                                    </div>
                                )}
                                {(record.siteName || record.gpsMode) && (
                                    <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-sm">
                                        {record.siteName || 'Site'}{record.gpsMode ? ` · mode GPS ${record.gpsMode}` : ''}
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
                    <StatusBadge status={status} />
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status?: string | null }) {
    const normalizedStatus = (status || '').toUpperCase();
    const config: Record<string, { bg: string; text: string; label: string; icon?: 'check' | 'x' | 'warning' }> = {
        COMPLETE: { bg: 'bg-green-100', text: 'text-green-800', label: 'Complet' },
        COMPLETED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Complet' },
        PRESENT: { bg: 'bg-green-100', text: 'text-green-800', label: 'Présent' },
        ACCEPTED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Accepté', icon: 'check' },
        APPROVED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Accepté', icon: 'check' },
        VALIDATED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Validé', icon: 'check' },
        IN_PROGRESS: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'En cours' },
        INCOMPLETE: { bg: 'bg-red-100', text: 'text-red-800', label: 'Incomplet' },
        CHECKED_IN: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'En cours' },
        PENDING_GPS: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'GPS attendu', icon: 'warning' },
        WARNING: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Sous réserve', icon: 'warning' },
        LATE: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'En retard', icon: 'warning' },
        ABSENT: { bg: 'bg-red-100', text: 'text-red-800', label: 'Absent', icon: 'x' },
        REJECTED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Refusé', icon: 'x' },
        REFUSED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Refusé', icon: 'x' },
        DECLINED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Refusé', icon: 'x' },
        INVALID: { bg: 'bg-red-100', text: 'text-red-800', label: 'Refusé', icon: 'x' }
    };

    const { bg, text, label, icon } = config[normalizedStatus] || {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        label: status || 'Non précisé'
    };

    return (
        <span className={`${bg} ${text} inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap`}>
            {icon === 'check' && <CheckCircle size={14} />}
            {icon === 'x' && <XCircle size={14} />}
            {icon === 'warning' && <AlertTriangle size={14} />}
            {label}
        </span>
    );
}

function ProofPill({ icon, label, active }: { icon: ReactNode; label: string; active: boolean }) {
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${active
            ? 'bg-white text-gray-800 border border-gray-200'
            : 'bg-gray-100 text-gray-500 border border-gray-200'
            }`}>
            {icon}
            {label}
        </span>
    );
}

function MobileProofMetric({ label, value, tone = 'muted' }: { label: string; value: string; tone?: 'good' | 'warning' | 'muted' }) {
    const toneClass = {
        good: 'border-green-200 bg-green-50 text-green-800',
        warning: 'border-amber-200 bg-amber-50 text-amber-800',
        muted: 'border-gray-200 bg-gray-50 text-gray-700'
    }[tone];

    return (
        <div className={`min-w-0 rounded-lg border px-3 py-2 ${toneClass}`}>
            <div className="text-[11px] font-medium uppercase tracking-normal opacity-70">{label}</div>
            <div className="mt-0.5 truncate text-sm font-semibold">{value}</div>
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

export default function Attendance() {
    const navigate = useNavigate();
    const { selectedSiteId } = useSiteContext();
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
    const [showExportModal, setShowExportModal] = useState(false);

    // Filters
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
    const [period, setPeriod] = useState<AttendancePeriod>('today');

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
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Relevé des heures</h1>
                    <p className="text-gray-500 mt-1">Suivi des pointages et présences</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="text-xs sm:text-sm text-gray-500">Total</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="text-xs sm:text-sm text-gray-500">Complets</div>
                    <div className="text-2xl font-bold text-green-600 mt-1">{stats.complete}</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="text-sm text-gray-500">En cours</div>
                    <div className="text-2xl font-bold text-orange-600 mt-1">{stats.inProgress}</div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-4 xl:flex xl:items-center">
                    {/* Period Selector */}
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-2 sm:border-0 sm:px-0 sm:py-0">
                        <Filter size={17} className="text-gray-400 flex-shrink-0" />
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value as AttendancePeriod)}
                            className="w-full bg-transparent text-sm font-medium text-gray-800 focus:outline-none sm:px-3 sm:py-2.5 sm:border sm:border-gray-300 sm:rounded-lg sm:focus:ring-2 sm:focus:ring-indigo-500 sm:focus:border-indigo-500"
                        >
                            <option value="today">Aujourd'hui</option>
                            <option value="week">Cette semaine</option>
                            <option value="month">Ce mois</option>
                        </select>
                    </div>

                    {/* Date Picker */}
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-2 sm:border-0 sm:px-0 sm:py-0">
                        <Calendar size={17} className="text-gray-400 flex-shrink-0" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full bg-transparent text-sm font-medium text-gray-800 focus:outline-none sm:px-3 sm:py-2.5 sm:border sm:border-gray-300 sm:rounded-lg sm:focus:ring-2 sm:focus:ring-indigo-500 sm:focus:border-indigo-500"
                        />
                    </div>

                    {/* Employee Filter */}
                    <div className="col-span-2 flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-2 sm:col-span-1 sm:border-0 sm:px-0 sm:py-0">
                        <User size={17} className="text-gray-400 flex-shrink-0" />
                        <select
                            value={selectedEmployee}
                            onChange={(e) => setSelectedEmployee(e.target.value)}
                            className="w-full min-w-0 bg-transparent text-sm font-medium text-gray-800 focus:outline-none sm:min-w-[150px] sm:px-3 sm:py-2.5 sm:border sm:border-gray-300 sm:rounded-lg sm:focus:ring-2 sm:focus:ring-indigo-500 sm:focus:border-indigo-500"
                        >
                            <option value="all">Tous les employés</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Export Button */}
                    <button
                        onClick={() => setShowExportModal(true)}
                        className="col-span-2 sm:col-span-2 xl:col-span-1 xl:ml-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium shadow-sm"
                    >
                        <FileDown size={18} />
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
                    <>
                    <div className="md:hidden divide-y divide-gray-100">
                        {filteredRecords.map((record) => {
                            const recordHasLocation = hasLocation(record);
                            const proofUrl = getProofUrl(record);
                            const status = getRecordStatus(record);
                            const distanceTone = getDistanceTone(record);
                            const statusReason = getStatusReason(record);

                            return (
                                <button
                                    key={record.id}
                                    onClick={() => setSelectedRecord(record)}
                                    className="w-full p-4 text-left hover:bg-gray-50 transition"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${getAvatarColor(record.employee.name)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                                                {getInitials(record.employee.name)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-gray-900 truncate">{record.employee.name || 'Sans nom'}</p>
                                                <p className="text-sm text-gray-500">{record.date} · {record.checkIn} → {record.checkOut || 'En cours'}</p>
                                            </div>
                                        </div>
                                        {proofUrl ? (
                                            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                                                <img src={proofUrl} alt="Preuve" className="h-full w-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="h-12 w-12 flex-shrink-0 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-400 flex items-center justify-center">
                                                <Camera size={18} />
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-3 flex items-center justify-between gap-2">
                                        <StatusBadge status={status} />
                                        <span className="text-sm font-medium text-gray-900">{record.duration}</span>
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        <MobileProofMetric
                                            label="Distance"
                                            value={hasDistance(record) ? formatDistance(record.distanceFromSite!) : 'Non fournie'}
                                            tone={distanceTone}
                                        />
                                        <MobileProofMetric
                                            label="Rayon"
                                            value={getRadiusLabel(record)}
                                            tone={distanceTone === 'warning' ? 'warning' : 'muted'}
                                        />
                                        <MobileProofMetric
                                            label="Site"
                                            value={getSiteLabel(record)}
                                            tone={record.siteName ? 'good' : 'muted'}
                                        />
                                        <MobileProofMetric
                                            label="Preuve"
                                            value={proofUrl ? 'Photo reçue' : 'Photo absente'}
                                            tone={proofUrl ? 'good' : 'muted'}
                                        />
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <ProofPill icon={<MapPin size={14} />} label={recordHasLocation ? 'GPS reçu' : 'GPS absent'} active={recordHasLocation} />
                                        {record.gpsMode && (
                                            <ProofPill icon={<MapPin size={14} />} label={`Mode ${record.gpsMode}`} active />
                                        )}
                                    </div>

                                    <p className={`mt-3 rounded-lg px-3 py-2 text-xs leading-relaxed ${statusReason || record.locationWarning
                                        ? 'bg-amber-50 text-amber-800'
                                        : 'bg-gray-50 text-gray-600'
                                        }`}>
                                        {getProofExplanation(record)}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                    <div className="hidden md:block overflow-x-auto">
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
                                {filteredRecords.map((record) => {
                                    const recordHasLocation = hasLocation(record);
                                    const proofUrl = getProofUrl(record);
                                    const status = getRecordStatus(record);

                                    return (
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
                                                {recordHasLocation ? (
                                                    <div className="space-y-1">
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
                                                        <div className="text-xs text-gray-500">{formatCoordinates(record)}</div>
                                                        {hasDistance(record) && (
                                                            <div className="text-xs font-medium text-amber-700">{formatDistance(record.distanceFromSite!)} du site</div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">GPS non fourni</span>
                                                )}
                                            </td>

                                            {/* Photo */}
                                            <td className="px-6 py-4">
                                                {proofUrl ? (
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                                                            <img
                                                                src={proofUrl}
                                                                alt="Preuve"
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                        <span className="text-sm text-gray-600">Photo reçue</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">Photo non fournie</span>
                                                )}
                                            </td>

                                            {/* Durée */}
                                            <td className="px-6 py-4">
                                                <span className="font-medium text-gray-900">
                                                    {record.duration}
                                                </span>
                                                <p className="mt-1 max-w-[220px] text-xs text-gray-500">{getProofExplanation(record)}</p>
                                            </td>

                                            {/* Statut */}
                                            <td className="px-6 py-4">
                                                <StatusBadge status={status} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    </>
                )}
            </div>

            {/* Detail Modal */}
            {selectedRecord && (
                <DetailModal
                    record={selectedRecord}
                    onClose={() => setSelectedRecord(null)}
                />
            )}

            {/* Export Modal */}
            <ExportModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
            />
        </div>
    );
}
