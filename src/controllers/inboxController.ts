import { Request, Response } from 'express';
import prisma from '../lib/prisma';

type InboxKind = 'INTERVENTION' | 'SUPPORT' | 'LEAVE' | 'EXPENSE' | 'NOTIFICATION';

interface InboxItem {
    id: string;
    kind: InboxKind;
    title: string;
    summary: string;
    actor: {
        id?: string;
        name: string;
        phoneNumber?: string | null;
    };
    priority: 'LOW' | 'NORMAL' | 'URGENT' | 'INFO';
    status: string;
    createdAt: string;
    updatedAt?: string;
    targetUrl: string;
    availableActions: string[];
    metadata?: Record<string, unknown>;
}

function clampLimit(rawLimit: unknown): number {
    const parsed = Number(rawLimit);
    if (!Number.isFinite(parsed) || parsed <= 0) return 50;
    return Math.min(Math.floor(parsed), 100);
}

function parseKinds(rawKind: unknown): Set<InboxKind> | null {
    if (!rawKind || typeof rawKind !== 'string') return null;

    const aliases: Record<string, InboxKind> = {
        intervention: 'INTERVENTION',
        interventions: 'INTERVENTION',
        support: 'SUPPORT',
        ticket: 'SUPPORT',
        tickets: 'SUPPORT',
        leave: 'LEAVE',
        leaves: 'LEAVE',
        rh: 'LEAVE',
        expense: 'EXPENSE',
        expenses: 'EXPENSE',
        frais: 'EXPENSE',
        notification: 'NOTIFICATION',
        notifications: 'NOTIFICATION',
    };

    const kinds = rawKind
        .split(',')
        .map(kind => aliases[kind.trim().toLowerCase()] || kind.trim().toUpperCase())
        .filter((kind): kind is InboxKind =>
            ['INTERVENTION', 'SUPPORT', 'LEAVE', 'EXPENSE', 'NOTIFICATION'].includes(kind)
        );

    return kinds.length > 0 ? new Set(kinds) : null;
}

function countByKind(items: InboxItem[]): Record<InboxKind | 'ALL', number> {
    const counts: Record<InboxKind | 'ALL', number> = {
        ALL: items.length,
        INTERVENTION: 0,
        SUPPORT: 0,
        LEAVE: 0,
        EXPENSE: 0,
        NOTIFICATION: 0,
    };

    for (const item of items) {
        counts[item.kind] += 1;
    }

    return counts;
}

function priorityRank(priority: InboxItem['priority']): number {
    if (priority === 'URGENT') return 3;
    if (priority === 'NORMAL') return 2;
    if (priority === 'LOW') return 1;
    return 0;
}

export const getInbox = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = req.user?.tenantId;
        const managerId = req.user?.userId;

        if (!tenantId || !managerId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const limit = clampLimit(req.query.limit);
        const kinds = parseKinds(req.query.kind);
        const includeResolved = req.query.status === 'all';
        const wants = (kind: InboxKind) => !kinds || kinds.has(kind);

        const [
            interventionRequests,
            tickets,
            leaveRequests,
            expenses,
            notifications,
        ] = await Promise.all([
            wants('INTERVENTION')
                ? prisma.interventionRequest.findMany({
                    where: {
                        tenantId,
                        ...(includeResolved ? {} : { status: { in: ['PENDING', 'APPROVED'] } }),
                    },
                    include: {
                        customer: { select: { id: true, companyName: true, contactName: true } },
                        interventionType: { select: { id: true, name: true, color: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                })
                : Promise.resolve([]),
            wants('SUPPORT')
                ? prisma.ticket.findMany({
                    where: {
                        tenantId,
                        ...(includeResolved ? {} : { status: { in: ['OPEN', 'IN_PROGRESS'] } }),
                    },
                    include: {
                        user: { select: { id: true, name: true, phoneNumber: true } },
                        _count: { select: { messages: true } },
                    },
                    orderBy: { updatedAt: 'desc' },
                    take: limit,
                })
                : Promise.resolve([]),
            wants('LEAVE')
                ? prisma.leaveRequest.findMany({
                    where: {
                        tenantId,
                        ...(includeResolved ? {} : { status: 'PENDING' }),
                    },
                    include: {
                        employee: { select: { id: true, name: true, phoneNumber: true } },
                    },
                    orderBy: { startDate: 'desc' },
                    take: limit,
                })
                : Promise.resolve([]),
            wants('EXPENSE')
                ? prisma.expense.findMany({
                    where: {
                        tenantId,
                        ...(includeResolved ? {} : { status: 'PENDING' }),
                    },
                    include: {
                        employee: { select: { id: true, name: true, phoneNumber: true } },
                    },
                    orderBy: { date: 'desc' },
                    take: limit,
                })
                : Promise.resolve([]),
            wants('NOTIFICATION')
                ? prisma.notification.findMany({
                    where: {
                        tenantId,
                        managerId,
                        ...(includeResolved ? {} : { isRead: false }),
                    },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                })
                : Promise.resolve([]),
        ]);

        const items: InboxItem[] = [
            ...interventionRequests.map(request => ({
                id: request.id,
                kind: 'INTERVENTION' as const,
                title: request.customer?.companyName
                    ? `Demande intervention - ${request.customer.companyName}`
                    : 'Demande intervention WhatsApp',
                summary: request.message,
                actor: {
                    id: request.customer?.id,
                    name: request.senderName || request.customer?.contactName || request.customer?.companyName || request.senderPhone,
                    phoneNumber: request.senderPhone,
                },
                priority: request.urgency === 'URGENT' ? 'URGENT' as const : 'NORMAL' as const,
                status: request.status,
                createdAt: request.createdAt.toISOString(),
                updatedAt: request.updatedAt.toISOString(),
                targetUrl: `/operations/requests?request=${request.id}`,
                availableActions: request.status === 'PENDING' ? ['approve', 'reject', 'plan'] : ['reject', 'plan'],
                metadata: {
                    customerId: request.customerId,
                    interventionTypeId: request.interventionTypeId,
                    interventionTypeName: request.interventionType?.name,
                    photoUrl: request.photoUrl,
                },
            })),
            ...tickets.map(ticket => ({
                id: ticket.id,
                kind: 'SUPPORT' as const,
                title: ticket.subject,
                summary: `${ticket._count.messages} message${ticket._count.messages > 1 ? 's' : ''}`,
                actor: {
                    id: ticket.user.id,
                    name: ticket.user.name || 'Manager',
                    phoneNumber: ticket.user.phoneNumber,
                },
                priority: ticket.priority === 'URGENT'
                    ? 'URGENT' as const
                    : ticket.priority === 'LOW' ? 'LOW' as const : 'NORMAL' as const,
                status: ticket.status,
                createdAt: ticket.createdAt.toISOString(),
                updatedAt: ticket.updatedAt.toISOString(),
                targetUrl: `/support?ticket=${ticket.id}`,
                availableActions: ['open', 'reply'],
            })),
            ...leaveRequests.map(leave => ({
                id: leave.id,
                kind: 'LEAVE' as const,
                title: `Demande d'absence - ${leave.employee.name || 'Employé'}`,
                summary: `${leave.type} du ${leave.startDate.toLocaleDateString('fr-FR')} au ${leave.endDate.toLocaleDateString('fr-FR')}`,
                actor: {
                    id: leave.employee.id,
                    name: leave.employee.name || 'Employé',
                    phoneNumber: leave.employee.phoneNumber,
                },
                priority: leave.type === 'SICK' ? 'URGENT' as const : 'NORMAL' as const,
                status: leave.status,
                createdAt: leave.startDate.toISOString(),
                targetUrl: `/attendance?leave=${leave.id}`,
                availableActions: ['review'],
                metadata: {
                    startDate: leave.startDate,
                    endDate: leave.endDate,
                    documentUrl: leave.documentUrl,
                },
            })),
            ...expenses.map(expense => ({
                id: expense.id,
                kind: 'EXPENSE' as const,
                title: `Note de frais - ${expense.employee.name || 'Employé'}`,
                summary: `${expense.merchant || expense.category}${expense.amount ? ` - ${expense.amount.toFixed(2)} ${expense.currency}` : ''}`,
                actor: {
                    id: expense.employee.id,
                    name: expense.employee.name || 'Employé',
                    phoneNumber: expense.employee.phoneNumber,
                },
                priority: 'NORMAL' as const,
                status: expense.status,
                createdAt: expense.date.toISOString(),
                targetUrl: `/expenses?expense=${expense.id}`,
                availableActions: expense.status === 'PENDING' ? ['approve', 'reject'] : ['open'],
                metadata: {
                    amount: expense.amount,
                    currency: expense.currency,
                    category: expense.category,
                    photoUrl: expense.photoUrl,
                },
            })),
            ...notifications.map(notification => ({
                id: notification.id,
                kind: 'NOTIFICATION' as const,
                title: notification.title,
                summary: notification.message,
                actor: {
                    id: notification.employeeId || undefined,
                    name: 'WhatsPoint',
                },
                priority: notification.type === 'ABSENCE' || notification.type === 'LATE' ? 'URGENT' as const : 'INFO' as const,
                status: notification.isRead ? 'READ' : 'UNREAD',
                createdAt: notification.createdAt.toISOString(),
                targetUrl: `/dashboard?notification=${notification.id}`,
                availableActions: notification.isRead ? ['open'] : ['mark_read', 'open'],
                metadata: {
                    type: notification.type,
                    employeeId: notification.employeeId,
                },
            })),
        ];

        const sortedItems = items
            .sort((a, b) => {
                const priorityDelta = priorityRank(b.priority) - priorityRank(a.priority);
                if (priorityDelta !== 0) return priorityDelta;
                return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
            })
            .slice(0, limit);

        return res.json({
            items: sortedItems,
            counts: countByKind(items),
            filters: {
                kind: kinds ? Array.from(kinds) : 'ALL',
                status: includeResolved ? 'all' : 'open',
                limit,
            },
        });
    } catch (error) {
        console.error('Error fetching inbox:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};
