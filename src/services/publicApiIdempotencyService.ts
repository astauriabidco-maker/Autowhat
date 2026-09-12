import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { hashLogIdentifier } from '../utils/safeWebhookLogger';
import { sendPublicApiError } from '../utils/publicApiResponse';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }

    return `{${Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`)
        .join(',')}}`;
}

function hashValue(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
}

export function hashIdempotencyKey(value: string | undefined): string | undefined {
    return hashLogIdentifier(value);
}

export function buildPublicApiRequestHash(req: Request): string {
    return hashValue(`${req.method}:${req.originalUrl}:${stableStringify(req.body ?? {})}`);
}

export async function runWithPublicApiIdempotency(
    req: Request,
    res: Response,
    handler: () => Promise<{ statusCode: number; body: Prisma.InputJsonValue }>
): Promise<void> {
    const idempotencyKey = String(req.headers['idempotency-key'] || '').trim();

    if (!idempotencyKey) {
        sendPublicApiError(res, 400, 'idempotency_key_required', 'Idempotency-Key header is required for this endpoint.');
        return;
    }

    if (!req.publicApi) {
        sendPublicApiError(res, 401, 'unauthorized', 'Invalid or missing API key.');
        return;
    }

    const keyHash = hashValue(idempotencyKey);
    const requestHash = buildPublicApiRequestHash(req);
    res.locals.publicApiIdempotencyKeyHash = hashIdempotencyKey(idempotencyKey);

    const existing = await prisma.apiIdempotencyKey.findUnique({
        where: {
            apiKeyId_keyHash: {
                apiKeyId: req.publicApi.apiKeyId,
                keyHash
            }
        }
    });

    if (existing && existing.expiresAt > new Date()) {
        if (existing.requestHash !== requestHash) {
            sendPublicApiError(res, 409, 'idempotency_conflict', 'This Idempotency-Key was already used with a different request.');
            return;
        }

        res.status(existing.responseStatus).json(existing.responseBody);
        return;
    }

    const result = await handler();
    await prisma.apiIdempotencyKey.upsert({
        where: {
            apiKeyId_keyHash: {
                apiKeyId: req.publicApi.apiKeyId,
                keyHash
            }
        },
        create: {
            tenantId: req.publicApi.tenantId,
            apiKeyId: req.publicApi.apiKeyId,
            keyHash,
            requestHash,
            responseStatus: result.statusCode,
            responseBody: result.body,
            expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS)
        },
        update: {
            requestHash,
            responseStatus: result.statusCode,
            responseBody: result.body,
            expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS)
        }
    });

    res.status(result.statusCode).json(result.body);
}
