import prisma from '../lib/prisma';
import {
    ConnectorDefinition,
    ConnectorEnvironment,
    findConnectorForWebhookEvent,
    getConnectorDefinition,
    getConnectorDefinitions,
    isConnectorEvent,
    isConnectorWebhookTarget
} from './connectorRegistry';

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
    duration: number | null;
    error: string | null;
    retryCount: number;
    nextRetryAt: Date | null;
    createdAt: Date;
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

function buildWebhookWhere(definition: ConnectorDefinition) {
    return {
        OR: definition.searchTerms.flatMap(term => [
            { name: { contains: term, mode: 'insensitive' as const } },
            { url: { contains: term, mode: 'insensitive' as const } }
        ])
    };
}

export async function getConnectorStatus(provider: string) {
    const definition = getConnectorDefinition(provider);
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
    const statuses = await Promise.all(
        getConnectorDefinitions().map(definition => getConnectorStatus(definition.provider))
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
    const definition = getConnectorDefinition(provider);
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

export function getConnectorDispatchGuard(
    webhook: { name?: string | null; url?: string | null; tenantId?: string | null; id?: string },
    eventType: string,
    tenantId?: string
) {
    const definition = findConnectorForWebhookEvent(webhook, eventType);
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

export { getConnectorDefinition, getConnectorDefinitions, isConnectorEvent, isConnectorWebhookTarget };
