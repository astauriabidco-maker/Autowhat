import { createContext } from 'react';
import type { ApiTenantSite } from '../types/api/sites';

export type Site = ApiTenantSite;

export interface SiteContextType {
    sites: Site[];
    selectedSiteId: string | null;
    setSelectedSiteId: (id: string | null) => void;
    isLoading: boolean;
    isLocalManager: boolean;
}

export const SiteContext = createContext<SiteContextType | undefined>(undefined);
