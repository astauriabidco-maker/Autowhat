import prisma from '../lib/prisma';
import crypto from 'crypto';
import {
    ConnectorDefinition,
    ConnectorEnvironment,
    findConnectorForWebhookEvent,
    getConnectorDefinition,
    getConnectorDefinitions,
    isConnectorEvent,
    isConnectorWebhookTarget
} from './connectorRegistry';
import { sanitizeLogText } from '../utils/safeWebhookLogger';

const SUPPORTED_CONNECTOR_EVENTS = [
    'check_in',
    'check_out',
    'late_arrival',
    'expense.submitted',
    'expense.approved',
    'expense.rejected',
    'leave.requested',
    'leave.approved',
    'leave.rejected',
    'document.received',
    'message.status.updated',
    'employee.secure_link.requested',
    'geofence.alert',
    'employee.created',
    'employee.deleted'
] as const;
const SENSITIVE_CONNECTOR_LOG_KEY_PATTERN = /(phone|email|name|url|link|token|secret|authorization|gps|lat|lng|longitude|latitude|address|rib|nir|bulletin|identity|document)/i;

type ConnectorWebhook = {
    id: string;
    name: string;
    url: string;
    tenantId: string | null;
    events: string[];
    isActive: boolean;
    lastTriggeredAt: Date | null;
    successCount: number;
    failureCount: number;
    updatedAt: Date;
};

type ConnectorLog = {
    id: string;
    webhookId: string;
    eventType: string;
    payload: unknown;
    status: string;
    statusCode: number | null;
    responseBody?: string | null;
    duration: number | null;
    error: string | null;
    retryCount: number;
    nextRetryAt: Date | null;
    createdAt: Date;
};

type ConnectorIssueLog = ConnectorLog & {
    webhook: {
        id: string;
        name: string;
        url: string;
        tenantId: string | null;
        isActive: boolean;
        events: string[];
    };
};

function inferEnvironment(definition: ConnectorDefinition, url: string): ConnectorEnvironment {
    if (url === definition.endpoints.sandbox) return 'sandbox';
    if (url === definition.endpoints.production) return 'production';

    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes(new URL(definition.endpoints.sandbox).hostname.toLowerCase())) return 'sandbox';
    if (lowerUrl.includes(new URL(definition.endpoints.production).hostname.toLowerCase())) return 'production';
    return 'custom';
}

function missingRequiredEvents(definition: ConnectorDefinition, events: string[]) {
    return definition.requiredEvents.filter(event => !events.includes(event));
}

function connectorState(definition: ConnectorDefinition, webhooks: ConnectorWebhook[], logs: ConnectorLog[]) {
    if (webhooks.length === 0) return 'not_configured';
    if (!webhooks.some(webhook => webhook.isActive)) return 'disabled';

    const activeMissingEvents = webhooks
        .filter(webhook => webhook.isActive)
        .flatMap(webhook => missingRequiredEvents(definition, webhook.events));
    if (activeMissingEvents.length > 0) return 'partial';

    const latestLog = logs[0];
    if (!latestLog) return 'configured';
    if (latestLog.status === 'SUCCESS' && latestLog.statusCode && latestLog.statusCode >= 200 && latestLog.statusCode < 300) {
        return 'healthy';
    }
    return 'degraded';
}

function extractEventId(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;

    const eventId = (payload as { eventId?: unknown }).eventId;
    return typeof eventId === 'string' ? eventId : null;
}

function toDeliverySummary(log: ConnectorLog) {
    return {
        id: log.id,
        webhookId: log.webhookId,
        eventId: extractEventId(log.payload),
        eventType: log.eventType,
        status: log.status,
        statusCode: log.statusCode,
        durationMs: log.duration,
        error: log.error,
        retryCount: log.retryCount,
        nextRetryAt: log.nextRetryAt?.toISOString() || null,
        createdAt: log.createdAt.toISOString()
    };
}

function toDeliveryDetail(log: ConnectorLog) {
    return {
        ...toDeliverySummary(log),
        replayable: ['PENDING', 'FAILED'].includes(log.status) && !containsRedactedConnectorLogPayload(log.payload),
        payload: redactConnectorLogPayload(log.payload),
        responseBody: log.responseBody ? sanitizeLogText(log.responseBody).substring(0, 2000) : null
    };
}

function toDeliveryIssue(log: ConnectorIssueLog, definition: ConnectorDefinition, tenantById: Map<string, any>) {
    return {
        ...toDeliveryDetail(log),
        provider: definition.provider,
        connectorName: definition.displayName,
        webhook: {
            id: log.webhook.id,
            name: log.webhook.name,
            endpoint: log.webhook.url,
            tenantId: log.webhook.tenantId,
            isActive: log.webhook.isActive,
            events: log.webhook.events
        },
        tenant: log.webhook.tenantId ? tenantById.get(log.webhook.tenantId) || null : null
    };
}

function containsRedactedConnectorLogPayload(value: unknown): boolean {
    if (value === '[redacted]') return true;
    if (Array.isArray(value)) return value.some(containsRedactedConnectorLogPayload);
    if (value && typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).some(containsRedactedConnectorLogPayload);
    }
    return false;
}

function redactConnectorLogPayload(value: unknown): unknown {
    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Array.isArray(value)) {
        return value.map(redactConnectorLogPayload);
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => {
                if (SENSITIVE_CONNECTOR_LOG_KEY_PATTERN.test(key)) {
                    return [key, '[redacted]'];
                }
                return [key, redactConnectorLogPayload(nestedValue)];
            })
        );
    }

    if (typeof value === 'string' && value.length > 180) {
        return `${value.slice(0, 180)}...`;
    }

    return value;
}

function buildWebhookWhere(definition: ConnectorDefinition) {
    return {
        OR: definition.searchTerms.flatMap(term => [
            { name: { contains: term, mode: 'insensitive' as const } },
            { url: { contains: term, mode: 'insensitive' as const } }
        ])
    };
}

function normalizeProvider(value: string) {
    return value
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function normalizeList(values: unknown, fallback: string[] = []) {
    if (!Array.isArray(values)) return fallback;
    return [...new Set(values.map(value => String(value).trim()).filter(Boolean))];
}

function toRuntimeDefinition(connector: any): ConnectorDefinition {
    const searchTerms = normalizeList(connector.searchTerms, [connector.provider.toLowerCase()]);
    return {
        provider: connector.provider,
        name: connector.name,
        displayName: connector.displayName,
        version: connector.version,
        docsUrl: connector.docsUrl || '/docs/connectors.md',
        openApiUrl: connector.openApiUrl || '/api/docs/public-v1.yaml',
        requiredEvents: normalizeList(connector.requiredEvents),
        searchTerms,
        endpoints: {
            sandbox: connector.sandboxEndpoint,
            production: connector.productionEndpoint
        },
        requiresTenantScopedEvents: Boolean(connector.requiresTenantScopedEvents),
        matchWebhook: webhook => {
            const name = webhook.name?.toLowerCase() || '';
            const url = webhook.url?.toLowerCase() || '';
            return searchTerms.some(term => {
                const normalizedTerm = term.toLowerCase();
                return name.includes(normalizedTerm) || url.includes(normalizedTerm);
            });
        }
    };
}

async function getRuntimeConnectorDefinitions() {
    const partnerConnectorClient = (prisma as any).partnerConnector;
    const dynamicConnectors = partnerConnectorClient?.findMany
        ? await partnerConnectorClient.findMany({
            where: { isActive: true },
            orderBy: { displayName: 'asc' }
        })
        : [];
    const staticDefinitions = getConnectorDefinitions();
    const staticProviders = new Set(staticDefinitions.map(definition => definition.provider));
    const dynamicDefinitions = dynamicConnectors
        .filter((connector: any) => !staticProviders.has(connector.provider))
        .map(toRuntimeDefinition);

    return [...staticDefinitions, ...dynamicDefinitions];
}

async function getRuntimeConnectorDefinition(provider: string) {
    const normalizedProvider = normalizeProvider(provider);
    const staticDefinition = getConnectorDefinition(normalizedProvider);
    if (staticDefinition) return staticDefinition;

    const partnerConnectorClient = (prisma as any).partnerConnector;
    if (!partnerConnectorClient?.findUnique) return null;

    const connector = await partnerConnectorClient.findUnique({
        where: { provider: normalizedProvider }
    });

    if (!connector || !connector.isActive) return null;
    return toRuntimeDefinition(connector);
}

export async function getConnectorStatus(provider: string) {
    const definition = await getRuntimeConnectorDefinition(provider);
    if (!definition) {
        return {
            ok: false as const,
            status: 404,
            error: 'Connecteur inconnu'
        };
    }

    const webhooks = await prisma.webhookConfig.findMany({
        where: buildWebhookWhere(definition),
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
        select: {
            id: true,
            name: true,
            url: true,
            tenantId: true,
            events: true,
            isActive: true,
            lastTriggeredAt: true,
            successCount: true,
            failureCount: true,
            updatedAt: true
        }
    });

    const webhookIds = webhooks.map(webhook => webhook.id);
    const logs = webhookIds.length > 0
        ? await prisma.webhookLog.findMany({
            where: { webhookId: { in: webhookIds } },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                id: true,
                webhookId: true,
                eventType: true,
                payload: true,
                status: true,
                statusCode: true,
                duration: true,
                error: true,
                retryCount: true,
                nextRetryAt: true,
                createdAt: true
            }
        })
        : [];

    const tenantIds = [...new Set(webhooks.map(webhook => webhook.tenantId).filter(Boolean))] as string[];
    const tenants = tenantIds.length > 0
        ? await prisma.tenant.findMany({
            where: { id: { in: tenantIds } },
            select: {
                id: true,
                name: true,
                country: true,
                plan: true,
                status: true
            }
        })
        : [];
    const tenantById = new Map(tenants.map(tenant => [tenant.id, tenant]));

    const logsByWebhook = new Map<string, ConnectorLog[]>();
    for (const log of logs) {
        const existing = logsByWebhook.get(log.webhookId) || [];
        existing.push(log);
        logsByWebhook.set(log.webhookId, existing);
    }

    const webhookSummaries = webhooks.map(webhook => {
        const webhookLogs = logsByWebhook.get(webhook.id) || [];
        const latestLog = webhookLogs[0] || null;
        return {
            id: webhook.id,
            name: webhook.name,
            environment: inferEnvironment(definition, webhook.url),
            endpoint: webhook.url,
            tenantId: webhook.tenantId,
            tenant: webhook.tenantId ? tenantById.get(webhook.tenantId) || null : null,
            isActive: webhook.isActive,
            version: definition.version,
            events: webhook.events,
            missingEvents: missingRequiredEvents(definition, webhook.events),
            successCount: webhook.successCount,
            failureCount: webhook.failureCount,
            lastTriggeredAt: webhook.lastTriggeredAt?.toISOString() || null,
            latestDelivery: latestLog ? toDeliverySummary(latestLog) : null,
            recentDeliveries: webhookLogs.slice(0, 5).map(toDeliverySummary)
        };
    });

    return {
        ok: true as const,
        provider: definition.provider,
        name: definition.name,
        displayName: definition.displayName,
        version: definition.version,
        docsUrl: definition.docsUrl,
        openApiUrl: definition.openApiUrl,
        requiredEvents: [...definition.requiredEvents],
        endpoints: definition.endpoints,
        state: connectorState(definition, webhooks, logs),
        totals: {
            webhooks: webhooks.length,
            activeWebhooks: webhooks.filter(webhook => webhook.isActive).length,
            successes: webhooks.reduce((sum, webhook) => sum + webhook.successCount, 0),
            failures: webhooks.reduce((sum, webhook) => sum + webhook.failureCount, 0)
        },
        recentDeliveries: logs.map(toDeliverySummary),
        webhooks: webhookSummaries
    };
}

export async function getConnectorsStatus() {
    const definitions = await getRuntimeConnectorDefinitions();
    const statuses = await Promise.all(
        definitions.map(definition => getConnectorStatus(definition.provider))
    );

    return statuses
        .filter(status => status.ok)
        .map(status => {
            const { ok, ...payload } = status;
            void ok;
            return payload;
        });
}

export async function updateConnectorWebhookEvents(provider: string, webhookId: string, events: string[]) {
    const definition = await getRuntimeConnectorDefinition(provider);
    if (!definition) {
        return {
            ok: false as const,
            status: 404,
            error: 'Connecteur inconnu'
        };
    }

    const normalizedEvents = [...new Set(events.map(event => String(event).trim()).filter(Boolean))];
    const invalidEvents = normalizedEvents.filter(event => !definition.requiredEvents.includes(event));

    if (invalidEvents.length > 0) {
        return {
            ok: false as const,
            status: 400,
            error: `Événements ${definition.name} invalides: ${invalidEvents.join(', ')}`
        };
    }

    const webhook = await prisma.webhookConfig.findUnique({
        where: { id: webhookId },
        select: {
            id: true,
            name: true,
            url: true,
            tenantId: true
        }
    });

    if (!webhook || !definition.matchWebhook(webhook)) {
        return {
            ok: false as const,
            status: 404,
            error: `Webhook ${definition.name} introuvable`
        };
    }

    if (definition.requiresTenantScopedEvents && !webhook.tenantId) {
        return {
            ok: false as const,
            status: 400,
            error: `Le connecteur ${definition.name} v1 doit être rattaché à un tenant`
        };
    }

    const updated = await prisma.webhookConfig.update({
        where: { id: webhookId },
        data: { events: normalizedEvents },
        select: {
            id: true,
            events: true,
            updatedAt: true
        }
    });

    return {
        ok: true as const,
        webhook: {
            id: updated.id,
            events: updated.events,
            updatedAt: updated.updatedAt.toISOString()
        }
    };
}

export async function getConnectorWebhookLogs(provider: string, webhookId: string, filters: {
    eventType?: string;
    status?: string;
    eventId?: string;
    limit?: number;
    cursor?: string;
}) {
    const definition = await getRuntimeConnectorDefinition(provider);
    if (!definition) {
        return {
            ok: false as const,
            status: 404,
            error: 'Connecteur inconnu'
        };
    }

    const webhook = await prisma.webhookConfig.findUnique({
        where: { id: webhookId },
        select: {
            id: true,
            name: true,
            url: true,
            tenantId: true
        }
    });

    if (!webhook || !definition.matchWebhook(webhook)) {
        return {
            ok: false as const,
            status: 404,
            error: `Webhook ${definition.name} introuvable`
        };
    }

    const limit = Math.min(Math.max(Number(filters.limit) || 25, 1), 100);
    const where: any = { webhookId };
    const eventType = String(filters.eventType || '').trim();
    const status = String(filters.status || '').trim().toUpperCase();
    const eventId = String(filters.eventId || '').trim();

    if (eventType) where.eventType = eventType;
    if (status) where.status = status;
    if (eventId) {
        where.payload = {
            path: ['eventId'],
            equals: eventId
        };
    }

    const logs = await prisma.webhookLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...(filters.cursor ? { cursor: { id: String(filters.cursor) }, skip: 1 } : {}),
        take: limit + 1,
        select: {
            id: true,
            webhookId: true,
            eventType: true,
            payload: true,
            status: true,
            statusCode: true,
            responseBody: true,
            duration: true,
            error: true,
            retryCount: true,
            nextRetryAt: true,
            createdAt: true
        }
    });

    const page = logs.slice(0, limit);

    return {
        ok: true as const,
        provider: definition.provider,
        webhook: {
            id: webhook.id,
            name: webhook.name,
            tenantId: webhook.tenantId,
            endpoint: webhook.url
        },
        filters: {
            eventType: eventType || null,
            status: status || null,
            eventId: eventId || null,
            limit
        },
        logs: page.map(toDeliveryDetail),
        pagination: {
            nextCursor: logs.length > limit ? logs[limit].id : null,
            hasMore: logs.length > limit
        }
    };
}

export async function getConnectorDeliveryIssues(filters: {
    provider?: string;
    eventType?: string;
    status?: string;
    eventId?: string;
    limit?: number;
    cursor?: string;
}) {
    const definitions = await getRuntimeConnectorDefinitions();
    const requestedProvider = filters.provider ? normalizeProvider(String(filters.provider)) : '';
    const filteredDefinitions = requestedProvider
        ? definitions.filter(definition => definition.provider === requestedProvider)
        : definitions;

    if (requestedProvider && filteredDefinitions.length === 0) {
        return {
            ok: false as const,
            status: 404,
            error: 'Connecteur inconnu'
        };
    }

    const webhooks = await prisma.webhookConfig.findMany({
        orderBy: [{ updatedAt: 'desc' }],
        select: {
            id: true,
            name: true,
            url: true,
            tenantId: true,
            events: true,
            isActive: true,
            updatedAt: true
        }
    });

    const definitionByWebhookId = new Map<string, ConnectorDefinition>();
    for (const webhook of webhooks) {
        const definition = filteredDefinitions.find(candidate => candidate.matchWebhook(webhook));
        if (definition) {
            definitionByWebhookId.set(webhook.id, definition);
        }
    }

    const webhookIds = [...definitionByWebhookId.keys()];
    const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 100);
    const status = String(filters.status || '').trim().toUpperCase();
    const eventType = String(filters.eventType || '').trim();
    const eventId = String(filters.eventId || '').trim();
    const where: any = {
        webhookId: { in: webhookIds },
        status: ['FAILED', 'PENDING'].includes(status) ? status : { in: ['FAILED', 'PENDING'] }
    };

    if (eventType) where.eventType = eventType;
    if (eventId) {
        where.payload = {
            path: ['eventId'],
            equals: eventId
        };
    }

    const logs = webhookIds.length > 0
        ? await prisma.webhookLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            ...(filters.cursor ? { cursor: { id: String(filters.cursor) }, skip: 1 } : {}),
            take: limit + 1,
            select: {
                id: true,
                webhookId: true,
                eventType: true,
                payload: true,
                status: true,
                statusCode: true,
                responseBody: true,
                duration: true,
                error: true,
                retryCount: true,
                nextRetryAt: true,
                createdAt: true,
                webhook: {
                    select: {
                        id: true,
                        name: true,
                        url: true,
                        tenantId: true,
                        isActive: true,
                        events: true
                    }
                }
            }
        })
        : [];
    const page = logs.slice(0, limit) as ConnectorIssueLog[];
    const tenantIds = [...new Set(page.map(log => log.webhook.tenantId).filter(Boolean))] as string[];
    const tenants = tenantIds.length > 0
        ? await prisma.tenant.findMany({
            where: { id: { in: tenantIds } },
            select: {
                id: true,
                name: true,
                country: true,
                plan: true,
                status: true
            }
        })
        : [];
    const tenantById = new Map(tenants.map(tenant => [tenant.id, tenant]));

    return {
        ok: true as const,
        filters: {
            provider: requestedProvider || null,
            status: ['FAILED', 'PENDING'].includes(status) ? status : null,
            eventType: eventType || null,
            eventId: eventId || null,
            limit
        },
        providers: definitions.map(definition => ({
            provider: definition.provider,
            displayName: definition.displayName
        })),
        issues: page
            .map(log => {
                const definition = definitionByWebhookId.get(log.webhookId);
                return definition ? toDeliveryIssue(log, definition, tenantById) : null;
            })
            .filter(Boolean),
        totals: {
            matchedWebhooks: webhookIds.length
        },
        pagination: {
            nextCursor: logs.length > limit ? logs[limit].id : null,
            hasMore: logs.length > limit
        }
    };
}

export async function getConnectorDispatchGuard(
    webhook: { name?: string | null; url?: string | null; tenantId?: string | null; id?: string },
    eventType: string,
    tenantId?: string
) {
    const definition = (await getRuntimeConnectorDefinitions()).find(connector =>
        connector.requiredEvents.includes(eventType) && connector.matchWebhook(webhook)
    ) || findConnectorForWebhookEvent(webhook, eventType);
    if (!definition) {
        return { allowed: true as const };
    }

    if (!definition.requiresTenantScopedEvents) {
        return { allowed: true as const, provider: definition.provider };
    }

    if (tenantId && webhook.tenantId === tenantId) {
        return { allowed: true as const, provider: definition.provider };
    }

    return {
        allowed: false as const,
        provider: definition.provider,
        reason: 'TENANT_SCOPED_EVENT_REQUIRES_TENANT_WEBHOOK'
    };
}

export async function createPartnerConnector(input: {
    provider: string;
    displayName: string;
    sandboxEndpoint: string;
    productionEndpoint?: string;
    tenantId: string;
    requiredEvents: string[];
    generateSecret?: boolean;
}) {
    const provider = normalizeProvider(input.provider);
    const displayName = String(input.displayName || '').trim();
    const sandboxEndpoint = String(input.sandboxEndpoint || '').trim();
    const productionEndpoint = String(input.productionEndpoint || sandboxEndpoint).trim();
    const tenantId = String(input.tenantId || '').trim();
    const requiredEvents = normalizeList(input.requiredEvents);
    const invalidEvents = requiredEvents.filter(event => !SUPPORTED_CONNECTOR_EVENTS.includes(event as any));

    if (!provider || provider.length < 3) {
        return { ok: false as const, status: 400, error: 'provider est requis et doit contenir au moins 3 caractères' };
    }
    if (getConnectorDefinition(provider)) {
        return { ok: false as const, status: 409, error: 'Ce provider est réservé par un connecteur système' };
    }
    if (!displayName) {
        return { ok: false as const, status: 400, error: 'displayName est requis' };
    }
    if (!tenantId) {
        return { ok: false as const, status: 400, error: 'tenantId est requis' };
    }
    if (requiredEvents.length === 0 || invalidEvents.length > 0) {
        return {
            ok: false as const,
            status: 400,
            error: invalidEvents.length > 0
                ? `Événements invalides: ${invalidEvents.join(', ')}`
                : 'Au moins un événement est requis'
        };
    }

    try {
        new URL(sandboxEndpoint);
        new URL(productionEndpoint);
    } catch {
        return { ok: false as const, status: 400, error: 'Endpoint invalide' };
    }

    const partnerConnectorClient = (prisma as any).partnerConnector;
    if (!partnerConnectorClient?.findUnique || !partnerConnectorClient?.create) {
        return { ok: false as const, status: 500, error: 'Modèle PartnerConnector indisponible' };
    }

    const existing = await partnerConnectorClient.findUnique({ where: { provider } });
    if (existing) {
        return { ok: false as const, status: 409, error: 'Connecteur déjà existant' };
    }

    const searchTerm = provider.toLowerCase();
    const secret = input.generateSecret === false
        ? null
        : crypto.randomBytes(32).toString('hex');

    const connector = await partnerConnectorClient.create({
        data: {
            provider,
            name: displayName,
            displayName,
            version: `${provider}_V1`,
            docsUrl: '/docs/connectors.md',
            openApiUrl: '/api/docs/public-v1.yaml',
            requiredEvents,
            searchTerms: [searchTerm, sandboxEndpoint.toLowerCase()],
            sandboxEndpoint,
            productionEndpoint,
            requiresTenantScopedEvents: true,
            isActive: true
        }
    });

    const webhook = await prisma.webhookConfig.create({
        data: {
            name: `${displayName} POC`,
            url: sandboxEndpoint,
            secret,
            events: requiredEvents,
            tenantId,
            isActive: true,
            httpMethod: 'POST'
        },
        select: {
            id: true,
            name: true,
            url: true,
            tenantId: true,
            events: true,
            isActive: true,
            createdAt: true
        }
    });

    return {
        ok: true as const,
        connector: toRuntimeDefinition(connector),
        webhook: {
            ...webhook,
            createdAt: webhook.createdAt.toISOString(),
            secretPlaintext: secret
        }
    };
}

export { getConnectorDefinition, getConnectorDefinitions, isConnectorEvent, isConnectorWebhookTarget };
export { SUPPORTED_CONNECTOR_EVENTS };
