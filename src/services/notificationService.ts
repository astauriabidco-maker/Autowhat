import { PrismaClient } from '@prisma/client';
import { sendMessage } from './whatsappService';

const prisma = new PrismaClient();

export type NotificationType = 'LATE' | 'ABSENCE' | 'GEOFENCE' | 'EXPENSE';

interface NotifyManagerParams {
    managerId: string;
    tenantId: string;
    type: NotificationType;
    title: string;
    message: string;
    employeeId?: string;
}

/**
 * Get notification emoji based on type
 */
const getNotificationEmoji = (type: NotificationType): string => {
    const emojis: Record<NotificationType, string> = {
        LATE: '⏰',
        ABSENCE: '🚫',
        GEOFENCE: '📍',
        EXPENSE: '💰'
    };
    return emojis[type] || '🔔';
};

/**
 * Check if a notification of this type for this employee already exists today
 * Used for anti-spam (max 1 notification per employee per type per day)
 */
const hasNotificationToday = async (
    managerId: string,
    type: NotificationType,
    employeeId: string
): Promise<boolean> => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const existing = await prisma.notification.findFirst({
        where: {
            managerId,
            type,
            employeeId,
            createdAt: {
                gte: todayStart,
                lte: todayEnd
            }
        }
    });

    return !!existing;
};

/**
 * Notify a manager with alert (DB + WhatsApp)
 * 
 * @param params - Notification parameters
 * @returns Created notification or null if anti-spam blocked
 */
export const notifyManager = async (params: NotifyManagerParams): Promise<any> => {
    const { managerId, tenantId, type, title, message, employeeId } = params;

    try {
        // Anti-spam check: 1 notification per employee per type per day
        if (employeeId && (type === 'LATE' || type === 'ABSENCE')) {
            const alreadyNotified = await hasNotificationToday(managerId, type, employeeId);
            if (alreadyNotified) {
                console.log(`🔇 Anti-spam: Manager already notified about ${type} for employee ${employeeId} today`);
                return null;
            }
        }

        // Action 1: Create notification in database
        const notification = await prisma.notification.create({
            data: {
                managerId,
                tenantId,
                type,
                title,
                message,
                employeeId
            }
        });

        console.log(`🔔 Notification created: [${type}] ${title}`);

        // Action 2: Send WhatsApp message to manager
        const manager = await prisma.employee.findUnique({
            where: { id: managerId },
            select: { phoneNumber: true, name: true }
        });

        if (manager?.phoneNumber) {
            const emoji = getNotificationEmoji(type);
            const whatsappMessage =
                `${emoji} *Alerte ${type}*\n\n` +
                `${message}\n\n` +
                `_Connectez-vous au dashboard pour gérer._`;

            await sendMessage(manager.phoneNumber, whatsappMessage);
            console.log(`📱 WhatsApp sent to ${manager.name || manager.phoneNumber}`);
        }

        return notification;

    } catch (error) {
        console.error('❌ Error in notifyManager:', error);
        throw error;
    }
};

/**
 * Notify all managers of a tenant
 */
export const notifyAllManagers = async (
    tenantId: string,
    type: NotificationType,
    title: string,
    message: string,
    employeeId?: string
): Promise<void> => {
    // Find all managers for this tenant
    const managers = await prisma.employee.findMany({
        where: {
            tenantId,
            role: 'MANAGER'
        },
        select: { id: true }
    });

    console.log(`📢 Notifying ${managers.length} managers for tenant ${tenantId}`);

    // Notify each manager
    for (const manager of managers) {
        await notifyManager({
            managerId: manager.id,
            tenantId,
            type,
            title,
            message,
            employeeId
        });
    }
};

/**
 * Get unread notification count for a manager
 */
export const getUnreadCount = async (managerId: string): Promise<number> => {
    return prisma.notification.count({
        where: {
            managerId,
            isRead: false
        }
    });
};
