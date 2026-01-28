import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

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
    { value: 'PAIE', label: '💰 Fiche de paie', color: '#10b981' },
    { value: 'CONTRAT', label: '📝 Contrat', color: '#3b82f6' },
    { value: 'INTERNE', label: '📋 Document interne', color: '#8b5cf6' }
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

    const API_BASE = window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : '';

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
            return;
        }
        fetchDocuments();
        fetchEmployees();
    }, []);

    const fetchDocuments = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE}/api/documents`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDocuments(response.data.documents.slice(0, 20));
            setLoading(false);
        } catch (err) {
            setError('Erreur lors du chargement des documents');
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE}/api/documents/employees`, {
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
            await axios.post(`${API_BASE}/api/documents`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`
                    // Note: Don't set Content-Type, let browser handle multipart boundary
                }
            });

            // Reset form
            setSelectedFile(null);
            setTitle('');
            setCategory('PAIE');
            setEmployeeId('');
            setSuccess('✅ Document envoyé ! L\'employé a été notifié par WhatsApp.');
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
            await axios.delete(`${API_BASE}/api/documents/${docId}`, {
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
        return {
            label: found?.label || cat,
            color: found?.color || '#6b7280'
        };
    };

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📂</div>
                    <p>Chargement...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            padding: '2rem'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '2rem'
            }}>
                <div>
                    <h1 style={{ color: 'white', fontSize: '2rem', margin: 0 }}>📂 Gestion Documentaire</h1>
                    <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>
                        Envoyez et gérez les documents de vos employés
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={() => navigate('/dashboard')}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '0.5rem',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.875rem'
                        }}
                    >
                        📊 Pointages
                    </button>
                    <button
                        onClick={() => navigate('/expenses')}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '0.5rem',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.875rem'
                        }}
                    >
                        🧾 Frais
                    </button>
                </div>
            </div>

            {/* Alerts */}
            {error && (
                <div style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    color: '#fca5a5',
                    marginBottom: '1.5rem'
                }}>
                    {error}
                </div>
            )}

            {success && (
                <div style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    border: '1px solid rgba(16, 185, 129, 0.5)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    color: '#6ee7b7',
                    marginBottom: '1.5rem'
                }}>
                    {success}
                </div>
            )}

            {/* Two Column Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '2rem' }}>

                {/* Zone 1: Upload Form */}
                <div style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '1rem',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '1.5rem'
                }}>
                    <h2 style={{ color: 'white', marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem' }}>
                        📤 Envoyer un document
                    </h2>

                    <form onSubmit={handleUpload}>
                        {/* Drag & Drop Zone */}
                        <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            style={{
                                border: `2px dashed ${dragActive ? '#10b981' : 'rgba(255,255,255,0.3)'}`,
                                borderRadius: '0.75rem',
                                padding: '1.5rem',
                                textAlign: 'center',
                                marginBottom: '1rem',
                                background: dragActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.02)',
                                transition: 'all 0.2s ease',
                                cursor: 'pointer'
                            }}
                            onClick={() => document.getElementById('fileInput')?.click()}
                        >
                            {selectedFile ? (
                                <div style={{ color: '#10b981' }}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📄</div>
                                    <p style={{ margin: 0, fontWeight: '500' }}>{selectedFile.name}</p>
                                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                </div>
                            ) : (
                                <div style={{ color: '#94a3b8' }}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📁</div>
                                    <p style={{ margin: 0, fontSize: '0.875rem' }}>Glissez un fichier ou cliquez</p>
                                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem' }}>PDF, JPG, PNG (max 10MB)</p>
                                </div>
                            )}
                            <input
                                id="fileInput"
                                type="file"
                                onChange={handleFileChange}
                                accept=".pdf,.jpg,.jpeg,.png"
                                style={{ display: 'none' }}
                            />
                        </div>

                        {/* Title */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                                Titre du document *
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Ex: Bulletin Paie Janvier"
                                required
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    background: 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '0.5rem',
                                    color: 'white',
                                    fontSize: '0.875rem',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        {/* Category */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                                Catégorie *
                            </label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    background: 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '0.5rem',
                                    color: 'white',
                                    fontSize: '0.875rem',
                                    boxSizing: 'border-box'
                                }}
                            >
                                {CATEGORIES.map(cat => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Target Employee */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                                Destinataire
                            </label>
                            <select
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    background: 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '0.5rem',
                                    color: 'white',
                                    fontSize: '0.875rem',
                                    boxSizing: 'border-box'
                                }}
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
                            style={{
                                width: '100%',
                                padding: '0.875rem',
                                background: (!selectedFile || !title || uploading)
                                    ? 'rgba(255,255,255,0.1)'
                                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                border: 'none',
                                borderRadius: '0.5rem',
                                color: 'white',
                                cursor: (!selectedFile || !title || uploading) ? 'not-allowed' : 'pointer',
                                fontWeight: '600',
                                fontSize: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            {uploading ? (
                                <>
                                    <span style={{
                                        display: 'inline-block',
                                        width: '1rem',
                                        height: '1rem',
                                        border: '2px solid white',
                                        borderTopColor: 'transparent',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite'
                                    }}></span>
                                    Envoi en cours...
                                </>
                            ) : (
                                <>📤 Uploader</>
                            )}
                        </button>
                    </form>
                </div>

                {/* Zone 2: Document History */}
                <div style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '1rem',
                    border: '1px solid rgba(255,255,255,0.1)',
                    overflow: 'hidden'
                }}>
                    <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <h2 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>
                            📋 Historique ({documents.length} documents)
                        </h2>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                                    <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', textAlign: 'left', fontWeight: '500', fontSize: '0.875rem' }}>Date</th>
                                    <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', textAlign: 'left', fontWeight: '500', fontSize: '0.875rem' }}>Titre</th>
                                    <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', textAlign: 'left', fontWeight: '500', fontSize: '0.875rem' }}>Catégorie</th>
                                    <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', textAlign: 'left', fontWeight: '500', fontSize: '0.875rem' }}>Cible</th>
                                    <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', textAlign: 'center', fontWeight: '500', fontSize: '0.875rem' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {documents.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                                            <p>Aucun document envoyé</p>
                                        </td>
                                    </tr>
                                ) : (
                                    documents.map((doc, i) => {
                                        const badge = getCategoryBadge(doc.category);
                                        return (
                                            <tr
                                                key={doc.id}
                                                style={{
                                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                    background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.1)'
                                                }}
                                            >
                                                <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                                                    {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', color: 'white', fontWeight: '500' }}>
                                                    📄 {doc.title}
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem' }}>
                                                    <span style={{
                                                        padding: '0.25rem 0.75rem',
                                                        borderRadius: '9999px',
                                                        background: `${badge.color}20`,
                                                        color: badge.color,
                                                        fontSize: '0.75rem',
                                                        fontWeight: '500'
                                                    }}>
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1', fontSize: '0.875rem' }}>
                                                    {doc.isGlobal ? (
                                                        <span style={{ color: '#60a5fa' }}>📢 Tous</span>
                                                    ) : (
                                                        <span>👤 {doc.employee?.name || 'Employé'}</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                        <a
                                                            href={`${API_BASE}${doc.url}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{
                                                                padding: '0.375rem 0.75rem',
                                                                background: 'rgba(59, 130, 246, 0.2)',
                                                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                                                borderRadius: '0.375rem',
                                                                color: '#60a5fa',
                                                                textDecoration: 'none',
                                                                fontSize: '0.75rem'
                                                            }}
                                                        >
                                                            Voir
                                                        </a>
                                                        <button
                                                            onClick={() => handleDelete(doc.id, doc.title)}
                                                            style={{
                                                                padding: '0.375rem 0.75rem',
                                                                background: 'rgba(239, 68, 68, 0.2)',
                                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                                borderRadius: '0.375rem',
                                                                color: '#f87171',
                                                                cursor: 'pointer',
                                                                fontSize: '0.75rem'
                                                            }}
                                                        >
                                                            🗑️
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

            {/* CSS Animation */}
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
