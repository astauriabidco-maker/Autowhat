import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    AlertTriangle,
    CheckCircle2,
    Compass,
    Loader2,
    MapPin,
    Navigation,
    RefreshCw,
    Save,
    ShieldCheck
} from 'lucide-react';

interface Site {
    id: string;
    name: string;
    address: string | null;
    country: string;
    latitude: number | null;
    longitude: number | null;
    radius: number;
    gpsMode: 'STRICT' | 'WARNING' | 'DISABLED';
}

interface SiteForm {
    country: string;
    latitude: string;
    longitude: string;
    radius: string;
    gpsMode: Site['gpsMode'];
    mapsInput: string;
}

interface MismatchWarning {
    siteId: string;
    error: string;
    detectedCountry?: string;
    detectedLabel?: string;
    selectedLabel?: string;
}

const COUNTRY_OPTIONS = [
    { code: 'FR', label: 'France' },
    { code: 'CM', label: 'Cameroun' },
    { code: 'BE', label: 'Belgique' },
    { code: 'CH', label: 'Suisse' },
    { code: 'CA', label: 'Canada' },
    { code: 'US', label: 'États-Unis' },
    { code: 'GB', label: 'Royaume-Uni' },
    { code: 'DE', label: 'Allemagne' },
    { code: 'ES', label: 'Espagne' },
    { code: 'OTHER', label: 'Autre' }
];

function formFromSite(site: Site): SiteForm {
    return {
        country: site.country || 'FR',
        latitude: site.latitude?.toString() || '',
        longitude: site.longitude?.toString() || '',
        radius: site.radius?.toString() || '200',
        gpsMode: site.gpsMode || 'WARNING',
        mapsInput: ''
    };
}

function parseCoordinates(input: string): { latitude: string; longitude: string } | null {
    const decoded = decodeURIComponent(input.trim());
    const patterns = [
        /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
        /q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
        /(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/
    ];

    for (const pattern of patterns) {
        const match = decoded.match(pattern);
        if (match) {
            return { latitude: match[1], longitude: match[2] };
        }
    }

    return null;
}

function gpsStatus(site: Site) {
    if (site.gpsMode === 'DISABLED') {
        return {
            label: 'GPS désactivé',
            icon: <AlertTriangle size={16} />,
            className: 'bg-amber-50 text-amber-700 border-amber-200'
        };
    }

    if (!site.latitude || !site.longitude) {
        return {
            label: 'GPS manquant',
            icon: <AlertTriangle size={16} />,
            className: 'bg-red-50 text-red-700 border-red-200'
        };
    }

    return {
        label: site.gpsMode === 'STRICT' ? 'GPS strict' : 'GPS souple',
        icon: <CheckCircle2 size={16} />,
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    };
}

export default function SiteGpsCenter() {
    const [sites, setSites] = useState<Site[]>([]);
    const [forms, setForms] = useState<Record<string, SiteForm>>({});
    const [loading, setLoading] = useState(true);
    const [savingSiteId, setSavingSiteId] = useState<string | null>(null);
    const [capturingSiteId, setCapturingSiteId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [mismatch, setMismatch] = useState<MismatchWarning | null>(null);

    const token = useMemo(() => localStorage.getItem('token'), []);

    const fetchSites = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await axios.get<{ sites: Site[] }>('/api/sites', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const nextSites = response.data.sites || [];
            setSites(nextSites);
            setForms(Object.fromEntries(nextSites.map(site => [site.id, formFromSite(site)])));
        } catch {
            setError("Impossible de charger les sites.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSites();
    }, []);

    const updateForm = (siteId: string, patch: Partial<SiteForm>) => {
        setForms(prev => ({
            ...prev,
            [siteId]: { ...prev[siteId], ...patch }
        }));
        setMismatch(null);
        setSuccess('');
    };

    const saveSite = async (site: Site, acceptCountryMismatch = false) => {
        const form = forms[site.id];
        if (!form) return;

        setSavingSiteId(site.id);
        setError('');
        setSuccess('');
        try {
            await axios.put(`/api/sites/${site.id}`, {
                name: site.name,
                address: site.address,
                country: form.country,
                latitude: form.latitude ? Number(form.latitude) : null,
                longitude: form.longitude ? Number(form.longitude) : null,
                radius: form.radius ? Number(form.radius) : 200,
                gpsMode: form.gpsMode,
                acceptCountryMismatch
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMismatch(null);
            setSuccess(`Position du site "${site.name}" enregistrée.`);
            await fetchSites();
        } catch (err) {
            if (axios.isAxiosError(err) && err.response?.data?.code === 'SITE_COUNTRY_LOCATION_MISMATCH') {
                setMismatch({
                    siteId: site.id,
                    error: err.response.data.error,
                    detectedCountry: err.response.data.detectedCountry,
                    detectedLabel: err.response.data.detectedLabel,
                    selectedLabel: err.response.data.selectedLabel
                });
            } else {
                setError("Impossible d'enregistrer ce site.");
            }
        } finally {
            setSavingSiteId(null);
        }
    };

    const captureCurrentPosition = (siteId: string) => {
        setError('');
        setSuccess('');
        if (!navigator.geolocation) {
            setError("Votre navigateur ne permet pas de capturer la position.");
            return;
        }

        setCapturingSiteId(siteId);
        navigator.geolocation.getCurrentPosition(
            position => {
                updateForm(siteId, {
                    latitude: position.coords.latitude.toFixed(6),
                    longitude: position.coords.longitude.toFixed(6),
                    gpsMode: forms[siteId]?.gpsMode === 'DISABLED' ? 'WARNING' : forms[siteId]?.gpsMode
                });
                setCapturingSiteId(null);
            },
            () => {
                setError("Position indisponible. Vérifiez les autorisations GPS du navigateur.");
                setCapturingSiteId(null);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    };

    const applyMapsInput = (siteId: string) => {
        const parsed = parseCoordinates(forms[siteId]?.mapsInput || '');
        if (!parsed) {
            setError("Coordonnées non reconnues. Collez un lien Google Maps ou une paire latitude, longitude.");
            return;
        }
        updateForm(siteId, parsed);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                    <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Pointage fiable</p>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">Sites GPS</h1>
                    <p className="text-gray-600 mt-2 max-w-2xl">
                        Configurez les coordonnées de vos sites de pointage. En mode strict, un collaborateur hors zone ne peut pas pointer comme présent.
                    </p>
                </div>
                <button
                    onClick={fetchSites}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50"
                >
                    <RefreshCw size={16} />
                    Actualiser
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-sm text-gray-500">Sites</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{sites.length}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-sm text-gray-500">GPS configuré</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">
                        {sites.filter(site => site.latitude && site.longitude && site.gpsMode !== 'DISABLED').length}
                    </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-sm text-gray-500">À corriger</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">
                        {sites.filter(site => !site.latitude || !site.longitude || site.gpsMode === 'DISABLED').length}
                    </p>
                </div>
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 font-medium">
                    {error}
                </div>
            )}
            {success && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 font-medium">
                    {success}
                </div>
            )}

            {loading ? (
                <div className="rounded-xl border border-gray-200 bg-white p-8 flex items-center justify-center gap-3 text-gray-500">
                    <Loader2 className="animate-spin" size={20} />
                    Chargement des sites...
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    {sites.map(site => {
                        const form = forms[site.id] || formFromSite(site);
                        const status = gpsStatus(site);
                        const mapsUrl = form.latitude && form.longitude
                            ? `https://www.google.com/maps/search/?api=1&query=${form.latitude},${form.longitude}`
                            : null;

                        return (
                            <section key={site.id} className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900">{site.name}</h2>
                                        <p className="text-sm text-gray-500 mt-1">{site.address || 'Adresse non renseignée'}</p>
                                    </div>
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-semibold ${status.className}`}>
                                        {status.icon}
                                        {status.label}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <label className="space-y-1.5">
                                        <span className="text-sm font-medium text-gray-700">Pays du site</span>
                                        <select
                                            value={form.country}
                                            onChange={event => updateForm(site.id, { country: event.target.value })}
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {COUNTRY_OPTIONS.map(country => (
                                                <option key={country.code} value={country.code}>{country.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="space-y-1.5">
                                        <span className="text-sm font-medium text-gray-700">Mode GPS</span>
                                        <select
                                            value={form.gpsMode}
                                            onChange={event => updateForm(site.id, { gpsMode: event.target.value as Site['gpsMode'] })}
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="WARNING">Souple : avertir sans bloquer</option>
                                            <option value="STRICT">Strict : bloquer hors zone</option>
                                            <option value="DISABLED">Désactivé</option>
                                        </select>
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <label className="space-y-1.5">
                                        <span className="text-sm font-medium text-gray-700">Latitude</span>
                                        <input
                                            value={form.latitude}
                                            onChange={event => updateForm(site.id, { latitude: event.target.value })}
                                            inputMode="decimal"
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="4.051056"
                                        />
                                    </label>
                                    <label className="space-y-1.5">
                                        <span className="text-sm font-medium text-gray-700">Longitude</span>
                                        <input
                                            value={form.longitude}
                                            onChange={event => updateForm(site.id, { longitude: event.target.value })}
                                            inputMode="decimal"
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="9.767869"
                                        />
                                    </label>
                                    <label className="space-y-1.5">
                                        <span className="text-sm font-medium text-gray-700">Rayon</span>
                                        <input
                                            value={form.radius}
                                            onChange={event => updateForm(site.id, { radius: event.target.value })}
                                            inputMode="numeric"
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="200"
                                        />
                                    </label>
                                </div>

                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                                    <p className="text-sm font-medium text-gray-700">Depuis un lien Google Maps ou des coordonnées partagées</p>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <input
                                            value={form.mapsInput}
                                            onChange={event => updateForm(site.id, { mapsInput: event.target.value })}
                                            className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="https://maps.google.com/... ou 4.05, 9.76"
                                        />
                                        <button
                                            onClick={() => applyMapsInput(site.id)}
                                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50"
                                        >
                                            <Compass size={16} />
                                            Extraire
                                        </button>
                                    </div>
                                </div>

                                {mismatch?.siteId === site.id && (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                                        <p className="text-sm text-amber-800 font-medium">{mismatch.error}</p>
                                        <div className="flex flex-col sm:flex-row gap-2 mt-3">
                                            <button
                                                onClick={() => updateForm(site.id, { country: mismatch.detectedCountry || form.country })}
                                                className="px-3 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600"
                                            >
                                                Corriger le pays
                                            </button>
                                            <button
                                                onClick={() => saveSite(site, true)}
                                                className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
                                            >
                                                Utiliser quand même
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <button
                                            onClick={() => captureCurrentPosition(site.id)}
                                            disabled={capturingSiteId === site.id}
                                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 disabled:opacity-60"
                                        >
                                            {capturingSiteId === site.id ? <Loader2 className="animate-spin" size={16} /> : <Navigation size={16} />}
                                            Capturer ici
                                        </button>
                                        {mapsUrl && (
                                            <a
                                                href={mapsUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50"
                                            >
                                                <MapPin size={16} />
                                                Voir carte
                                            </a>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => saveSite(site)}
                                        disabled={savingSiteId === site.id}
                                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-60"
                                    >
                                        {savingSiteId === site.id ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                        Enregistrer
                                    </button>
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex gap-3 text-blue-900">
                <ShieldCheck size={22} className="shrink-0 mt-0.5" />
                <p className="text-sm">
                    Astuce terrain : si le manager n'est pas sur place, un collaborateur peut partager sa position WhatsApp au manager. Le manager peut ensuite copier les coordonnées, transmettre la position au bot ou les enregistrer ici.
                </p>
            </div>
        </div>
    );
}
