import { useState, useEffect } from 'react';
import { X, User, Phone, Briefcase, Loader2, Building2 } from 'lucide-react';

interface AddEmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddEmployeeModal({ isOpen, onClose, onSuccess }: AddEmployeeModalProps) {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        phoneNumber: '',
        countryCode: '+33',
        position: '',
        workProfile: 'MOBILE', // MOBILE ou SEDENTARY
        siteId: '' // Site de rattachement pour sédentaire
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [sites, setSites] = useState<{ id: string, name: string }[]>([]);

    // Charger les sites disponibles
    useEffect(() => {
        if (isOpen) {
            const fetchSites = async () => {
                try {
                    const token = localStorage.getItem('token');
                    const res = await fetch('/api/sites', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (data.sites) setSites(data.sites);
                } catch (e) {
                    console.error('Failed to load sites:', e);
                }
            };
            fetchSites();
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const token = localStorage.getItem('token');

            // Combine first and last name
            const fullName = `${formData.firstName} ${formData.lastName}`.trim();

            // Combine country code and phone number
            const fullPhone = `${formData.countryCode}${formData.phoneNumber}`;

            const response = await fetch('/api/employees', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: fullName,
                    phoneNumber: fullPhone,
                    position: formData.position || 'Employé',
                    role: 'EMPLOYEE',
                    workProfile: formData.workProfile,
                    siteId: formData.siteId || null
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de la création');
            }

            // Reset form
            setFormData({
                firstName: '',
                lastName: '',
                phoneNumber: '',
                countryCode: '+33',
                position: '',
                workProfile: 'MOBILE',
                siteId: ''
            });

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Erreur lors de la création de l\'employé');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-100">
                        <h2 className="text-xl font-semibold text-gray-900">
                            Ajouter un employé
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                                {error}
                            </div>
                        )}

                        {/* First Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Prénom *
                            </label>
                            <div className="relative">
                                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    required
                                    value={formData.firstName}
                                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                                    placeholder="Jean"
                                />
                            </div>
                        </div>

                        {/* Last Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Nom *
                            </label>
                            <div className="relative">
                                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    required
                                    value={formData.lastName}
                                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                                    placeholder="Dupont"
                                />
                            </div>
                        </div>

                        {/* Phone Number */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Numéro WhatsApp *
                            </label>
                            <div className="flex gap-2">
                                <select
                                    value={formData.countryCode}
                                    onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                                    className="w-24 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                >
                                    <option value="+33">🇫🇷 +33</option>
                                    <option value="+32">🇧🇪 +32</option>
                                    <option value="+41">🇨🇭 +41</option>
                                    <option value="+1">🇺🇸 +1</option>
                                    <option value="+44">🇬🇧 +44</option>
                                    <option value="+212">🇲🇦 +212</option>
                                </select>
                                <div className="relative flex-1">
                                    <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="tel"
                                        required
                                        value={formData.phoneNumber}
                                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value.replace(/\D/g, '') })}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                                        placeholder="612345678"
                                    />
                                </div>
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                                Format: numéro sans le 0 initial
                            </p>
                        </div>

                        {/* Position */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Poste
                            </label>
                            <div className="relative">
                                <Briefcase size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={formData.position}
                                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                                    placeholder="Peintre, Électricien, Commercial..."
                                />
                            </div>
                        </div>

                        {/* Work Profile */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Profil de poste
                            </label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, workProfile: 'MOBILE' })}
                                    className={`flex-1 py-2.5 px-4 rounded-lg border-2 transition flex items-center justify-center gap-2 ${formData.workProfile === 'MOBILE'
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    🏃 Mobile (Terrain)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, workProfile: 'SEDENTARY' })}
                                    className={`flex-1 py-2.5 px-4 rounded-lg border-2 transition flex items-center justify-center gap-2 ${formData.workProfile === 'SEDENTARY'
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    🏢 Sédentaire
                                </button>
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                                {formData.workProfile === 'MOBILE'
                                    ? '✨ Peut pointer depuis n\'importe où'
                                    : '📍 Doit être dans le rayon du site pour pointer'}
                            </p>
                        </div>

                        {/* Site - Only show if sedentary or if sites exist */}
                        {sites.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    <Building2 size={16} className="inline mr-1" />
                                    Site de rattachement
                                    {formData.workProfile === 'SEDENTARY' && <span className="text-red-500"> *</span>}
                                </label>
                                <select
                                    value={formData.siteId}
                                    onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                    required={formData.workProfile === 'SEDENTARY'}
                                >
                                    <option value="">-- Aucun site --</option>
                                    {sites.map(site => (
                                        <option key={site.id} value={site.id}>📍 {site.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Création en cours...
                                </>
                            ) : (
                                'Créer l\'employé'
                            )}
                        </button>

                        <p className="text-xs text-center text-gray-500">
                            💡 L'employé recevra automatiquement un message WhatsApp de bienvenue
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
}
