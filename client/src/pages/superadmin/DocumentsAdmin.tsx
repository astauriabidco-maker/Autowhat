import { useState, useEffect, useCallback } from 'react';
import {
    FileText,
    Filter,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    Clock,
    Building2,
    User,
    Download
} from 'lucide-react';

// Types
interface DocumentStats {
    totalDocuments: number;
    expired: number;
    expiringSoon: number;
    tenantsWithDocs: number;
    tenants: { id: string; name: string }[];
}

interface Document {
    id: string;
    name: string;
    type: string;
    typeLabel: string;
    url: string;
    expiryDate: string | null;
    expiryStatus: 'ok' | 'warning' | 'expired' | 'none';
    createdAt: string;
    tenantId: string;
    tenantName: string;
    employee: {
        id: string;
        name: string;
        phoneNumber: string;
    } | null;
    isGlobal: boolean;
}

const DOCUMENT_TYPES = [
    { value: 'all', label: 'Tous les types' },
    { value: 'CONTRACT', label: 'Contrats' },
    { value: 'CERTIFICATE', label: 'Certificats/Permis' },
    { value: 'IDENTITY', label: 'Pièces d\'identité' },
    { value: 'OTHER', label: 'Autres' }
];

const EXPIRY_STATUSES = [
    { value: 'all', label: 'Tous les statuts' },
    { value: 'expired', label: '🔴 Expirés' },
    { value: 'warning', label: '🟠 Expire bientôt' },
    { value: 'ok', label: '🟢 Valides' },
    { value: 'none', label: '⚪ Sans expiration' }
];

export default function DocumentsAdmin() {
    const [stats, setStats] = useState<DocumentStats | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [selectedTenant, setSelectedTenant] = useState('all');
    const [selectedType, setSelectedType] = useState('all');
    const [selectedExpiryStatus, setSelectedExpiryStatus] = useState('all');

    // Fetch stats
    const fetchStats = useCallback(async () => {
        try {
            const token = localStorage.getItem('superadmin_token');
            const response = await fetch('/superadmin/documents/stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch stats');
            const data = await response.json();
            setStats(data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    }, []);

    // Fetch documents with filters
    const fetchDocuments = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('superadmin_token');
            const params = new URLSearchParams();
            if (selectedTenant !== 'all') params.append('tenantId', selectedTenant);
            if (selectedType !== 'all') params.append('type', selectedType);
            if (selectedExpiryStatus !== 'all') params.append('expiryStatus', selectedExpiryStatus);

            const response = await fetch(`/superadmin/documents?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch documents');
            const data = await response.json();
            setDocuments(data.documents || []);
        } catch (error) {
            console.error('Error fetching documents:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedTenant, selectedType, selectedExpiryStatus]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    // Get expiry badge
    const getExpiryBadge = (status: string, date: string | null) => {
        if (status === 'none' || !date) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-full">
                    ⚪ N/A
                </span>
            );
        }

        const formattedDate = new Date(date).toLocaleDateString('fr-FR');

        if (status === 'expired') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full">
                    <AlertCircle className="w-3 h-3" />
                    {formattedDate}
                </span>
            );
        }

        if (status === 'warning') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-700 bg-orange-100 rounded-full">
                    <Clock className="w-3 h-3" />
                    {formattedDate}
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                <CheckCircle className="w-3 h-3" />
                {formattedDate}
            </span>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Documents RH</h1>
                    <p className="text-gray-600">Vue multi-tenant des documents employés</p>
                </div>
                <button
                    onClick={() => { fetchStats(); fetchDocuments(); }}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Actualiser
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats?.totalDocuments || 0}</p>
                            <p className="text-sm text-gray-500">Documents total</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-red-600">{stats?.expired || 0}</p>
                            <p className="text-sm text-gray-500">Expirés</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                            <Clock className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-orange-600">{stats?.expiringSoon || 0}</p>
                            <p className="text-sm text-gray-500">Expire &lt;30j</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats?.tenantsWithDocs || 0}</p>
                            <p className="text-sm text-gray-500">Entreprises</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                <div className="flex items-center gap-4">
                    <Filter className="w-5 h-5 text-gray-400" />

                    <select
                        value={selectedTenant}
                        onChange={(e) => setSelectedTenant(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="all">Toutes les entreprises</option>
                        {stats?.tenants?.map((tenant) => (
                            <option key={tenant.id} value={tenant.id}>
                                {tenant.name}
                            </option>
                        ))}
                    </select>

                    <select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {DOCUMENT_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>

                    <select
                        value={selectedExpiryStatus}
                        onChange={(e) => setSelectedExpiryStatus(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {EXPIRY_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>

                    <span className="ml-auto text-sm text-gray-500">
                        {documents.length} document{documents.length > 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            {/* Documents Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : documents.length === 0 ? (
                    <div className="text-center py-12">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">Aucun document trouvé</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Document
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Entreprise
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Employé
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Type
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Expiration
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Ajouté
                                </th>
                                <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {documents.map((doc) => (
                                <tr key={doc.id} className="hover:bg-gray-50">
                                    <td className="py-3 px-4">
                                        <a
                                            href={doc.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline font-medium"
                                        >
                                            {doc.name}
                                        </a>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-gray-700">{doc.tenantName}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        {doc.employee ? (
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-gray-400" />
                                                <span className="text-sm text-gray-700">{doc.employee.name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">Document global</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                                            {doc.typeLabel}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        {getExpiryBadge(doc.expiryStatus, doc.expiryDate)}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-500">
                                        {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <a
                                            href={doc.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                            <Download className="w-4 h-4" />
                                            Voir
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
