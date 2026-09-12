import request from 'supertest';
import {
    describeIntegration,
    disconnectTestDatabase,
    resetTestDatabase,
    seedTenantGraph
} from './helpers/db';

describeIntegration('tenant isolation integration', () => {
    afterAll(disconnectTestDatabase);

    beforeEach(async () => {
        await resetTestDatabase();
    });

    it('keeps employees scoped to the authenticated manager tenant', async () => {
        const tenantA = await seedTenantGraph('IsolateA');
        const tenantB = await seedTenantGraph('IsolateB');
        const { createApp } = await import('../../src/app');

        const createResponse = await request(createApp())
            .post('/api/employees')
            .set('Authorization', `Bearer ${tenantA.token}`)
            .send({
                name: 'A-only Employee',
                phoneNumber: '+33622000001',
                role: 'EMPLOYEE'
            })
            .expect(201);

        const employeeId = createResponse.body.employee.id;

        const tenantAEmployees = await request(createApp())
            .get('/api/employees')
            .set('Authorization', `Bearer ${tenantA.token}`)
            .expect(200);

        expect(tenantAEmployees.body.employees.map((employee: { id: string }) => employee.id))
            .toContain(employeeId);

        const tenantBEmployees = await request(createApp())
            .get('/api/employees')
            .set('Authorization', `Bearer ${tenantB.token}`)
            .expect(200);

        expect(tenantBEmployees.body.employees.map((employee: { id: string }) => employee.id))
            .not.toContain(employeeId);

        await request(createApp())
            .patch(`/api/employees/${employeeId}`)
            .set('Authorization', `Bearer ${tenantB.token}`)
            .send({ name: 'Cross tenant rename' })
            .expect(404);
    });

    it('keeps sites scoped to the authenticated manager tenant', async () => {
        const tenantA = await seedTenantGraph('SiteA');
        const tenantB = await seedTenantGraph('SiteB');
        const { createApp } = await import('../../src/app');

        const createResponse = await request(createApp())
            .post('/api/sites')
            .set('Authorization', `Bearer ${tenantA.token}`)
            .send({
                name: 'A-only Site',
                country: 'FR',
                latitude: 48.85,
                longitude: 2.35,
                radius: 120,
                gpsMode: 'WARNING'
            })
            .expect(201);

        const siteId = createResponse.body.site.id;

        const tenantASites = await request(createApp())
            .get('/api/sites')
            .set('Authorization', `Bearer ${tenantA.token}`)
            .expect(200);

        expect(tenantASites.body.sites.map((site: { id: string }) => site.id))
            .toContain(siteId);

        const tenantBSites = await request(createApp())
            .get('/api/sites')
            .set('Authorization', `Bearer ${tenantB.token}`)
            .expect(200);

        expect(tenantBSites.body.sites.map((site: { id: string }) => site.id))
            .not.toContain(siteId);

        await request(createApp())
            .put(`/api/sites/${siteId}`)
            .set('Authorization', `Bearer ${tenantB.token}`)
            .send({ name: 'Cross tenant site rename' })
            .expect(404);
    });
});
