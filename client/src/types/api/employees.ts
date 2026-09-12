import type { ApiId, IsoDateString } from './common';

export type EmployeeStatus = 'ACTIVE' | 'ARCHIVED' | 'NEVER_CONNECTED';
export type EmployeeRole = 'MANAGER' | 'EMPLOYEE' | 'ARCHIVED' | string;
export type EmployeeWorkProfile = 'MOBILE' | 'SEDENTARY';
export type EmployeeLanguage = 'fr' | 'en' | 'es';

export interface ApiEmployeeSummary {
    id: ApiId;
    name: string;
    phoneNumber: string;
    role: EmployeeRole;
    position: string;
    status: EmployeeStatus;
    lastActivity: IsoDateString | null;
    lastActivityFormatted: string;
}

export interface ApiEmployeesResponse {
    employees: ApiEmployeeSummary[];
}

export interface ApiEmployeeQuota {
    maxEmployees: number;
    currentEmployees: number;
}

export interface ApiEmployeeCreatePayload {
    name: string;
    phoneNumber: string;
    position: string;
    role: 'EMPLOYEE';
    workProfile: EmployeeWorkProfile;
    siteId: ApiId | null;
    language: EmployeeLanguage;
}

export interface ApiEmployeeArchivePayload {
    archived: boolean;
}
