import type { ApiId } from './common';

export type GpsMode = 'STRICT' | 'WARNING' | 'DISABLED';

export interface ApiTenantSite {
    id: ApiId;
    name: string;
    address: string | null;
    country: string;
    latitude: number | null;
    longitude: number | null;
    radius: number;
    gpsMode: GpsMode;
}

export interface ApiSitesResponse {
    sites: ApiTenantSite[];
}

export interface ApiTenantSiteUpdatePayload {
    name: string;
    address: string | null;
    country: string;
    latitude: number | null;
    longitude: number | null;
    radius: number;
    gpsMode: GpsMode;
    acceptCountryMismatch?: boolean;
}
