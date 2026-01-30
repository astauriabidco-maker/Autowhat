/**
 * SuperAdmin Support Controller
 * Admin inbox for ticket management
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendTicketReplyEmail } from '../services/emailService';

const prisma = new PrismaClient();

/**
 * GET /admin/tickets
 * List all tickets (SuperAdmin)
 */
export const getAllTickets = async (req: Request, res: Response): Promise<any> => {
    try {
        const { status, priority } = req.query;

        const where: any = {};
        if (status) where.status = status;
        if (priority) where.priority = priority;

        const tickets = await prisma.ticket.findMany({
            where,
            orderBy: [
                { status: 'asc' }, // OPEN first
                { updatedAt: 'desc' }
            ],
            include: {
                tenant: { select: { id: true, name: true } },
                user: { select: { id: true, name: true, phoneNumber: true } },
                _count: { select: { messages: true } },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1 // Last message preview
                }
            }
        });

        return res.json(tickets);
    } catch (error) {
        console.error('Error fetching tickets:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * GET /admin/tickets/:id
 * Get ticket details with all messages
 */
export const getTicketDetails = async (req: Request, res: Response): Promise<any> => {
    try {
        const id = req.params.id as string;

        const ticket = await prisma.ticket.findUnique({
            where: { id },
            include: {
                tenant: { select: { id: true, name: true } },
                user: { select: { id: true, name: true, phoneNumber: true } },
                messages: { orderBy: { createdAt: 'asc' } }
            }
        });

        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        return res.json(ticket);
    } catch (error) {
        console.error('Error fetching ticket:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * POST /admin/tickets/:id/reply
 * Admin reply to ticket
 */
export const adminReply = async (req: Request, res: Response): Promise<any> => {
    try {
        const adminId = (req as any).superAdminId;
        const id = req.params.id as string;
        const { message, markResolved } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Get ticket with user info for email notification
        const ticket = await prisma.ticket.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        tenant: { select: { name: true } }
                    }
                }
            }
        });
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        // Determine new status
        let newStatus = ticket.status;
        if (markResolved) {
            newStatus = 'RESOLVED';
        } else if (ticket.status === 'OPEN') {
            newStatus = 'IN_PROGRESS';
        }

        // Create message and update ticket
        const [newMessage] = await prisma.$transaction([
            prisma.ticketMessage.create({
                data: {
                    ticketId: id,
                    content: message,
                    senderId: adminId,
                    isAdmin: true
                }
            }),
            prisma.ticket.update({
                where: { id },
                data: {
                    status: newStatus,
                    updatedAt: new Date()
                }
            })
        ]);

        console.log(`🎧 Admin replied to ticket ${id} (status: ${newStatus})`);

        // Send email notification to client (non-blocking)
        // Try to derive email from phone or use a placeholder
        const clientEmail = ticket.user.phoneNumber?.includes('@')
            ? ticket.user.phoneNumber
            : null;

        if (clientEmail) {
            sendTicketReplyEmail(
                { email: clientEmail, name: ticket.user.name || 'Client' },
                { id: ticket.id, subject: ticket.subject },
                message
            ).catch(err => console.error('Email notification failed:', err));
        }

        return res.status(201).json({
            message: newMessage,
            newStatus
        });
    } catch (error) {
        console.error('Error replying to ticket:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * PATCH /admin/tickets/:id/status
 * Update ticket status
 */
export const updateTicketStatus = async (req: Request, res: Response): Promise<any> => {
    try {
        const id = req.params.id as string;
        const { status } = req.body;

        const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                error: 'Invalid status',
                validStatuses
            });
        }

        const ticket = await prisma.ticket.update({
            where: { id },
            data: { status }
        });

        console.log(`🎫 Ticket ${id} status changed to ${status}`);

        return res.json(ticket);
    } catch (error) {
        console.error('Error updating ticket status:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * GET /admin/tickets/stats
 * Get ticket statistics
 */
export const getTicketStats = async (req: Request, res: Response): Promise<any> => {
    try {
        const [open, inProgress, resolved, closed, total] = await Promise.all([
            prisma.ticket.count({ where: { status: 'OPEN' } }),
            prisma.ticket.count({ where: { status: 'IN_PROGRESS' } }),
            prisma.ticket.count({ where: { status: 'RESOLVED' } }),
            prisma.ticket.count({ where: { status: 'CLOSED' } }),
            prisma.ticket.count()
        ]);

        return res.json({
            open,
            inProgress,
            resolved,
            closed,
            total
        });
    } catch (error) {
        console.error('Error fetching ticket stats:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
