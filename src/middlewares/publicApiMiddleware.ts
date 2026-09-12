import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { hashLogIdentifier } from '../utils/safeWebhookLogger';
import { sendPublicApiError } from '../utils/publicApiResponse';
import { PublicApiScope, verifyPublicApiKey } from '../services/publicApiKeyService';

declare global {
    namespace Express {
        interface Request {
            publicApi?: {
                tenantId: string;
                tenantName: string;
                tenantCountry: string;
                tenantPlan: string;
                tenantStatus: string;
                apiKeyId: string;
                apiKeyName: string;
                apiKeyPrefix: string;
                scopes: string[];
                requiredScope?: string;
            };
        }
    }
}

function bearerToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return null;
    }

    return authHeader.slice('Bearer '.length).trim() || null;
}

export function publicApiRequestContext(req: Request, res: Response, next: NextFunction): void {
    res.locals.publicApiRequestId = req.headers['x-request-id'] || `req_${crypto.randomUUID()}`;
    next();
}

export async function authenticatePublicApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = bearerToken(req);

    if (!token) {
        sendPublicApiError(res, 401, 'unauthorized', 'Invalid or missing API key.');
        return;
    }

    const verified = await verifyPublicApiKey(token);
    if (!verified) {
        sendPublicApiError(res, 401, 'unauthorized', 'Invalid or missing API key.');
        return;
    }

    req.publicApi = {
        tenantId: verified.tenant.id,
        tenantName: verified.tenant.name,
        tenantCountry: verified.tenant.country,
        tenantPlan: verified.tenant.plan,
        tenantStatus: verified.tenant.status,
        apiKeyId: verified.apiKey.id,
        apiKeyName: verified.apiKey.name,
        apiKeyPrefix: verified.apiKey.keyPrefix,
        scopes: verified.apiKey.scopes
    };

    next();
}

export function requireApiScope(scope: PublicApiScope) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.publicApi) {
            sendPublicApiError(res, 401, 'unauthorized', 'Invalid or missing API key.');
            return;
        }

        req.publicApi.requiredScope = scope;

        if (!req.publicApi.scopes.includes(scope)) {
            sendPublicApiError(res, 403, 'forbidden', 'This API key is not allowed to access this endpoint.');
            return;
        }

        next();
    };
}

export function publicApiAuditLog(req: Request, res: Response, next: NextFunction): void {
    const startedAt = Date.now();

    res.on('finish', () => {
        const requestId = String(res.locals.publicApiRequestId || '');
        if (!requestId) return;

        void prisma.apiRequestLog.create({
            data: {
                requestId,
                tenantId: req.publicApi?.tenantId,
                apiKeyId: req.publicApi?.apiKeyId,
                method: req.method,
                path: req.originalUrl.split('?')[0],
                statusCode: res.statusCode,
                durationMs: Date.now() - startedAt,
                scope: req.publicApi?.requiredScope,
                errorCode: res.locals.publicApiErrorCode,
                idempotencyKeyHash: res.locals.publicApiIdempotencyKeyHash,
                ipHash: hashLogIdentifier(req.ip),
                userAgentHash: hashLogIdentifier(req.get('user-agent'))
            }
        }).catch((error) => {
            console.error('Public API audit log error:', error);
        });
    });

    next();
}
