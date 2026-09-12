export type ApiId = string;
export type IsoDateString = string;

export interface ApiErrorResponse {
    error: string;
    code?: string;
}

export interface ApiSuccessResponse {
    success: boolean;
    message?: string;
}

export interface ApiCount {
    count: number;
}
