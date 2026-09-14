import prisma from '../lib/prisma';

export const KALLDY_CONNECTOR_VERSION = 'KALLDY_V1';
export const KALLDY_REQUIRED_EVENTS = [
    'leave.approved',
    'document.received',
    'employee.secure_link.requested'
] as const;

const KALLDY_SANDBOX_ENDPOINT = 'https://api.testbed.fr.paie.kalldy.com/api/webhooks/whatspoint';
const KALLDY_PRODUCTION_ENDPOINT = 'https://api.fr.paie.kalldy.com/api/webhooks/whatspoint';

type KalldyWebhook = {
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

type KalldyLog = {
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

function inferEnvironment(url: string): 'sandbox' | 'production' | 'custom' {
    if (url === KALLDY_SANDBOX_ENDPOINT || url.includes('testbed.fr.paie.kalldy.com')) return 'sandbox';
    if (url === KALLDY_PRODUCTION_ENDPOINT || url.includes('fr.paie.kalldy.com')) return 'production';
    return 'custom';
}

function missingRequiredEvents(events: string[]) {
    return KALLDY_REQUIRED_EVENTS.filter(event => !events.includes(event));
}

function connectorState(webhooks: KalldyWebhook[], logs: KalldyLog[]) {
    if (webhooks.length === 0) return 'not_configured';
    if (!webhooks.some(webhook => webhook.isActive)) return 'disabled';

    const activeMissingEvents = webhooks
        .filter(webhook => webhook.isActive)
        .flatMap(webhook => missingRequiredEvents(webhook.events));
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

function toDeliverySummary(log: KalldyLog) {
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

export async function getKalldyConnectorStatus() {
    const webhooks = await prisma.webhookConfig.findMany({
        where: {
            OR: [
                { name: { contains: 'Kalldy', mode: 'insensitive' } },
                { url: { contains: 'kalldy', mode: 'insensitive' } }
            ]
        },
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

    const logsByWebhook = new Map<string, KalldyLog[]>();
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
            environment: inferEnvironment(webhook.url),
            endpoint: webhook.url,
            tenantId: webhook.tenantId,
            tenant: webhook.tenantId ? tenantById.get(webhook.tenantId) || null : null,
            isActive: webhook.isActive,
            version: KALLDY_CONNECTOR_VERSION,
            events: webhook.events,
            missingEvents: missingRequiredEvents(webhook.events),
            successCount: webhook.successCount,
            failureCount: webhook.failureCount,
            lastTriggeredAt: webhook.lastTriggeredAt?.toISOString() || null,
            latestDelivery: latestLog ? toDeliverySummary(latestLog) : null,
            recentDeliveries: webhookLogs.slice(0, 5).map(toDeliverySummary)
        };
    });

    return {
        provider: 'KALLDY',
        version: KALLDY_CONNECTOR_VERSION,
        requiredEvents: [...KALLDY_REQUIRED_EVENTS],
        endpoints: {
            sandbox: KALLDY_SANDBOX_ENDPOINT,
            production: KALLDY_PRODUCTION_ENDPOINT
        },
        state: connectorState(webhooks, logs),
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
