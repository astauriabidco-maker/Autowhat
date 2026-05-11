/**
 * Support Controller - Client API
 * Ticket creation and management for managers
 */

import { Request, Response } from 'express';
import { deflectSupportTicketViaRAG } from '../services/aiAgentService';
import prisma from '../lib/prisma';


/**
 * POST /api/tickets
 * Create a new ticket with initial message
 */
export const createTicket = async (req: Request, res: Response): Promise<any> => {
    try {
        const managerId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        const { subject, priority, message } = req.body;

        if (!managerId || !tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        if (!subject || !message) {
            return res.status(400).json({ error: 'Subject and message are required' });
        }

        // Create ticket with first message
        const ticket = await prisma.ticket.create({
            data: {
                subject,
                priority: priority || 'NORMAL',
                userId: managerId,
                tenantId,
                messages: {
                    create: {
                        content: message,
                        senderId: managerId,
                        isAdmin: false
                    }
                }
            },
            include: {
                messages: true,
                user: { select: { id: true, name: true, phoneNumber: true } }
            }
        });

        console.log(`🎫 New ticket created: ${ticket.id} - ${subject}`);

        // ------------------------------------------------------------------
        // SOLOPRENEUR OPTIMIZATION: AI TICKET DEFLECTION (Tier-1 Support)
        // ------------------------------------------------------------------
        const aiResponse = await deflectSupportTicketViaRAG(subject, message);
        
        if (aiResponse) {
            await prisma.ticketMessage.create({
                data: {
                    ticketId: ticket.id,
                    content: aiResponse,
                    senderId: 'SYSTEM_AI',
                    isAdmin: true
                }
            });
            console.log(`🤖 AI Support Agent deflected ticket ${ticket.id} immediately.`);
            
            // Refetch to include the AI response in the UI instantly
            const updatedTicket = await prisma.ticket.findUnique({
                where: { id: ticket.id },
                include: {
                    messages: true,
                    user: { select: { id: true, name: true, phoneNumber: true } }
                }
            });
            return res.status(201).json(updatedTicket);
        }

        return res.status(201).json(ticket);
    } catch (error) {
        console.error('Error creating ticket:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * GET /api/tickets
 * List all tickets for the tenant
 */
export const getTickets = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const tickets = await prisma.ticket.findMany({
            where: { tenantId },
            orderBy: { updatedAt: 'desc' },
            include: {
                user: { select: { id: true, name: true } },
                _count: { select: { messages: true } }
            }
        });

        return res.json(tickets);
    } catch (error) {
        console.error('Error fetching tickets:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * GET /api/tickets/:id
 * Get a single ticket with messages
 */
export const getTicket = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = req.user?.tenantId;
        const id = req.params.id as string;

        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const ticket = await prisma.ticket.findFirst({
            where: { id, tenantId },
            include: {
                messages: { orderBy: { createdAt: 'asc' } },
                user: { select: { id: true, name: true, phoneNumber: true } }
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
 * POST /api/tickets/:id/reply
 * Add a message to a ticket (client)
 */
export const replyToTicket = async (req: Request, res: Response): Promise<any> => {
    try {
        const managerId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        const id = req.params.id as string;
        const { message } = req.body;

        if (!managerId || !tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Verify ticket belongs to tenant
        const ticket = await prisma.ticket.findFirst({
            where: { id, tenantId }
        });

        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        if (ticket.status === 'CLOSED') {
            return res.status(400).json({ error: 'Cannot reply to a closed ticket' });
        }

        // Create message and update ticket status
        const [newMessage] = await prisma.$transaction([
            prisma.ticketMessage.create({
                data: {
                    ticketId: id,
                    content: message,
                    senderId: managerId,
                    isAdmin: false
                }
            }),
            // Reopen if was RESOLVED
            prisma.ticket.update({
                where: { id },
                data: {
                    status: ticket.status === 'RESOLVED' ? 'OPEN' : ticket.status,
                    updatedAt: new Date()
                }
            })
        ]);

        console.log(`💬 Client replied to ticket ${id}`);

        return res.status(201).json(newMessage);
    } catch (error) {
        console.error('Error replying to ticket:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
