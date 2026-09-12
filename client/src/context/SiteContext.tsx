import { useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';
import { SiteContext, type Site } from './siteContextCore';
import type { ApiSitesResponse } from '../types/api/sites';

export function SiteProvider({ children }: { children: ReactNode }) {
    const [sites, setSites] = useState<Site[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLocalManager, setIsLocalManager] = useState(false);

    useEffect(() => {
        const fetchSites = async () => {
            // Skip site fetching if we are in superadmin area (unless impersonating)
            const isSuperAdminPath = window.location.pathname.startsWith('/superadmin');
            const isImpersonating = !!sessionStorage.getItem('superadmin_original_token');

            if (isSuperAdminPath && !isImpersonating) {
                setIsLoading(false);
                return;
            }

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
                const response = await axios.get<ApiSitesResponse>('/api/sites', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setSites(response.data.sites || []);
            } catch (error) {
                // Handle 401/403 silently to avoid console spam in SuperAdmin mode
                console.warn('Site fetching skipped or failed (expected in some modes):', error);
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
