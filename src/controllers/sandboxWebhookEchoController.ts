import crypto from 'crypto';
import { Request, Response } from 'express';
import prisma from '../lib/prisma';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function isSandboxEchoEnabled() {
    if (process.env.ENABLE_SANDBOX_WEBHOOK_ECHO === 'true') return true;
    if (process.env.NODE_ENV !== 'production') return true;

    const urls = [
        process.env.FRONTEND_URL,
        process.env.BACKEND_URL,
        process.env.CORS_ORIGINS
    ].filter(Boolean).join(',');

    return urls.includes('testbed.whatspoint.com');
}

function normalizePathname(url: string) {
    try {
        return new URL(url).pathname.replace(/\/$/, '');
    } catch {
        return '';
    }
}

function timingSafeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function signatureFor(payload: string, secret: string) {
    return `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
}

function getRawPayload(req: Request) {
    const rawBody = (req as any).rawBody;
    if (Buffer.isBuffer(rawBody)) {
        return rawBody.toString('utf8');
    }
    return JSON.stringify(req.body || {});
}

function getBaseUrl(req: Request) {
    const proto = req.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol;
    return `${proto}://${req.get('host')}`;
}

export const receiveSandboxEchoWebhook = async (req: Request, res: Response): Promise<any> => {
    if (!isSandboxEchoEnabled()) {
        return res.status(404).json({ error: 'Not found' });
    }

    const payload = req.body || {};
    const event = String(req.get('X-WhatsPoint-Event') || payload.event || '');
    const eventId = String(req.get('X-WhatsPoint-Event-Id') || payload.eventId || '');
    const timestamp = String(req.get('X-WhatsPoint-Timestamp') || payload.timestamp || '');
    const signature = String(req.get('X-WhatsPoint-Signature') || '');

    if (!event || !eventId || !timestamp || !signature) {
        return res.status(400).json({
            success: false,
            error: 'MISSING_WEBHOOK_HEADERS'
        });
    }

    const timestampMs = Date.parse(timestamp);
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > FIVE_MINUTES_MS) {
        return res.status(401).json({
            success: false,
            error: 'STALE_WEBHOOK_TIMESTAMP'
        });
    }

    if (payload.event && payload.event !== event) {
        return res.status(400).json({ success: false, error: 'EVENT_HEADER_MISMATCH' });
    }
    if (payload.eventId && payload.eventId !== eventId) {
        return res.status(400).json({ success: false, error: 'EVENT_ID_HEADER_MISMATCH' });
    }

    const requestPath = normalizePathname(`${getBaseUrl(req)}${req.originalUrl}`);
    const candidateWebhooks = await prisma.webhookConfig.findMany({
        where: {
            isActive: true,
            events: { has: event }
        },
        select: {
            id: true,
            name: true,
            url: true,
            tenantId: true,
            secret: true
        }
    });

    const matchingWebhooks = candidateWebhooks.filter(webhook => normalizePathname(webhook.url) === requestPath);
    const payloadString = getRawPayload(req);
    const matchingWebhook = matchingWebhooks.find(webhook =>
        webhook.secret && timingSafeEqual(signatureFor(payloadString, webhook.secret), signature)
    );

    if (!matchingWebhook) {
        return res.status(401).json({
            success: false,
            error: 'INVALID_WEBHOOK_SIGNATURE'
        });
    }

    return res.status(200).json({
        success: true,
        receiver: 'whatspoint.sandbox.echo',
        webhookId: matchingWebhook.id,
        webhookName: matchingWebhook.name,
        tenantId: payload.tenantId || matchingWebhook.tenantId || null,
        event,
        eventId,
        receivedAt: new Date().toISOString(),
        payloadKeys: payload.data && typeof payload.data === 'object' ? Object.keys(payload.data).sort() : []
    });
};
