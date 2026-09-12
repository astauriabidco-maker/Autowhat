import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, expect } from 'vitest';
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
            email: 'superadmin-whatsapp@example.test',
            password: await bcrypt.hash('ValidPass123!', 8),
            name: 'Super Admin WhatsApp'
        }
    });

    return {
        superAdmin,
        token: superAdminToken(superAdmin)
    };
}

describeIntegration('superadmin WhatsApp system numbers API', () => {
    afterAll(disconnectTestDatabase);

    beforeEach(async () => {
        await resetTestDatabase();
    });

    it('imports a system number and assigns it exclusively to a tenant', async () => {
        const { token } = await seedSuperAdmin();
        const seeded = await seedTenantGraph('AdminSystemNumber');
        const { createApp } = await import('../../src/app');
        const app = createApp();

        const created = await request(app)
            .post('/admin/whatsapp-numbers')
            .set('Authorization', `Bearer ${token}`)
            .send({
                phoneNumberId: 'phone_admin_system',
                displayNumber: '+33122222222',
                countryCode: 'FR',
                accessToken: 'token_admin_system',
                wabaId: 'waba_admin_system',
                channelType: 'DEDICATED',
                setupStatus: 'ACTIVE',
                planScope: 'PRO',
                maxTenants: 1
            })
            .expect(201);

        await request(app)
            .post(`/admin/whatsapp-numbers/${created.body.id}/assign`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                tenantId: seeded.tenant.id,
                exclusive: true
            })
            .expect(200);

        const list = await request(app)
            .get('/admin/whatsapp-numbers')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(list.body.numbers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: created.body.id,
                phoneNumberId: 'phone_admin_system',
                displayNumber: '+33122222222',
                channelType: 'DEDICATED',
                setupStatus: 'ACTIVE',
                planScope: 'PRO',
                maxTenants: 1,
                tenantCount: 1,
                availableSlots: 0,
                tenants: [expect.objectContaining({ id: seeded.tenant.id })]
            })
        ]));
        expect(list.body.health).toEqual(expect.objectContaining({
            summary: expect.objectContaining({
                totalAlerts: expect.any(Number),
                activeTenants: expect.any(Number),
                activeNumbers: expect.any(Number),
                availableSharedSlots: expect.any(Number)
            }),
            alerts: expect.any(Array)
        }));

        await request(app)
            .post('/admin/whatsapp-numbers/health/check')
            .set('Authorization', `Bearer ${token}`)
            .send({ force: true })
            .expect(200)
            .expect(response => {
                expect(response.body).toEqual(expect.objectContaining({
                    success: expect.any(Boolean),
                    alertsDetected: expect.any(Number),
                    notificationsSent: expect.any(Number)
                }));
            });
    });

    it('rejects manual assignment when tenant country does not match the system number', async () => {
        const { token } = await seedSuperAdmin();
        const seeded = await seedTenantGraph('AdminCountryMismatch');
        const { createApp } = await import('../../src/app');
        const app = createApp();

        const created = await request(app)
            .post('/admin/whatsapp-numbers')
            .set('Authorization', `Bearer ${token}`)
            .send({
                phoneNumberId: 'phone_admin_country_mismatch',
                displayNumber: '+237650000003',
                countryCode: 'CM',
                accessToken: 'token_admin_country_mismatch',
                wabaId: 'waba_admin_country_mismatch',
                channelType: 'DEDICATED',
                setupStatus: 'ACTIVE',
                planScope: 'PRO',
                maxTenants: 1
            })
            .expect(201);

        await request(app)
            .post(`/admin/whatsapp-numbers/${created.body.id}/assign`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                tenantId: seeded.tenant.id,
                exclusive: true
            })
            .expect(409)
            .expect(response => {
                expect(response.body.error).toBe('Ce numéro WhatsApp ne correspond pas au pays du client.');
            });
    });
});
