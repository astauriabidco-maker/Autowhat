import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Search,
    Plus,
    MoreVertical,
    Phone,
    CheckCircle,
    Archive,
    AlertCircle,
    Users,
    UserCheck,
    UserX
} from 'lucide-react';
import AddEmployeeModal from '../components/AddEmployeeModal';

interface Employee {
    id: string;
    name: string;
    phoneNumber: string;
    role: string;
    position: string;
    status: 'ACTIVE' | 'ARCHIVED' | 'NEVER_CONNECTED';
    lastActivity: string | null;
    lastActivityFormatted: string;
}

export default function Employees() {
    const navigate = useNavigate();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
            return;
        }
        fetchEmployees();
    }, [navigate]);

    useEffect(() => {
        // Filter employees based on search query
        if (!searchQuery) {
            setFilteredEmployees(employees);
        } else {
            const query = searchQuery.toLowerCase();
            setFilteredEmployees(
                employees.filter(emp =>
                    emp.name.toLowerCase().includes(query) ||
                    emp.phoneNumber.includes(query) ||
                    emp.position.toLowerCase().includes(query)
                )
            );
        }
    }, [searchQuery, employees]);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get<{ employees: Employee[] }>('/api/employees', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEmployees(response.data.employees);
        } catch (err: any) {
            if (err.response?.status === 401) {
                localStorage.removeItem('token');
                navigate('/');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleArchive = async (id: string) => {
        try {
            const token = localStorage.getItem('token');
            await axios.patch(`/api/employees/${id}`,
                { archived: true },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchEmployees();
            setActiveMenu(null);
        } catch (err) {
            console.error('Error archiving employee:', err);
        }
    };

    const handleEmployeeAdded = () => {
        fetchEmployees();
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const getAvatarColor = (name: string) => {
        const colors = [
            'bg-blue-500',
            'bg-green-500',
            'bg-purple-500',
            'bg-orange-500',
            'bg-pink-500',
            'bg-indigo-500',
            'bg-teal-500',
            'bg-red-500'
        ];
        const index = name.charCodeAt(0) % colors.length;
        return colors[index];
    };

    const formatPhoneNumber = (phone: string) => {
        // Format: +33 6 12 34 56 78
        if (phone.length >= 11) {
            return `+${phone.slice(0, 2)} ${phone.slice(2, 3)} ${phone.slice(3, 5)} ${phone.slice(5, 7)} ${phone.slice(7, 9)} ${phone.slice(9)}`;
        }
        return phone;
    };

    const getStatusBadge = (status: Employee['status']) => {
        switch (status) {
            case 'ACTIVE':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                        <CheckCircle size={12} />
                        Actif
                    </span>
                );
            case 'ARCHIVED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                        <Archive size={12} />
                        Archivé
                    </span>
                );
            case 'NEVER_CONNECTED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                        <AlertCircle size={12} />
                        Jamais connecté
                    </span>
                );
        }
    };

    // Stats
    const activeCount = employees.filter(e => e.status === 'ACTIVE').length;
    const neverConnectedCount = employees.filter(e => e.status === 'NEVER_CONNECTED').length;
    const archivedCount = employees.filter(e => e.status === 'ARCHIVED').length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Chargement de l'équipe...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Mon Équipe</h1>
                    <p className="text-gray-500 mt-1">{employees.length} employé{employees.length > 1 ? 's' : ''} enregistré{employees.length > 1 ? 's' : ''}</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition shadow-sm"
                >
                    <Plus size={18} />
                    Ajouter un employé
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                        <Users size={24} className="text-blue-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
                        <p className="text-sm text-gray-500">Total</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                    <div className="p-3 bg-green-50 rounded-lg">
                        <UserCheck size={24} className="text-green-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
                        <p className="text-sm text-gray-500">Actifs</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                    <div className="p-3 bg-yellow-50 rounded-lg">
                        <AlertCircle size={24} className="text-yellow-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-900">{neverConnectedCount}</p>
                        <p className="text-sm text-gray-500">À activer</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <UserX size={24} className="text-gray-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-900">{archivedCount}</p>
                        <p className="text-sm text-gray-500">Archivés</p>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher par nom, téléphone ou poste..."
                    className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employé</th>
                            <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                            <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                            <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Dernière activité</th>
                            <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredEmployees.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                    {searchQuery ? 'Aucun employé trouvé' : 'Aucun employé enregistré'}
                                </td>
                            </tr>
                        ) : (
                            filteredEmployees.map((employee) => (
                                <tr key={employee.id} className="hover:bg-gray-50 transition">
                                    {/* Employee */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 ${getAvatarColor(employee.name)} rounded-full flex items-center justify-center text-white font-semibold text-sm`}>
                                                {getInitials(employee.name)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{employee.name}</p>
                                                <p className="text-sm text-gray-500">{employee.position}</p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Contact */}
                                    <td className="px-6 py-4">
                                        <a
                                            href={`https://wa.me/${employee.phoneNumber}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 text-gray-700 hover:text-green-600 transition"
                                        >
                                            <Phone size={14} />
                                            {formatPhoneNumber(employee.phoneNumber)}
                                        </a>
                                    </td>

                                    {/* Status */}
                                    <td className="px-6 py-4">
                                        {getStatusBadge(employee.status)}
                                    </td>

                                    {/* Last Activity */}
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {employee.lastActivityFormatted}
                                    </td>

                                    {/* Actions */}
                                    <td className="px-6 py-4 text-right relative">
                                        <button
                                            onClick={() => setActiveMenu(activeMenu === employee.id ? null : employee.id)}
                                            className="p-2 hover:bg-gray-100 rounded-lg transition"
                                        >
                                            <MoreVertical size={16} className="text-gray-500" />
                                        </button>

                                        {activeMenu === employee.id && (
                                            <>
                                                <div
                                                    className="fixed inset-0 z-10"
                                                    onClick={() => setActiveMenu(null)}
                                                />
                                                <div className="absolute right-6 top-12 z-20 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                                                    <a
                                                        href={`https://wa.me/${employee.phoneNumber}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                                    >
                                                        Envoyer un message
                                                    </a>
                                                    {employee.status !== 'ARCHIVED' && (
                                                        <button
                                                            onClick={() => handleArchive(employee.id)}
                                                            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                                        >
                                                            Archiver
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add Employee Modal */}
            <AddEmployeeModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={handleEmployeeAdded}
            />

            {/* Success Toast */}
            {showToast && (
                <div className="fixed bottom-6 right-6 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in z-50">
                    <CheckCircle size={20} />
                    <span>Employé ajouté avec succès !</span>
                </div>
            )}
        </div>
    );
}
