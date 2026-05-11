import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Wrench, Plus, X, Pencil, Trash2, Archive, Clock, FileText,
    Shield, Camera, Palette, Zap, Thermometer,
    Droplets, Hammer, Cog, Truck, Phone, Wifi, Bug, Eye,
    HardHat, Lightbulb, PaintBucket, Plug, Router,
    Scan, Scissors, ShieldCheck, Snowflake, SquareStack,
    CheckCircle2
} from 'lucide-react';

const token = localStorage.getItem('token');
const headers = { Authorization: `Bearer ${token}` };

// Icon map for selection
const ICON_OPTIONS: { value: string; icon: React.ReactNode; label: string }[] = [
    { value: 'wrench', icon: <Wrench size={18} />, label: 'Clé' },
    { value: 'zap', icon: <Zap size={18} />, label: 'Électricité' },
    { value: 'thermometer', icon: <Thermometer size={18} />, label: 'Chauffage' },
    { value: 'droplets', icon: <Droplets size={18} />, label: 'Plomberie' },
    { value: 'hammer', icon: <Hammer size={18} />, label: 'Construction' },
    { value: 'cog', icon: <Cog size={18} />, label: 'Mécanique' },
    { value: 'truck', icon: <Truck size={18} />, label: 'Livraison' },
    { value: 'phone', icon: <Phone size={18} />, label: 'Télécom' },
    { value: 'wifi', icon: <Wifi size={18} />, label: 'Réseau' },
    { value: 'bug', icon: <Bug size={18} />, label: 'Diagnostic' },
    { value: 'eye', icon: <Eye size={18} />, label: 'Inspection' },
    { value: 'hardhat', icon: <HardHat size={18} />, label: 'Chantier' },
    { value: 'lightbulb', icon: <Lightbulb size={18} />, label: 'Éclairage' },
    { value: 'paintbucket', icon: <PaintBucket size={18} />, label: 'Peinture' },
    { value: 'plug', icon: <Plug size={18} />, label: 'Branchement' },
    { value: 'router', icon: <Router size={18} />, label: 'IT' },
    { value: 'scan', icon: <Scan size={18} />, label: 'Contrôle' },
    { value: 'scissors', icon: <Scissors size={18} />, label: 'Découpe' },
    { value: 'shieldcheck', icon: <ShieldCheck size={18} />, label: 'Sécurité' },
    { value: 'snowflake', icon: <Snowflake size={18} />, label: 'Climatisation' },
];

const COLOR_PRESETS = [
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
    '#ec4899', '#ef4444', '#f97316', '#f59e0b',
    '#eab308', '#84cc16', '#22c55e', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#64748b', '#1e293b',
];

function getIconComponent(iconName: string | null | undefined, size = 18) {
    if (!iconName) return <Wrench size={size} />;
    const found = ICON_OPTIONS.find(i => i.value === iconName);
    if (!found) return <Wrench size={size} />;
    // Re-render with custom size
    const IconMap: Record<string, React.ReactNode> = {
        wrench: <Wrench size={size} />, zap: <Zap size={size} />, thermometer: <Thermometer size={size} />,
        droplets: <Droplets size={size} />, hammer: <Hammer size={size} />, cog: <Cog size={size} />,
        truck: <Truck size={size} />, phone: <Phone size={size} />, wifi: <Wifi size={size} />,
        bug: <Bug size={size} />, eye: <Eye size={size} />, hardhat: <HardHat size={size} />,
        lightbulb: <Lightbulb size={size} />, paintbucket: <PaintBucket size={size} />,
        plug: <Plug size={size} />, router: <Router size={size} />, scan: <Scan size={size} />,
        scissors: <Scissors size={size} />, shieldcheck: <ShieldCheck size={size} />,
        snowflake: <Snowflake size={size} />,
    };
    return IconMap[iconName] || <Wrench size={size} />;
}

interface InterventionType {
    id: string;
    name: string;
    description?: string | null;
    color: string;
    icon?: string | null;
    defaultDuration: number;
    isActive: boolean;
    sortOrder: number;
    requiresReport: boolean;
    requiresSignature: boolean;
    requiresPhotos: boolean;
    _count: { interventions: number };
    createdAt: string;
}

const emptyForm = {
    name: '', description: '', color: '#3b82f6', icon: 'wrench',
    defaultDuration: '60', requiresReport: false, requiresSignature: true, requiresPhotos: false,
};

export default function InterventionTypes() {
    const [types, setTypes] = useState<InterventionType[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [showInactive, setShowInactive] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const fetchTypes = async () => {
        try {
            const { data } = await axios.get(`/api/intervention-types${showInactive ? '?includeInactive=true' : ''}`, { headers });
            setTypes(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('Error fetching types:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTypes(); }, [showInactive]);

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyForm);
        setShowModal(true);
    };

    const openEdit = (type: InterventionType) => {
        setEditingId(type.id);
        setForm({
            name: type.name,
            description: type.description || '',
            color: type.color,
            icon: type.icon || 'wrench',
            defaultDuration: String(type.defaultDuration),
            requiresReport: type.requiresReport,
            requiresSignature: type.requiresSignature,
            requiresPhotos: type.requiresPhotos,
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            if (editingId) {
                await axios.put(`/api/intervention-types/${editingId}`, form, { headers });
            } else {
                await axios.post('/api/intervention-types', form, { headers });
            }
            setShowModal(false);
            setForm(emptyForm);
            setEditingId(null);
            fetchTypes();
        } catch (e) {
            console.error('Error saving type:', e);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await axios.delete(`/api/intervention-types/${id}`, { headers });
            setDeleteConfirm(null);
            fetchTypes();
        } catch (e) {
            console.error('Error deleting type:', e);
        }
    };

    const handleToggleActive = async (type: InterventionType) => {
        try {
            await axios.put(`/api/intervention-types/${type.id}`, { isActive: !type.isActive }, { headers });
            fetchTypes();
        } catch (e) {
            console.error('Error toggling active:', e);
        }
    };

    const activeTypes = types.filter(t => t.isActive);
    const archivedTypes = types.filter(t => !t.isActive);

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <span className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white">
                            <SquareStack size={24} />
                        </span>
                        Types d'Interventions
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Définissez les types d'interventions adaptés à votre activité · {activeTypes.length} actif{activeTypes.length > 1 ? 's' : ''}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={showInactive}
                            onChange={(e) => setShowInactive(e.target.checked)}
                            className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                        />
                        Voir archivés
                    </label>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium text-sm shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all"
                    >
                        <Plus size={18} /> Nouveau Type
                    </button>
                </div>
            </div>

            {/* Active Types Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                </div>
            ) : activeTypes.length === 0 && !showInactive ? (
                <div className="text-center py-20 bg-white/60 backdrop-blur-sm rounded-2xl border border-gray-100">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                        <SquareStack size={28} className="text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Aucun type d'intervention</h3>
                    <p className="text-gray-500 mb-6 max-w-md mx-auto">
                        Créez vos premiers types pour structurer vos interventions.<br />
                        Ex: "Dépannage urgence", "Maintenance préventive", "Installation"…
                    </p>
                    <button
                        onClick={openCreate}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-xl font-medium text-sm hover:bg-blue-600 transition-colors"
                    >
                        <Plus size={18} /> Créer mon premier type
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeTypes.map((type) => (
                        <div
                            key={type.id}
                            className="group bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:border-gray-200 transition-all duration-200"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md"
                                        style={{ backgroundColor: type.color }}
                                    >
                                        {getIconComponent(type.icon, 22)}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{type.name}</h3>
                                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                            <Clock size={12} />
                                            <span>{type.defaultDuration} min</span>
                                            <span className="text-gray-300">·</span>
                                            <span>{type._count.interventions} interv.</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => openEdit(type)}
                                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                        <Pencil size={15} />
                                    </button>
                                    <button
                                        onClick={() => handleToggleActive(type)}
                                        className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                                        title="Archiver"
                                    >
                                        <Archive size={15} />
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirm(type.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>

                            {type.description && (
                                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{type.description}</p>
                            )}

                            {/* Requirement badges */}
                            <div className="flex flex-wrap gap-1.5">
                                {type.requiresSignature && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium">
                                        <Shield size={11} /> Signature
                                    </span>
                                )}
                                {type.requiresReport && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">
                                        <FileText size={11} /> Rapport
                                    </span>
                                )}
                                {type.requiresPhotos && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-medium">
                                        <Camera size={11} /> Photos
                                    </span>
                                )}
                            </div>

                            {/* Delete confirmation inline */}
                            {deleteConfirm === type.id && (
                                <div className="mt-3 p-3 bg-red-50 rounded-xl border border-red-100">
                                    <p className="text-xs text-red-700 mb-2">
                                        {type._count.interventions > 0
                                            ? `Ce type est utilisé par ${type._count.interventions} intervention(s). Il sera archivé au lieu d'être supprimé.`
                                            : 'Supprimer définitivement ce type ?'}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleDelete(type.id)}
                                            className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600"
                                        >
                                            Confirmer
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirm(null)}
                                            className="px-3 py-1 bg-white text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 border border-gray-200"
                                        >
                                            Annuler
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Archived Types */}
            {showInactive && archivedTypes.length > 0 && (
                <div className="mt-8">
                    <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Archive size={14} /> Archivés ({archivedTypes.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {archivedTypes.map((type) => (
                            <div
                                key={type.id}
                                className="group bg-gray-50/80 rounded-2xl border border-gray-200 p-5 opacity-60 hover:opacity-80 transition-all"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white/80"
                                            style={{ backgroundColor: type.color }}
                                        >
                                            {getIconComponent(type.icon, 20)}
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-gray-600 line-through">{type.name}</h3>
                                            <span className="text-xs text-gray-400">{type._count.interventions} interv.</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleToggleActive(type)}
                                        className="px-3 py-1 bg-white text-blue-600 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-50 transition-colors"
                                    >
                                        Réactiver
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">
                                    {editingId ? 'Modifier le type' : 'Nouveau type d\'intervention'}
                                </h2>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Personnalisez ce type selon votre activité
                                </p>
                            </div>
                            <button onClick={() => { setShowModal(false); setEditingId(null); }} className="p-2 hover:bg-gray-100 rounded-xl">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-5">
                            {/* Preview */}
                            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-xl border border-gray-100">
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg transition-all duration-300"
                                    style={{ backgroundColor: form.color }}
                                >
                                    {getIconComponent(form.icon, 24)}
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-800">{form.name || 'Nom du type…'}</p>
                                    <p className="text-xs text-gray-400">{form.defaultDuration} min · Aperçu</p>
                                </div>
                            </div>

                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom du type *</label>
                                <input
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Ex: Dépannage plomberie urgence"
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Description détaillée de ce type d'intervention…"
                                    rows={2}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                />
                            </div>

                            {/* Color + Duration row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                                        <Palette size={14} className="text-gray-400" /> Couleur
                                    </label>
                                    <div className="grid grid-cols-8 gap-1.5 mb-2">
                                        {COLOR_PRESETS.map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setForm({ ...form, color: c })}
                                                className={`w-7 h-7 rounded-lg transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'}`}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                    <input
                                        type="color"
                                        value={form.color}
                                        onChange={(e) => setForm({ ...form, color: e.target.value })}
                                        className="w-full h-8 rounded-lg cursor-pointer border border-gray-200"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                                        <Clock size={14} className="text-gray-400" /> Durée par défaut
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={form.defaultDuration}
                                            onChange={(e) => setForm({ ...form, defaultDuration: e.target.value })}
                                            min={15}
                                            step={15}
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">min</span>
                                    </div>
                                    <div className="flex gap-1.5 mt-2">
                                        {[30, 60, 90, 120].map(d => (
                                            <button
                                                key={d}
                                                onClick={() => setForm({ ...form, defaultDuration: String(d) })}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${form.defaultDuration === String(d) ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                    }`}
                                            >
                                                {d >= 60 ? `${d / 60}h` : `${d}m`}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Icon selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Icône</label>
                                <div className="grid grid-cols-10 gap-1.5">
                                    {ICON_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setForm({ ...form, icon: opt.value })}
                                            title={opt.label}
                                            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${form.icon === opt.value
                                                    ? 'text-white shadow-md scale-110'
                                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:scale-105'
                                                }`}
                                            style={form.icon === opt.value ? { backgroundColor: form.color } : {}}
                                        >
                                            {opt.icon}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Requirements */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">Exigences de l'intervention</label>
                                <div className="space-y-2.5">
                                    <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={form.requiresSignature}
                                            onChange={(e) => setForm({ ...form, requiresSignature: e.target.checked })}
                                            className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-500"
                                        />
                                        <Shield size={16} className="text-indigo-500" />
                                        <div>
                                            <span className="text-sm font-medium text-gray-700">Signature client obligatoire</span>
                                            <p className="text-xs text-gray-400">Le client devra signer sur tablette à la fin</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={form.requiresReport}
                                            onChange={(e) => setForm({ ...form, requiresReport: e.target.checked })}
                                            className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                                        />
                                        <FileText size={16} className="text-blue-500" />
                                        <div>
                                            <span className="text-sm font-medium text-gray-700">Rapport d'intervention obligatoire</span>
                                            <p className="text-xs text-gray-400">Le technicien devra rédiger un rapport</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={form.requiresPhotos}
                                            onChange={(e) => setForm({ ...form, requiresPhotos: e.target.checked })}
                                            className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                                        />
                                        <Camera size={16} className="text-emerald-500" />
                                        <div>
                                            <span className="text-sm font-medium text-gray-700">Photos obligatoires</span>
                                            <p className="text-xs text-gray-400">Le technicien devra joindre des photos avant/après</p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="sticky bottom-0 bg-white rounded-b-2xl border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
                            <button
                                onClick={() => { setShowModal(false); setEditingId(null); }}
                                className="px-5 py-2.5 text-gray-600 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !form.name.trim()}
                                className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl disabled:opacity-50 transition-all flex items-center gap-2"
                            >
                                <CheckCircle2 size={16} />
                                {saving ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Créer le type'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
