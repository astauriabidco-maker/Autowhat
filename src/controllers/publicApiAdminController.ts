import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import {
    createPublicApiKey,
    listPublicApiKeys,
    normalizePublicApiScopes,
    PUBLIC_API_SCOPES,
    revokePublicApiKey
} from '../services/publicApiKeyService';

function routeParam(value: string | string[] | undefined): string {
    return Array.isArray(value) ? value[0] : value || '';
}

function serializeApiKey(apiKey: Awaited<ReturnType<typeof listPublicApiKeys>>[number]) {
    return {
        id: apiKey.id,
        tenantId: apiKey.tenantId,
        name: apiKey.name,
        prefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        isActive: apiKey.isActive,
        expiresAt: apiKey.expiresAt,
        revokedAt: apiKey.revokedAt,
        lastUsedAt: apiKey.lastUsedAt,
        createdAt: apiKey.createdAt,
        updatedAt: apiKey.updatedAt,
        tenant: apiKey.tenant
    };
}

export async function getPublicApiScopes(_req: Request, res: Response): Promise<void> {
    res.json({ scopes: PUBLIC_API_SCOPES });
}

export async function getPublicApiKeys(req: Request, res: Response): Promise<void> {
    try {
        const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined;
        const [apiKeys, tenants] = await Promise.all([
            listPublicApiKeys(tenantId),
            prisma.tenant.findMany({
                select: {
                    id: true,
                    name: true,
                    country: true,
                    plan: true,
                    status: true
                },
                orderBy: { name: 'asc' }
            })
        ]);

        res.json({
            apiKeys: apiKeys.map(serializeApiKey),
            tenants
        });
    } catch (error) {
        console.error('Error listing public API keys:', error);
        res.status(500).json({ error: 'Erreur lors du chargement des clés API' });
    }
}

export async function createTenantPublicApiKey(req: Request, res: Response): Promise<void> {
    try {
        const tenantId = routeParam(req.params.tenantId);
        const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
        const scopes = normalizePublicApiScopes(req.body.scopes);
        const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;

        if (!name) {
            res.status(400).json({ error: 'name requis' });
            return;
        }

        if (scopes.length === 0) {
            res.status(400).json({ error: 'Au moins un scope valide est requis' });
            return;
        }

        if (expiresAt && Number.isNaN(expiresAt.getTime())) {
            res.status(400).json({ error: 'expiresAt invalide' });
            return;
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { id: true, name: true, country: true, plan: true, status: true }
        });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant introuvable' });
            return;
        }

        const { apiKey, token } = await createPublicApiKey({
            tenantId,
            name,
            scopes,
            expiresAt
        });

        res.status(201).json({
            apiKey: {
                id: apiKey.id,
                tenantId: apiKey.tenantId,
                name: apiKey.name,
                prefix: apiKey.keyPrefix,
                scopes: apiKey.scopes,
                isActive: apiKey.isActive,
                expiresAt: apiKey.expiresAt,
                revokedAt: apiKey.revokedAt,
                lastUsedAt: apiKey.lastUsedAt,
                createdAt: apiKey.createdAt,
                updatedAt: apiKey.updatedAt,
                tenant
            },
            token,
            warning: 'Cette clé API ne sera affichée qu’une seule fois.'
        });
    } catch (error) {
        console.error('Error creating public API key:', error);
        res.status(500).json({ error: 'Erreur lors de la création de la clé API' });
    }
}

export async function revokeTenantPublicApiKey(req: Request, res: Response): Promise<void> {
    try {
        const tenantId = routeParam(req.params.tenantId);
        const id = routeParam(req.params.id);

        const existing = await prisma.apiKey.findFirst({
            where: { id, tenantId },
            select: { id: true }
        });

        if (!existing) {
            res.status(404).json({ error: 'Clé API introuvable' });
            return;
        }

        const revoked = await revokePublicApiKey(id);
        res.json({
            success: true,
            apiKey: revoked
                ? {
                    id: revoked.id,
                    tenantId: revoked.tenantId,
                    name: revoked.name,
                    prefix: revoked.keyPrefix,
                    scopes: revoked.scopes,
                    isActive: revoked.isActive,
                    expiresAt: revoked.expiresAt,
                    revokedAt: revoked.revokedAt,
                    lastUsedAt: revoked.lastUsedAt,
                    createdAt: revoked.createdAt,
                    updatedAt: revoked.updatedAt
                }
                : null
        });
    } catch (error) {
        console.error('Error revoking public API key:', error);
        res.status(500).json({ error: 'Erreur lors de la révocation de la clé API' });
    }
}
