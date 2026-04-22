import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { sendEmail } from '../services/emailService';

const prisma = new PrismaClient();

/**
 * Remplace les variables dans un template
 */
function replaceVariables(template: string, data: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
    }
    return result;
}

/**
 * Exécute une règle d'automatisation
 */
async function executeRule(rule: any): Promise<void> {
    console.log(`[Automation] Executing rule: ${rule.name}`);

    const now = new Date();
    let leads: any[] = [];

    try {
        // Récupérer les leads selon le trigger
        switch (rule.trigger) {
            case 'DAYS_SINCE_SIGNUP': {
                const targetDate = new Date(now.getTime() - rule.triggerValue * 24 * 60 * 60 * 1000);
                const dayStart = new Date(targetDate);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(targetDate);
                dayEnd.setHours(23, 59, 59, 999);

                leads = await prisma.tenant.findMany({
                    where: {
                        createdAt: {
                            gte: dayStart,
                            lte: dayEnd
                        },
                        subscriptionStatus: { not: 'active' }
                    },
                    include: {
                        employees: {
                            where: { role: 'MANAGER' },
                            take: 1
                        }
                    }
                });
                break;
            }

            case 'TRIAL_EXPIRES_IN': {
                const targetDate = new Date(now.getTime() + rule.triggerValue * 24 * 60 * 60 * 1000);
                const dayStart = new Date(targetDate);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(targetDate);
                dayEnd.setHours(23, 59, 59, 999);

                leads = await prisma.tenant.findMany({
                    where: {
                        trialEndsAt: {
                            gte: dayStart,
                            lte: dayEnd
                        },
                        subscriptionStatus: { not: 'active' }
                    },
                    include: {
                        employees: {
                            where: { role: 'MANAGER' },
                            take: 1
                        }
                    }
                });
                break;
            }

            case 'TRIAL_EXPIRED_DAYS': {
                const targetDate = new Date(now.getTime() - rule.triggerValue * 24 * 60 * 60 * 1000);
                const dayStart = new Date(targetDate);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(targetDate);
                dayEnd.setHours(23, 59, 59, 999);

                leads = await prisma.tenant.findMany({
                    where: {
                        trialEndsAt: {
                            gte: dayStart,
                            lte: dayEnd
                        },
                        subscriptionStatus: { not: 'active' }
                    },
                    include: {
                        employees: {
                            where: { role: 'MANAGER' },
                            take: 1
                        }
                    }
                });
                break;
            }

            case 'NO_ACTIVITY_DAYS': {
                const targetDate = new Date(now.getTime() - rule.triggerValue * 24 * 60 * 60 * 1000);

                leads = await prisma.tenant.findMany({
                    where: {
                        OR: [
                            { lastLoginAt: { lt: targetDate } },
                            { lastLoginAt: null }
                        ],
                        subscriptionStatus: { not: 'active' }
                    },
                    include: {
                        employees: {
                            where: { role: 'MANAGER' },
                            take: 1
                        }
                    }
                });
                break;
            }

            case 'NO_SUBSCRIPTION': {
                const targetDate = new Date(now.getTime() - rule.triggerValue * 24 * 60 * 60 * 1000);
                const dayStart = new Date(targetDate);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(targetDate);
                dayEnd.setHours(23, 59, 59, 999);

                leads = await prisma.tenant.findMany({
                    where: {
                        createdAt: {
                            gte: dayStart,
                            lte: dayEnd
                        },
                        subscriptionStatus: null
                    },
                    include: {
                        employees: {
                            where: { role: 'MANAGER' },
                            take: 1
                        }
                    }
                });
                break;
            }
        }

        console.log(`[Automation] Found ${leads.length} leads for rule: ${rule.name}`);

        // Envoyer les messages
        for (const lead of leads) {
            const admin = lead.employees?.[0];
            if (!admin) continue;

            const email = admin.phoneNumber?.includes('@') ? admin.phoneNumber : null;
            if (!email && rule.channel === 'EMAIL') continue;

            const variables = {
                nom: admin.name || '',
                entreprise: lead.name || '',
                email: email || '',
                daysLeft: lead.trialEndsAt
                    ? Math.max(0, Math.ceil((new Date(lead.trialEndsAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))).toString()
                    : '0',
                trialEndDate: lead.trialEndsAt
                    ? new Date(lead.trialEndsAt).toLocaleDateString('fr-FR')
                    : '',
                loginUrl: process.env.FRONTEND_URL || 'https://app.whatspoint.app'
            };

            try {
                if (rule.channel === 'EMAIL' && email) {
                    const subject = replaceVariables(rule.templateSubject || '', variables);
                    const body = replaceVariables(rule.templateBody, variables);

                    await sendEmail({
                        to: email,
                        subject,
                        html: body.replace(/\n/g, '<br>')
                    });

                    // Log success
                    await prisma.automationExecution.create({
                        data: {
                            ruleId: rule.id,
                            tenantId: lead.id,
                            recipient: email,
                            status: 'SUCCESS'
                        }
                    });

                    // Add note
                    await prisma.leadNote.create({
                        data: {
                            tenantId: lead.id,
                            content: `🤖 [Auto] ${rule.name}`,
                            createdBy: 'system'
                        }
                    });
                }
            } catch (error: any) {
                console.error(`[Automation] Error sending to ${email}:`, error.message);
                await prisma.automationExecution.create({
                    data: {
                        ruleId: rule.id,
                        tenantId: lead.id,
                        recipient: email || 'unknown',
                        status: 'FAILED',
                        error: error.message
                    }
                });
            }
        }

        // Update lastExecutedAt
        await prisma.automationRule.update({
            where: { id: rule.id },
            data: { lastExecutedAt: now }
        });

    } catch (error: any) {
        console.error(`[Automation] Error executing rule ${rule.name}:`, error);
    }
}

/**
 * Exécute toutes les règles actives
 */
async function runAutomations(): Promise<void> {
    console.log('[Automation] Starting automation run...');

    try {
        const rules = await prisma.automationRule.findMany({
            where: { isActive: true }
        });

        console.log(`[Automation] Found ${rules.length} active rules`);

        for (const rule of rules) {
            await executeRule(rule);
        }

        console.log('[Automation] Automation run complete');
    } catch (error) {
        console.error('[Automation] Error running automations:', error);
    }
}

/**
 * Démarre le CRON job pour les automatisations
 */
export function startSalesAutomation(): void {
    // Exécuter tous les jours à 10h00 (heure de Paris)
    cron.schedule('0 10 * * *', () => {
        runAutomations();
    }, { timezone: 'Europe/Paris' });

    console.log('[Automation] CRON job scheduled for 10:00 AM daily (Paris time)');
}

/**
 * Exécution manuelle pour tests
 */
export async function runManualAutomation(): Promise<void> {
    await runAutomations();
}
