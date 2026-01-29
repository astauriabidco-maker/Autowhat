import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
    FileSpreadsheet,
    Upload,
    Download,
    CheckCircle,
    AlertCircle,
    ArrowLeft,
    Loader2,
    FileUp
} from 'lucide-react';

interface ImportResult {
    imported: number;
    updated: number;
    sitesCreated: number;
    errors: Array<{ row: number; message: string }>;
}

export default function ImportEmployees() {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Generate and download Excel template
    const downloadTemplate = () => {
        const templateData = [
            {
                FirstName: 'Jean',
                LastName: 'Dupont',
                Phone: '0612345678',
                JobTitle: 'Ouvrier',
                SiteName: 'Agence Paris',
                Profile: 'MOBILE'
            },
            {
                FirstName: 'Marie',
                LastName: 'Martin',
                Phone: '+33698765432',
                JobTitle: 'Chef d\'équipe',
                SiteName: 'Agence Lyon',
                Profile: 'SEDENTARY'
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Employés');

        // Set column widths
        worksheet['!cols'] = [
            { wch: 15 },
            { wch: 15 },
            { wch: 15 },
            { wch: 20 },
            { wch: 20 },
            { wch: 12 }
        ];

        XLSX.writeFile(workbook, 'modele_import_employes.xlsx');
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.csv'))) {
            setFile(droppedFile);
            setResult(null);
            setError(null);
        } else {
            setError('Format invalide. Utilisez .xlsx ou .csv');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setResult(null);
            setError(null);
        }
    };

    const handleImport = async () => {
        if (!file) return;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const token = localStorage.getItem('token');
            const response = await axios.post<ImportResult>('/api/import/employees', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            setResult(response.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Erreur lors de l\'import');
        } finally {
            setLoading(false);
        }
    };

    const hasSuccess = result && (result.imported > 0 || result.updated > 0);
    const hasErrors = result && result.errors.length > 0;

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/employees')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                    <ArrowLeft size={20} className="text-gray-600" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Import de masse</h1>
                    <p className="text-gray-500">Importez des employés depuis un fichier Excel ou CSV</p>
                </div>
            </div>

            {/* Step 1: Template */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                        1
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">Téléchargez le modèle</h2>
                        <p className="text-gray-600 mb-4">
                            Utilisez ce modèle Excel pour préparer vos données. Colonnes :
                            <span className="font-mono text-sm bg-gray-100 px-1 rounded mx-1">FirstName</span>
                            <span className="font-mono text-sm bg-gray-100 px-1 rounded mx-1">LastName</span>
                            <span className="font-mono text-sm bg-gray-100 px-1 rounded mx-1">Phone</span>
                            <span className="font-mono text-sm bg-gray-100 px-1 rounded mx-1">JobTitle</span>
                            <span className="font-mono text-sm bg-gray-100 px-1 rounded mx-1">SiteName</span>
                            <span className="font-mono text-sm bg-gray-100 px-1 rounded mx-1">Profile</span>
                        </p>
                        <button
                            onClick={downloadTemplate}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
                        >
                            <Download size={18} />
                            Télécharger le modèle Excel
                        </button>
                    </div>
                </div>
            </div>

            {/* Step 2: Upload */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                        2
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">Uploadez votre fichier</h2>

                        {/* Drop Zone */}
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${isDragOver
                                    ? 'border-indigo-500 bg-indigo-50'
                                    : file
                                        ? 'border-green-500 bg-green-50'
                                        : 'border-gray-300 hover:border-gray-400'
                                }`}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.csv"
                                onChange={handleFileChange}
                                className="hidden"
                            />

                            {file ? (
                                <div className="flex items-center justify-center gap-3">
                                    <FileSpreadsheet size={32} className="text-green-600" />
                                    <div className="text-left">
                                        <p className="font-medium text-gray-900">{file.name}</p>
                                        <p className="text-sm text-gray-500">
                                            {(file.size / 1024).toFixed(1)} Ko
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <FileUp size={40} className="mx-auto text-gray-400 mb-3" />
                                    <p className="text-gray-600">
                                        Glissez votre fichier ici ou{' '}
                                        <span className="text-indigo-600 font-medium">parcourez</span>
                                    </p>
                                    <p className="text-sm text-gray-400 mt-1">Excel (.xlsx) ou CSV</p>
                                </>
                            )}
                        </div>

                        {/* Import Button */}
                        <button
                            onClick={handleImport}
                            disabled={!file || loading}
                            className={`mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition ${!file || loading
                                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                }`}
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Import en cours...
                                </>
                            ) : (
                                <>
                                    <Upload size={18} />
                                    Lancer l'import
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Step 3: Results */}
            {(result || error) && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                            3
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Résultats</h2>

                            {/* Global Error */}
                            {error && (
                                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                                    <AlertCircle size={20} />
                                    {error}
                                </div>
                            )}

                            {/* Success */}
                            {hasSuccess && (
                                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 mb-4">
                                    <CheckCircle size={20} />
                                    <div>
                                        <p className="font-medium">
                                            ✅ {result!.imported} employé{result!.imported > 1 ? 's' : ''} importé{result!.imported > 1 ? 's' : ''}
                                            {result!.updated > 0 && `, ${result!.updated} mis à jour`}
                                        </p>
                                        {result!.sitesCreated > 0 && (
                                            <p className="text-sm text-green-600">
                                                🏢 {result!.sitesCreated} site{result!.sitesCreated > 1 ? 's' : ''} créé{result!.sitesCreated > 1 ? 's' : ''}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Errors */}
                            {hasErrors && (
                                <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
                                    <div className="px-4 py-3 bg-red-100 border-b border-red-200">
                                        <p className="font-medium text-red-700">
                                            ⚠️ {result!.errors.length} erreur{result!.errors.length > 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    <ul className="divide-y divide-red-200 max-h-48 overflow-y-auto">
                                        {result!.errors.map((err, idx) => (
                                            <li key={idx} className="px-4 py-2 text-sm text-red-700">
                                                <span className="font-mono">Ligne {err.row}</span>: {err.message}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
