import request from 'supertest';
import { vi } from 'vitest';
import prisma from '../../src/lib/prisma';
import {
    describeIntegration,
    disconnectTestDatabase,
    resetTestDatabase,
    seedTenantGraph
} from './helpers/db';

const whatsappServiceMocks = vi.hoisted(() => ({
    sendMessage: vi.fn()
}));

vi.mock('../../src/services/whatsappService', () => whatsappServiceMocks);

describeIntegration('manager field HR inbox integration', () => {
    afterAll(disconnectTestDatabase);

    beforeEach(async () => {
        vi.clearAllMocks();
        await resetTestDatabase();
    });

    it('lists leave requests and GPS attendance anomalies as actionable HR inbox items', async () => {
        const seeded = await seedTenantGraph('InboxList');
        const leave = await prisma.leaveRequest.create({
            data: {
                startDate: new Date('2026-09-14T00:00:00.000Z'),
                endDate: new Date('2026-09-14T23:59:59.000Z'),
                type: 'SICK',
                status: 'PENDING',
                documentUrl: 'sick-note.pdf',
                employeeId: seeded.employee.id,
                tenantId: seeded.tenant.id
            }
        });
        const attendance = await prisma.attendance.create({
            data: {
                checkIn: new Date('2026-09-12T07:45:00.000Z'),
                status: 'WARNING',
                gpsVerdict: 'WARNING',
                verdictReason: 'Pointage hors rayon GPS.',
                locationWarning: true,
                distanceFromSite: 420,
                employeeId: seeded.employee.id,
                tenantId: seeded.tenant.id,
                siteId: seeded.site.id
            }
        });
        const { createApp } = await import('../../src/app');

        const response = await request(createApp())
            .get('/api/inbox?kind=leave,gps')
            .set('Authorization', `Bearer ${seeded.token}`)
            .expect(200);

        expect(response.body.counts).toMatchObject({
            LEAVE: 1,
            ATTENDANCE_GPS: 1
        });
        expect(response.body.items).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: leave.id,
                    kind: 'LEAVE',
                    priority: 'URGENT',
                    requiresDecision: true,
                    availableActions: expect.arrayContaining(['approve', 'reject', 'comment'])
                }),
                expect.objectContaining({
                    id: attendance.id,
                    kind: 'ATTENDANCE_GPS',
                    status: 'PENDING_REVIEW',
                    requiresDecision: true,
                    availableActions: expect.arrayContaining(['confirm', 'approve', 'reject', 'comment'])
                })
            ])
        );

        const serializedInbox = JSON.stringify(response.body);
        expect(serializedInbox).not.toContain(seeded.employee.phoneNumber);
        expect(serializedInbox).not.toContain('sick-note.pdf');
        expect(serializedInbox).not.toContain('420');
        expect(serializedInbox).not.toContain('"latitude"');
        expect(serializedInbox).not.toContain('"longitude"');

        const leaveItem = response.body.items.find((item: { id: string }) => item.id === leave.id);
        const gpsItem = response.body.items.find((item: { id: string }) => item.id === attendance.id);
        expect(leaveItem.actor.phoneNumber).toMatch(/••/);
        expect(leaveItem.metadata).toMatchObject({ hasDocument: true });
        expect(leaveItem.metadata).not.toHaveProperty('documentUrl');
        expect(gpsItem.metadata).toMatchObject({ hasPhoto: false });
        expect(gpsItem.metadata).not.toHaveProperty('photoUrl');
        expect(gpsItem.metadata).not.toHaveProperty('distanceFromSite');
    });

    it('lets a manager approve a leave request with a comment from the inbox', async () => {
        const seeded = await seedTenantGraph('InboxLeaveA');
        const leave = await prisma.leaveRequest.create({
            data: {
                startDate: new Date('2026-09-15T00:00:00.000Z'),
                endDate: new Date('2026-09-16T23:59:59.000Z'),
                status: 'PENDING',
                employeeId: seeded.employee.id,
                tenantId: seeded.tenant.id
            }
        });
        const { createApp } = await import('../../src/app');

        const response = await request(createApp())
            .patch(`/api/inbox/leave/${leave.id}/decision`)
            .set('Authorization', `Bearer ${seeded.token}`)
            .send({
                action: 'APPROVE',
                comment: 'Validé pour remplacement organisé.'
            })
            .expect(200);

        expect(response.body.leaveRequest).toMatchObject({
            id: leave.id,
            status: 'APPROVED',
            validatedBy: seeded.manager.id,
            managerComment: 'Validé pour remplacement organisé.',
            employee: {
                id: seeded.employee.id,
                name: seeded.employee.name
            }
        });
        expect(response.body.leaveRequest.employee).not.toHaveProperty('phoneNumber');

        const stored = await prisma.leaveRequest.findUniqueOrThrow({ where: { id: leave.id } });
        expect(stored.status).toBe('APPROVED');
        expect(stored.managerComment).toBe('Validé pour remplacement organisé.');
        expect(whatsappServiceMocks.sendMessage).toHaveBeenCalledWith(
            seeded.employee.phoneNumber.replace(/^\+/, ''),
            expect.stringContaining('Validé pour remplacement organisé.'),
            undefined
        );
    });

    it('blocks cross-tenant leave decisions from the inbox', async () => {
        const tenantA = await seedTenantGraph('InboxLeaveB');
        const tenantB = await seedTenantGraph('InboxLeaveC');
        const leave = await prisma.leaveRequest.create({
            data: {
                startDate: new Date('2026-09-17T00:00:00.000Z'),
                endDate: new Date('2026-09-17T23:59:59.000Z'),
                status: 'PENDING',
                employeeId: tenantA.employee.id,
                tenantId: tenantA.tenant.id
            }
        });
        const { createApp } = await import('../../src/app');

        await request(createApp())
            .patch(`/api/inbox/leave/${leave.id}/decision`)
            .set('Authorization', `Bearer ${tenantB.token}`)
            .send({ action: 'REJECT', comment: 'Tentative autre tenant' })
            .expect(404);

        const stored = await prisma.leaveRequest.findUniqueOrThrow({ where: { id: leave.id } });
        expect(stored.status).toBe('PENDING');
        expect(stored.managerComment).toBeNull();
    });

    it('records manager decisions on GPS attendance items from the inbox', async () => {
        const seeded = await seedTenantGraph('InboxGps');
        const attendance = await prisma.attendance.create({
            data: {
                checkIn: new Date('2026-09-12T08:15:00.000Z'),
                status: 'PENDING_GPS',
                gpsVerdict: 'PENDING',
                locationWarning: true,
                employeeId: seeded.employee.id,
                tenantId: seeded.tenant.id,
                siteId: seeded.site.id
            }
        });
        const { createApp } = await import('../../src/app');

        const response = await request(createApp())
            .patch(`/api/inbox/attendance_gps/${attendance.id}/decision`)
            .set('Authorization', `Bearer ${seeded.token}`)
            .send({
                action: 'REJECT',
                comment: 'Aucune preuve GPS reçue après relance.'
            })
            .expect(200);

        expect(response.body.attendance).toMatchObject({
            id: attendance.id,
            status: 'REJECTED',
            gpsVerdict: 'REJECTED',
            locationWarning: true,
            distanceSignal: 'distance non disponible'
        });
        expect(response.body.attendance).not.toHaveProperty('photoUrl');
        expect(response.body.attendance).not.toHaveProperty('latitude');
        expect(response.body.attendance).not.toHaveProperty('longitude');
        expect(response.body.attendance).not.toHaveProperty('distanceFromSite');

        const event = await prisma.attendanceDecisionEvent.findFirstOrThrow({
            where: {
                attendanceId: attendance.id,
                tenantId: seeded.tenant.id
            }
        });
        expect(event).toMatchObject({
            action: 'REJECT',
            previousStatus: 'PENDING_GPS',
            nextStatus: 'REJECTED',
            previousGpsVerdict: 'PENDING',
            nextGpsVerdict: 'REJECTED',
            managerId: seeded.manager.id,
            reason: 'Aucune preuve GPS reçue après relance.'
        });
    });
});
