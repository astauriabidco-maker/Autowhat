import { Request, Response } from 'express';
import { InterventionRequestStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { areLegacyOperationsEnabled } from '../middlewares/legacyOperationsMiddleware';
import { dispatchWebhook, WEBHOOK_EVENTS } from '../services/webhookService';
import { getConfigForTenant } from '../services/whatsappConfigService';
import { sendMessage } from '../services/whatsappService';

type InboxKind = 'ATTENDANCE_GPS' | 'INTERVENTION' | 'SUPPORT' | 'LEAVE' | 'EXPENSE' | 'NOTIFICATION';
type InboxDecisionAction = 'APPROVE' | 'REJECT' | 'COMMENT' | 'CONFIRM';

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
    channel?: 'WHATSAPP' | 'DASHBOARD' | 'SYSTEM';
    requiresDecision?: boolean;
}

interface InboxSummary {
    actionable: number;
    urgent: number;
    pendingApproval: number;
    stale: number;
}

function maskPhoneNumber(phoneNumber: string | null | undefined): string | null {
    if (!phoneNumber) return null;

    const normalized = phoneNumber.replace(/\s+/g, '');
    if (normalized.length <= 4) return '••••';

    const visibleSuffix = normalized.slice(-4);
    const prefix = normalized.startsWith('+') ? '+••' : '••';
    return `${prefix} ${visibleSuffix}`;
}

function publicEmployee(employee: { id: string; name: string | null }) {
    return {
        id: employee.id,
        name: employee.name || 'Employé'
    };
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
        attendance: 'ATTENDANCE_GPS',
        pointage: 'ATTENDANCE_GPS',
        gps: 'ATTENDANCE_GPS',
        geofence: 'ATTENDANCE_GPS',
        anomaly: 'ATTENDANCE_GPS',
        anomalies: 'ATTENDANCE_GPS',
    };

    const kinds = rawKind
        .split(',')
        .map(kind => aliases[kind.trim().toLowerCase()] || kind.trim().toUpperCase())
        .filter((kind): kind is InboxKind =>
            ['ATTENDANCE_GPS', 'INTERVENTION', 'SUPPORT', 'LEAVE', 'EXPENSE', 'NOTIFICATION'].includes(kind)
        );

    return kinds.length > 0 ? new Set(kinds) : null;
}

function priorityRank(priority: InboxItem['priority']): number {
    if (priority === 'URGENT') return 3;
    if (priority === 'NORMAL') return 2;
    if (priority === 'LOW') return 1;
    return 0;
}

function isActionable(item: InboxItem): boolean {
    return item.availableActions.some(action => action !== 'open');
}

function isPendingApproval(item: InboxItem): boolean {
    return item.requiresDecision === true
        || (item.status === 'PENDING' && item.availableActions.some(action => action === 'approve' || action === 'review'));
}

function isStale(item: InboxItem): boolean {
    const referenceDate = new Date(item.updatedAt || item.createdAt).getTime();
    if (!Number.isFinite(referenceDate)) return false;

    const ageHours = (Date.now() - referenceDate) / 3600000;
    return ageHours >= 24 && isActionable(item);
}

function parseInboxDecisionAction(rawAction: unknown): InboxDecisionAction | null {
    if (typeof rawAction !== 'string') return null;

    const normalized = rawAction.trim().toUpperCase();
    const aliases: Record<string, InboxDecisionAction> = {
        APPROVE: 'APPROVE',
        APPROVED: 'APPROVE',
        VALIDATE: 'APPROVE',
        VALIDER: 'APPROVE',
        ACCEPT: 'APPROVE',
        REJECT: 'REJECT',
        REJECTED: 'REJECT',
        REFUSER: 'REJECT',
        REFUSE: 'REJECT',
        COMMENT: 'COMMENT',
        COMMENTER: 'COMMENT',
        CONFIRM: 'CONFIRM',
        CONFIRMER: 'CONFIRM',
    };

    return aliases[normalized] || null;
}

function normalizeComment(rawComment: unknown): string | null {
    if (typeof rawComment !== 'string') return null;

    const trimmed = rawComment.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 500) : null;
}

function attendanceInboxStatus(status: string, gpsVerdict: string | null, locationWarning: boolean): string {
    if (status === 'PENDING_GPS') return 'GPS_REQUIRED';
    if (status === 'REJECTED' || gpsVerdict === 'REJECTED') return 'REJECTED';
    if (status === 'WARNING' || gpsVerdict === 'WARNING' || locationWarning) return 'PENDING_REVIEW';
    if (gpsVerdict === 'NOT_CONFIGURED') return 'GPS_NOT_CONFIGURED';
    return status;
}

function gpsDistanceSignal(distanceFromSite: number | null): string {
    if (distanceFromSite === null) return 'distance non disponible';
    if (distanceFromSite <= 250) return 'écart GPS faible';
    if (distanceFromSite <= 1000) return 'écart GPS notable';
    return 'écart GPS important';
}

function formatInboxDate(date: Date): string {
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function buildLeaveDecisionMessage(params: {
    status: string;
    startDate: Date;
    endDate: Date;
    managerComment: string | null;
}): string {
    const statusLabel = params.status === 'APPROVED' ? 'validée' : 'refusée';
    const statusEmoji = params.status === 'APPROVED' ? '✅' : '❌';
    const dateLabel = params.startDate.toDateString() === params.endDate.toDateString()
        ? `du ${formatInboxDate(params.startDate)}`
        : `du ${formatInboxDate(params.startDate)} au ${formatInboxDate(params.endDate)}`;
    const commentLine = params.managerComment ? `\n\nMessage du manager : ${params.managerComment}` : '';

    return `${statusEmoji} Votre demande d'absence ${dateLabel} a été ${statusLabel}.${commentLine}`;
}

async function notifyLeaveDecisionEmployee(params: {
    tenantId: string;
    phoneNumber: string;
    status: string;
    startDate: Date;
    endDate: Date;
    managerComment: string | null;
}) {
    try {
        const credentials = await getConfigForTenant(params.tenantId);
        await sendMessage(
            params.phoneNumber.replace(/^\+/, ''),
            buildLeaveDecisionMessage(params),
            credentials || undefined
        );
    } catch (error) {
        console.warn('whatsapp.leave_decision_notification_failed', {
            tenantId: params.tenantId,
            status: params.status,
            error: error instanceof Error ? error.message : 'unknown'
        });
    }
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
        const legacyOperationsEnabled = areLegacyOperationsEnabled();
        const wants = (kind: InboxKind) => (!kinds || kinds.has(kind)) && (kind !== 'INTERVENTION' || legacyOperationsEnabled);
        const interventionWhere: Prisma.InterventionRequestWhereInput = {
            tenantId,
            ...(includeResolved ? {} : { status: { in: [InterventionRequestStatus.PENDING, InterventionRequestStatus.APPROVED] } }),
        };
        const ticketWhere: Prisma.TicketWhereInput = {
            tenantId,
            ...(includeResolved ? {} : { status: { in: ['OPEN', 'IN_PROGRESS'] } }),
        };
        const leaveWhere: Prisma.LeaveRequestWhereInput = {
            tenantId,
            ...(includeResolved ? {} : { status: 'PENDING' }),
        };
        const expenseWhere: Prisma.ExpenseWhereInput = {
            tenantId,
            ...(includeResolved ? {} : { status: 'PENDING' }),
        };
        const attendanceGpsWhere: Prisma.AttendanceWhereInput = {
            tenantId,
            ...(includeResolved
                ? {
                    OR: [
                        { status: { in: ['PENDING_GPS', 'WARNING', 'REJECTED'] } },
                        { locationWarning: true },
                        { gpsVerdict: { in: ['PENDING', 'WARNING', 'REJECTED', 'NOT_CONFIGURED', 'APPROVED'] } }
                    ]
                }
                : {
                    OR: [
                        { status: { in: ['PENDING_GPS', 'WARNING', 'REJECTED'] } },
                        { locationWarning: true },
                        { gpsVerdict: { in: ['PENDING', 'WARNING', 'REJECTED', 'NOT_CONFIGURED'] } }
                    ]
                }),
        };
        const notificationWhere: Prisma.NotificationWhereInput = {
            tenantId,
            managerId,
            ...(includeResolved ? {} : { isRead: false }),
        };

        const [
            interventionRequests,
            tickets,
            leaveRequests,
            expenses,
            attendanceGpsItems,
            notifications,
            interventionCount,
            supportCount,
            leaveCount,
            expenseCount,
            attendanceGpsCount,
            notificationCount,
        ] = await Promise.all([
            wants('INTERVENTION')
                ? prisma.interventionRequest.findMany({
                    where: interventionWhere,
                    include: {
                        customer: { select: { id: true, companyName: true, contactName: true } },
                        interventionType: { select: { id: true, name: true, color: true } },
                        assignedTo: { select: { id: true, name: true, phoneNumber: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                })
                : Promise.resolve([]),
            wants('SUPPORT')
                ? prisma.ticket.findMany({
                    where: ticketWhere,
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
                    where: leaveWhere,
                    include: {
                        employee: { select: { id: true, name: true, phoneNumber: true } },
                    },
                    orderBy: { startDate: 'desc' },
                    take: limit,
                })
                : Promise.resolve([]),
            wants('EXPENSE')
                ? prisma.expense.findMany({
                    where: expenseWhere,
                    include: {
                        employee: { select: { id: true, name: true, phoneNumber: true } },
                    },
                    orderBy: { date: 'desc' },
                    take: limit,
                })
                : Promise.resolve([]),
            wants('ATTENDANCE_GPS')
                ? prisma.attendance.findMany({
                    where: attendanceGpsWhere,
                    include: {
                        employee: {
                            select: {
                                id: true,
                                name: true,
                                phoneNumber: true,
                                workProfile: true,
                                site: {
                                    select: {
                                        id: true,
                                        name: true,
                                        radius: true,
                                        gpsMode: true
                                    }
                                }
                            }
                        },
                        decisionEvents: {
                            orderBy: { createdAt: 'desc' },
                            take: 1,
                            select: {
                                action: true,
                                reason: true,
                                createdAt: true
                            }
                        }
                    },
                    orderBy: { checkIn: 'desc' },
                    take: limit,
                })
                : Promise.resolve([]),
            wants('NOTIFICATION')
                ? prisma.notification.findMany({
                    where: notificationWhere,
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                })
                : Promise.resolve([]),
            legacyOperationsEnabled
                ? prisma.interventionRequest.count({ where: interventionWhere })
                : Promise.resolve(0),
            prisma.ticket.count({ where: ticketWhere }),
            prisma.leaveRequest.count({ where: leaveWhere }),
            prisma.expense.count({ where: expenseWhere }),
            prisma.attendance.count({ where: attendanceGpsWhere }),
            prisma.notification.count({ where: notificationWhere }),
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
                    phoneNumber: maskPhoneNumber(request.senderPhone),
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
                    hasPhoto: Boolean(request.photoUrl),
                    assignedTo: request.assignedTo,
                    slaDueAt: request.slaDueAt?.toISOString() || null,
                    slaBreachedAt: request.slaBreachedAt?.toISOString() || null,
                    lastInternalCommentAt: request.lastInternalCommentAt?.toISOString() || null,
                    lastEventAt: request.lastEventAt?.toISOString() || null,
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
                    phoneNumber: maskPhoneNumber(ticket.user.phoneNumber),
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
                    phoneNumber: maskPhoneNumber(leave.employee.phoneNumber),
                },
                priority: leave.type === 'SICK' ? 'URGENT' as const : 'NORMAL' as const,
                status: leave.status,
                createdAt: leave.startDate.toISOString(),
                targetUrl: `/attendance?leave=${leave.id}`,
                availableActions: leave.status === 'PENDING' ? ['approve', 'reject', 'comment'] : ['open'],
                channel: 'WHATSAPP' as const,
                requiresDecision: leave.status === 'PENDING',
                metadata: {
                    startDate: leave.startDate.toISOString(),
                    endDate: leave.endDate.toISOString(),
                    isHalfDayStart: leave.isHalfDayStart,
                    isHalfDayEnd: leave.isHalfDayEnd,
                    hasDocument: Boolean(leave.documentUrl),
                    managerComment: leave.managerComment,
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
                    phoneNumber: maskPhoneNumber(expense.employee.phoneNumber),
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
                    hasPhoto: Boolean(expense.photoUrl),
                },
            })),
            ...attendanceGpsItems.map(attendance => {
                const status = attendanceInboxStatus(attendance.status, attendance.gpsVerdict, attendance.locationWarning);
                const site = attendance.employee.site;
                const distanceLabel = gpsDistanceSignal(attendance.distanceFromSite);
                const reason = attendance.verdictReason
                    || (status === 'GPS_REQUIRED'
                        ? 'Position GPS attendue pour valider ce pointage strict.'
                        : status === 'REJECTED'
                            ? `Pointage refusé ou hors zone : ${distanceLabel}.`
                            : `Pointage GPS à vérifier (${distanceLabel}).`);

                return {
                    id: attendance.id,
                    kind: 'ATTENDANCE_GPS' as const,
                    title: `Pointage à traiter - ${attendance.employee.name || 'Employé'}`,
                    summary: reason,
                    actor: {
                        id: attendance.employee.id,
                        name: attendance.employee.name || 'Employé',
                        phoneNumber: maskPhoneNumber(attendance.employee.phoneNumber),
                    },
                    priority: status === 'REJECTED' || status === 'GPS_REQUIRED' ? 'URGENT' as const : 'NORMAL' as const,
                    status,
                    createdAt: attendance.checkIn.toISOString(),
                    updatedAt: (attendance.proofReceivedAt || attendance.gpsCheckedAt || attendance.checkOut || attendance.checkIn).toISOString(),
                    targetUrl: `/attendance?attendance=${attendance.id}`,
                    availableActions: status === 'GPS_REQUIRED'
                        ? ['approve', 'reject', 'comment']
                        : status === 'PENDING_REVIEW' || status === 'GPS_NOT_CONFIGURED'
                            ? ['confirm', 'approve', 'reject', 'comment']
                            : ['open', 'comment'],
                    channel: 'WHATSAPP' as const,
                    requiresDecision: ['GPS_REQUIRED', 'PENDING_REVIEW', 'GPS_NOT_CONFIGURED'].includes(status),
                    metadata: {
                        attendanceId: attendance.id,
                        employeeId: attendance.employee.id,
                        workProfile: attendance.employee.workProfile,
                        siteId: attendance.siteId || site?.id || null,
                        siteName: site?.name || null,
                        siteGpsMode: site?.gpsMode || null,
                        gpsVerdict: attendance.gpsVerdict,
                        verdictReason: attendance.verdictReason,
                        distanceSignal: gpsDistanceSignal(attendance.distanceFromSite),
                        locationWarning: attendance.locationWarning,
                        proofReceivedAt: attendance.proofReceivedAt?.toISOString() || null,
                        gpsCheckedAt: attendance.gpsCheckedAt?.toISOString() || null,
                        hasPhoto: Boolean(attendance.photoUrl),
                        lastDecision: attendance.decisionEvents[0] || null,
                    },
                };
            }),
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
                const actionableDelta = Number(isActionable(b)) - Number(isActionable(a));
                if (actionableDelta !== 0) return actionableDelta;

                const priorityDelta = priorityRank(b.priority) - priorityRank(a.priority);
                if (priorityDelta !== 0) return priorityDelta;

                const approvalDelta = Number(isPendingApproval(b)) - Number(isPendingApproval(a));
                if (approvalDelta !== 0) return approvalDelta;

                return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
            })
            .slice(0, limit);

        const summary: InboxSummary = {
            actionable: sortedItems.filter(isActionable).length,
            urgent: sortedItems.filter(item => item.priority === 'URGENT').length,
            pendingApproval: sortedItems.filter(isPendingApproval).length,
            stale: sortedItems.filter(isStale).length,
        };

        return res.json({
            items: sortedItems,
            counts: {
                ALL: interventionCount + supportCount + leaveCount + expenseCount + attendanceGpsCount + notificationCount,
                ATTENDANCE_GPS: attendanceGpsCount,
                INTERVENTION: interventionCount,
                SUPPORT: supportCount,
                LEAVE: leaveCount,
                EXPENSE: expenseCount,
                NOTIFICATION: notificationCount,
            },
            summary,
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

async function updateLeaveDecision(params: {
    tenantId: string;
    managerId: string;
    leaveId: string;
    action: 'APPROVE' | 'REJECT' | 'COMMENT';
    comment: string | null;
}) {
    const { tenantId, managerId, leaveId, action, comment } = params;

    const leaveRequest = await prisma.leaveRequest.findFirst({
        where: {
            id: leaveId,
            tenantId,
            ...(action === 'COMMENT' ? {} : { status: 'PENDING' })
        },
        include: {
            employee: { select: { id: true, name: true, phoneNumber: true } }
        }
    });

    if (!leaveRequest) return null;

    const status = action === 'APPROVE'
        ? 'APPROVED'
        : action === 'REJECT'
            ? 'REJECTED'
            : leaveRequest.status;

    const updated = await prisma.leaveRequest.update({
        where: { id: leaveRequest.id },
        data: {
            status,
            managerComment: comment,
            ...(action === 'COMMENT'
                ? {}
                : {
                    validatedBy: managerId,
                    validatedAt: new Date()
                })
        },
        include: {
            employee: { select: { id: true, name: true, phoneNumber: true } }
        }
    });

    if (action !== 'COMMENT') {
        await dispatchWebhook(
            status === 'APPROVED' ? WEBHOOK_EVENTS.LEAVE_APPROVED : WEBHOOK_EVENTS.LEAVE_REJECTED,
            {
                leaveRequestId: updated.id,
                employeeId: updated.employee.id,
                employeeName: updated.employee.name,
                startDate: updated.startDate,
                endDate: updated.endDate,
                isHalfDayStart: updated.isHalfDayStart,
                isHalfDayEnd: updated.isHalfDayEnd,
                status,
                managerComment: updated.managerComment
            },
            tenantId
        );

        await notifyLeaveDecisionEmployee({
            tenantId,
            phoneNumber: updated.employee.phoneNumber,
            status,
            startDate: updated.startDate,
            endDate: updated.endDate,
            managerComment: updated.managerComment
        });
    }

    return {
        id: updated.id,
        status: updated.status,
        validatedBy: updated.validatedBy,
        validatedAt: updated.validatedAt?.toISOString() || null,
        managerComment: updated.managerComment,
        employee: publicEmployee(updated.employee),
        startDate: updated.startDate.toISOString(),
        endDate: updated.endDate.toISOString(),
        isHalfDayStart: updated.isHalfDayStart,
        isHalfDayEnd: updated.isHalfDayEnd,
        type: updated.type,
        hasDocument: Boolean(updated.documentUrl)
    };
}

function buildAttendanceDecisionData(action: InboxDecisionAction, reason: string | null, attendance: {
    status: string;
    gpsVerdict: string | null;
    verdictReason: string | null;
    locationWarning: boolean;
    gpsCheckedAt: Date | null;
}) {
    const decidedAt = new Date();
    const comment = reason || attendance.verdictReason || null;

    if (action === 'APPROVE') {
        return {
            decidedAt,
            eventAction: 'APPROVE_EXCEPTION',
            data: {
                status: 'PRESENT',
                locationWarning: false,
                gpsVerdict: 'APPROVED',
                verdictReason: reason
                    ? `Validation exceptionnelle manager: ${reason}`
                    : attendance.verdictReason || 'Validation exceptionnelle manager',
                gpsCheckedAt: attendance.gpsCheckedAt || decidedAt
            }
        };
    }

    if (action === 'REJECT') {
        return {
            decidedAt,
            eventAction: 'REJECT',
            data: {
                status: 'REJECTED',
                locationWarning: true,
                gpsVerdict: 'REJECTED',
                verdictReason: reason
                    ? `Refus manager: ${reason}`
                    : attendance.verdictReason || 'Refus manager',
                gpsCheckedAt: attendance.gpsCheckedAt || decidedAt
            }
        };
    }

    if (action === 'CONFIRM') {
        return {
            decidedAt,
            eventAction: 'CONFIRM',
            data: {
                status: attendance.status === 'WARNING' ? 'PRESENT' : attendance.status,
                locationWarning: false,
                gpsVerdict: attendance.gpsVerdict || (attendance.status === 'PENDING_GPS' ? 'PENDING' : 'APPROVED'),
                verdictReason: reason
                    ? `Verdict confirmé par le manager: ${reason}`
                    : attendance.verdictReason || 'Verdict confirmé par le manager',
                gpsCheckedAt: attendance.gpsCheckedAt || decidedAt
            }
        };
    }

    return {
        decidedAt,
        eventAction: 'COMMENT',
        data: {
            status: attendance.status,
            locationWarning: attendance.locationWarning,
            gpsVerdict: attendance.gpsVerdict,
            verdictReason: comment ? `Commentaire manager: ${comment}` : attendance.verdictReason,
            gpsCheckedAt: attendance.gpsCheckedAt
        }
    };
}

async function updateAttendanceDecision(params: {
    tenantId: string;
    managerId: string;
    attendanceId: string;
    action: InboxDecisionAction;
    comment: string | null;
}) {
    const { tenantId, managerId, attendanceId, action, comment } = params;

    const attendance = await prisma.attendance.findFirst({
        where: { id: attendanceId, tenantId },
        include: {
            employee: {
                select: {
                    id: true,
                    name: true,
                    phoneNumber: true,
                    workProfile: true,
                    site: { select: { id: true, name: true, radius: true, gpsMode: true } }
                }
            }
        }
    });

    if (!attendance) return null;

    const decision = buildAttendanceDecisionData(action, comment, attendance);

    const updated = await prisma.$transaction(async (tx) => {
        const updatedAttendance = await tx.attendance.update({
            where: { id: attendance.id },
            data: decision.data
        });

        await tx.attendanceDecisionEvent.create({
            data: {
                action: decision.eventAction,
                previousStatus: attendance.status,
                nextStatus: updatedAttendance.status,
                previousGpsVerdict: attendance.gpsVerdict,
                nextGpsVerdict: updatedAttendance.gpsVerdict,
                reason: comment || decision.data.verdictReason,
                managerId,
                tenantId,
                attendanceId: attendance.id,
                createdAt: decision.decidedAt
            }
        });

        return updatedAttendance;
    });

    return {
        id: updated.id,
        employee: publicEmployee(attendance.employee),
        status: updated.status,
        inboxStatus: attendanceInboxStatus(updated.status, updated.gpsVerdict, updated.locationWarning),
        gpsVerdict: updated.gpsVerdict,
        verdictReason: updated.verdictReason,
        gpsCheckedAt: updated.gpsCheckedAt,
        proofReceivedAt: updated.proofReceivedAt,
        hasPhoto: Boolean(updated.photoUrl),
        distanceSignal: gpsDistanceSignal(updated.distanceFromSite),
        locationWarning: updated.locationWarning,
        siteId: updated.siteId
    };
}

export const decideInboxItem = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = req.user?.tenantId;
        const managerId = req.user?.userId;

        if (!tenantId || !managerId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const kind = String(req.params.kind || '').trim().toUpperCase();
        const itemId = String(req.params.id || '');
        const action = parseInboxDecisionAction(req.body?.action);
        const comment = normalizeComment(req.body?.comment ?? req.body?.reason);

        if (!action) {
            return res.status(400).json({
                error: 'Action invalide',
                allowedActions: ['APPROVE', 'REJECT', 'COMMENT', 'CONFIRM']
            });
        }

        if (action === 'COMMENT' && !comment) {
            return res.status(400).json({ error: 'Un commentaire est requis pour COMMENT.' });
        }

        if (['LEAVE', 'ABSENCE'].includes(kind)) {
            if (!['APPROVE', 'REJECT', 'COMMENT'].includes(action)) {
                return res.status(400).json({
                    error: 'Action invalide pour une demande d’absence',
                    allowedActions: ['APPROVE', 'REJECT', 'COMMENT']
                });
            }

            const leaveRequest = await updateLeaveDecision({
                tenantId,
                managerId,
                leaveId: itemId,
                action: action as 'APPROVE' | 'REJECT' | 'COMMENT',
                comment
            });

            if (!leaveRequest) {
                return res.status(404).json({ error: 'Demande introuvable ou déjà traitée' });
            }

            return res.json({ success: true, kind: 'LEAVE', action, leaveRequest });
        }

        if (['ATTENDANCE_GPS', 'ATTENDANCE', 'GPS'].includes(kind)) {
            const attendance = await updateAttendanceDecision({
                tenantId,
                managerId,
                attendanceId: itemId,
                action,
                comment
            });

            if (!attendance) {
                return res.status(404).json({ error: 'Pointage introuvable' });
            }

            return res.json({ success: true, kind: 'ATTENDANCE_GPS', action, attendance });
        }

        return res.status(400).json({
            error: 'Type d’inbox non traitable',
            allowedKinds: ['LEAVE', 'ATTENDANCE_GPS']
        });
    } catch (error) {
        console.error('Error deciding inbox item:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const updateLeaveStatus = async (req: Request, res: Response): Promise<any> => {
    const status = typeof req.body?.status === 'string' ? req.body.status.trim().toUpperCase() : '';
    const action = status === 'APPROVED' ? 'APPROVE' : status === 'REJECTED' ? 'REJECT' : null;

    if (!action) {
        return res.status(400).json({
            error: 'Statut invalide',
            allowedStatuses: ['APPROVED', 'REJECTED']
        });
    }

    req.params.kind = 'leave';
    req.body.action = action;
    return decideInboxItem(req, res);
};
