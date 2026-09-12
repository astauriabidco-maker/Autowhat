import prisma from '../lib/prisma';
import { sendEmail } from './emailService';
import { getSystemNumberPoolHealth, NumberPoolHealth, NumberPoolHealthAlert } from './numberAllocationService';
import { getRedisConnection, isRedisEnabled } from './redisConnection';

let lastAlertFingerprint: string | null = null;
const DEFAULT_ALERT_TTL_SECONDS = 6 * 60 * 60;
const ALERT_FINGERPRINT_KEY = 'whatspoint:whatsapp-pool-health:last-fingerprint';
const UPDATE_FINGERPRINT_SCRIPT = `
local current = redis.call("GET", KEYS[1])
if current == ARGV[1] then
  return 0
end
redis.call("SET", KEYS[1], ARGV[1], "EX", ARGV[2])
return 1
`;

function alertTtlSeconds(): number {
    const raw = Number(process.env.WHATSAPP_POOL_ALERT_TTL_SECONDS);
    if (!Number.isFinite(raw) || raw < 60) return DEFAULT_ALERT_TTL_SECONDS;
    return Math.floor(raw);
}

function configuredRecipients(): string[] {
    return (process.env.WHATSAPP_POOL_ALERT_EMAILS || process.env.SUPERADMIN_ALERT_EMAILS || '')
        .split(',')
        .map(email => email.trim())
        .filter(Boolean);
}

async function resolveRecipients(): Promise<string[]> {
    const envRecipients = configuredRecipients();
    if (envRecipients.length > 0) return Array.from(new Set(envRecipients));

    const superAdmins = await prisma.superAdmin.findMany({
        select: { email: true },
        orderBy: { createdAt: 'asc' }
    });

    return Array.from(new Set(superAdmins.map(admin => admin.email).filter(Boolean)));
}

function alertFingerprint(alerts: NumberPoolHealthAlert[]): string {
    return alerts
        .map(alert => `${alert.severity}:${alert.kind}:${alert.countryCode || ''}:${alert.planScope || ''}:${alert.tenantId || ''}:${alert.numberId || ''}`)
        .sort()
        .join('|');
}

function alertText(alerts: NumberPoolHealthAlert[]): string {
    return alerts
        .map(alert => `- [${alert.severity.toUpperCase()}] ${alert.message}`)
        .join('\n');
}

function alertHtml(health: NumberPoolHealth): string {
    const rows = health.alerts.map(alert => `
        <tr>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-weight: 700; color: ${alert.severity === 'critical' ? '#b91c1c' : '#b45309'};">${alert.severity}</td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb;">${alert.message}</td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${[alert.countryCode, alert.planScope, alert.tenantName, alert.displayNumber].filter(Boolean).join(' / ')}</td>
        </tr>
    `).join('');

    return `
        <h2>Sante du pool WhatsApp</h2>
        <p>${health.summary.criticalAlerts} alerte(s) critique(s), ${health.summary.warningAlerts} warning(s).</p>
        <table style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 14px;">
            <thead>
                <tr>
                    <th style="text-align: left; padding: 8px 10px; border-bottom: 2px solid #d1d5db;">Niveau</th>
                    <th style="text-align: left; padding: 8px 10px; border-bottom: 2px solid #d1d5db;">Alerte</th>
                    <th style="text-align: left; padding: 8px 10px; border-bottom: 2px solid #d1d5db;">Contexte</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

async function shouldNotifyFingerprint(fingerprint: string, force: boolean): Promise<{ shouldNotify: boolean; backend: 'redis' | 'memory' }> {
    if (force) {
        lastAlertFingerprint = fingerprint;
        if (isRedisEnabled()) {
            try {
                await getRedisConnection().set(ALERT_FINGERPRINT_KEY, fingerprint, 'EX', alertTtlSeconds());
                return { shouldNotify: true, backend: 'redis' };
            } catch (error) {
                console.warn('[WhatsApp Pool Health] Redis forced fingerprint update failed, falling back to memory:', error);
            }
        }
        return { shouldNotify: true, backend: 'memory' };
    }

    if (isRedisEnabled()) {
        try {
            const updated = await getRedisConnection().eval(
                UPDATE_FINGERPRINT_SCRIPT,
                1,
                ALERT_FINGERPRINT_KEY,
                fingerprint,
                String(alertTtlSeconds())
            );
            lastAlertFingerprint = fingerprint;
            return { shouldNotify: Number(updated) === 1, backend: 'redis' };
        } catch (error) {
            console.warn('[WhatsApp Pool Health] Redis dedupe failed, falling back to memory:', error);
        }
    }

    if (fingerprint === lastAlertFingerprint) {
        return { shouldNotify: false, backend: 'memory' };
    }

    lastAlertFingerprint = fingerprint;
    return { shouldNotify: true, backend: 'memory' };
}

export async function runWhatsAppPoolHealthAlert(options: { force?: boolean } = {}): Promise<{
    success: boolean;
    alertsDetected: number;
    criticalAlerts: number;
    warningAlerts: number;
    notificationsSent: number;
    dedupeBackend?: 'redis' | 'memory';
    skippedReason?: string;
}> {
    const health = await getSystemNumberPoolHealth();

    if (health.alerts.length === 0) {
        lastAlertFingerprint = null;
        if (isRedisEnabled()) {
            try {
                await getRedisConnection().del(ALERT_FINGERPRINT_KEY);
            } catch (error) {
                console.warn('[WhatsApp Pool Health] Redis fingerprint reset failed:', error);
            }
        }
        return {
            success: true,
            alertsDetected: 0,
            criticalAlerts: 0,
            warningAlerts: 0,
            notificationsSent: 0,
            skippedReason: 'NO_ALERTS'
        };
    }

    const fingerprint = alertFingerprint(health.alerts);
    const dedupe = await shouldNotifyFingerprint(fingerprint, options.force === true);
    if (!dedupe.shouldNotify) {
        return {
            success: true,
            alertsDetected: health.summary.totalAlerts,
            criticalAlerts: health.summary.criticalAlerts,
            warningAlerts: health.summary.warningAlerts,
            notificationsSent: 0,
            dedupeBackend: dedupe.backend,
            skippedReason: 'UNCHANGED'
        };
    }

    const recipients = await resolveRecipients();
    if (recipients.length === 0) {
        lastAlertFingerprint = fingerprint;
        console.warn('[WhatsApp Pool Health] Alerts detected but no superadmin recipient configured.');
        console.warn(alertText(health.alerts));
        return {
            success: true,
            alertsDetected: health.summary.totalAlerts,
            criticalAlerts: health.summary.criticalAlerts,
            warningAlerts: health.summary.warningAlerts,
            notificationsSent: 0,
            dedupeBackend: dedupe.backend,
            skippedReason: 'NO_RECIPIENTS'
        };
    }

    const subject = health.summary.criticalAlerts > 0
        ? `[WhatsPoint] ${health.summary.criticalAlerts} alerte(s) critique(s) pool WhatsApp`
        : `[WhatsPoint] ${health.summary.warningAlerts} warning(s) pool WhatsApp`;

    let notificationsSent = 0;
    for (const recipient of recipients) {
        const sent = await sendEmail({
            to: recipient,
            subject,
            html: alertHtml(health),
            text: `Sante du pool WhatsApp\n\n${alertText(health.alerts)}`
        });
        if (sent) notificationsSent++;
    }

    lastAlertFingerprint = fingerprint;

    return {
        success: true,
        alertsDetected: health.summary.totalAlerts,
        criticalAlerts: health.summary.criticalAlerts,
        warningAlerts: health.summary.warningAlerts,
        notificationsSent,
        dedupeBackend: dedupe.backend
    };
}

export function resetWhatsAppPoolHealthAlertState() {
    lastAlertFingerprint = null;
}
