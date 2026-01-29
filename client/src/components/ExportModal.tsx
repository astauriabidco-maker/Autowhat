import { useState, useEffect, Fragment } from 'react';
import { X, FileSpreadsheet, FileText, Download, Calendar, Users, Building2 } from 'lucide-react';
import axios from 'axios';
import clsx from 'clsx';

interface Site {
    id: string;
    name: string;
}

interface Employee {
    id: string;
    name: string;
}

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ExportModal({ isOpen, onClose }: ExportModalProps) {
    const [activeTab, setActiveTab] = useState<'excel' | 'pdf'>('excel');

    // Excel tab state
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedSite, setSelectedSite] = useState('');
    const [sites, setSites] = useState<Site[]>([]);

    // PDF tab state
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [employees, setEmployees] = useState<Employee[]>([]);

    // Loading states
    const [loadingExcel, setLoadingExcel] = useState(false);
    const [loadingPdf, setLoadingPdf] = useState(false);

    // Set default dates to current month
    useEffect(() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        setStartDate(firstDay.toISOString().split('T')[0]);
        setEndDate(lastDay.toISOString().split('T')[0]);
    }, []);

    // Fetch sites and employees
    useEffect(() => {
        if (isOpen) {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            axios.get('/api/sites', { headers })
                .then(res => setSites(res.data))
                .catch(console.error);

            axios.get('/api/employees', { headers })
                .then(res => setEmployees(res.data))
                .catch(console.error);
        }
    }, [isOpen]);

    const handleDownloadExcel = async () => {
        if (!startDate || !endDate) {
            alert('Veuillez sélectionner les dates de début et fin');
            return;
        }

        setLoadingExcel(true);
        try {
            const token = localStorage.getItem('token');
            const params: any = { start: startDate, end: endDate };
            if (selectedSite) params.siteId = selectedSite;

            const response = await axios.get('/api/exports/excel', {
                headers: { Authorization: `Bearer ${token}` },
                params,
                responseType: 'blob'
            });

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;

            // Get filename from header or generate one
            const contentDisposition = response.headers['content-disposition'];
            let filename = `Export_Paie_${startDate}_${endDate}.xlsx`;
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?(.+)"?/);
                if (match) filename = decodeURIComponent(match[1]);
            }

            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Error downloading Excel:', error);
            alert('Erreur lors du téléchargement du fichier Excel');
        } finally {
            setLoadingExcel(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (!selectedEmployee) {
            alert('Veuillez sélectionner un employé');
            return;
        }

        setLoadingPdf(true);
        try {
            const token = localStorage.getItem('token');

            const response = await axios.get(`/api/exports/pdf/${selectedEmployee}`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { month: selectedMonth, year: selectedYear },
                responseType: 'blob'
            });

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;

            const employee = employees.find(e => e.id === selectedEmployee);
            const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
            const filename = `Feuille_${employee?.name || 'Employe'}_${monthNames[selectedMonth]}_${selectedYear}.pdf`;

            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Error downloading PDF:', error);
            alert('Erreur lors du téléchargement du fichier PDF');
        } finally {
            setLoadingPdf(false);
        }
    };

    if (!isOpen) return null;

    const months = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    return (
        <Fragment>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Download size={24} />
                                <h2 className="text-xl font-bold">Exporter les données</h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-white/20 rounded-lg transition"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200">
                        <button
                            onClick={() => setActiveTab('excel')}
                            className={clsx(
                                'flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition',
                                activeTab === 'excel'
                                    ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                                    : 'text-gray-500 hover:text-gray-700'
                            )}
                        >
                            <FileSpreadsheet size={18} />
                            Rapport Excel
                        </button>
                        <button
                            onClick={() => setActiveTab('pdf')}
                            className={clsx(
                                'flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition',
                                activeTab === 'pdf'
                                    ? 'text-red-600 border-b-2 border-red-600 bg-red-50'
                                    : 'text-gray-500 hover:text-gray-700'
                            )}
                        >
                            <FileText size={18} />
                            Feuille de Temps
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {activeTab === 'excel' ? (
                            <div className="space-y-5">
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <p className="text-sm text-green-800">
                                        📊 <strong>Rapport Comptable (Excel)</strong><br />
                                        Export de toutes les présences pour la paie avec totaux par employé.
                                    </p>
                                </div>

                                {/* Date range */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            <Calendar size={14} className="inline mr-1" />
                                            Date de début
                                        </label>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            <Calendar size={14} className="inline mr-1" />
                                            Date de fin
                                        </label>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                {/* Site filter */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        <Building2 size={14} className="inline mr-1" />
                                        Site (optionnel)
                                    </label>
                                    <select
                                        value={selectedSite}
                                        onChange={(e) => setSelectedSite(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    >
                                        <option value="">Tous les sites</option>
                                        {sites.map(site => (
                                            <option key={site.id} value={site.id}>{site.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Download button */}
                                <button
                                    onClick={handleDownloadExcel}
                                    disabled={loadingExcel || !startDate || !endDate}
                                    className={clsx(
                                        'w-full py-3 rounded-xl font-bold text-white transition flex items-center justify-center gap-2',
                                        loadingExcel || !startDate || !endDate
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl'
                                    )}
                                >
                                    {loadingExcel ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                            Génération en cours...
                                        </>
                                    ) : (
                                        <>
                                            <FileSpreadsheet size={20} />
                                            Télécharger Excel
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <p className="text-sm text-red-800">
                                        📄 <strong>Feuille de Temps (PDF)</strong><br />
                                        Document individuel avec tableau journalier et cadres de signature.
                                    </p>
                                </div>

                                {/* Month/Year selectors */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            <Calendar size={14} className="inline mr-1" />
                                            Mois
                                        </label>
                                        <select
                                            value={selectedMonth}
                                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                        >
                                            {months.map((month, idx) => (
                                                <option key={idx} value={idx}>{month}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            <Calendar size={14} className="inline mr-1" />
                                            Année
                                        </label>
                                        <select
                                            value={selectedYear}
                                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                        >
                                            {years.map(year => (
                                                <option key={year} value={year}>{year}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Employee selector */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        <Users size={14} className="inline mr-1" />
                                        Employé
                                    </label>
                                    <select
                                        value={selectedEmployee}
                                        onChange={(e) => setSelectedEmployee(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                    >
                                        <option value="">Sélectionner un employé</option>
                                        {employees.map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Download button */}
                                <button
                                    onClick={handleDownloadPdf}
                                    disabled={loadingPdf || !selectedEmployee}
                                    className={clsx(
                                        'w-full py-3 rounded-xl font-bold text-white transition flex items-center justify-center gap-2',
                                        loadingPdf || !selectedEmployee
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-lg hover:shadow-xl'
                                    )}
                                >
                                    {loadingPdf ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                            Génération en cours...
                                        </>
                                    ) : (
                                        <>
                                            <FileText size={20} />
                                            Générer PDF
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Fragment>
    );
}
