/**
 * Webhook Configuration Controller
 * CRUD operations for outgoing webhook configurations
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { WEBHOOK_EVENTS, testWebhook } from '../services/webhookService';

const prisma = new PrismaClient();

/**
 * GET /admin/webhooks
 * Get all webhook configurations (SuperAdmin: all, Manager: tenant-only)
 */
export const getWebhooks = async (req: Request, res: Response): Promise<any> => {
    try {
        const isSuperAdmin = !!(req as any).superAdminId;
        const tenantId = (req as any).tenantId;

        const webhooks = await prisma.webhookConfig.findMany({
            where: isSuperAdmin
                ? {} // SuperAdmin sees all
                : { tenantId }, // Manager sees only their tenant
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { logs: true } }
            }
        });

        return res.json(webhooks);
    } catch (error) {
        console.error('Error fetching webhooks:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * GET /admin/webhooks/:id
 * Get a single webhook with recent logs
 */
export const getWebhook = async (req: Request, res: Response): Promise<any> => {
    try {
        const id = req.params.id as string;

        const webhook = await prisma.webhookConfig.findUnique({
            where: { id },
            include: {
                logs: {
                    orderBy: { createdAt: 'desc' },
                    take: 50
                }
            }
        });

        if (!webhook) {
            return res.status(404).json({ error: 'Webhook not found' });
        }

        return res.json(webhook);
    } catch (error) {
        console.error('Error fetching webhook:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * POST /admin/webhooks
 * Create a new webhook configuration
 */
export const createWebhook = async (req: Request, res: Response): Promise<any> => {
    try {
        const { name, url, events, tenantId, generateSecret } = req.body;
        const isSuperAdmin = !!(req as any).superAdminId;

        // Validation
        if (!name || !url || !events || !Array.isArray(events)) {
            return res.status(400).json({ error: 'name, url, and events array are required' });
        }

        // Validate URL
        try {
            new URL(url);
        } catch {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        // Validate events
        const validEvents = Object.values(WEBHOOK_EVENTS);
        const invalidEvents = events.filter((e: string) => !validEvents.includes(e as any));
        if (invalidEvents.length > 0) {
            return res.status(400).json({
                error: `Invalid events: ${invalidEvents.join(', ')}`,
                validEvents
            });
        }

        // Generate secret if requested
        let secret: string | null = null;
        if (generateSecret) {
            secret = crypto.randomBytes(32).toString('hex');
        }

        const webhook = await prisma.webhookConfig.create({
            data: {
                name,
                url,
                secret,
                events,
                tenantId: isSuperAdmin ? (tenantId || null) : (req as any).tenantId,
                isActive: true
            }
        });

        console.log(`🔔 Webhook created: ${name} -> ${url}`);

        return res.status(201).json({
            ...webhook,
            // Only return the secret on creation
            secretPlaintext: secret
        });
    } catch (error) {
        console.error('Error creating webhook:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * PUT /admin/webhooks/:id
 * Update a webhook configuration
 */
export const updateWebhook = async (req: Request, res: Response): Promise<any> => {
    try {
        const id = req.params.id as string;
        const { name, url, events, isActive, regenerateSecret } = req.body;

        const existing = await prisma.webhookConfig.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Webhook not found' });
        }

        const updateData: any = {};

        if (name !== undefined) updateData.name = name;
        if (url !== undefined) {
            try {
                new URL(url);
                updateData.url = url;
            } catch {
                return res.status(400).json({ error: 'Invalid URL format' });
            }
        }
        if (events !== undefined) {
            const validEvents = Object.values(WEBHOOK_EVENTS);
            const invalidEvents = events.filter((e: string) => !validEvents.includes(e as any));
            if (invalidEvents.length > 0) {
                return res.status(400).json({ error: `Invalid events: ${invalidEvents.join(', ')}` });
            }
            updateData.events = events;
        }
        if (isActive !== undefined) updateData.isActive = isActive;

        // Regenerate secret if requested
        let newSecret: string | null = null;
        if (regenerateSecret) {
            newSecret = crypto.randomBytes(32).toString('hex');
            updateData.secret = newSecret;
        }

        const webhook = await prisma.webhookConfig.update({
            where: { id },
            data: updateData
        });

        console.log(`🔔 Webhook updated: ${webhook.name}`);

        return res.json({
            ...webhook,
            secretPlaintext: newSecret // Only if regenerated
        });
    } catch (error) {
        console.error('Error updating webhook:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * DELETE /admin/webhooks/:id
 * Delete a webhook configuration
 */
export const deleteWebhook = async (req: Request, res: Response): Promise<any> => {
    try {
        const id = req.params.id as string;

        const existing = await prisma.webhookConfig.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Webhook not found' });
        }

        await prisma.webhookConfig.delete({ where: { id } });

        console.log(`🔔 Webhook deleted: ${existing.name}`);

        return res.json({ success: true, message: 'Webhook deleted' });
    } catch (error) {
        console.error('Error deleting webhook:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * POST /admin/webhooks/:id/test
 * Send a test payload to a webhook
 */
export const testWebhookEndpoint = async (req: Request, res: Response): Promise<any> => {
    try {
        const id = req.params.id as string;

        const result = await testWebhook(id);

        if (result.success) {
            return res.json({
                success: true,
                message: 'Test webhook sent successfully',
                statusCode: result.statusCode
            });
        } else {
            return res.status(400).json({
                success: false,
                error: result.error,
                statusCode: result.statusCode
            });
        }
    } catch (error) {
        console.error('Error testing webhook:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * GET /admin/webhooks/events
 * Get list of available webhook events
 */
export const getWebhookEvents = async (req: Request, res: Response): Promise<any> => {
    const events = Object.entries(WEBHOOK_EVENTS).map(([key, value]) => ({
        key,
        value,
        description: getEventDescription(value)
    }));

    return res.json(events);
};

function getEventDescription(event: string): string {
    const descriptions: Record<string, string> = {
        'check_in': 'Déclenché quand un employé pointe son arrivée',
        'check_out': 'Déclenché quand un employé pointe son départ',
        'late_arrival': 'Déclenché quand un employé arrive en retard',
        'expense.submitted': 'Déclenché quand une note de frais est soumise',
        'expense.approved': 'Déclenché quand une note de frais est approuvée',
        'expense.rejected': 'Déclenché quand une note de frais est refusée',
        'leave.requested': 'Déclenché quand une demande de congé est créée',
        'leave.approved': 'Déclenché quand un congé est approuvé',
        'leave.rejected': 'Déclenché quand un congé est refusé',
        'geofence.alert': 'Déclenché quand un employé pointe hors zone',
        'employee.created': 'Déclenché quand un employé est créé',
        'employee.deleted': 'Déclenché quand un employé est supprimé'
    };
    return descriptions[event] || event;
}
