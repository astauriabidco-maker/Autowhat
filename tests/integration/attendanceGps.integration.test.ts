import prisma from '../../src/lib/prisma';
import request from 'supertest';
import {
    describeIntegration,
    disconnectTestDatabase,
    resetTestDatabase,
    seedTenantGraph
} from './helpers/db';

describeIntegration('attendance GPS integration', () => {
    afterAll(disconnectTestDatabase);

    beforeEach(async () => {
        await resetTestDatabase();
    });

    it('creates a pending GPS attendance for a sedentary employee on a strict geofenced site', async () => {
        const seeded = await seedTenantGraph('GpsA');
        const { checkIn } = await import('../../src/services/attendanceService');

        const employee = {
            ...seeded.employee,
            tenant: seeded.tenant
        };

        const result = await checkIn(employee, new Date('2026-09-11T07:55:00.000Z'));

        expect(result).toMatchObject({
            success: true,
            requiresLocation: true
        });

        const attendance = await prisma.attendance.findFirstOrThrow({
            where: {
                employeeId: seeded.employee.id,
                tenantId: seeded.tenant.id
            }
        });

        expect(attendance).toMatchObject({
            siteId: seeded.site.id,
            status: 'PENDING_GPS',
            gpsVerdict: 'PENDING',
            locationWarning: true,
            tenantId: seeded.tenant.id
        });
    });

    it('prevents checkout while the latest attendance still waits for GPS proof', async () => {
        const seeded = await seedTenantGraph('GpsB');
        const { checkIn, checkOut } = await import('../../src/services/attendanceService');
        const employee = {
            ...seeded.employee,
            tenant: seeded.tenant
        };

        await checkIn(employee, new Date('2026-09-11T07:55:00.000Z'));

        const result = await checkOut(employee, new Date('2026-09-11T16:30:00.000Z'));

        expect(result).toMatchObject({
            success: false,
            message: expect.stringContaining('attend encore votre position WhatsApp')
        });
    });

    it('allows direct check-in and checkout when GPS is disabled for the site', async () => {
        const seeded = await seedTenantGraph('GpsDisabled');
        await prisma.site.update({
            where: { id: seeded.site.id },
            data: {
                gpsMode: 'DISABLED',
                latitude: null,
                longitude: null
            }
        });
        const { checkIn, checkOut } = await import('../../src/services/attendanceService');
        const employee = {
            ...seeded.employee,
            tenant: seeded.tenant
        };

        const checkInResult = await checkIn(employee, new Date('2026-09-11T07:55:00.000Z'));
        const checkOutResult = await checkOut(employee, new Date('2026-09-11T16:30:00.000Z'));

        const attendance = await prisma.attendance.findFirstOrThrow({
            where: {
                employeeId: seeded.employee.id,
                tenantId: seeded.tenant.id
            }
        });

        expect(checkInResult).toMatchObject({
            success: true,
            requiresLocation: false
        });
        expect(checkOutResult).toMatchObject({
            success: true
        });
        expect(attendance).toMatchObject({
            status: 'PRESENT',
            gpsVerdict: 'NOT_REQUIRED',
            locationWarning: false
        });
        expect(attendance.checkOut?.toISOString()).toBe('2026-09-11T16:30:00.000Z');
    });

    it('keeps strict sites without coordinates as warning instead of waiting for GPS proof', async () => {
        const seeded = await seedTenantGraph('GpsStrictNoCoordinates');
        await prisma.site.update({
            where: { id: seeded.site.id },
            data: {
                gpsMode: 'STRICT',
                latitude: null,
                longitude: null
            }
        });
        const { checkIn, checkOut } = await import('../../src/services/attendanceService');
        const employee = {
            ...seeded.employee,
            tenant: seeded.tenant
        };

        const checkInResult = await checkIn(employee, new Date('2026-09-11T07:55:00.000Z'));
        const checkOutResult = await checkOut(employee, new Date('2026-09-11T16:30:00.000Z'));

        const attendance = await prisma.attendance.findFirstOrThrow({
            where: {
                employeeId: seeded.employee.id,
                tenantId: seeded.tenant.id
            }
        });

        expect(checkInResult).toMatchObject({
            success: true,
            requiresLocation: false
        });
        expect(checkOutResult).toMatchObject({
            success: true
        });
        expect(attendance).toMatchObject({
            status: 'WARNING',
            gpsVerdict: 'NOT_CONFIGURED',
            locationWarning: true,
            verdictReason: 'Site en mode GPS strict sans coordonnées configurées.'
        });
        expect(attendance.checkOut?.toISOString()).toBe('2026-09-11T16:30:00.000Z');
    });

    it('lets a manager approve a pending GPS attendance and records the decision event', async () => {
        const seeded = await seedTenantGraph('GpsDecisionA');
        const { checkIn } = await import('../../src/services/attendanceService');
        const employee = {
            ...seeded.employee,
            tenant: seeded.tenant
        };

        await checkIn(employee, new Date('2026-09-11T07:55:00.000Z'));
        const attendance = await prisma.attendance.findFirstOrThrow({
            where: {
                employeeId: seeded.employee.id,
                tenantId: seeded.tenant.id
            }
        });
        const { createApp } = await import('../../src/app');

        const response = await request(createApp())
            .patch(`/api/attendance/${attendance.id}/verdict`)
            .set('Authorization', `Bearer ${seeded.token}`)
            .send({
                action: 'APPROVE_EXCEPTION',
                reason: 'Employé confirmé par le chef de chantier'
            })
            .expect(200);

        expect(response.body.attendance).toMatchObject({
            id: attendance.id,
            status: 'PRESENT',
            gpsVerdict: 'APPROVED',
            locationWarning: false,
            siteId: seeded.site.id
        });

        const event = await prisma.attendanceDecisionEvent.findFirstOrThrow({
            where: {
                attendanceId: attendance.id,
                tenantId: seeded.tenant.id
            }
        });

        expect(event).toMatchObject({
            action: 'APPROVE_EXCEPTION',
            previousStatus: 'PENDING_GPS',
            nextStatus: 'PRESENT',
            previousGpsVerdict: 'PENDING',
            nextGpsVerdict: 'APPROVED',
            managerId: seeded.manager.id
        });
    });

    it('blocks cross-tenant manager decisions on attendance verdicts', async () => {
        const tenantA = await seedTenantGraph('GpsDecisionB');
        const tenantB = await seedTenantGraph('GpsDecisionC');
        const { checkIn } = await import('../../src/services/attendanceService');

        await checkIn({
            ...tenantA.employee,
            tenant: tenantA.tenant
        }, new Date('2026-09-11T07:55:00.000Z'));

        const attendance = await prisma.attendance.findFirstOrThrow({
            where: {
                employeeId: tenantA.employee.id,
                tenantId: tenantA.tenant.id
            }
        });
        const { createApp } = await import('../../src/app');

        await request(createApp())
            .patch(`/api/attendance/${attendance.id}/verdict`)
            .set('Authorization', `Bearer ${tenantB.token}`)
            .send({
                action: 'REJECT',
                reason: 'Tentative cross tenant'
            })
            .expect(404);
    });
});
