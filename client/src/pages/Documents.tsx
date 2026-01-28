import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import clsx from 'clsx';
import {
    Upload,
    FileText,
    Trash2,
    ExternalLink,
    AlertCircle,
    CheckCircle,
    File,
    Users
} from 'lucide-react';

interface Document {
    id: string;
    title: string;
    category: string;
    categoryLabel: string;
    url: string;
    createdAt: string;
    employee: {
        id: string;
        name: string;
        phoneNumber: string;
    } | null;
    isGlobal: boolean;
}

interface Employee {
    id: string;
    name: string;
    phoneNumber: string;
}

const CATEGORIES = [
    { value: 'PAIE', label: '💰 Fiche de paie', color: 'bg-emerald-100 text-emerald-700' },
    { value: 'CONTRAT', label: '📝 Contrat', color: 'bg-blue-100 text-blue-700' },
    { value: 'INTERNE', label: '📋 Document interne', color: 'bg-purple-100 text-purple-700' }
];

export default function Documents() {
    const navigate = useNavigate();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Upload form state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('PAIE');
    const [employeeId, setEmployeeId] = useState<string>('');
    const [dragActive, setDragActive] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
            return;
        }
        fetchDocuments();
        fetchEmployees();
    }, [navigate]);

    const fetchDocuments = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/documents', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDocuments(response.data.documents.slice(0, 20));
        } catch (err) {
            setError('Erreur lors du chargement des documents');
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/documents/employees', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEmployees(response.data.employees);
        } catch (err) {
            console.error('Error fetching employees:', err);
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (isValidFile(file)) {
                setSelectedFile(file);
            } else {
                setError('Type de fichier non supporté. Utilisez PDF, JPG ou PNG.');
            }
        }
    };

    const isValidFile = (file: File) => {
        const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        return validTypes.includes(file.type);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (isValidFile(file)) {
                setSelectedFile(file);
                setError(null);
            } else {
                setError('Type de fichier non supporté. Utilisez PDF, JPG ou PNG.');
            }
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile || !title) return;

        setUploading(true);
        setError(null);
        setSuccess(null);

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('title', title);
        formData.append('category', category);
        if (employeeId) {
            formData.append('employeeId', employeeId);
        }

        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/documents', formData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSelectedFile(null);
            setTitle('');
            setCategory('PAIE');
            setEmployeeId('');
            setSuccess('Document envoyé ! L\'employé a été notifié par WhatsApp.');
            fetchDocuments();

            setTimeout(() => setSuccess(null), 5000);
        } catch (err) {
            setError('Erreur lors de l\'upload');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (docId: string, docTitle: string) => {
        if (!confirm(`Supprimer "${docTitle}" ?`)) return;

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`/api/documents/${docId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDocuments();
            setSuccess('Document supprimé');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError('Erreur lors de la suppression');
        }
    };

    const getCategoryBadge = (cat: string) => {
        const found = CATEGORIES.find(c => c.value === cat);
        return found || { label: cat, color: 'bg-gray-100 text-gray-700' };
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Chargement des documents...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Alerts */}
            {error && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            {success && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                    <CheckCircle size={18} />
                    {success}
                </div>
            )}

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Upload Form */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Upload size={20} className="text-blue-600" />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900">Envoyer un document</h2>
                    </div>

                    <form onSubmit={handleUpload} className="space-y-4">
                        {/* Drag & Drop Zone */}
                        <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById('fileInput')?.click()}
                            className={clsx(
                                'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition',
                                dragActive
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-300 hover:border-gray-400'
                            )}
                        >
                            {selectedFile ? (
                                <div className="text-green-600">
                                    <File size={24} className="mx-auto mb-2" />
                                    <p className="font-medium">{selectedFile.name}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                </div>
                            ) : (
                                <div className="text-gray-500">
                                    <Upload size={24} className="mx-auto mb-2" />
                                    <p className="text-sm">Glissez un fichier ou cliquez</p>
                                    <p className="text-xs mt-1">PDF, JPG, PNG (max 10MB)</p>
                                </div>
                            )}
                            <input
                                id="fileInput"
                                type="file"
                                onChange={handleFileChange}
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                            />
                        </div>

                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Titre du document *
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Ex: Bulletin Paie Janvier"
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Category */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Catégorie *
                            </label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {CATEGORIES.map(cat => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Target Employee */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Destinataire
                            </label>
                            <select
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">📢 Tout le monde (Document Global)</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>
                                        👤 {emp.name || emp.phoneNumber}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={!selectedFile || !title || uploading}
                            className={clsx(
                                'w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition',
                                (!selectedFile || !title || uploading)
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                            )}
                        >
                            <Upload size={18} />
                            {uploading ? 'Envoi en cours...' : 'Uploader'}
                        </button>
                    </form>
                </div>

                {/* Document History */}
                <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-3 p-4 border-b border-gray-200">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <FileText size={20} className="text-purple-600" />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            Historique ({documents.length} documents)
                        </h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Titre</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cible</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {documents.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                                            <FileText size={32} className="mx-auto mb-2 text-gray-300" />
                                            <p>Aucun document envoyé</p>
                                        </td>
                                    </tr>
                                ) : (
                                    documents.map((doc) => {
                                        const badge = getCategoryBadge(doc.category);
                                        return (
                                            <tr key={doc.id} className="hover:bg-gray-50 transition">
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="font-medium text-gray-900">{doc.title}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={clsx(
                                                        'inline-flex px-2.5 py-1 text-xs font-medium rounded-full',
                                                        badge.color
                                                    )}>
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    {doc.isGlobal ? (
                                                        <span className="flex items-center gap-1 text-blue-600">
                                                            <Users size={14} /> Tous
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-600">
                                                            {doc.employee?.name || 'Employé'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <a
                                                            href={doc.url.startsWith('http') ? doc.url : `http://localhost:3000${doc.url}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                        >
                                                            <ExternalLink size={16} />
                                                        </a>
                                                        <button
                                                            onClick={() => handleDelete(doc.id, doc.title)}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
