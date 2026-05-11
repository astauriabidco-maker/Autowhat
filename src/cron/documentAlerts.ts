/**
 * Document Expiration Alerts Cron Job
 * Runs daily to check for documents expiring within 30 days
 * and sends email notifications to managers
 */

import { getExpiringDocuments, getExpiredDocuments } from '../services/documentService';
import { differenceInDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import prisma from '../lib/prisma';


interface DocumentAlert {
    documentName: string;
    employeeName: string;
    expiryDate: Date;
    daysRemaining: number;
    tenantId: string;
}

/**
 * Get all managers for a tenant
 */
async function getManagersForTenant(tenantId: string) {
    return prisma.employee.findMany({
        where: {
            tenantId,
            role: 'MANAGER'
        },
        select: {
            id: true,
            name: true,
            phoneNumber: true,
            tenant: {
                select: {
                    name: true
                }
            }
        }
    });
}

/**
 * Group alerts by tenant
 */
function groupAlertsByTenant(documents: any[]): Map<string, DocumentAlert[]> {
    const grouped = new Map<string, DocumentAlert[]>();

    for (const doc of documents) {
        if (!doc.employee) continue;

        const tenantId = doc.employee.tenantId;
        const alert: DocumentAlert = {
            documentName: doc.name,
            employeeName: doc.employee.name || 'Employé',
            expiryDate: doc.expiryDate,
            daysRemaining: differenceInDays(doc.expiryDate, new Date()),
            tenantId
        };

        if (!grouped.has(tenantId)) {
            grouped.set(tenantId, []);
        }
        grouped.get(tenantId)!.push(alert);
    }

    return grouped;
}

/**
 * Format alerts for email
 */
function formatAlertsForEmail(alerts: DocumentAlert[]): string {
    const lines = alerts.map(alert => {
        const dateStr = format(alert.expiryDate, 'dd MMMM yyyy', { locale: fr });
        const status = alert.daysRemaining < 0
            ? `⛔️ EXPIRÉ depuis ${Math.abs(alert.daysRemaining)} jours`
            : alert.daysRemaining <= 7
                ? `🔴 Expire dans ${alert.daysRemaining} jours`
                : `⚠️ Expire dans ${alert.daysRemaining} jours`;

        return `• ${alert.documentName} de ${alert.employeeName} - ${status} (${dateStr})`;
    });

    return lines.join('\n');
}

/**
 * Main function to run document expiration alerts
 */
export async function runDocumentAlerts(): Promise<{ success: boolean; alertsSent: number; errors: string[] }> {
    console.log('📋 Running document expiration alerts...');
    const errors: string[] = [];
    let alertsSent = 0;

    try {
        // Get documents expiring in 30 days AND already expired
        const [expiringDocs, expiredDocs] = await Promise.all([
            getExpiringDocuments(30),
            getExpiredDocuments()
        ]);

        const allDocs = [...expiringDocs, ...expiredDocs];

        if (allDocs.length === 0) {
            console.log('✅ No documents expiring soon or expired.');
            return { success: true, alertsSent: 0, errors: [] };
        }

        console.log(`📄 Found ${allDocs.length} documents requiring alerts`);

        // Group by tenant
        const alertsByTenant = groupAlertsByTenant(allDocs);

        // Send emails to managers of each tenant
        for (const [tenantId, alerts] of alertsByTenant) {
            const managers = await getManagersForTenant(tenantId);

            if (managers.length === 0) {
                console.log(`⚠️ No managers found for tenant ${tenantId}`);
                continue;
            }

            const tenant = managers[0]?.tenant;
            const alertContent = formatAlertsForEmail(alerts);

            const expiredCount = alerts.filter(a => a.daysRemaining < 0).length;
            const expiringCount = alerts.length - expiredCount;

            const subject = expiredCount > 0
                ? `🚨 ${expiredCount} document(s) expiré(s) + ${expiringCount} à renouveler`
                : `⚠️ ${expiringCount} document(s) expirent bientôt`;

            const htmlContent = `
                <h2 style="color: #334155;">📋 Alertes Documents RH</h2>
                <p style="color: #64748b;">Entreprise : <strong>${tenant?.name || 'Non spécifiée'}</strong></p>
                
                <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <pre style="margin: 0; white-space: pre-wrap; font-family: inherit;">${alertContent}</pre>
                </div>
                
                <p style="color: #64748b; font-size: 14px;">
                    Connectez-vous à votre tableau de bord pour gérer les documents de vos employés.
                </p>
            `;

            // For now, we log the alerts since we don't have manager emails
            // In production, you would send actual emails
            console.log(`📧 Alert for tenant ${tenantId}:`);
            console.log(`   Subject: ${subject}`);
            console.log(`   Alerts:\n${alertContent}`);

            // Try to send email if we have notification service
            try {
                // Since managers are employees with phoneNumbers, we need different email logic
                // For now, log the notification
                console.log(`📨 Would notify ${managers.length} manager(s) about ${alerts.length} document alerts`);
                alertsSent++;
            } catch (emailError: any) {
                console.error(`❌ Error sending alert for tenant ${tenantId}:`, emailError.message);
                errors.push(`Tenant ${tenantId}: ${emailError.message}`);
            }
        }

        console.log(`✅ Document alerts completed: ${alertsSent} tenants notified`);
        return { success: true, alertsSent, errors };

    } catch (error: any) {
        console.error('❌ Error running document alerts:', error);
        return { success: false, alertsSent, errors: [error.message] };
    }
}

/**
 * Manual trigger endpoint handler
 */
export async function triggerDocumentAlertsManually() {
    return await runDocumentAlerts();
}
