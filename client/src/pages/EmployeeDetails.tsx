import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ArrowLeft,
    User,
    Phone,
    MapPin,
    Calendar,
    FileText,
    Upload,
    Trash2,
    AlertCircle,
    CheckCircle,
    Clock,
    X
} from 'lucide-react';

// Types
interface Employee {
    id: string;
    name: string | null;
    phoneNumber: string;
    role: string;
    workProfile: string;
    color: string;
    createdAt: string;
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
}

const DOCUMENT_TYPES = [
    { value: 'CONTRACT', label: 'Contrat' },
    { value: 'CERTIFICATE', label: 'Certificat/Permis' },
    { value: 'IDENTITY', label: 'Pièce d\'identité' },
    { value: 'OTHER', label: 'Autre' }
];

export default function EmployeeDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // State
    const [employee, setEmployee] = useState<Employee | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'info' | 'documents'>('info');

    // Upload modal state
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadForm, setUploadForm] = useState({
        name: '',
        type: 'CONTRACT',
        expiryDate: '',
        file: null as File | null
    });
    const [uploading, setUploading] = useState(false);

    // Fetch employee data
    const fetchEmployee = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/employees`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch');

            const data = await response.json();
            const emp = data.employees?.find((e: Employee) => e.id === id);
            if (emp) setEmployee(emp);
        } catch (error) {
            console.error('Error fetching employee:', error);
        }
    }, [id]);

    // Fetch employee documents
    const fetchDocuments = useCallback(async () => {
        if (!id) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/employees/${id}/documents`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch');

            const data = await response.json();
            setDocuments(data.documents || []);
        } catch (error) {
            console.error('Error fetching documents:', error);
        }
    }, [id]);

    useEffect(() => {
        const loadAll = async () => {
            setLoading(true);
            await Promise.all([fetchEmployee(), fetchDocuments()]);
            setLoading(false);
        };
        loadAll();
    }, [fetchEmployee, fetchDocuments]);

    // Upload document
    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uploadForm.file || !uploadForm.name || !id) return;

        setUploading(true);
        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('file', uploadForm.file);
            formData.append('name', uploadForm.name);
            formData.append('type', uploadForm.type);
            formData.append('employeeId', id);
            if (uploadForm.expiryDate) {
                formData.append('expiryDate', uploadForm.expiryDate);
            }

            const response = await fetch('/api/documents', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!response.ok) throw new Error('Upload failed');

            // Reset and refresh
            setShowUploadModal(false);
            setUploadForm({ name: '', type: 'CONTRACT', expiryDate: '', file: null });
            await fetchDocuments();
        } catch (error) {
            console.error('Error uploading document:', error);
            alert('Erreur lors du téléversement');
        } finally {
            setUploading(false);
        }
    };

    // Delete document
    const handleDelete = async (docId: string) => {
        if (!confirm('Supprimer ce document ?')) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/documents/${docId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Delete failed');
            await fetchDocuments();
        } catch (error) {
            console.error('Error deleting document:', error);
            alert('Erreur lors de la suppression');
        }
    };

    // Get expiry badge
    const getExpiryBadge = (status: string, date: string | null) => {
        if (status === 'none' || !date) return null;

        const formattedDate = new Date(date).toLocaleDateString('fr-FR');

        if (status === 'expired') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full">
                    <AlertCircle className="w-3 h-3" />
                    Expiré le {formattedDate}
                </span>
            );
        }

        if (status === 'warning') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-700 bg-orange-100 rounded-full">
                    <Clock className="w-3 h-3" />
                    Expire le {formattedDate}
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                <CheckCircle className="w-3 h-3" />
                Valide jusqu'au {formattedDate}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!employee) {
        return (
            <div className="p-6">
                <p className="text-gray-600">Employé non trouvé.</p>
                <Link to="/employees" className="text-blue-500 hover:underline">
                    Retour à la liste
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/employees')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div
                            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                            style={{ backgroundColor: employee.color || '#3B82F6' }}
                        >
                            {(employee.name || 'E')[0].toUpperCase()}
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">
                                {employee.name || 'Employé'}
                            </h1>
                            <p className="text-sm text-gray-500">
                                {employee.role === 'MANAGER' ? 'Manager' : 'Employé'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b border-gray-200">
                <nav className="flex px-6 gap-6">
                    <button
                        onClick={() => setActiveTab('info')}
                        className={`py-4 border-b-2 font-medium text-sm transition-colors ${activeTab === 'info'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <User className="w-4 h-4 inline mr-2" />
                        Informations
                    </button>
                    <button
                        onClick={() => setActiveTab('documents')}
                        className={`py-4 border-b-2 font-medium text-sm transition-colors ${activeTab === 'documents'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <FileText className="w-4 h-4 inline mr-2" />
                        Documents ({documents.length})
                    </button>
                </nav>
            </div>

            {/* Content */}
            <div className="p-6">
                {activeTab === 'info' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                            Informations personnelles
                        </h2>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Phone className="w-5 h-5 text-gray-400" />
                                <span className="text-gray-700">{employee.phoneNumber}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <MapPin className="w-5 h-5 text-gray-400" />
                                <span className="text-gray-700">
                                    Profil: {employee.workProfile === 'FIXED' ? 'Fixe' : 'Mobile'}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Calendar className="w-5 h-5 text-gray-400" />
                                <span className="text-gray-700">
                                    Inscrit le {new Date(employee.createdAt).toLocaleDateString('fr-FR')}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'documents' && (
                    <div className="space-y-6">
                        {/* Upload button */}
                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowUploadModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Upload className="w-4 h-4" />
                                Ajouter un document
                            </button>
                        </div>

                        {/* Documents list */}
                        {documents.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">Aucun document pour cet employé</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                                                Document
                                            </th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                                                Type
                                            </th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                                                Expiration
                                            </th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                                                Ajouté le
                                            </th>
                                            <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {documents.map((doc) => (
                                            <tr key={doc.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
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
                                                    <button
                                                        onClick={() => handleDelete(doc.id)}
                                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold">Ajouter un document</h3>
                            <button
                                onClick={() => setShowUploadModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUpload} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nom du document *
                                </label>
                                <input
                                    type="text"
                                    value={uploadForm.name}
                                    onChange={(e) => setUploadForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Ex: Permis de conduire"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Type *
                                </label>
                                <select
                                    value={uploadForm.type}
                                    onChange={(e) => setUploadForm(f => ({ ...f, type: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    {DOCUMENT_TYPES.map((t) => (
                                        <option key={t.value} value={t.value}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Date d'expiration
                                </label>
                                <input
                                    type="date"
                                    value={uploadForm.expiryDate}
                                    onChange={(e) => setUploadForm(f => ({ ...f, expiryDate: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Fichier *
                                </label>
                                <input
                                    type="file"
                                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                                    onChange={(e) => setUploadForm(f => ({ ...f, file: e.target.files?.[0] || null }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    required
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowUploadModal(false)}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                    {uploading ? 'Envoi...' : 'Ajouter'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
