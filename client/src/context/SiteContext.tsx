import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';

interface Site {
    id: string;
    name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
}

interface SiteContextType {
    sites: Site[];
    selectedSiteId: string | null; // null = "Vue Globale" (tous les sites)
    setSelectedSiteId: (id: string | null) => void;
    isLoading: boolean;
    isLocalManager: boolean; // True si user a un siteId fixe
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

export function SiteProvider({ children }: { children: ReactNode }) {
    const [sites, setSites] = useState<Site[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLocalManager, setIsLocalManager] = useState(false);

    useEffect(() => {
        const fetchSites = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setIsLoading(false);
                return;
            }

            try {
                // Récupérer les infos user du localStorage
                const userData = localStorage.getItem('user');
                if (userData) {
                    const user = JSON.parse(userData);
                    // Si le user a un siteId assigné, c'est un manager local
                    if (user.siteId) {
                        setIsLocalManager(true);
                        setSelectedSiteId(user.siteId);
                    }
                }

                // Fetch sites
                const response = await axios.get<{ sites: Site[] }>('/api/sites', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setSites(response.data.sites || []);
            } catch (error) {
                console.error('Error fetching sites:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSites();
    }, []);

    const handleSetSelectedSiteId = (id: string | null) => {
        // Si c'est un manager local, on ne peut pas changer de site
        if (isLocalManager) return;
        setSelectedSiteId(id);
    };

    return (
        <SiteContext.Provider value={{
            sites,
            selectedSiteId,
            setSelectedSiteId: handleSetSelectedSiteId,
            isLoading,
            isLocalManager
        }}>
            {children}
        </SiteContext.Provider>
    );
}

export function useSiteContext() {
    const context = useContext(SiteContext);
    if (context === undefined) {
        throw new Error('useSiteContext must be used within a SiteProvider');
    }
    return context;
}
