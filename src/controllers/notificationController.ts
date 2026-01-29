import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/notifications
 * List notifications for the connected manager
 */
export const getNotifications = async (req: Request, res: Response): Promise<any> => {
    try {
        const managerId = (req as any).user?.id;
        const tenantId = (req as any).user?.tenantId;

        if (!managerId || !tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const notifications = await prisma.notification.findMany({
            where: { managerId },
            orderBy: { createdAt: 'desc' },
            take: 50  // Limit to last 50 notifications
        });

        // Get unread count
        const unreadCount = await prisma.notification.count({
            where: { managerId, isRead: false }
        });

        return res.json({
            notifications,
            unreadCount
        });

    } catch (error) {
        console.error('❌ Error fetching notifications:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
export const markAsRead = async (req: Request, res: Response): Promise<any> => {
    try {
        const managerId = (req as any).user?.id;
        const id = req.params.id as string;

        if (!managerId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        // Verify ownership
        const notification = await prisma.notification.findFirst({
            where: { id, managerId }
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification non trouvée' });
        }

        // Update
        const updated = await prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });

        return res.json(updated);

    } catch (error) {
        console.error('❌ Error marking notification as read:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read for the manager
 */
export const markAllAsRead = async (req: Request, res: Response): Promise<any> => {
    try {
        const managerId = (req as any).user?.id;

        if (!managerId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const result = await prisma.notification.updateMany({
            where: { managerId, isRead: false },
            data: { isRead: true }
        });

        return res.json({
            success: true,
            updated: result.count
        });

    } catch (error) {
        console.error('❌ Error marking all as read:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * GET /api/notifications/unread-count
 * Get just the count of unread notifications (for polling)
 */
export const getUnreadCount = async (req: Request, res: Response): Promise<any> => {
    try {
        const managerId = (req as any).user?.id;

        if (!managerId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const count = await prisma.notification.count({
            where: { managerId, isRead: false }
        });

        return res.json({ count });

    } catch (error) {
        console.error('❌ Error getting unread count:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};
