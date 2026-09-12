import request from 'supertest';
import jwt from 'jsonwebtoken';
import {
    describeIntegration,
    disconnectTestDatabase,
    resetTestDatabase,
    seedTenantGraph,
    managerToken
} from './helpers/db';

describeIntegration('auth integration', () => {
    afterAll(disconnectTestDatabase);

    beforeEach(async () => {
        await resetTestDatabase();
    });

    it('logs in a manager against the test database and returns the current user', async () => {
        const seeded = await seedTenantGraph('AuthA');
        const { createApp } = await import('../../src/app');

        const loginResponse = await request(createApp())
            .post('/auth/login')
            .send({
                phoneNumber: seeded.manager.phoneNumber,
                password: 'ValidPass123!'
            })
            .expect(200);

        expect(loginResponse.body.token).toEqual(expect.any(String));
        expect(loginResponse.body.user).toMatchObject({
            id: seeded.manager.id,
            name: seeded.manager.name,
            role: 'MANAGER',
            tenant: seeded.tenant.name
        });

        const meResponse = await request(createApp())
            .get('/api/users/me')
            .set('Authorization', `Bearer ${loginResponse.body.token}`)
            .expect(200);

        expect(meResponse.body).toMatchObject({
            id: seeded.manager.id,
            role: 'MANAGER',
            tenant: {
                id: seeded.tenant.id,
                name: seeded.tenant.name
            }
        });
    });

    it('rejects invalid manager credentials', async () => {
        const seeded = await seedTenantGraph('AuthB');
        const { createApp } = await import('../../src/app');

        await request(createApp())
            .post('/auth/login')
            .send({
                phoneNumber: seeded.manager.phoneNumber,
                password: 'wrong-password'
            })
            .expect(401);
    });

    it('rejects expired tokens and non-manager dashboard access', async () => {
        const seeded = await seedTenantGraph('AuthC');
        const { createApp } = await import('../../src/app');
        const app = createApp();
        const expiredToken = jwt.sign(
            {
                userId: seeded.manager.id,
                tenantId: seeded.tenant.id,
                role: 'MANAGER'
            },
            process.env.JWT_SECRET || 'test-jwt-secret-change-me',
            { expiresIn: -1 }
        );

        await request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${expiredToken}`)
            .expect(401);

        await request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${managerToken({ ...seeded.employee, role: 'EMPLOYEE' })}`)
            .expect(403);
    });
});
