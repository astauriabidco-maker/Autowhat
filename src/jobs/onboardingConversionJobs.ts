import cron from 'node-cron';
import prisma from '../lib/prisma';
import { createManagerMagicLoginLink } from '../services/managerMagicLoginService';
import { sendMessage } from '../services/whatsappService';
import { getCredentialsForTenant } from '../services/whatsappConfigService';

const LINK_REMINDER_DELAY_MS = 20 * 60 * 1000;
const INVITE_REMINDER_DELAY_MS = 30 * 60 * 1000;
const EMPLOYEE_ACTIVATION_REMINDER_DELAY_MS = 2 * 60 * 60 * 1000;
const SITE_GPS_APPROVAL_REMINDER_DELAY_MS = 60 * 60 * 1000;
const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

function cleanWhatsAppNumber(phoneNumber: string): string {
    return phoneNumber.replace(/\D/g, '');
}

async function hasEvent(tenantId: string, type: string, employeeId?: string): Promise<boolean> {
    const event = await prisma.onboardingEvent.findFirst({
        where: {
            tenantId,
            type,
            ...(employeeId ? { employeeId } : {})
        },
        select: { id: true }
    });

    return Boolean(event);
}

function jsonObject(value: unknown): Record<string, any> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, any>;
}

async function hasGpsApprovalReminderAfter(
    tenantId: string,
    managerId: string,
    siteId: string | null,
    sharedAt: Date
): Promise<boolean> {
    const reminders = await prisma.onboardingEvent.findMany({
        where: {
            tenantId,
            employeeId: managerId,
            type: 'SITE_GPS_APPROVAL_REMINDER_SENT',
            createdAt: { gte: sharedAt }
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { metadata: true }
    });

    return reminders.some(reminder => {
        const metadata = jsonObject(reminder.metadata);
        return !siteId || metadata.siteId === siteId;
    });
}

async function sendMagicLinkOpenReminders(now: Date): Promise<number> {
    const olderThan = new Date(now.getTime() - LINK_REMINDER_DELAY_MS);
    const since = new Date(now.getTime() - LOOKBACK_MS);

    const unopenedTokens = await prisma.managerMagicLoginToken.findMany({
        where: {
            createdAt: {
                gte: since,
                lte: olderThan
            },
            usedAt: null
        },
        take: 25,
        orderBy: { createdAt: 'asc' },
        include: {
            employee: {
                include: { tenant: true }
            }
        }
    });

    let sent = 0;

    for (const token of unopenedTokens) {
        const manager = token.employee;
        if (manager.role !== 'MANAGER' || manager.tenant.status === 'SUSPENDED') continue;

        const alreadyReachedDashboard = await hasEvent(manager.tenantId, 'MANAGER_DASHBOARD_REACHED', manager.id);
        const alreadyReminded = await hasEvent(manager.tenantId, 'MANAGER_MAGIC_LINK_REMINDER_SENT', manager.id);
        if (alreadyReachedDashboard || alreadyReminded) continue;

        const { url } = await createManagerMagicLoginLink(manager.id, { source: 'REMINDER_MAGIC_LINK' });
        await sendMessage(
            cleanWhatsAppNumber(manager.phoneNumber),
            `👋 Votre espace WhatsPoint est prêt.\n\n` +
            `Ouvrez votre dashboard manager ici :\n${url}\n\n` +
            `_Ce nouveau lien personnel expire dans 15 minutes._`
        );

        await prisma.onboardingEvent.create({
            data: {
                tenantId: manager.tenantId,
                employeeId: manager.id,
                type: 'MANAGER_MAGIC_LINK_REMINDER_SENT',
                metadata: {
                    source: 'CRON',
                    originalTokenId: token.id
                }
            }
        });
        sent += 1;
    }

    return sent;
}

async function sendFirstEmployeeInviteReminders(now: Date): Promise<number> {
    const olderThan = new Date(now.getTime() - INVITE_REMINDER_DELAY_MS);
    const since = new Date(now.getTime() - LOOKBACK_MS);

    const tenants = await prisma.tenant.findMany({
        where: {
            createdAt: {
                gte: since,
                lte: olderThan
            },
            status: { not: 'SUSPENDED' }
        },
        take: 50,
        orderBy: { createdAt: 'asc' },
        include: {
            employees: {
                where: { role: { in: ['MANAGER', 'EMPLOYEE'] } },
                select: {
                    id: true,
                    role: true,
                    name: true,
                    phoneNumber: true,
                    hasCompletedOnboarding: true
                }
            }
        }
    });

    let sent = 0;

    for (const tenant of tenants) {
        const manager = tenant.employees.find(e => e.role === 'MANAGER');
        const hasEmployee = tenant.employees.some(e => e.role === 'EMPLOYEE');
        if (!manager || hasEmployee) continue;

        const reachedDashboard = await hasEvent(tenant.id, 'MANAGER_DASHBOARD_REACHED', manager.id);
        const managerActivated = await hasEvent(tenant.id, 'MANAGER_ACTIVATED', manager.id);
        const alreadyReminded = await hasEvent(tenant.id, 'EMPLOYEE_INVITE_REMINDER_SENT', manager.id);
        if ((!reachedDashboard && !managerActivated) || alreadyReminded) continue;

        const { url } = await createManagerMagicLoginLink(manager.id, {
            redirectTo: '/employees',
            source: 'REMINDER_EMPLOYEE_INVITE'
        });

        await sendMessage(
            cleanWhatsAppNumber(manager.phoneNumber),
            `Vous êtes à une étape du premier résultat WhatsPoint.\n\n` +
            `Invitez votre premier collaborateur ici :\n${url}\n\n` +
            `Vous pouvez aussi répondre *Inviter employé* dans WhatsApp.`
        );

        await prisma.onboardingEvent.create({
            data: {
                tenantId: tenant.id,
                employeeId: manager.id,
                type: 'EMPLOYEE_INVITE_REMINDER_SENT',
                metadata: {
                    source: 'CRON'
                }
            }
        });
        sent += 1;
    }

    return sent;
}

async function sendFirstEmployeeActivationReminders(now: Date): Promise<number> {
    const olderThan = new Date(now.getTime() - EMPLOYEE_ACTIVATION_REMINDER_DELAY_MS);
    const since = new Date(now.getTime() - LOOKBACK_MS);

    const tenants = await prisma.tenant.findMany({
        where: {
            status: { not: 'SUSPENDED' },
            employees: {
                some: {
                    role: 'EMPLOYEE',
                    hasCompletedOnboarding: false,
                    createdAt: {
                        gte: since,
                        lte: olderThan
                    }
                }
            }
        },
        take: 50,
        orderBy: { createdAt: 'asc' },
        include: {
            employees: {
                where: { role: { in: ['MANAGER', 'EMPLOYEE'] } },
                orderBy: { createdAt: 'asc' },
                select: {
                    id: true,
                    role: true,
                    name: true,
                    phoneNumber: true,
                    hasCompletedOnboarding: true,
                    createdAt: true
                }
            }
        }
    });

    let sent = 0;

    for (const tenant of tenants) {
        const manager = tenant.employees.find(e => e.role === 'MANAGER');
        const firstPendingEmployee = tenant.employees.find(e =>
            e.role === 'EMPLOYEE' &&
            !e.hasCompletedOnboarding &&
            e.createdAt >= since &&
            e.createdAt <= olderThan
        );
        if (!manager || !firstPendingEmployee) continue;

        const employeeActivated = await hasEvent(tenant.id, 'EMPLOYEE_ACTIVATED', firstPendingEmployee.id);
        const alreadyReminded = await hasEvent(tenant.id, 'FIRST_EMPLOYEE_ACTIVATION_REMINDER_SENT', firstPendingEmployee.id);
        if (employeeActivated || alreadyReminded) continue;

        const { url } = await createManagerMagicLoginLink(manager.id, {
            redirectTo: '/employees',
            source: 'REMINDER_EMPLOYEE_ACTIVATION'
        });

        await sendMessage(
            cleanWhatsAppNumber(manager.phoneNumber),
            `Votre premier collaborateur n'a pas encore activé WhatsPoint.\n\n` +
            `${firstPendingEmployee.name || 'Le collaborateur invité'} doit simplement répondre au message WhatsApp reçu pour activer son accès.\n\n` +
            `Vous pouvez suivre ou relancer l'invitation ici :\n${url}`
        );

        await prisma.onboardingEvent.create({
            data: {
                tenantId: tenant.id,
                employeeId: firstPendingEmployee.id,
                type: 'FIRST_EMPLOYEE_ACTIVATION_REMINDER_SENT',
                metadata: {
                    source: 'CRON',
                    managerId: manager.id
                }
            }
        });
        sent += 1;
    }

    return sent;
}

async function sendSiteGpsApprovalReminders(now: Date): Promise<number> {
    const olderThan = new Date(now.getTime() - SITE_GPS_APPROVAL_REMINDER_DELAY_MS);
    const since = new Date(now.getTime() - LOOKBACK_MS);

    const managers = await prisma.employee.findMany({
        where: {
            role: 'MANAGER',
            conversationState: 'WAITING_MANAGER_SITE_GPS_APPROVAL',
            tenant: { status: { not: 'SUSPENDED' } }
        },
        take: 50,
        orderBy: { updatedAt: 'asc' },
        include: { tenant: { select: { id: true, name: true, status: true } } }
    });

    let sent = 0;

    for (const manager of managers) {
        const data = jsonObject(manager.tempExpenseData);
        const sharedAt = data.sharedAt ? new Date(String(data.sharedAt)) : manager.updatedAt;
        if (Number.isNaN(sharedAt.getTime()) || sharedAt < since || sharedAt > olderThan) continue;

        const siteId = data.siteId ? String(data.siteId) : null;
        const alreadyReminded = await hasGpsApprovalReminderAfter(manager.tenantId, manager.id, siteId, sharedAt);
        if (alreadyReminded) continue;

        const siteName = data.siteName ? String(data.siteName) : 'le site concerné';
        const providerName = data.providerName || data.providerPhone || 'un collaborateur';
        const { url } = await createManagerMagicLoginLink(manager.id, {
            redirectTo: '/sites-gps',
            source: 'REMINDER_SITE_GPS_APPROVAL'
        });
        const credentials = await getCredentialsForTenant(manager.tenantId);

        await sendMessage(
            cleanWhatsAppNumber(manager.phoneNumber),
            `⏳ Une position GPS attend votre validation.\n\n` +
            `Site : *${siteName}*\n` +
            `Envoyée par : *${providerName}*\n\n` +
            `Validez, corrigez le pays ou refusez depuis le GPS Center :\n${url}`,
            credentials
        );

        await prisma.onboardingEvent.create({
            data: {
                tenantId: manager.tenantId,
                employeeId: manager.id,
                type: 'SITE_GPS_APPROVAL_REMINDER_SENT',
                metadata: {
                    source: 'CRON',
                    siteId,
                    siteName,
                    providerEmployeeId: data.providerEmployeeId || null,
                    sharedAt: sharedAt.toISOString(),
                    delayMinutes: Math.round(SITE_GPS_APPROVAL_REMINDER_DELAY_MS / 60000)
                }
            }
        });
        sent += 1;
    }

    return sent;
}

export async function runOnboardingConversionJobs(): Promise<{
    magicLinkReminders: number;
    employeeInviteReminders: number;
    employeeActivationReminders: number;
    siteGpsApprovalReminders: number;
}> {
    const now = new Date();
    console.log(`🧭 [Onboarding Conversion] Running check at ${now.toISOString()}`);

    const [magicLinkReminders, employeeInviteReminders, employeeActivationReminders, siteGpsApprovalReminders] = await Promise.all([
        sendMagicLinkOpenReminders(now),
        sendFirstEmployeeInviteReminders(now),
        sendFirstEmployeeActivationReminders(now),
        sendSiteGpsApprovalReminders(now)
    ]);

    console.log(
        `🧭 [Onboarding Conversion] Complete: ${magicLinkReminders} magic link reminder(s), ` +
        `${employeeInviteReminders} employee invite reminder(s), ` +
        `${employeeActivationReminders} employee activation reminder(s), ` +
        `${siteGpsApprovalReminders} site GPS approval reminder(s).`
    );

    return { magicLinkReminders, employeeInviteReminders, employeeActivationReminders, siteGpsApprovalReminders };
}

export function initOnboardingConversionJobs(): void {
    cron.schedule('*/15 * * * *', () => {
        runOnboardingConversionJobs().catch((err) =>
            console.error('❌ [Onboarding Conversion] Uncaught error:', err)
        );
    }, {
        timezone: 'Europe/Paris'
    });

    console.log('🧭 [Cron] Onboarding Conversion Job scheduled (every 15 min)');
}
