/**
 * Intervention Request Controller
 * Manages WhatsApp-originated intervention requests (CRUD + workflow).
 */

import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import crypto from 'crypto';
import { signUploadUrlIfNeeded } from '../utils/signedFileUrl';
import { recordRequestEvent, REQUEST_ENTITY_TYPES, REQUEST_EVENT_TYPES } from '../services/requestEventService';

function withSignedPhoto<T extends { photoUrl?: string | null }>(request: T): T {
    return {
        ...request,
        photoUrl: signUploadUrlIfNeeded(request.photoUrl)
    };
}

// ─── LIST ────────────────────────────────────────────────────────────────────
/** GET /api/intervention-requests */
export const listRequests = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user!.tenantId;
        const { status, customerId } = req.query;

        const where: any = { tenantId };
        if (status) where.status = status as string;
        if (customerId) where.customerId = customerId as string;

        const requests = await prisma.interventionRequest.findMany({
            where,
            include: {
                customer: { select: { id: true, companyName: true, contactName: true, phone: true } },
                customerSite: { select: { id: true, name: true, address: true, city: true } },
                interventionType: { select: { id: true, name: true, color: true } },
                intervention: { select: { id: true, title: true, status: true, scheduledStart: true } },
            },
            orderBy: [
                { status: 'asc' },    // PENDING first
                { createdAt: 'desc' },
            ],
        });

        res.json(requests.map(withSignedPhoto));
    } catch (error) {
        console.error('Error listing intervention requests:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── GET ONE ─────────────────────────────────────────────────────────────────
/** GET /api/intervention-requests/:id */
export const getRequest = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user!.tenantId;
        const id = req.params.id as string;

        const request = await prisma.interventionRequest.findFirst({
            where: { id, tenantId },
            include: {
                customer: true,
                customerSite: true,
                interventionType: true,
                intervention: true,
            },
        });

        if (!request) return res.status(404).json({ error: 'Request not found' });
        res.json(withSignedPhoto(request));
    } catch (error) {
        console.error('Error getting intervention request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── UPDATE (assign customer, type, notes) ───────────────────────────────────
/** PUT /api/intervention-requests/:id */
export const updateRequest = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user!.tenantId;
        const userId = (req as any).user!.userId;
        const id = req.params.id as string;
        const { customerId, customerSiteId, interventionTypeId, managerNotes, urgency } = req.body;

        const existing = await prisma.interventionRequest.findFirst({ where: { id, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Request not found' });
        if (existing.status === 'PLANNED') return res.status(400).json({ error: 'Cannot edit a planned request' });

        const data: any = {};
        if (customerId !== undefined) data.customerId = customerId || null;
        if (customerSiteId !== undefined) data.customerSiteId = customerSiteId || null;
        if (interventionTypeId !== undefined) data.interventionTypeId = interventionTypeId || null;
        if (managerNotes !== undefined) data.managerNotes = managerNotes;
        if (urgency !== undefined) data.urgency = urgency;

        const updated = await prisma.interventionRequest.update({
            where: { id },
            data: {
                ...data,
                lastEventAt: Object.keys(data).length > 0 ? new Date() : existing.lastEventAt,
            },
            include: {
                customer: { select: { id: true, companyName: true, contactName: true } },
                customerSite: { select: { id: true, name: true, address: true, city: true } },
                interventionType: { select: { id: true, name: true, color: true } },
            },
        });

        if (Object.keys(data).length > 0) {
            await recordRequestEvent({
                tenantId,
                entityType: REQUEST_ENTITY_TYPES.INTERVENTION_REQUEST,
                entityId: id,
                type: REQUEST_EVENT_TYPES.UPDATED,
                actorType: 'MANAGER',
                actorId: userId,
                metadata: { fields: Object.keys(data) },
            });
        }

        res.json(withSignedPhoto(updated));
    } catch (error) {
        console.error('Error updating intervention request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── APPROVE ─────────────────────────────────────────────────────────────────
/** POST /api/intervention-requests/:id/approve */
export const approveRequest = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user!.tenantId;
        const userId = (req as any).user!.userId;
        const id = req.params.id as string;

        const existing = await prisma.interventionRequest.findFirst({ where: { id, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Request not found' });
        if (existing.status !== 'PENDING') return res.status(400).json({ error: 'Only PENDING requests can be approved' });

        const updated = await prisma.interventionRequest.update({
            where: { id },
            data: {
                status: 'APPROVED',
                processedAt: new Date(),
                processedById: userId,
                lastEventAt: new Date(),
            },
        });

        await recordRequestEvent({
            tenantId,
            entityType: REQUEST_ENTITY_TYPES.INTERVENTION_REQUEST,
            entityId: id,
            type: REQUEST_EVENT_TYPES.STATUS_CHANGED,
            actorType: 'MANAGER',
            actorId: userId,
            metadata: { from: existing.status, to: 'APPROVED' },
        });

        // Notify customer via WhatsApp
        try {
            const { sendMessage } = await import('../services/whatsappService');
            const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
            await sendMessage(
                existing.senderPhone,
                `✅ *Demande acceptée !*\n\n` +
                `Bonjour${existing.senderName ? ` ${existing.senderName}` : ''},\n\n` +
                `Votre demande d'intervention a été *acceptée* ✅\n` +
                `Un technicien vous sera assigné sous peu.\n\n` +
                `— ${tenant?.name || 'Notre équipe'}`
            );
        } catch (e) {
            console.error('Error sending approval WhatsApp notification:', e);
        }

        res.json(updated);
    } catch (error) {
        console.error('Error approving intervention request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── REJECT ──────────────────────────────────────────────────────────────────
/** POST /api/intervention-requests/:id/reject */
export const rejectRequest = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user!.tenantId;
        const userId = (req as any).user!.userId;
        const id = req.params.id as string;
        const { rejectionReason } = req.body;

        const existing = await prisma.interventionRequest.findFirst({ where: { id, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Request not found' });
        if (!['PENDING', 'APPROVED'].includes(existing.status)) {
            return res.status(400).json({ error: 'Only PENDING or APPROVED requests can be rejected' });
        }

        const updated = await prisma.interventionRequest.update({
            where: { id },
            data: {
                status: 'REJECTED',
                rejectionReason: rejectionReason || null,
                processedAt: new Date(),
                processedById: userId,
                lastEventAt: new Date(),
            },
        });

        await recordRequestEvent({
            tenantId,
            entityType: REQUEST_ENTITY_TYPES.INTERVENTION_REQUEST,
            entityId: id,
            type: REQUEST_EVENT_TYPES.STATUS_CHANGED,
            actorType: 'MANAGER',
            actorId: userId,
            message: rejectionReason || null,
            metadata: { from: existing.status, to: 'REJECTED' },
        });

        // Notify customer via WhatsApp
        try {
            const { sendMessage } = await import('../services/whatsappService');
            const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
            const reasonText = rejectionReason ? `\nMotif : ${rejectionReason}` : '';
            await sendMessage(
                existing.senderPhone,
                `😔 *Demande non retenue*\n\n` +
                `Bonjour${existing.senderName ? ` ${existing.senderName}` : ''},\n\n` +
                `Nous ne sommes malheureusement pas en mesure de donner suite à votre demande d'intervention.${reasonText}\n\n` +
                `N'hésitez pas à nous recontacter pour tout besoin.` +
                `\n\n— ${tenant?.name || 'Notre équipe'}`
            );
        } catch (e) {
            console.error('Error sending rejection WhatsApp notification:', e);
        }

        res.json(updated);
    } catch (error) {
        console.error('Error rejecting intervention request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── CONVERT TO INTERVENTION ─────────────────────────────────────────────────
/** POST /api/intervention-requests/:id/plan */
export const planRequest = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user!.tenantId;
        const userId = (req as any).user!.userId;
        const id = req.params.id as string;
        const { employeeId, scheduledStart, scheduledEnd, title, description } = req.body;

        if (!employeeId || !scheduledStart || !scheduledEnd) {
            return res.status(400).json({ error: 'employeeId, scheduledStart, scheduledEnd are required' });
        }

        const existing = await prisma.interventionRequest.findFirst({
            where: { id, tenantId },
            include: { customer: true, customerSite: true, interventionType: true },
        });
        if (!existing) return res.status(404).json({ error: 'Request not found' });
        if (existing.status === 'PLANNED') return res.status(400).json({ error: 'Already planned' });
        if (existing.status === 'REJECTED') return res.status(400).json({ error: 'Cannot plan a rejected request' });

        // Verify customer exists
        if (!existing.customerId) {
            return res.status(400).json({ error: 'Please assign a customer before planning' });
        }

        // Verify employee
        const employee = await prisma.employee.findFirst({ where: { id: employeeId, tenantId } });
        if (!employee) return res.status(404).json({ error: 'Employee not found' });

        const signatureToken = crypto.randomUUID();

        // Create intervention
        const intervention = await prisma.intervention.create({
            data: {
                title: title || `Demande client — ${existing.customer?.companyName || existing.senderName || existing.senderPhone}`,
                description: description || `📩 Demande WhatsApp:\n${existing.message}`,
                interventionTypeId: existing.interventionTypeId,
                status: 'SCHEDULED',
                scheduledStart: new Date(scheduledStart),
                scheduledEnd: new Date(scheduledEnd),
                customerId: existing.customerId!,
                customerSiteId: existing.customerSiteId,
                employeeId,
                tenantId,
                signatureToken,
            },
            include: {
                customer: { select: { id: true, companyName: true, contactName: true } },
                employee: { select: { id: true, name: true, phoneNumber: true } },
            },
        });

        // Update request status
        await prisma.interventionRequest.update({
            where: { id },
            data: {
                status: 'PLANNED',
                interventionId: intervention.id,
                processedAt: new Date(),
                processedById: userId,
                lastEventAt: new Date(),
            },
        });

        await recordRequestEvent({
            tenantId,
            entityType: REQUEST_ENTITY_TYPES.INTERVENTION_REQUEST,
            entityId: id,
            type: REQUEST_EVENT_TYPES.STATUS_CHANGED,
            actorType: 'MANAGER',
            actorId: userId,
            metadata: {
                from: existing.status,
                to: 'PLANNED',
                interventionId: intervention.id,
                employeeId,
                scheduledStart,
                scheduledEnd,
            },
        });

        // Notify customer via WhatsApp
        try {
            const { sendMessage } = await import('../services/whatsappService');
            const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
            const scheduledDate = new Date(scheduledStart);
            const dateStr = scheduledDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            const timeStr = scheduledDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

            await sendMessage(
                existing.senderPhone,
                `📅 *Intervention planifiée !*\n\n` +
                `Bonjour${existing.senderName ? ` ${existing.senderName}` : ''},\n\n` +
                `Votre intervention a été planifiée :\n` +
                `📌 *${intervention.title}*\n` +
                `📆 ${dateStr} à ${timeStr}\n` +
                `👤 Technicien : ${(intervention as any).employee?.name || 'À confirmer'}\n\n` +
                `Vous recevrez un rappel la veille.\n\n` +
                `— ${tenant?.name || 'Notre équipe'}`
            );
        } catch (e) {
            console.error('Error sending planning WhatsApp notification:', e);
        }

        res.status(201).json(intervention);
    } catch (error) {
        console.error('Error planning intervention request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── DELETE ──────────────────────────────────────────────────────────────────
/** DELETE /api/intervention-requests/:id */
export const deleteRequest = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user!.tenantId;
        const id = req.params.id as string;

        const existing = await prisma.interventionRequest.findFirst({ where: { id, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Request not found' });

        await prisma.interventionRequest.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting intervention request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── ASSIGNMENT ──────────────────────────────────────────────────────────────
/** PATCH /api/intervention-requests/:id/assignment */
export const updateAssignment = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user!.tenantId;
        const userId = (req as any).user!.userId;
        const id = req.params.id as string;
        const { employeeId } = req.body;

        const existing = await prisma.interventionRequest.findFirst({ where: { id, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Request not found' });

        if (employeeId) {
            const employee = await prisma.employee.findFirst({ where: { id: employeeId, tenantId } });
            if (!employee) return res.status(404).json({ error: 'Employee not found' });
        }

        const updated = await prisma.interventionRequest.update({
            where: { id },
            data: {
                assignedToId: employeeId || null,
                lastEventAt: new Date(),
            },
            include: {
                assignedTo: { select: { id: true, name: true, phoneNumber: true } },
            },
        });

        await recordRequestEvent({
            tenantId,
            entityType: REQUEST_ENTITY_TYPES.INTERVENTION_REQUEST,
            entityId: id,
            type: employeeId ? REQUEST_EVENT_TYPES.ASSIGNED : REQUEST_EVENT_TYPES.UNASSIGNED,
            actorType: 'MANAGER',
            actorId: userId,
            metadata: { from: existing.assignedToId, to: employeeId || null },
        });

        res.json(updated);
    } catch (error) {
        console.error('Error updating intervention request assignment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── SLA ─────────────────────────────────────────────────────────────────────
/** PATCH /api/intervention-requests/:id/sla */
export const updateSla = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user!.tenantId;
        const userId = (req as any).user!.userId;
        const id = req.params.id as string;
        const { slaDueAt } = req.body;

        const existing = await prisma.interventionRequest.findFirst({ where: { id, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Request not found' });

        const nextSlaDueAt = slaDueAt ? new Date(slaDueAt) : null;
        if (slaDueAt && Number.isNaN(nextSlaDueAt?.getTime())) {
            return res.status(400).json({ error: 'Invalid slaDueAt' });
        }

        const updated = await prisma.interventionRequest.update({
            where: { id },
            data: {
                slaDueAt: nextSlaDueAt,
                slaBreachedAt: null,
                lastEventAt: new Date(),
            },
        });

        await recordRequestEvent({
            tenantId,
            entityType: REQUEST_ENTITY_TYPES.INTERVENTION_REQUEST,
            entityId: id,
            type: nextSlaDueAt ? REQUEST_EVENT_TYPES.SLA_SET : REQUEST_EVENT_TYPES.SLA_CLEARED,
            actorType: 'MANAGER',
            actorId: userId,
            metadata: {
                from: existing.slaDueAt?.toISOString() || null,
                to: nextSlaDueAt?.toISOString() || null,
            },
        });

        res.json(updated);
    } catch (error) {
        console.error('Error updating intervention request SLA:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── INTERNAL COMMENTS ───────────────────────────────────────────────────────
/** POST /api/intervention-requests/:id/comments */
export const addComment = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user!.tenantId;
        const userId = (req as any).user!.userId;
        const id = req.params.id as string;
        const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';

        if (!message) return res.status(400).json({ error: 'Message is required' });

        const existing = await prisma.interventionRequest.findFirst({ where: { id, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Request not found' });

        await recordRequestEvent({
            tenantId,
            entityType: REQUEST_ENTITY_TYPES.INTERVENTION_REQUEST,
            entityId: id,
            type: REQUEST_EVENT_TYPES.COMMENTED,
            actorType: 'MANAGER',
            actorId: userId,
            message,
        });

        res.status(201).json({ success: true });
    } catch (error) {
        console.error('Error adding intervention request comment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── EVENTS ──────────────────────────────────────────────────────────────────
/** GET /api/intervention-requests/:id/events */
export const listEvents = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user!.tenantId;
        const id = req.params.id as string;

        const existing = await prisma.interventionRequest.findFirst({ where: { id, tenantId }, select: { id: true } });
        if (!existing) return res.status(404).json({ error: 'Request not found' });

        const events = await prisma.requestEvent.findMany({
            where: {
                tenantId,
                entityType: REQUEST_ENTITY_TYPES.INTERVENTION_REQUEST,
                entityId: id,
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        res.json({ events });
    } catch (error) {
        console.error('Error listing intervention request events:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── STATS ───────────────────────────────────────────────────────────────────
/** GET /api/intervention-requests/stats */
export const getStats = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user!.tenantId;

        const [pending, approved, planned, rejected, total] = await Promise.all([
            prisma.interventionRequest.count({ where: { tenantId, status: 'PENDING' } }),
            prisma.interventionRequest.count({ where: { tenantId, status: 'APPROVED' } }),
            prisma.interventionRequest.count({ where: { tenantId, status: 'PLANNED' } }),
            prisma.interventionRequest.count({ where: { tenantId, status: 'REJECTED' } }),
            prisma.interventionRequest.count({ where: { tenantId } }),
        ]);

        res.json({ pending, approved, planned, rejected, total });
    } catch (error) {
        console.error('Error getting intervention request stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
