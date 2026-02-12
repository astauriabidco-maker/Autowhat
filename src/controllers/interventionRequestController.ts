/**
 * Intervention Request Controller
 * Manages WhatsApp-originated intervention requests (CRUD + workflow).
 */

import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import crypto from 'crypto';

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

        res.json(requests);
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
        res.json(request);
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
            data,
            include: {
                customer: { select: { id: true, companyName: true, contactName: true } },
                customerSite: { select: { id: true, name: true, address: true, city: true } },
                interventionType: { select: { id: true, name: true, color: true } },
            },
        });

        res.json(updated);
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
        const userId = (req as any).user!.id;
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
            },
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
        const userId = (req as any).user!.id;
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
            },
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
        const userId = (req as any).user!.id;
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
