import request from 'supertest';
import prisma from '../../src/lib/prisma';
import {
    describeIntegration,
    disconnectTestDatabase,
    resetTestDatabase,
    seedTenantGraph
} from './helpers/db';

describeIntegration('employees and sites business API integration', () => {
    afterAll(disconnectTestDatabase);

    beforeEach(async () => {
        await resetTestDatabase();
    });

    it('normalizes employee phones, rejects duplicates, and enforces tenant quota', async () => {
        const seeded = await seedTenantGraph('EmployeeRules');
        const { createApp } = await import('../../src/app');
        const app = createApp();

        const created = await request(app)
            .post('/api/employees')
            .set('Authorization', `Bearer ${seeded.token}`)
            .send({
                name: 'Quota Subject',
                phoneNumber: '+33 6 22 00 00 77',
                role: 'EMPLOYEE',
                workProfile: 'SEDENTARY',
                siteId: seeded.site.id
            })
            .expect(201);

        expect(created.body.employee).toMatchObject({
            name: 'Quota Subject',
            phoneNumber: '33622000077',
            role: 'EMPLOYEE'
        });

        await request(app)
            .post('/api/employees')
            .set('Authorization', `Bearer ${seeded.token}`)
            .send({
                name: 'Duplicate Phone',
                phoneNumber: '33622000077'
            })
            .expect(409);

        await prisma.tenant.update({
            where: { id: seeded.tenant.id },
            data: { maxEmployees: 3 }
        });

        await request(app)
            .post('/api/employees')
            .set('Authorization', `Bearer ${seeded.token}`)
            .send({
                name: 'Above Quota',
                phoneNumber: '+33622000078'
            })
            .expect(403)
            .expect(({ body }) => {
                expect(body.code).toBe('QUOTA_EXCEEDED');
                expect(body.current).toBe(3);
                expect(body.max).toBe(3);
            });
    });

    it('does not allow assigning an employee to another tenant site', async () => {
        const tenantA = await seedTenantGraph('EmployeeSiteA');
        const tenantB = await seedTenantGraph('EmployeeSiteB');
        const { createApp } = await import('../../src/app');

        await request(createApp())
            .post('/api/employees')
            .set('Authorization', `Bearer ${tenantA.token}`)
            .send({
                name: 'Cross Site Employee',
                phoneNumber: '+33622000088',
                siteId: tenantB.site.id
            })
            .expect(404);

        const leakedEmployee = await prisma.employee.findFirst({
            where: {
                tenantId: tenantA.tenant.id,
                phoneNumber: '33622000088'
            }
        });

        expect(leakedEmployee).toBeNull();
    });

    it('records site GPS updates as onboarding audit events', async () => {
        const seeded = await seedTenantGraph('SiteAudit');
        const { createApp } = await import('../../src/app');

        const response = await request(createApp())
            .put(`/api/sites/${seeded.site.id}`)
            .set('Authorization', `Bearer ${seeded.token}`)
            .send({
                name: 'Site Audit Updated',
                address: '10 rue de Rivoli',
                country: 'FR',
                latitude: 48.857,
                longitude: 2.351,
                radius: 90,
                gpsMode: 'STRICT'
            })
            .expect(200);

        expect(response.body.site).toMatchObject({
            id: seeded.site.id,
            name: 'Site Audit Updated',
            radius: 90,
            gpsMode: 'STRICT'
        });

        const event = await prisma.onboardingEvent.findFirstOrThrow({
            where: {
                tenantId: seeded.tenant.id,
                employeeId: seeded.manager.id,
                type: 'SITE_GPS_UPDATED'
            }
        });

        expect(event.metadata).toMatchObject({
            source: 'manager_dashboard',
            siteId: seeded.site.id,
            siteName: 'Site Audit Updated'
        });
    });
});
