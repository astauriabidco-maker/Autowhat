/**
 * Outgoing Webhook Service
 * Dispatches events to configured webhook endpoints
 */

import crypto from 'crypto';
import prisma from '../lib/prisma';
import { sanitizeLogText } from '../utils/safeWebhookLogger';
import { getConnectorDispatchGuard } from './connectorService';

const SENSITIVE_PAYLOAD_KEY_PATTERN = /(phone|email|name|url|link|token|secret|authorization|gps|lat|lng|longitude|latitude|address|rib|nir|bulletin|identity|document)/i;
const MAX_AUDIT_STRING_LENGTH = 180;

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

    // Secure PWA handoff
    EMPLOYEE_SECURE_LINK_REQUESTED: 'employee.secure_link.requested',

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

export type TestWebhookEventType = WebhookEventType | 'test';
export type MessageStatusTestValue = 'sent' | 'delivered' | 'read' | 'failed';

interface TestWebhookOptions {
    eventType?: TestWebhookEventType;
    messageStatus?: MessageStatusTestValue;
}

function containsRedactedValue(value: unknown): boolean {
    if (Array.isArray(value)) {
        return value.some(containsRedactedValue);
    }

    if (value && typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).some(containsRedactedValue);
    }

    return value === '[redacted]';
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

function redactWebhookPayloadForAudit(value: unknown): unknown {
    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Array.isArray(value)) {
        return value.map(redactWebhookPayloadForAudit);
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => {
                if (SENSITIVE_PAYLOAD_KEY_PATTERN.test(key)) {
                    return [key, '[redacted]'];
                }
                return [key, redactWebhookPayloadForAudit(nestedValue)];
            })
        );
    }

    if (typeof value === 'string') {
        return value.slice(0, MAX_AUDIT_STRING_LENGTH);
    }

    return value;
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

function normalizeCustomHeaders(customHeaders: unknown): Record<string, string> {
    let normalizedHeaders = customHeaders;
    if (typeof normalizedHeaders === 'string') {
        try { normalizedHeaders = JSON.parse(normalizedHeaders); } catch {}
    }

    if (!normalizedHeaders || typeof normalizedHeaders !== 'object' || Array.isArray(normalizedHeaders)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(normalizedHeaders as Record<string, unknown>)
            .filter(([, value]) => value !== null && value !== undefined)
            .map(([key, value]) => [key, String(value)])
    );
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

        const deliverableWebhooks: typeof webhooks = [];
        for (const webhook of webhooks) {
            const guard = await getConnectorDispatchGuard(webhook, eventType, tenantId);
            if (guard.allowed) {
                deliverableWebhooks.push(webhook);
                continue;
            }

            console.warn('Connector webhook skipped because it is not tenant-scoped for this event', {
                provider: guard.provider,
                reason: guard.reason,
                webhookId: webhook.id,
                eventType,
                hasTenantId: Boolean(tenantId),
                webhookTenantId: webhook.tenantId || null
            });
        }

        if (deliverableWebhooks.length === 0) {
            return; // No webhooks configured for this event
        }

        console.log(`🔔 Dispatching ${eventType} to ${deliverableWebhooks.length} webhook(s)`);

        // Dispatch to all webhooks in parallel
        const results = await Promise.allSettled(
            deliverableWebhooks.map(webhook => sendWebhook(webhook, eventType, data, tenantId))
        );

        // Log results
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`❌ Webhook ${deliverableWebhooks[index].name} failed:`, result.reason);
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

    // Keep the exact payload only while a retry is pending. Successful and final logs
    // are audit records, not payload archives.
    await prisma.webhookLog.create({
        data: {
            webhookId: config.id,
            eventType,
            payload: (error ? finalPayload : redactWebhookPayloadForAudit(finalPayload)) as any,
            statusCode,
            responseBody: responseBody ? sanitizeLogText(responseBody).substring(0, 2000) : null,
            error: error ? sanitizeLogText(error) : null,
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

function buildTestWebhookPayload(params: {
    eventType: TestWebhookEventType;
    timestamp: string;
    tenantId?: string | null;
    webhookId: string;
    webhookName: string;
    messageStatus?: MessageStatusTestValue;
}) {
    if (params.eventType === WEBHOOK_EVENTS.LEAVE_APPROVED) {
        const data = {
            leaveRequestId: 'leave_poc_001',
            employeePhoneNumber: '+33612345678',
            startDate: '2026-06-10',
            endDate: '2026-06-17',
            businessDays: 6,
            status: 'APPROVED'
        };

        return {
            eventId: createWebhookEventId(params.eventType, params.tenantId || undefined, data),
            event: params.eventType,
            timestamp: params.timestamp,
            tenantId: params.tenantId || undefined,
            data
        };
    }

    if (params.eventType === WEBHOOK_EVENTS.DOCUMENT_RECEIVED) {
        const data = {
            documentId: 'doc_poc_001',
            employeePhoneNumber: '+33612345678',
            documentType: 'absence_justification',
            fileName: 'justificatif-absence-poc.pdf',
            mimeType: 'application/pdf',
            fileSizeBytes: 245760,
            mediaId: 'media_poc_001',
            mediaUrl: 'https://api.testbed.whatspoint.com/api/files/signed/poc-document-token',
            mediaUrlExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        };

        return {
            eventId: createWebhookEventId(params.eventType, params.tenantId || undefined, data),
            event: params.eventType,
            timestamp: params.timestamp,
            tenantId: params.tenantId || undefined,
            data
        };
    }

    if (params.eventType === WEBHOOK_EVENTS.EMPLOYEE_SECURE_LINK_REQUESTED) {
        const data = {
            employeeRef: 'emp_poc_001',
            employeePhoneNumber: '+33612345678',
            purpose: 'PROFILE_UPDATE',
            deliveryChannel: 'whatsapp',
            secureLink: 'https://testbed.fr.paie.kalldy.com/pwa/secure-intake/poc-token',
            secureLinkExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            sensitiveDataInWhatsApp: false,
            messageTemplate: {
                name: 'kalldy_secure_pwa_relaunch_fr',
                language: 'fr',
                variables: {
                    firstName: 'Camille',
                    expiresInMinutes: 30
                }
            }
        };

        return {
            eventId: createWebhookEventId(params.eventType, params.tenantId || undefined, data),
            event: params.eventType,
            timestamp: params.timestamp,
            tenantId: params.tenantId || undefined,
            data
        };
    }

    if (params.eventType === WEBHOOK_EVENTS.MESSAGE_STATUS_UPDATED) {
        const status = params.messageStatus || 'delivered';
        const messageId = `wp_msg_poc_${status}`;
        const data = {
            messageId,
            providerMessageId: messageId,
            correlationId: 'wp_evt_secure_link_poc',
            employeePhoneNumber: '+33612345678',
            templateId: 'whatspoint_pwa_secure_link_fr',
            status,
            statusAt: params.timestamp
        };

        const eventId = createWebhookEventId(params.eventType, params.tenantId || undefined, data);
        return {
            eventId,
            event: params.eventType,
            timestamp: params.timestamp,
            tenantId: params.tenantId || undefined,
            data: {
                ...data,
                correlationId: eventId
            }
        };
    }

    const data = {
        message: 'This is a test webhook from WhatsPoint',
        webhookId: params.webhookId,
        webhookName: params.webhookName
    };

    return {
        eventId: createWebhookEventId(params.eventType, params.tenantId || undefined, {
            webhookId: params.webhookId,
            webhookName: params.webhookName
        }),
        event: params.eventType,
        timestamp: params.timestamp,
        tenantId: params.tenantId || undefined,
        data
    };
}

async function recordTestWebhookDelivery(params: {
    webhook: { id: string };
    eventType: TestWebhookEventType;
    payload: ReturnType<typeof buildTestWebhookPayload>;
    statusCode?: number | null;
    responseBody?: string | null;
    error?: string | null;
    duration: number;
}): Promise<void> {
    const failed = Boolean(params.error);

    await prisma.webhookConfig.update({
        where: { id: params.webhook.id },
        data: {
            lastTriggeredAt: new Date(),
            ...(failed
                ? { failureCount: { increment: 1 } }
                : { successCount: { increment: 1 } }
            )
        }
    });

    await prisma.webhookLog.create({
        data: {
            webhookId: params.webhook.id,
            eventType: params.eventType,
            payload: redactWebhookPayloadForAudit(params.payload) as any,
            statusCode: params.statusCode ?? null,
            responseBody: params.responseBody ? sanitizeLogText(params.responseBody).substring(0, 2000) : null,
            error: params.error ? sanitizeLogText(params.error) : null,
            duration: params.duration,
            status: failed ? 'FAILED' : 'SUCCESS',
            retryCount: 0,
            nextRetryAt: null
        } as any
    });
}

/**
 * Test a webhook configuration by sending a test event
 */
export async function testWebhook(
    webhookId: string,
    options: TestWebhookOptions = {}
): Promise<{ success: boolean; error?: string; statusCode?: number }> {
    const webhook = await prisma.webhookConfig.findUnique({
        where: { id: webhookId }
    });

    if (!webhook) {
        return { success: false, error: 'Webhook not found' };
    }

    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const eventType = options.eventType || 'test';
    const payload = buildTestWebhookPayload({
        eventType,
        timestamp,
        tenantId: webhook.tenantId,
        webhookId: webhook.id,
        webhookName: webhook.name,
        messageStatus: options.messageStatus
    });

    const payloadString = JSON.stringify(payload);
    const headers = buildWebhookHeaders({
        event: eventType,
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
        const responseBody = await response.text().catch(() => '');

        if (response.ok) {
            await recordTestWebhookDelivery({
                webhook,
                eventType,
                payload,
                statusCode: response.status,
                responseBody,
                duration
            });

            console.log(`✅ Test webhook to ${webhook.name} succeeded in ${duration}ms`);
            return { success: true, statusCode: response.status };
        } else {
            const error = `HTTP ${response.status}: ${responseBody.substring(0, 200)}`;
            await recordTestWebhookDelivery({
                webhook,
                eventType,
                payload,
                statusCode: response.status,
                responseBody,
                error,
                duration
            });

            return {
                success: false,
                error,
                statusCode: response.status
            };
        }
    } catch (err: any) {
        const error = err.message || 'Unknown error';
        await recordTestWebhookDelivery({
            webhook,
            eventType,
            payload,
            error,
            duration: Date.now() - startTime
        });

        return { success: false, error };
    }
}

export async function replayWebhookDelivery(
    webhookId: string,
    logId: string
): Promise<{ success: boolean; error?: string; statusCode?: number; eventId?: string | null; eventType?: string }> {
    const sourceLog = await prisma.webhookLog.findUnique({
        where: { id: logId },
        include: { webhook: true }
    });

    if (!sourceLog || sourceLog.webhookId !== webhookId) {
        return { success: false, error: 'Log webhook introuvable' };
    }

    if (!['PENDING', 'FAILED'].includes(sourceLog.status)) {
        return { success: false, error: 'Seuls les webhooks en échec ou en retry peuvent être rejoués' };
    }

    const webhook = sourceLog.webhook;
    if (!webhook || !webhook.isActive) {
        return { success: false, error: 'Webhook inactif ou supprimé' };
    }

    const payload = sourceLog.payload as Record<string, any>;
    const eventId = typeof payload?.eventId === 'string' ? payload.eventId : null;
    if (!payload || typeof payload !== 'object' || !eventId || containsRedactedValue(payload)) {
        return {
            success: false,
            error: 'Payload non rejouable: la charge utile complète n’est plus disponible'
        };
    }

    const payloadString = JSON.stringify(payload);
    const replayTimestamp = new Date().toISOString();
    const headers = buildWebhookHeaders({
        event: sourceLog.eventType as WebhookEventType,
        eventId,
        timestamp: replayTimestamp,
        userAgent: 'WhatsPoint-Webhook-Replay/1.0'
    });
    Object.assign(headers, normalizeCustomHeaders(webhook.headers));
    applyWebhookSignature(headers, payloadString, webhook.secret);

    const startTime = Date.now();
    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let error: string | null = null;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        let response: Response;
        try {
            response = await fetch(webhook.url, {
                method: webhook.httpMethod || 'POST',
                headers,
                body: payloadString,
                signal: controller.signal
            });

            statusCode = response.status;
            responseBody = await response.text().catch(() => null);
        } finally {
            clearTimeout(timeout);
        }

        if (!response.ok) {
            error = `HTTP ${statusCode}: ${responseBody?.substring(0, 200) || 'No response body'}`;
        }
    } catch (err: any) {
        error = err.message || 'Unknown error';
    }

    const duration = Date.now() - startTime;
    const success = !error;

    await prisma.webhookConfig.update({
        where: { id: webhook.id },
        data: {
            lastTriggeredAt: new Date(),
            ...(success
                ? { successCount: { increment: 1 } }
                : { failureCount: { increment: 1 } }
            )
        }
    });

    if (success && sourceLog.status === 'PENDING') {
        await prisma.webhookLog.update({
            where: { id: sourceLog.id },
            data: {
                status: 'SUCCESS',
                nextRetryAt: null,
                error: null,
                statusCode,
                responseBody: responseBody ? sanitizeLogText(responseBody).substring(0, 2000) : null
            } as any
        });
    }

    const auditPayload = {
        ...payload,
        replay: {
            sourceLogId: sourceLog.id,
            replayedAt: replayTimestamp
        }
    };

    await prisma.webhookLog.create({
        data: {
            webhookId: webhook.id,
            eventType: sourceLog.eventType,
            payload: redactWebhookPayloadForAudit(auditPayload) as any,
            statusCode,
            responseBody: responseBody ? sanitizeLogText(responseBody).substring(0, 2000) : null,
            error: error ? sanitizeLogText(error) : null,
            duration,
            status: success ? 'SUCCESS' : 'FAILED',
            retryCount: 0,
            nextRetryAt: null
        } as any
    });

    return {
        success,
        ...(error ? { error: sanitizeLogText(error) } : {}),
        ...(statusCode ? { statusCode } : {}),
        eventId,
        eventType: sourceLog.eventType
    };
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

            Object.assign(headers, normalizeCustomHeaders(config.headers));
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
                    ...(newStatus === 'SUCCESS' || newStatus === 'FAILED'
                        ? { payload: redactWebhookPayloadForAudit(payload) as any }
                        : {}),
                    error: error ? sanitizeLogText(error) : (log.error as string), // keep last error if needed
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
