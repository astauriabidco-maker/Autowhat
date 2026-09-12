import type { ApiId } from './common';

export interface ApiCustomerSite {
    id: ApiId;
    name: string;
    isMainSite: boolean;
    address: string;
    address2?: string | null;
    city: string;
    postalCode: string;
    country: string;
    latitude?: number | null;
    longitude?: number | null;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    accessCode?: string | null;
    accessNotes?: string | null;
    _count?: {
        interventions: number;
    };
}

export interface ApiCustomer {
    id: ApiId;
    companyName: string;
    contactName: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    country?: string | null;
    accessCode?: string | null;
    notes?: string | null;
    sites?: ApiCustomerSite[];
    _count?: {
        interventions: number;
        sites: number;
    };
}

export type ApiCustomerCreatePayload = Omit<ApiCustomerUpdatePayload, never>;

export interface ApiCustomerUpdatePayload {
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    address: string;
    country: string;
    accessCode: string;
    notes: string;
}

export interface ApiCustomerSiteUpsertPayload {
    name: string;
    address: string;
    address2: string;
    city: string;
    postalCode: string;
    country: string;
    latitude: number | null;
    longitude: number | null;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    accessCode: string;
    accessNotes: string;
    isMainSite: boolean;
}

export interface ApiCustomerImportPayload {
    customers: Array<{
        companyName: string;
        contactName: string;
        email: string;
        phone: string;
        address: string;
        country: string;
    }>;
}
