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
    AlertTriangle,
    ChevronRight,
    ShieldCheck
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
    onDecision: (record: AttendanceRecord, action: AttendanceDecisionAction) => Promise<void>;
    decidingAction: AttendanceDecisionAction | null;
}

type AttendancePeriod = 'today' | 'week' | 'month';
type AttendanceQuickFilter = 'all' | 'toReview' | 'pendingGps' | 'warning' | 'rejected' | 'accepted';
type AttendanceDecisionAction = 'APPROVE_EXCEPTION' | 'REJECT' | 'CONFIRM';

const QUICK_FILTERS: Array<{ key: AttendanceQuickFilter; label: string }> = [
    { key: 'all', label: 'Tous' },
    { key: 'toReview', label: 'À contrôler' },
    { key: 'pendingGps', label: 'GPS attendu' },
    { key: 'warning', label: 'Sous réserve' },
    { key: 'rejected', label: 'Refusés' },
    { key: 'accepted', label: 'Acceptés' }
];
type DecisionStatus = 'ACCEPTED' | 'WARNING' | 'PENDING_GPS' | 'REJECTED' | 'IN_PROGRESS' | 'UNKNOWN';

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

function getDecisionStatus(record: AttendanceRecord): DecisionStatus {
    const status = getRecordStatus(record).toUpperCase();
    const gpsVerdict = (record.gpsVerdict || '').toUpperCase();

    if (isRejectedStatus(status) || gpsVerdict === 'REJECTED') return 'REJECTED';
    if (status === 'PENDING_GPS' || gpsVerdict === 'PENDING') return 'PENDING_GPS';
    if (status === 'WARNING' || record.locationWarning || gpsVerdict === 'WARNING' || gpsVerdict === 'NOT_CONFIGURED') return 'WARNING';
    if (isAcceptedStatus(status) || gpsVerdict === 'APPROVED' || gpsVerdict === 'NOT_REQUIRED') return 'ACCEPTED';
    if (!record.checkOut) return 'IN_PROGRESS';
    return 'UNKNOWN';
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

function isRecordToReview(record: AttendanceRecord): boolean {
    return ['PENDING_GPS', 'WARNING', 'REJECTED'].includes(getDecisionStatus(record));
}

function matchesQuickFilter(record: AttendanceRecord, filter: AttendanceQuickFilter): boolean {
    const status = getDecisionStatus(record);

    switch (filter) {
        case 'toReview':
            return isRecordToReview(record);
        case 'pendingGps':
            return status === 'PENDING_GPS';
        case 'warning':
            return status === 'WARNING';
        case 'rejected':
            return status === 'REJECTED';
        case 'accepted':
            return status === 'ACCEPTED';
        case 'all':
        default:
            return true;
    }
}

function getStatusReason(record: AttendanceRecord): string | null {
    return record.rejectionReason || record.verdictReason || record.statusReason || record.managerComment || null;
}

function getReadableReason(record: AttendanceRecord): string {
    return getStatusReason(record) || getProofExplanation(record);
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

function formatDateTime(value?: string | null): string {
    if (!value) return 'Non horodaté';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Horodatage invalide';
    return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
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

function DetailModal({ record, onClose, onDecision, decidingAction }: DetailModalProps) {
    const recordHasLocation = hasLocation(record);
    const proofUrl = getProofUrl(record);
    const status = getDecisionStatus(record);
    const canApprove = ['PENDING_GPS', 'WARNING', 'REJECTED'].includes(status);
    const canReject = status !== 'REJECTED';
    const canConfirm = status !== 'PENDING_GPS';
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
                        <p className="mt-2 text-sm text-gray-700">{getReadableReason(record)}</p>
                        <p className="mt-2 text-xs font-medium text-gray-500">
                            Contrôle GPS : {formatDateTime(record.gpsCheckedAt)}
                            {record.proofReceivedAt ? ` · Dernière preuve : ${formatDateTime(record.proofReceivedAt)}` : ''}
                        </p>
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
                <div className="px-4 py-4 sm:px-6 bg-gray-50 border-t border-gray-200 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                            <Clock size={16} />
                            Durée : <strong>{record.duration}</strong>
                        </span>
                        <StatusBadge status={status} />
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:w-auto">
                        <button
                            type="button"
                            disabled={!canApprove || decidingAction !== null}
                            onClick={() => onDecision(record, 'APPROVE_EXCEPTION')}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                        >
                            {decidingAction === 'APPROVE_EXCEPTION' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                            Valider exception
                        </button>
                        <button
                            type="button"
                            disabled={!canReject || decidingAction !== null}
                            onClick={() => onDecision(record, 'REJECT')}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                        >
                            {decidingAction === 'REJECT' ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                            Refuser
                        </button>
                        <button
                            type="button"
                            disabled={!canConfirm || decidingAction !== null}
                            onClick={() => onDecision(record, 'CONFIRM')}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                        >
                            {decidingAction === 'CONFIRM' ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                            Confirmer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status?: string | null }) {
    const normalizedStatus = (status || '').toUpperCase();
    const config: Record<string, { bg: string; text: string; label: string; icon?: 'check' | 'x' | 'warning' }> = {
        COMPLETE: { bg: 'bg-green-100', text: 'text-green-800', label: 'Accepté', icon: 'check' },
        COMPLETED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Accepté', icon: 'check' },
        PRESENT: { bg: 'bg-green-100', text: 'text-green-800', label: 'Accepté', icon: 'check' },
        ACCEPTED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Accepté', icon: 'check' },
        APPROVED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Accepté', icon: 'check' },
        VALIDATED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Accepté', icon: 'check' },
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
    const [decidingAction, setDecidingAction] = useState<AttendanceDecisionAction | null>(null);

    // Filters
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
    const [period, setPeriod] = useState<AttendancePeriod>('today');
    const [quickFilter, setQuickFilter] = useState<AttendanceQuickFilter>('all');

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
            return;
        }
        fetchData();
    }, [navigate, period, selectedDate, selectedSiteId]); // Refetch on site/date change

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const attendanceParams = new URLSearchParams({ period, date: selectedDate });
            if (selectedSiteId) {
                attendanceParams.set('siteId', selectedSiteId);
            }

            const [attendanceRes, employeesRes] = await Promise.all([
                axios.get(`/api/attendance?${attendanceParams.toString()}`, { headers }),
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

    const handleDecision = async (record: AttendanceRecord, action: AttendanceDecisionAction) => {
        setDecidingAction(action);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            const defaultReason: Record<AttendanceDecisionAction, string> = {
                APPROVE_EXCEPTION: 'Présence validée exceptionnellement depuis le dashboard manager.',
                REJECT: 'Pointage refusé depuis le dashboard manager.',
                CONFIRM: 'Verdict GPS confirmé depuis le dashboard manager.'
            };

            await axios.patch(
                `/api/attendance/${record.id}/verdict`,
                { action, reason: defaultReason[action] },
                { headers }
            );
            await fetchData();
            setSelectedRecord(null);
        } catch (err) {
            console.error('Error updating attendance verdict:', err);
        } finally {
            setDecidingAction(null);
        }
    };

    // Filter records
    const baseFilteredRecords = records.filter(record => {
        if (selectedSiteId && record.siteId !== selectedSiteId) {
            return false;
        }
        if (selectedEmployee !== 'all' && record.employee.id !== selectedEmployee) {
            return false;
        }
        return true;
    });

    const quickFilterCounts = QUICK_FILTERS.reduce<Record<AttendanceQuickFilter, number>>((counts, filter) => {
        counts[filter.key] = baseFilteredRecords.filter(record => matchesQuickFilter(record, filter.key)).length;
        return counts;
    }, {
        all: 0,
        toReview: 0,
        pendingGps: 0,
        warning: 0,
        rejected: 0,
        accepted: 0
    });

    const filteredRecords = baseFilteredRecords.filter(record => matchesQuickFilter(record, quickFilter));

    // Stats
    const stats = {
        total: filteredRecords.length,
        accepted: filteredRecords.filter(r => getDecisionStatus(r) === 'ACCEPTED').length,
        toReview: filteredRecords.filter(r => ['PENDING_GPS', 'WARNING'].includes(getDecisionStatus(r))).length,
        rejected: filteredRecords.filter(r => getDecisionStatus(r) === 'REJECTED').length
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
                    <div className="text-xs sm:text-sm text-gray-500">Acceptés</div>
                    <div className="text-2xl font-bold text-green-600 mt-1">{stats.accepted}</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="text-sm text-gray-500">À décider</div>
                    <div className="text-2xl font-bold text-amber-600 mt-1">{stats.toReview + stats.rejected}</div>
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

                <div className="mt-3 border-t border-gray-100 pt-3">
                    <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                        {QUICK_FILTERS.map(filter => {
                            const active = quickFilter === filter.key;
                            const count = quickFilterCounts[filter.key];

                            return (
                                <button
                                    key={filter.key}
                                    type="button"
                                    onClick={() => setQuickFilter(filter.key)}
                                    aria-pressed={active}
                                    className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition ${active
                                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-white'
                                        }`}
                                >
                                    <span>{filter.label}</span>
                                    <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] leading-none ${active
                                        ? 'bg-white/20 text-white'
                                        : 'bg-white text-gray-500'
                                        }`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
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
                            const status = getDecisionStatus(record);
                            const distanceTone = getDistanceTone(record);
                            const readableReason = getReadableReason(record);

                            return (
                                <button
                                    key={record.id}
                                    onClick={() => setSelectedRecord(record)}
                                    className="w-full p-4 text-left hover:bg-gray-50 transition"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <StatusBadge status={status} />
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600">
                                            Détails
                                            <ChevronRight size={15} />
                                        </span>
                                    </div>

                                    <div className="mt-3 flex items-start gap-3">
                                        <div className="flex min-w-0 flex-1 items-center gap-3">
                                            <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${getAvatarColor(record.employee.name)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                                                {getInitials(record.employee.name)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-gray-900 truncate">{record.employee.name || 'Sans nom'}</p>
                                                <p className="text-sm text-gray-500">{record.date} · {record.checkIn} → {record.checkOut || 'En cours'}</p>
                                                <p className="mt-0.5 text-xs text-gray-500 truncate">{getSiteLabel(record)}</p>
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
                                            label="Durée"
                                            value={record.duration}
                                            tone={record.checkOut ? 'good' : 'muted'}
                                        />
                                        <MobileProofMetric
                                            label="Preuve"
                                            value={proofUrl ? 'Photo reçue' : 'Photo absente'}
                                            tone={proofUrl ? 'good' : 'muted'}
                                        />
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <ProofPill icon={<MapPin size={14} />} label={recordHasLocation ? 'GPS reçu' : 'GPS absent'} active={recordHasLocation} />
                                        <ProofPill icon={<ShieldCheck size={14} />} label={`Contrôle GPS: ${formatDateTime(record.gpsCheckedAt)}`} active={Boolean(record.gpsCheckedAt)} />
                                        {record.gpsMode && (
                                            <ProofPill icon={<MapPin size={14} />} label={`Mode ${record.gpsMode}`} active />
                                        )}
                                    </div>

                                    <p className={`mt-3 rounded-lg px-3 py-2 text-xs leading-relaxed ${status !== 'ACCEPTED'
                                        ? 'bg-amber-50 text-amber-800'
                                        : 'bg-gray-50 text-gray-600'
                                        }`}>
                                        {readableReason}
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
                                            <ShieldCheck size={16} />
                                            Décision
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
                                            GPS / Site
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
                                            Horaires
                                        </div>
                                    </th>
                                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredRecords.map((record) => {
                                    const recordHasLocation = hasLocation(record);
                                    const proofUrl = getProofUrl(record);
                                    const status = getDecisionStatus(record);
                                    const distanceTone = getDistanceTone(record);

                                    return (
                                        <tr
                                            key={record.id}
                                            onClick={() => setSelectedRecord(record)}
                                            className="hover:bg-gray-50 cursor-pointer transition"
                                        >
                                            {/* Décision */}
                                            <td className="px-6 py-4 align-top">
                                                <StatusBadge status={status} />
                                                <p className="mt-2 max-w-[260px] text-xs leading-relaxed text-gray-600">
                                                    {getReadableReason(record)}
                                                </p>
                                            </td>

                                            {/* Employé */}
                                            <td className="px-6 py-4 align-top">
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
                                                        <div className="mt-1 text-xs text-gray-500">
                                                            {record.date}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* GPS / Site */}
                                            <td className="px-6 py-4 align-top">
                                                {recordHasLocation ? (
                                                    <div className="space-y-2">
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
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">GPS non fourni</span>
                                                )}
                                                <div className="mt-2 grid max-w-[260px] grid-cols-2 gap-2">
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
                                                </div>
                                                <p className="mt-2 text-xs text-gray-500">{getSiteLabel(record)}</p>
                                            </td>

                                            {/* Photo */}
                                            <td className="px-6 py-4 align-top">
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
                                                <p className="mt-2 text-xs text-gray-500">
                                                    Dernière preuve : {formatDateTime(record.proofReceivedAt)}
                                                </p>
                                            </td>

                                            {/* Horaires */}
                                            <td className="px-6 py-4 align-top">
                                                <div className="font-medium text-gray-900">
                                                    {record.checkIn} → {record.checkOut || 'En cours'}
                                                </div>
                                                <div className="mt-1 text-sm text-gray-500">
                                                    Durée : {record.duration}
                                                </div>
                                                <p className="mt-2 max-w-[220px] text-xs text-gray-500">
                                                    Contrôle GPS : {formatDateTime(record.gpsCheckedAt)}
                                                </p>
                                            </td>

                                            {/* Action */}
                                            <td className="px-6 py-4 align-top">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedRecord(record);
                                                    }}
                                                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                                                >
                                                    Détails
                                                    <ChevronRight size={16} />
                                                </button>
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
                    onDecision={handleDecision}
                    decidingAction={decidingAction}
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
