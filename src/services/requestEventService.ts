import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

export const REQUEST_ENTITY_TYPES = {
    INTERVENTION_REQUEST: 'INTERVENTION_REQUEST',
} as const;

export const REQUEST_EVENT_TYPES = {
    UPDATED: 'UPDATED',
    ASSIGNED: 'ASSIGNED',
    UNASSIGNED: 'UNASSIGNED',
    COMMENTED: 'COMMENTED',
    STATUS_CHANGED: 'STATUS_CHANGED',
    SLA_SET: 'SLA_SET',
    SLA_CLEARED: 'SLA_CLEARED',
} as const;

type RequestEventInput = {
    tenantId: string;
    entityType: string;
    entityId: string;
    type: string;
    actorType: string;
    actorId?: string | null;
    visibility?: string;
    message?: string | null;
    metadata?: Prisma.InputJsonValue;
};

export async function recordRequestEvent(input: RequestEventInput): Promise<void> {
    await prisma.$transaction([
        prisma.requestEvent.create({
            data: {
                tenantId: input.tenantId,
                entityType: input.entityType,
                entityId: input.entityId,
                type: input.type,
                actorType: input.actorType,
                actorId: input.actorId || null,
                visibility: input.visibility || 'INTERNAL',
                message: input.message || null,
                metadata: input.metadata || undefined,
            },
        }),
        prisma.interventionRequest.updateMany({
            where: {
                id: input.entityId,
                tenantId: input.tenantId,
            },
            data: {
                lastEventAt: new Date(),
                ...(input.type === REQUEST_EVENT_TYPES.COMMENTED ? { lastInternalCommentAt: new Date() } : {}),
            },
        }),
    ]);
}
