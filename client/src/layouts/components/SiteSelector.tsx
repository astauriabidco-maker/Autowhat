import { useSiteContext } from '../../context/SiteContext';
import { MapPin, ChevronDown, Globe } from 'lucide-react';

/**
 * SiteSelector Component
 * 
 * Règle d'or UX: if (sites.length <= 1) return null;
 * Le composant est invisible pour les clients mono-site.
 */
export default function SiteSelector() {
    const { sites, selectedSiteId, setSelectedSiteId, isLoading, isLocalManager } = useSiteContext();

    // Règle d'or : Masquer si <= 1 site
    if (isLoading || sites.length <= 1) {
        return null;
    }

    // Si manager local, afficher le site sans possibilité de changer
    if (isLocalManager) {
        const currentSite = sites.find(s => s.id === selectedSiteId);
        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-gray-600">
                <MapPin size={16} className="text-blue-500" />
                <span className="text-sm font-medium">{currentSite?.name || 'Site'}</span>
            </div>
        );
    }

    return (
        <div className="relative">
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-blue-400 transition cursor-pointer">
                {selectedSiteId ? (
                    <MapPin size={16} className="text-blue-500" />
                ) : (
                    <Globe size={16} className="text-green-500" />
                )}
                <select
                    value={selectedSiteId || ''}
                    onChange={(e) => setSelectedSiteId(e.target.value || null)}
                    className="bg-transparent border-none outline-none text-sm font-medium text-gray-700 cursor-pointer pr-6 appearance-none"
                >
                    <option value="">🌍 Vue Globale</option>
                    {sites.map((site) => (
                        <option key={site.id} value={site.id}>
                            📍 {site.name}
                        </option>
                    ))}
                </select>
                <ChevronDown size={16} className="text-gray-400 absolute right-3 pointer-events-none" />
            </div>
        </div>
    );
}
