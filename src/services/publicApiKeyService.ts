import crypto from 'crypto';
import { ApiKey, Tenant } from '@prisma/client';
import prisma from '../lib/prisma';

export const PUBLIC_API_SCOPES = [
    'tenant:read',
    'employees:read',
    'attendance:read',
    'messages:send'
] as const;

export type PublicApiScope = typeof PUBLIC_API_SCOPES[number] | string;

export interface VerifiedPublicApiKey {
    apiKey: Pick<ApiKey, 'id' | 'name' | 'keyPrefix' | 'scopes'>;
    tenant: Pick<Tenant, 'id' | 'name' | 'country' | 'plan' | 'status'>;
}

function apiKeyHashSecret(): string {
    return process.env.API_KEY_HASH_SECRET
        || process.env.LOG_HASH_SECRET
        || process.env.JWT_SECRET
        || 'whatspoint-api-key-hash';
}

export function hashPublicApiKey(token: string): string {
    return crypto
        .createHmac('sha256', apiKeyHashSecret())
        .update(token)
        .digest('hex');
}

function keyEnvironmentPrefix(mode?: 'test' | 'live'): string {
    if (mode) {
        return mode === 'live' ? 'wp_live' : 'wp_test';
    }

    return process.env.NODE_ENV === 'production' ? 'wp_live' : 'wp_test';
}

function generateRawPublicApiKey(mode?: 'test' | 'live'): string {
    return `${keyEnvironmentPrefix(mode)}_${crypto.randomBytes(32).toString('base64url')}`;
}

export async function createPublicApiKey(input: {
    tenantId: string;
    name: string;
    scopes: PublicApiScope[];
    expiresAt?: Date | null;
    mode?: 'test' | 'live';
}): Promise<{ apiKey: ApiKey; token: string }> {
    const token = generateRawPublicApiKey(input.mode);
    const keyPrefix = token.slice(0, 18);
    const keyHash = hashPublicApiKey(token);

    const apiKey = await prisma.apiKey.create({
        data: {
            tenantId: input.tenantId,
            name: input.name,
            keyPrefix,
            keyHash,
            scopes: [...new Set(input.scopes)],
            expiresAt: input.expiresAt ?? null
        }
    });

    return { apiKey, token };
}

export function normalizePublicApiScopes(scopes: unknown): string[] {
    if (!Array.isArray(scopes)) {
        return [];
    }

    const allowedScopes = new Set<string>(PUBLIC_API_SCOPES);
    return [...new Set(scopes.map(scope => String(scope).trim()).filter(scope => allowedScopes.has(scope)))];
}

export async function listPublicApiKeys(tenantId?: string) {
    return prisma.apiKey.findMany({
        where: tenantId ? { tenantId } : undefined,
        select: {
            id: true,
            tenantId: true,
            name: true,
            keyPrefix: true,
            scopes: true,
            isActive: true,
            expiresAt: true,
            revokedAt: true,
            lastUsedAt: true,
            createdAt: true,
            updatedAt: true,
            tenant: {
                select: {
                    id: true,
                    name: true,
                    country: true,
                    plan: true,
                    status: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
}

export async function revokePublicApiKey(id: string): Promise<ApiKey | null> {
    const existing = await prisma.apiKey.findUnique({ where: { id } });
    if (!existing) {
        return null;
    }

    return prisma.apiKey.update({
        where: { id },
        data: {
            isActive: false,
            revokedAt: existing.revokedAt ?? new Date()
        }
    });
}

export async function verifyPublicApiKey(token: string): Promise<VerifiedPublicApiKey | null> {
    if (!token || token.length < 24) {
        return null;
    }

    const keyHash = hashPublicApiKey(token);
    const now = new Date();

    const apiKey = await prisma.apiKey.findUnique({
        where: { keyHash },
        include: {
            tenant: {
                select: {
                    id: true,
                    name: true,
                    country: true,
                    plan: true,
                    status: true
                }
            }
        }
    });

    if (!apiKey || !apiKey.isActive || apiKey.revokedAt || (apiKey.expiresAt && apiKey.expiresAt <= now)) {
        return null;
    }

    if (apiKey.tenant.status !== 'ACTIVE') {
        return null;
    }

    await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: now }
    });

    return {
        apiKey: {
            id: apiKey.id,
            name: apiKey.name,
            keyPrefix: apiKey.keyPrefix,
            scopes: apiKey.scopes
        },
        tenant: apiKey.tenant
    };
}

export async function resolveTenantIdFromLegacyOrPublicApiKey(token: string, requiredScope?: PublicApiScope): Promise<string | null> {
    const publicApiKey = await verifyPublicApiKey(token);
    if (publicApiKey) {
        if (requiredScope && !publicApiKey.apiKey.scopes.includes(requiredScope)) {
            return null;
        }

        return publicApiKey.tenant.id;
    }

    try {
        const tenants: Array<{ id: string }> = await prisma.$queryRaw`
            SELECT id FROM "Tenant"
            WHERE config->>'inboundApiKey' = ${token}
            AND status = 'ACTIVE'
            LIMIT 1
        `;

        return tenants[0]?.id ?? null;
    } catch (error) {
        console.error('External API auth error:', error);
        return null;
    }
}
