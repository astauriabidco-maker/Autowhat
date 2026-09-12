import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { expect } from 'vitest';
import prisma from '../../src/lib/prisma';
import {
    describeIntegration,
    disconnectTestDatabase,
    resetTestDatabase,
    seedTenantGraph
} from './helpers/db';

function superAdminToken(superAdmin: { id: string; email: string; name: string }) {
    return jwt.sign(
        {
            id: superAdmin.id,
            email: superAdmin.email,
            name: superAdmin.name,
            role: 'SUPER_ADMIN'
        },
        process.env.JWT_SECRET || 'test-jwt-secret-change-me',
        { expiresIn: '1h' }
    );
}

async function seedSuperAdmin() {
    const superAdmin = await prisma.superAdmin.create({
        data: {
            email: 'superadmin-public-api@example.test',
            password: await bcrypt.hash('ValidPass123!', 8),
            name: 'Super Admin Public API'
        }
    });

    return {
        superAdmin,
        token: superAdminToken(superAdmin)
    };
}

describeIntegration('superadmin public API key management', () => {
    afterAll(disconnectTestDatabase);

    beforeEach(async () => {
        await resetTestDatabase();
    });

    it('creates, lists, and revokes tenant API keys without exposing raw tokens later', async () => {
        const { token: superAdminJwt } = await seedSuperAdmin();
        const seeded = await seedTenantGraph('PublicApiAdmin');
        const { createApp } = await import('../../src/app');
        const app = createApp();

        const scopes = await request(app)
            .get('/admin/api/scopes')
            .set('Authorization', `Bearer ${superAdminJwt}`)
            .expect(200);
        expect(scopes.body.scopes).toEqual(expect.arrayContaining(['tenant:read', 'messages:send']));

        const created = await request(app)
            .post(`/admin/tenants/${seeded.tenant.id}/api-keys`)
            .set('Authorization', `Bearer ${superAdminJwt}`)
            .send({
                name: 'ERP production',
                scopes: ['tenant:read', 'messages:send', 'invalid:scope']
            })
            .expect(201);

        const rawToken = created.body.token;
        expect(rawToken).toMatch(/^wp_test_/);
        expect(created.body.apiKey).toMatchObject({
            tenantId: seeded.tenant.id,
            name: 'ERP production',
            scopes: ['tenant:read', 'messages:send']
        });
        expect(created.body.apiKey.prefix).toBe(rawToken.slice(0, 18));

        const stored = await prisma.apiKey.findUniqueOrThrow({ where: { id: created.body.apiKey.id } });
        expect(stored.keyHash).not.toContain(rawToken);
        expect(stored.keyPrefix).toBe(rawToken.slice(0, 18));

        const listed = await request(app)
            .get('/admin/api/keys')
            .query({ tenantId: seeded.tenant.id })
            .set('Authorization', `Bearer ${superAdminJwt}`)
            .expect(200);
        expect(listed.body.apiKeys).toHaveLength(1);
        expect(JSON.stringify(listed.body)).not.toContain(rawToken);
        expect(listed.body.apiKeys[0]).toMatchObject({
            id: created.body.apiKey.id,
            tenantId: seeded.tenant.id,
            prefix: rawToken.slice(0, 18)
        });

        await request(app)
            .get('/api/v1/me')
            .set('Authorization', `Bearer ${rawToken}`)
            .expect(200);

        const revoked = await request(app)
            .post(`/admin/tenants/${seeded.tenant.id}/api-keys/${created.body.apiKey.id}/revoke`)
            .set('Authorization', `Bearer ${superAdminJwt}`)
            .expect(200);
        expect(revoked.body.apiKey).toMatchObject({
            id: created.body.apiKey.id,
            isActive: false
        });
        expect(JSON.stringify(revoked.body)).not.toContain(rawToken);

        await request(app)
            .get('/api/v1/me')
            .set('Authorization', `Bearer ${rawToken}`)
            .expect(401);
    });

    it('rejects invalid admin key creation payloads', async () => {
        const { token: superAdminJwt } = await seedSuperAdmin();
        const seeded = await seedTenantGraph('PublicApiInvalidAdmin');
        const { createApp } = await import('../../src/app');

        await request(createApp())
            .post(`/admin/tenants/${seeded.tenant.id}/api-keys`)
            .set('Authorization', `Bearer ${superAdminJwt}`)
            .send({
                name: '',
                scopes: ['tenant:read']
            })
            .expect(400);

        await request(createApp())
            .post(`/admin/tenants/${seeded.tenant.id}/api-keys`)
            .set('Authorization', `Bearer ${superAdminJwt}`)
            .send({
                name: 'No valid scopes',
                scopes: ['unknown:scope']
            })
            .expect(400);
    });
});
