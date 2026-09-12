import type { ApiId, IsoDateString } from './common';

export type InterventionStatus = 'SCHEDULED' | 'EN_ROUTE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
export type InterventionNotificationType = 'reminder' | 'en_route' | 'signature' | 'completed';

export interface ApiInterventionCustomer {
    id: ApiId;
    companyName: string;
    contactName: string;
    address?: string | null;
    phone?: string | null;
}

export interface ApiInterventionCustomerSite {
    id: ApiId;
    name: string;
    address: string;
    city: string;
    postalCode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    contactName?: string | null;
    contactPhone?: string | null;
    accessCode?: string | null;
}

export interface ApiInterventionEmployee {
    id: ApiId;
    name: string;
    phoneNumber?: string;
}

export interface ApiInterventionType {
    id: ApiId;
    name: string;
    description?: string | null;
    color: string;
    icon?: string | null;
    defaultDuration: number;
    requiresReport?: boolean;
    requiresSignature?: boolean;
    requiresPhotos?: boolean;
    isActive?: boolean;
    sortOrder?: number;
    _count?: {
        interventions: number;
    };
}

export interface ApiIntervention {
    id: ApiId;
    title: string;
    description?: string | null;
    status: InterventionStatus;
    scheduledStart: IsoDateString;
    scheduledEnd: IsoDateString;
    realStart?: IsoDateString | null;
    realEnd?: IsoDateString | null;
    reportContent?: string | null;
    signatureUrl?: string | null;
    pdfUrl?: string | null;
    customer: ApiInterventionCustomer;
    customerSite?: ApiInterventionCustomerSite | null;
    interventionType?: ApiInterventionType | null;
    employee: ApiInterventionEmployee;
}

export interface ApiInterventionCreatePayload {
    title: string;
    description: string;
    customerId: ApiId;
    customerSiteId: ApiId | '';
    interventionTypeId: ApiId | '';
    employeeId: ApiId;
    scheduledStart: IsoDateString;
    scheduledEnd: IsoDateString;
}

export interface ApiInterventionSchedulePayload {
    scheduledStart: IsoDateString;
    scheduledEnd: IsoDateString;
}

export interface ApiInterventionStatusPayload {
    status: InterventionStatus;
}

export interface ApiInterventionNotificationPayload {
    type: InterventionNotificationType;
}

export type InterventionRequestStatus = 'PENDING' | 'APPROVED' | 'PLANNED' | 'REJECTED';
export type InterventionRequestUrgency = 'NORMAL' | 'URGENT';
export type RequestEventType =
    | 'UPDATED'
    | 'ASSIGNED'
    | 'UNASSIGNED'
    | 'COMMENTED'
    | 'STATUS_CHANGED'
    | 'SLA_SET'
    | 'SLA_CLEARED';
export type RequestActorType = 'MANAGER' | 'SYSTEM' | 'CUSTOMER' | string;

export interface ApiInterventionRequest {
    id: ApiId;
    message: string;
    photoUrl?: string | null;
    urgency: InterventionRequestUrgency;
    senderPhone: string;
    senderName?: string | null;
    customerId?: ApiId | null;
    customerSiteId?: ApiId | null;
    interventionTypeId?: ApiId | null;
    status: InterventionRequestStatus;
    managerNotes?: string | null;
    rejectionReason?: string | null;
    interventionId?: ApiId | null;
    createdAt: IsoDateString;
    customer?: {
        id: ApiId;
        companyName: string;
        contactName: string;
        phone?: string | null;
    } | null;
    customerSite?: {
        id: ApiId;
        name: string;
        address: string;
        city: string;
    } | null;
    interventionType?: {
        id: ApiId;
        name: string;
        color: string;
    } | null;
    intervention?: {
        id: ApiId;
        title: string;
        status: InterventionStatus;
        scheduledStart: IsoDateString;
    } | null;
    assignedToId?: ApiId | null;
    assignedTo?: {
        id: ApiId;
        name: string | null;
        phoneNumber: string;
    } | null;
    slaDueAt?: IsoDateString | null;
    slaBreachedAt?: IsoDateString | null;
    lastInternalCommentAt?: IsoDateString | null;
    lastEventAt?: IsoDateString | null;
}

export interface ApiInterventionRequestStats {
    pending: number;
    approved: number;
    planned: number;
    rejected: number;
    total: number;
}

export interface ApiRequestEvent {
    id: ApiId;
    type: RequestEventType;
    actorType: RequestActorType;
    actorId?: ApiId | null;
    message?: string | null;
    metadata?: Record<string, unknown> | null;
    createdAt: IsoDateString;
}

export interface ApiRequestEventsResponse {
    events: ApiRequestEvent[];
}

export interface ApiInterventionRequestUpdatePayload {
    customerId?: ApiId | null;
    customerSiteId?: ApiId | null;
    interventionTypeId?: ApiId | null;
    managerNotes?: string | null;
    urgency?: InterventionRequestUrgency;
}

export interface ApiInterventionRequestRejectPayload {
    rejectionReason: string;
}

export interface ApiInterventionRequestPlanPayload {
    employeeId: ApiId;
    scheduledStart: string;
    scheduledEnd: string;
    title: string;
    description: string;
}

export interface ApiInterventionRequestAssignmentPayload {
    employeeId: ApiId | null;
}

export interface ApiInterventionRequestSlaPayload {
    slaDueAt: IsoDateString | null;
}

export interface ApiInterventionRequestCommentPayload {
    message: string;
}
