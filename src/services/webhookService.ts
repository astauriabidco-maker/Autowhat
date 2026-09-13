/**
 * Outgoing Webhook Service
 * Dispatches events to configured webhook endpoints
 */

import crypto from 'crypto';
import prisma from '../lib/prisma';


// Supported webhook event types
export const WEBHOOK_EVENTS = {
    // Attendance
    CHECK_IN: 'check_in',
    CHECK_OUT: 'check_out',
    LATE_ARRIVAL: 'late_arrival',

    // Expenses
    EXPENSE_SUBMITTED: 'expense.submitted',
    EXPENSE_APPROVED: 'expense.approved',
    EXPENSE_REJECTED: 'expense.rejected',

    // Leaves
    LEAVE_REQUESTED: 'leave.requested',
    LEAVE_APPROVED: 'leave.approved',
    LEAVE_REJECTED: 'leave.rejected',

    // Documents
    DOCUMENT_RECEIVED: 'document.received',

    // Messages
    MESSAGE_STATUS_UPDATED: 'message.status.updated',

    // Geofencing
    GEOFENCE_ALERT: 'geofence.alert',

    // Employee
    EMPLOYEE_CREATED: 'employee.created',
    EMPLOYEE_DELETED: 'employee.deleted'
} as const;

export type WebhookEventType = typeof WEBHOOK_EVENTS[keyof typeof WEBHOOK_EVENTS];

interface WebhookPayload {
    eventId: string;
    event: WebhookEventType;
    timestamp: string;
    tenantId?: string;
    data: Record<string, any>;
}

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
function generateSignature(payload: string, secret: string): string {
    return crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
}

function normalizeForHash(value: unknown): unknown {
    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Array.isArray(value)) {
        return value.map(normalizeForHash);
    }

    if (value && typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>)
            .sort()
            .reduce<Record<string, unknown>>((normalized, key) => {
                normalized[key] = normalizeForHash((value as Record<string, unknown>)[key]);
                return normalized;
            }, {});
    }

    return value;
}

function createWebhookEventId(eventType: WebhookEventType | 'test', tenantId: string | undefined, data: Record<string, any>): string {
    const canonicalPayload = JSON.stringify(normalizeForHash({
        event: eventType,
        tenantId: tenantId || null,
        data
    }));
    const hash = crypto.createHash('sha256').update(canonicalPayload).digest('hex').slice(0, 32);

    return `wp_evt_${hash}`;
}

function buildWebhookHeaders(params: {
    event: WebhookEventType | 'test';
    eventId: string;
    timestamp: string;
    userAgent?: string;
}): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'User-Agent': params.userAgent || 'WhatsPoint-Webhook/1.0',
        'X-WhatsPoint-Event': params.event,
        'X-WhatsPoint-Event-Id': params.eventId,
        'X-WhatsPoint-Timestamp': params.timestamp,
        // Legacy headers kept for existing integrations.
        'X-Webhook-Event': params.event,
        'X-Webhook-Event-Id': params.eventId,
        'X-Webhook-Timestamp': params.timestamp
    };
}

function applyWebhookSignature(headers: Record<string, string>, payloadString: string, secret?: string | null) {
    if (secret) {
        const signature = generateSignature(payloadString, secret);
        headers['X-WhatsPoint-Signature'] = `sha256=${signature}`;
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }
}

/**
 * Dispatch a webhook event to all matching configurations
 */
export async function dispatchWebhook(
    eventType: WebhookEventType,
    data: Record<string, any>,
    tenantId?: string
): Promise<void> {
    try {
        // Find all active webhooks that listen to this event
        const webhooks = await prisma.webhookConfig.findMany({
            where: {
                isActive: true,
                events: { has: eventType },
                OR: [
                    { tenantId: null },     // Global webhooks
                    { tenantId: tenantId }   // Tenant-specific webhooks
                ]
            }
        });

        if (webhooks.length === 0) {
            return; // No webhooks configured for this event
        }

        console.log(`🔔 Dispatching ${eventType} to ${webhooks.length} webhook(s)`);

        // Dispatch to all webhooks in parallel
        const results = await Promise.allSettled(
            webhooks.map(webhook => sendWebhook(webhook, eventType, data, tenantId))
        );

        // Log results
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`❌ Webhook ${webhooks[index].name} failed:`, result.reason);
            }
        });
    } catch (error) {
        console.error('Error dispatching webhooks:', error);
    }
}

/**
 * Send a single webhook request
 */
async function sendWebhook(
    config: { 
        id: string; 
        name: string; 
        url: string; 
        secret: string | null;
        payloadMapping?: any;
        httpMethod?: string;
        headers?: any;
    },
    eventType: WebhookEventType,
    data: Record<string, any>,
    tenantId?: string
): Promise<void> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const eventId = createWebhookEventId(eventType, tenantId, data);

    const payload: WebhookPayload = {
        eventId,
        event: eventType,
        timestamp,
        tenantId,
        data
    };

    // Apply Payload Mapping if configured
    let finalPayload: any = payload;
    if (config.payloadMapping && Object.keys(config.payloadMapping).length > 0) {
        let templateStr = JSON.stringify(config.payloadMapping);
        const context: Record<string, any> = { ...data, event: payload.event, tenantId: payload.tenantId };
        
        templateStr = templateStr.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
            const val = context[key.trim()];
            return val !== undefined && val !== null ? String(val) : '';
        });
        
        try {
            finalPayload = JSON.parse(templateStr);
        } catch (e) {
            console.error('Failed to parse webhook payloadMapping', e);
        }
    }

    const payloadString = JSON.stringify(finalPayload);

    // Build headers
    const headers = buildWebhookHeaders({
        event: eventType,
        eventId,
        timestamp
    });

    // Apply custom headers from config
    if (config.headers && typeof config.headers === 'object') {
        Object.assign(headers, config.headers);
    }
    applyWebhookSignature(headers, payloadString, config.secret);

    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let error: string | null = null;

    const method = config.httpMethod?.toUpperCase() || 'POST';

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(config.url, {
            method: method,
            headers,
            body: payloadString,
            signal: controller.signal
        });

        clearTimeout(timeout);

        statusCode = response.status;
        responseBody = await response.text().catch(() => null);

        if (!response.ok) {
            error = `HTTP ${statusCode}: ${responseBody?.substring(0, 500) || 'No response body'}`;
        }

        // Update success/failure count
        await prisma.webhookConfig.update({
            where: { id: config.id },
            data: {
                lastTriggeredAt: new Date(),
                ...(response.ok
                    ? { successCount: { increment: 1 } }
                    : { failureCount: { increment: 1 } }
                )
            }
        });

    } catch (err: any) {
        error = err.message || 'Unknown error';

        // Update failure count
        await prisma.webhookConfig.update({
            where: { id: config.id },
            data: {
                lastTriggeredAt: new Date(),
                failureCount: { increment: 1 }
            }
        });
    }

    const duration = Date.now() - startTime;

    // Determine Queue Status (Phase 3)
    let status = 'SUCCESS';
    let nextRetryAt: Date | undefined;

    if (error) {
        status = 'PENDING'; // Add to retry queue
        nextRetryAt = new Date(Date.now() + 5 * 60 * 1000); // Retry in 5 minutes
    }

    // Log the webhook attempt (or queue it)
    await prisma.webhookLog.create({
        data: {
            webhookId: config.id,
            eventType,
            payload: finalPayload as any,
            statusCode,
            responseBody: responseBody?.substring(0, 2000), // Limit stored response
            error,
            duration,
            status,
            retryCount: 0,
            nextRetryAt
        } as any // cast as any because Prisma client might not be fully generated yet locally
    });

    if (error) {
        console.log(`⚠️ Webhook ${config.name} returned error: ${error}. Queued for retry.`);
    } else {
        console.log(`✅ Webhook ${config.name} delivered in ${duration}ms`);
    }
}

/**
 * Test a webhook configuration by sending a test event
 */
export async function testWebhook(webhookId: string): Promise<{ success: boolean; error?: string; statusCode?: number }> {
    const webhook = await prisma.webhookConfig.findUnique({
        where: { id: webhookId }
    });

    if (!webhook) {
        return { success: false, error: 'Webhook not found' };
    }

    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const payload = {
        eventId: createWebhookEventId('test', webhook.tenantId || undefined, {
            webhookId: webhook.id,
            webhookName: webhook.name
        }),
        event: 'test',
        timestamp,
        data: {
            message: 'This is a test webhook from AutoWhats',
            webhookId: webhook.id,
            webhookName: webhook.name
        }
    };

    const payloadString = JSON.stringify(payload);
    const headers = buildWebhookHeaders({
        event: 'test',
        eventId: payload.eventId,
        timestamp
    });
    applyWebhookSignature(headers, payloadString, webhook.secret);

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(webhook.url, {
            method: 'POST',
            headers,
            body: payloadString,
            signal: controller.signal
        });

        clearTimeout(timeout);

        const duration = Date.now() - startTime;

        if (response.ok) {
            console.log(`✅ Test webhook to ${webhook.name} succeeded in ${duration}ms`);
            return { success: true, statusCode: response.status };
        } else {
            const body = await response.text().catch(() => '');
            return {
                success: false,
                error: `HTTP ${response.status}: ${body.substring(0, 200)}`,
                statusCode: response.status
            };
        }
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Worker Function: Retry pending webhooks
 * This should be called by a cron job (e.g. every minute)
 */
export async function processWebhookQueue(): Promise<void> {
    try {
        const now = new Date();
        
        // Find webhooks that are pending and due for retry
        const pendingLogs = await prisma.webhookLog.findMany({
            where: {
                status: 'PENDING',
                nextRetryAt: { lte: now }
            },
            include: {
                webhook: true
            },
            take: 50 // process in batches
        });

        if (pendingLogs.length === 0) return;
        
        console.log(`[Queue] Processing ${pendingLogs.length} pending webhook retries...`);

        for (const log of pendingLogs) {
            const config = log.webhook;
            if (!config || !config.isActive) {
                // If webhook config was deleted or deactivated, mark as failed
                await prisma.webhookLog.update({
                    where: { id: log.id },
                    data: { status: 'FAILED' } as any
                });
                continue;
            }

            const payload = log.payload as Record<string, any>;
            const payloadString = JSON.stringify(payload);
            const retryTimestamp = typeof payload.timestamp === 'string' ? payload.timestamp : new Date().toISOString();
            const retryEventId = typeof payload.eventId === 'string'
                ? payload.eventId
                : createWebhookEventId(log.eventType as WebhookEventType, config.tenantId || undefined, payload.data || payload);
            const headers = buildWebhookHeaders({
                event: log.eventType as WebhookEventType,
                eventId: retryEventId,
                timestamp: retryTimestamp,
                userAgent: 'WhatsPoint-Webhook-Retry/1.0'
            });

            // Apply custom headers from config
            let customHeaders = config.headers;
            if (typeof customHeaders === 'string') {
                try { customHeaders = JSON.parse(customHeaders); } catch(e) {}
            }
            if (customHeaders && typeof customHeaders === 'object') {
                Object.assign(headers, customHeaders);
            }
            applyWebhookSignature(headers, payloadString, config.secret);

            let statusCode: number | null = null;
            let responseBody: string | null = null;
            let error: string | null = null;
            let isSuccess = false;

            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 10000);

                const response = await fetch(config.url, {
                    method: config.httpMethod || 'POST',
                    headers,
                    body: payloadString,
                    signal: controller.signal
                });

                clearTimeout(timeout);
                statusCode = response.status;
                responseBody = await response.text().catch(() => null);

                if (response.ok) {
                    isSuccess = true;
                } else {
                    error = `HTTP ${statusCode}: ${responseBody?.substring(0, 200)}`;
                }
            } catch (err: any) {
                error = err.message;
            }

            // Determine next steps
            const newRetryCount = (log as any).retryCount + 1;
            let newStatus = 'PENDING';
            let nextRetryAt: Date | null = null;

            if (isSuccess) {
                newStatus = 'SUCCESS';
            } else if (newRetryCount >= 3) {
                // Max retries reached (3) -> Dead letter
                newStatus = 'FAILED';
                console.log(`❌ Webhook retry failed permanently after 3 attempts: ${log.id}`);
            } else {
                // Exponential backoff: 5m, 15m, 45m
                const delayMs = 5 * 60 * 1000 * Math.pow(3, newRetryCount - 1);
                nextRetryAt = new Date(Date.now() + delayMs);
            }

            // Update log
            await prisma.webhookLog.update({
                where: { id: log.id },
                data: {
                    status: newStatus,
                    retryCount: newRetryCount,
                    nextRetryAt,
                    error: error ? error : (log.error as string), // keep last error if needed
                    statusCode: statusCode || log.statusCode
                } as any
            });

            // Update global config stats
            await prisma.webhookConfig.update({
                where: { id: config.id },
                data: {
                    ...(isSuccess 
                        ? { successCount: { increment: 1 } }
                        : { failureCount: { increment: 1 } }
                    )
                }
            });
        }
    } catch (e) {
        console.error('Error processing webhook queue:', e);
    }
}
