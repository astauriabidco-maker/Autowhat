import { Response } from 'express';

export interface PublicApiMeta {
    requestId?: string;
    [key: string]: unknown;
}

export function sendPublicApiData(res: Response, data: unknown, meta: PublicApiMeta = {}): void {
    res.status(res.statusCode >= 400 ? 200 : res.statusCode).json({
        data,
        meta: {
            requestId: res.locals.publicApiRequestId,
            ...meta
        }
    });
}

export function sendPublicApiError(
    res: Response,
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>
): void {
    res.locals.publicApiErrorCode = code;
    res.status(statusCode).json({
        error: {
            code,
            message,
            requestId: res.locals.publicApiRequestId,
            ...(details ? { details } : {})
        }
    });
}
