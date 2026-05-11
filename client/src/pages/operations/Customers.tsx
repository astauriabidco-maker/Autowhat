import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Building2, Plus, Search, Upload, Edit3, Trash2, X,
    Phone, Mail, MapPin, Key, ChevronDown, ChevronUp,
    Navigation, Clock
} from 'lucide-react';
import CustomerHistory from './CustomerHistory';

interface CustomerSite {
    id: string;
    name: string;
    isMainSite: boolean;
    address: string;
    address2?: string;
    city: string;
    postalCode: string;
    country: string;
    latitude?: number;
    longitude?: number;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    accessCode?: string;
    accessNotes?: string;
    _count?: { interventions: number };
}

interface Customer {
    id: string;
    companyName: string;
    contactName: string;
    email?: string;
    phone?: string;
    address?: string;
    country?: string;
    accessCode?: string;
    notes?: string;
    sites?: CustomerSite[];
    _count?: { interventions: number; sites: number };
}

const COUNTRIES = [
    { code: 'FR', label: '🇫🇷 France', format: 'NPA + Ville' },
    { code: 'BE', label: '🇧🇪 Belgique', format: 'NPA + Ville' },
    { code: 'CH', label: '🇨🇭 Suisse', format: 'NPA + Ville' },
    { code: 'LU', label: '🇱🇺 Luxembourg', format: 'NPA + Ville' },
    { code: 'MC', label: '🇲🇨 Monaco', format: 'NPA + Ville' },
    { code: 'CA', label: '🇨🇦 Canada', format: 'Code postal + Ville' },
    { code: 'CM', label: '🇨🇲 Cameroun', format: 'Ville + Quartier' },
    { code: 'SN', label: '🇸🇳 Sénégal', format: 'Ville + Quartier' },
    { code: 'CI', label: '🇨🇮 Côte d\'Ivoire', format: 'Ville + Quartier' },
    { code: 'MA', label: '🇲🇦 Maroc', format: 'Code postal + Ville' },
    { code: 'TN', label: '🇹🇳 Tunisie', format: 'Code postal + Ville' },
    { code: 'DZ', label: '🇩🇿 Algérie', format: 'Code postal + Ville' },
    { code: 'DE', label: '🇩🇪 Allemagne', format: 'PLZ + Ort' },
    { code: 'ES', label: '🇪🇸 Espagne', format: 'CP + Ciudad' },
    { code: 'GB', label: '🇬🇧 Royaume-Uni', format: 'Postcode + City' },
    { code: 'US', label: '🇺🇸 États-Unis', format: 'City, State ZIP' },
    { code: 'OTHER', label: '🌍 Autre', format: 'Code postal + Ville' },
];

const emptyCustomerForm = { companyName: '', contactName: '', email: '', phone: '', address: '', country: 'FR', accessCode: '', notes: '' };

const emptySiteForm = {
    name: '', address: '', address2: '', city: '', postalCode: '', country: 'FR',
    latitude: '', longitude: '',
    contactName: '', contactPhone: '', contactEmail: '',
    accessCode: '', accessNotes: '', isMainSite: false,
};

export default function Customers() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showSiteModal, setShowSiteModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [editingCustomerForSite, setEditingCustomerForSite] = useState<Customer | null>(null);
    const [editingSite, setEditingSite] = useState<CustomerSite | null>(null);
    const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
    const [form, setForm] = useState(emptyCustomerForm);
    const [siteForm, setSiteForm] = useState(emptySiteForm);
    const [csvText, setCsvText] = useState('');
    const [saving, setSaving] = useState(false);
    const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    const fetchCustomers = async (q = '') => {
        try {
            setLoading(true);
            const res = await axios.get('/api/customers', { headers, params: q ? { search: q } : {} });
            setCustomers(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error('Error fetching customers', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCustomers(); }, []);
    useEffect(() => { const t = setTimeout(() => fetchCustomers(search), 300); return () => clearTimeout(t); }, [search]);

    // --- Customer CRUD ---
    const openCustomerModal = (customer?: Customer) => {
        if (customer) {
            setEditingCustomer(customer);
            setForm({
                companyName: customer.companyName, contactName: customer.contactName,
                email: customer.email || '', phone: customer.phone || '',
                address: customer.address || '', country: customer.country || 'FR',
                accessCode: customer.accessCode || '', notes: customer.notes || '',
            });
        } else {
            setEditingCustomer(null);
            setForm(emptyCustomerForm);
        }
        setShowModal(true);
    };

    const handleSaveCustomer = async () => {
        if (!form.companyName || !form.contactName) return;
        setSaving(true);
        try {
            if (editingCustomer) {
                await axios.put(`/api/customers/${editingCustomer.id}`, form, { headers });
            } else {
                await axios.post('/api/customers', form, { headers });
            }
            setShowModal(false);
            fetchCustomers(search);
        } catch (e) { console.error('Error saving customer', e); }
        finally { setSaving(false); }
    };

    const handleDeleteCustomer = async (id: string) => {
        if (!confirm('Supprimer ce client et tous ses sites ?')) return;
        try {
            await axios.delete(`/api/customers/${id}`, { headers });
            fetchCustomers(search);
        } catch (e) { console.error('Error deleting customer', e); }
    };

    // --- Site CRUD ---
    const openSiteModal = (customer: Customer, site?: CustomerSite) => {
        setEditingCustomerForSite(customer);
        if (site) {
            setEditingSite(site);
            setSiteForm({
                name: site.name, address: site.address, address2: site.address2 || '',
                city: site.city, postalCode: site.postalCode, country: site.country,
                latitude: site.latitude?.toString() || '', longitude: site.longitude?.toString() || '',
                contactName: site.contactName || '', contactPhone: site.contactPhone || '',
                contactEmail: site.contactEmail || '',
                accessCode: site.accessCode || '', accessNotes: site.accessNotes || '',
                isMainSite: site.isMainSite,
            });
        } else {
            setEditingSite(null);
            setSiteForm({ ...emptySiteForm, country: customer.country || 'FR' });
        }
        setShowSiteModal(true);
    };

    const handleSaveSite = async () => {
        if (!siteForm.name || !siteForm.address || !siteForm.city || !siteForm.postalCode) return;
        if (!editingCustomerForSite) return;
        setSaving(true);
        try {
            const payload = {
                ...siteForm,
                latitude: siteForm.latitude ? parseFloat(siteForm.latitude) : null,
                longitude: siteForm.longitude ? parseFloat(siteForm.longitude) : null,
            };

            if (editingSite) {
                await axios.put(`/api/customers/${editingCustomerForSite.id}/sites/${editingSite.id}`, payload, { headers });
            } else {
                await axios.post(`/api/customers/${editingCustomerForSite.id}/sites`, payload, { headers });
            }
            setShowSiteModal(false);
            fetchCustomers(search);
        } catch (e) { console.error('Error saving site', e); }
        finally { setSaving(false); }
    };

    const handleDeleteSite = async (customerId: string, siteId: string) => {
        if (!confirm('Supprimer ce site ?')) return;
        try {
            await axios.delete(`/api/customers/${customerId}/sites/${siteId}`, { headers });
            fetchCustomers(search);
        } catch (e) { console.error('Error deleting site', e); }
    };

    // --- CSV Import ---
    const handleImport = async () => {
        const lines = csvText.split('\n').filter(l => l.trim());
        if (lines.length < 2) return;
        const headerRow = lines[0].split(';').map(h => h.trim().toLowerCase());
        const parsedCustomers = lines.slice(1).map(line => {
            const values = line.split(';');
            const obj: Record<string, string> = {};
            headerRow.forEach((h, i) => { obj[h] = values[i]?.trim() || ''; });
            return {
                companyName: obj['société'] || obj['societe'] || obj['company'] || obj['companyname'] || '',
                contactName: obj['contact'] || obj['contactname'] || obj['nom'] || '',
                email: obj['email'] || obj['mail'] || '',
                phone: obj['téléphone'] || obj['telephone'] || obj['phone'] || obj['tel'] || '',
                address: obj['adresse'] || obj['address'] || '',
                country: obj['pays'] || obj['country'] || 'FR',
            };
        }).filter(c => c.companyName);

        if (parsedCustomers.length === 0) return;

        try {
            await axios.post('/api/customers/import-csv', { customers: parsedCustomers }, { headers });
            setShowImportModal(false);
            setCsvText('');
            fetchCustomers();
        } catch (e) { console.error('Error importing', e); }
    };

    const getCountryFlag = (code?: string) => {
        return COUNTRIES.find(c => c.code === code)?.label.split(' ')[0] || '🌍';
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Building2 className="text-blue-600" size={28} />
                        Clients
                    </h2>
                    <p className="text-gray-500 mt-1">Gérez votre portefeuille client · {customers.length} clients</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition text-sm font-medium text-gray-700">
                        <Upload size={16} /> Import CSV
                    </button>
                    <button onClick={() => openCustomerModal()}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition shadow-lg shadow-blue-500/25 font-medium">
                        <Plus size={16} /> Nouveau Client
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher un client..."
                    className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                />
            </div>

            {/* Customer List */}
            {loading ? (
                <div className="text-center py-20 text-gray-400">Chargement...</div>
            ) : customers.length === 0 ? (
                <div className="text-center py-20">
                    <Building2 size={48} className="text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">Aucun client pour le moment</p>
                    <p className="text-gray-400 text-sm mt-1">Ajoutez votre premier client pour démarrer</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {customers.map(customer => (
                        <div key={customer.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
                            {/* Customer Header */}
                            <div className="p-5">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4 flex-1 min-w-0">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-600 font-bold text-lg flex-shrink-0">
                                            {customer.companyName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-lg font-bold text-gray-900 truncate">{customer.companyName}</h3>
                                                <span className="text-sm">{getCountryFlag(customer.country)}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-gray-500">
                                                <span className="flex items-center gap-1.5">
                                                    <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">👤</span>
                                                    {customer.contactName}
                                                </span>
                                                {customer.phone && (
                                                    <span className="flex items-center gap-1"><Phone size={13} className="text-gray-400" /> {customer.phone}</span>
                                                )}
                                                {customer.email && (
                                                    <span className="flex items-center gap-1"><Mail size={13} className="text-gray-400" /> {customer.email}</span>
                                                )}
                                            </div>
                                            {customer.address && (
                                                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                                    <MapPin size={12} /> {customer.address}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                                        {/* Stats badges */}
                                        <div className="flex items-center gap-2 mr-2">
                                            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold">
                                                {customer._count?.sites || 0} site{(customer._count?.sites || 0) !== 1 ? 's' : ''}
                                            </span>
                                            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold">
                                                {customer._count?.interventions || 0} interv.
                                            </span>
                                        </div>

                                        <button onClick={() => setHistoryCustomer(customer)} className="p-2 rounded-lg hover:bg-purple-50 text-gray-400 hover:text-purple-600 transition" title="Historique">
                                            <Clock size={16} />
                                        </button>
                                        <button onClick={() => openCustomerModal(customer)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition" title="Modifier">
                                            <Edit3 size={16} />
                                        </button>
                                        <button onClick={() => handleDeleteCustomer(customer.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition" title="Supprimer">
                                            <Trash2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => setExpandedCustomer(expandedCustomer === customer.id ? null : customer.id)}
                                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition"
                                            title="Voir les sites"
                                        >
                                            {expandedCustomer === customer.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Sites Section */}
                            {expandedCustomer === customer.id && (
                                <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                            <MapPin size={14} className="text-blue-500" />
                                            Sites d'intervention
                                        </h4>
                                        <button
                                            onClick={() => openSiteModal(customer)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
                                        >
                                            <Plus size={12} /> Ajouter un site
                                        </button>
                                    </div>

                                    {(!customer.sites || customer.sites.length === 0) ? (
                                        <div className="text-center py-6 text-gray-400 text-sm">
                                            <MapPin size={24} className="mx-auto mb-2 opacity-40" />
                                            Aucun site enregistré · <button onClick={() => openSiteModal(customer)} className="text-blue-600 hover:underline">Ajouter le premier site</button>
                                        </div>
                                    ) : (
                                        <div className="grid gap-2">
                                            {customer.sites.map(site => (
                                                <div key={site.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold text-gray-900 text-sm">{site.name}</span>
                                                                {site.isMainSite && (
                                                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase">
                                                                        Siège
                                                                    </span>
                                                                )}
                                                                <span className="text-xs">{getCountryFlag(site.country)}</span>
                                                            </div>
                                                            <p className="text-sm text-gray-600 mt-1">
                                                                {site.address}{site.address2 ? `, ${site.address2}` : ''}
                                                            </p>
                                                            <p className="text-xs text-gray-400">
                                                                {site.postalCode} {site.city}
                                                            </p>
                                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
                                                                {site.contactName && (
                                                                    <span className="flex items-center gap-1">👤 {site.contactName}</span>
                                                                )}
                                                                {site.contactPhone && (
                                                                    <span className="flex items-center gap-1"><Phone size={11} /> {site.contactPhone}</span>
                                                                )}
                                                                {site.accessCode && (
                                                                    <span className="flex items-center gap-1"><Key size={11} className="text-amber-500" /> {site.accessCode}</span>
                                                                )}
                                                                {site.latitude && site.longitude && (
                                                                    <span className="flex items-center gap-1"><Navigation size={11} className="text-green-500" /> GPS ✓</span>
                                                                )}
                                                                {(site._count?.interventions || 0) > 0 && (
                                                                    <span className="text-blue-500 font-medium">{site._count?.interventions} interv.</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 ml-3">
                                                            <button onClick={() => openSiteModal(customer, site)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
                                                                <Edit3 size={14} />
                                                            </button>
                                                            <button onClick={() => handleDeleteSite(customer.id, site.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ========== CUSTOMER MODAL ========== */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">
                                {editingCustomer ? 'Modifier le client' : 'Nouveau client'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Société *</label>
                                <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Nom de l'entreprise" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Contact *</label>
                                <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Prénom Nom" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                                    <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Pays</label>
                                <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse principale</label>
                                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Adresse du siège" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Code d'accès</label>
                                <input value={form.accessCode} onChange={(e) => setForm({ ...form, accessCode: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Digicode, badge..." />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Instructions</label>
                                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                    placeholder="Instructions permanentes pour le technicien..." />
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition">Annuler</button>
                            <button onClick={handleSaveCustomer} disabled={saving || !form.companyName || !form.contactName}
                                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition font-medium disabled:opacity-50 shadow-lg shadow-blue-500/25">
                                {saving ? 'Enregistrement...' : editingCustomer ? 'Enregistrer' : 'Créer le client'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========== SITE MODAL ========== */}
            {showSiteModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">
                                    {editingSite ? 'Modifier le site' : 'Nouveau site'}
                                </h3>
                                <p className="text-sm text-gray-500 mt-0.5">{editingCustomerForSite?.companyName}</p>
                            </div>
                            <button onClick={() => setShowSiteModal(false)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Site Name + isMainSite */}
                            <div className="flex items-end gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom du site *</label>
                                    <input value={siteForm.name} onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Ex: Siège social, Entrepôt Nord, Agence Lyon..." />
                                </div>
                                <label className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl cursor-pointer hover:bg-green-50 transition whitespace-nowrap">
                                    <input type="checkbox" checked={siteForm.isMainSite}
                                        onChange={(e) => setSiteForm({ ...siteForm, isMainSite: e.target.checked })}
                                        className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                                    <span className="text-sm font-medium text-gray-700">Site principal</span>
                                </label>
                            </div>

                            <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                                <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                                    <MapPin size={14} /> Adresse
                                </h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Rue & Numéro *</label>
                                        <input value={siteForm.address} onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                            placeholder="123 Rue de la Paix" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Complément</label>
                                        <input value={siteForm.address2} onChange={(e) => setSiteForm({ ...siteForm, address2: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                            placeholder="Bâtiment B, 3ème étage, Porte 12..." />
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Code postal *</label>
                                            <input value={siteForm.postalCode} onChange={(e) => setSiteForm({ ...siteForm, postalCode: e.target.value })}
                                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                                placeholder="75001" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Ville *</label>
                                            <input value={siteForm.city} onChange={(e) => setSiteForm({ ...siteForm, city: e.target.value })}
                                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                                placeholder="Paris" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Pays</label>
                                            <select value={siteForm.country} onChange={(e) => setSiteForm({ ...siteForm, country: e.target.value })}
                                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                                                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* GPS */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                                        <Navigation size={12} className="text-green-500" /> Latitude
                                    </label>
                                    <input type="number" step="any" value={siteForm.latitude}
                                        onChange={(e) => setSiteForm({ ...siteForm, latitude: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="48.8566" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                                        <Navigation size={12} className="text-green-500" /> Longitude
                                    </label>
                                    <input type="number" step="any" value={siteForm.longitude}
                                        onChange={(e) => setSiteForm({ ...siteForm, longitude: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="2.3522" />
                                </div>
                            </div>

                            {/* Contact local */}
                            <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100">
                                <h4 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">
                                    👤 Contact sur site
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Nom du contact</label>
                                        <input value={siteForm.contactName} onChange={(e) => setSiteForm({ ...siteForm, contactName: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                            placeholder="Responsable site" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone</label>
                                        <input value={siteForm.contactPhone} onChange={(e) => setSiteForm({ ...siteForm, contactPhone: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                            placeholder="+33 6..." />
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Email du contact</label>
                                    <input type="email" value={siteForm.contactEmail} onChange={(e) => setSiteForm({ ...siteForm, contactEmail: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white" />
                                </div>
                            </div>

                            {/* Access */}
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                    <Key size={14} className="text-amber-500" /> Accès au site
                                </h4>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Code d'accès</label>
                                    <input value={siteForm.accessCode} onChange={(e) => setSiteForm({ ...siteForm, accessCode: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                        placeholder="Digicode, badge, interphone..." />
                                </div>
                                <div className="mt-3">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Instructions d'accès</label>
                                    <textarea value={siteForm.accessNotes} onChange={(e) => setSiteForm({ ...siteForm, accessNotes: e.target.value })} rows={2}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white"
                                        placeholder="Entrer par le parking souterrain, prendre l'ascenseur B..." />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setShowSiteModal(false)} className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition">Annuler</button>
                            <button onClick={handleSaveSite}
                                disabled={saving || !siteForm.name || !siteForm.address || !siteForm.city || !siteForm.postalCode}
                                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition font-medium disabled:opacity-50 shadow-lg shadow-blue-500/25">
                                {saving ? 'Enregistrement...' : editingSite ? 'Enregistrer' : 'Créer le site'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========== CSV IMPORT MODAL ========== */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">Import CSV</h3>
                            <button onClick={() => setShowImportModal(false)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
                                <p className="font-semibold mb-1">📋 Format attendu (séparateur : point-virgule)</p>
                                <code className="text-xs block bg-white/60 rounded p-2 mt-1">
                                    société;contact;email;téléphone;adresse;pays<br />
                                    Acme Corp;Jean Dupont;jean@acme.fr;+33 6 12 34;5 Rue de..;FR
                                </code>
                            </div>
                            <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={8}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                placeholder="Collez votre CSV ici..." />
                        </div>
                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setShowImportModal(false)} className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition">Annuler</button>
                            <button onClick={handleImport} disabled={!csvText.trim()}
                                className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium disabled:opacity-50 shadow-lg shadow-green-500/25">
                                Importer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========== CUSTOMER HISTORY MODAL ========== */}
            {historyCustomer && (
                <CustomerHistory
                    customerId={historyCustomer.id}
                    customerName={historyCustomer.companyName}
                    onClose={() => setHistoryCustomer(null)}
                />
            )}
        </div>
    );
}
