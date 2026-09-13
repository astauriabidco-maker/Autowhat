import request from 'supertest';
import { expect, vi } from 'vitest';
import prisma from '../../src/lib/prisma';
import { createPublicApiKey, hashPublicApiKey } from '../../src/services/publicApiKeyService';
import {
    describeIntegration,
    disconnectTestDatabase,
    resetTestDatabase,
    seedTenantGraph
} from './helpers/db';

const whatsappServiceMocks = vi.hoisted(() => ({
    sendMessage: vi.fn(),
    sendTemplateMessage: vi.fn()
}));

vi.mock('../../src/services/whatsappService', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/services/whatsappService')>();
    return {
        ...actual,
        ...whatsappServiceMocks
    };
});

async function waitForApiRequestLog(apiKeyId: string) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const log = await prisma.apiRequestLog.findFirst({
            where: { apiKeyId },
            orderBy: { createdAt: 'desc' }
        });

        if (log) return log;
        await new Promise(resolve => setTimeout(resolve, 20));
    }

    throw new Error('Expected public API audit log to be written');
}

describeIntegration('public API v1 foundation', () => {
    afterAll(disconnectTestDatabase);

    beforeEach(async () => {
        await resetTestDatabase();
        vi.clearAllMocks();
        process.env.WHATSAPP_PHONE_ID = 'test_phone_number_id';
        process.env.WHATSAPP_API_TOKEN = 'test_whatsapp_token';
    });

    it('authenticates API keys without storing the raw token and exposes tenant identity', async () => {
        const seeded = await seedTenantGraph('PublicApiMe');
        const { token, apiKey } = await createPublicApiKey({
            tenantId: seeded.tenant.id,
            name: 'ERP test',
            scopes: ['tenant:read']
        });
        const { createApp } = await import('../../src/app');

        expect(apiKey.keyHash).toBe(hashPublicApiKey(token));
        expect(apiKey.keyHash).not.toContain(token);
        expect(apiKey.keyPrefix).toBe(token.slice(0, 18));

        await request(createApp())
            .get('/api/v1/me')
            .expect(401)
            .expect(({ body }) => {
                expect(body.error.code).toBe('unauthorized');
            });

        await request(createApp())
            .get('/api/v1/me')
            .set('Authorization', `Bearer ${token}`)
            .expect(200)
            .expect(({ body }) => {
                expect(body.data.tenant).toMatchObject({
                    id: seeded.tenant.id,
                    name: seeded.tenant.name,
                    country: 'FR',
                    plan: 'PRO'
                });
                expect(body.data.apiKey).toMatchObject({
                    id: apiKey.id,
                    name: 'ERP test',
                    prefix: apiKey.keyPrefix,
                    scopes: ['tenant:read']
                });
                expect(JSON.stringify(body)).not.toContain(token);
                expect(body.meta.requestId).toMatch(/^req_/);
            });

        const refreshedKey = await prisma.apiKey.findUniqueOrThrow({ where: { id: apiKey.id } });
        expect(refreshedKey.lastUsedAt).toBeTruthy();

        const auditLog = await waitForApiRequestLog(apiKey.id);
        expect(auditLog).toMatchObject({
            tenantId: seeded.tenant.id,
            apiKeyId: apiKey.id,
            method: 'GET',
            path: '/api/v1/me',
            statusCode: 200,
            scope: 'tenant:read'
        });
        expect(JSON.stringify(auditLog)).not.toContain(token);
    });

    it('rejects expired, revoked, inactive, and insufficiently scoped keys', async () => {
        const seeded = await seedTenantGraph('PublicApiScopes');
        const expired = await createPublicApiKey({
            tenantId: seeded.tenant.id,
            name: 'Expired',
            scopes: ['tenant:read'],
            expiresAt: new Date(Date.now() - 60_000)
        });
        const revoked = await createPublicApiKey({
            tenantId: seeded.tenant.id,
            name: 'Revoked',
            scopes: ['tenant:read']
        });
        const readOnly = await createPublicApiKey({
            tenantId: seeded.tenant.id,
            name: 'Read only',
            scopes: ['tenant:read']
        });
        await prisma.apiKey.update({
            where: { id: revoked.apiKey.id },
            data: { revokedAt: new Date() }
        });
        const { createApp } = await import('../../src/app');
        const app = createApp();

        await request(app)
            .get('/api/v1/me')
            .set('Authorization', `Bearer ${expired.token}`)
            .expect(401);

        await request(app)
            .get('/api/v1/me')
            .set('Authorization', `Bearer ${revoked.token}`)
            .expect(401);

        await request(app)
            .post('/api/v1/messages')
            .set('Authorization', `Bearer ${readOnly.token}`)
            .set('Idempotency-Key', 'scope-check-1')
            .send({
                employeeId: seeded.employee.id,
                message: 'Bonjour'
            })
            .expect(403)
            .expect(({ body }) => {
                expect(body.error.code).toBe('forbidden');
            });
    });

    it('sends messages through the tenant channel and replays identical idempotent requests', async () => {
        const seeded = await seedTenantGraph('PublicApiMessages');
        const { token } = await createPublicApiKey({
            tenantId: seeded.tenant.id,
            name: 'Messaging',
            scopes: ['tenant:read', 'messages:send']
        });
        const { createApp } = await import('../../src/app');
        const app = createApp();

        whatsappServiceMocks.sendMessage.mockResolvedValue(undefined);

        const payload = {
            employeeId: seeded.employee.id,
            message: 'Votre pointage est pris en compte.'
        };

        const first = await request(app)
            .post('/api/v1/messages')
            .set('Authorization', `Bearer ${token}`)
            .set('Idempotency-Key', 'erp-message-001')
            .send(payload)
            .expect(202);

        expect(first.body.data).toMatchObject({
            status: 'accepted',
            recipient: {
                employeeId: seeded.employee.id
            },
            channel: {
                intent: 'EMPLOYEE_NOTIFICATION'
            }
        });

        await request(app)
            .post('/api/v1/messages')
            .set('Authorization', `Bearer ${token}`)
            .set('Idempotency-Key', 'erp-message-001')
            .send(payload)
            .expect(202)
            .expect(({ body }) => {
                expect(body).toEqual(first.body);
            });

        expect(whatsappServiceMocks.sendMessage).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(first.body)).not.toContain(seeded.employee.phoneNumber);

        const idempotencyRecord = await prisma.apiIdempotencyKey.findFirstOrThrow();
        expect(idempotencyRecord.keyHash).not.toBe('erp-message-001');
        expect(JSON.stringify(idempotencyRecord.responseBody)).not.toContain(seeded.employee.phoneNumber);
    });

    it('exposes read-only employee and attendance data for MCP without raw PII', async () => {
        const seeded = await seedTenantGraph('PublicApiMcp');
        const checkIn = new Date('2026-09-12T07:05:00.000Z');
        const checkOut = new Date('2026-09-12T15:45:00.000Z');
        await prisma.attendance.create({
            data: {
                employeeId: seeded.employee.id,
                tenantId: seeded.tenant.id,
                siteId: seeded.site.id,
                checkIn,
                checkOut,
                status: 'LATE',
                gpsVerdict: 'WARNING',
                locationWarning: true,
                latitude: 48.8566,
                longitude: 2.3522,
                photoUrl: 'https://storage.example/private-proof.jpg'
            }
        });
        const { token } = await createPublicApiKey({
            tenantId: seeded.tenant.id,
            name: 'MCP read-only',
            scopes: ['employees:read', 'attendance:read']
        });
        const { createApp } = await import('../../src/app');
        const app = createApp();

        await request(app)
            .get('/api/v1/employees?limit=10')
            .set('Authorization', `Bearer ${token}`)
            .expect(200)
            .expect(({ body }) => {
                expect(body.data.employees).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            id: seeded.employee.id,
                            name: seeded.employee.name,
                            phoneLast4: seeded.employee.phoneNumber.slice(-4),
                            site: expect.objectContaining({
                                id: seeded.site.id,
                                name: seeded.site.name
                            })
                        })
                    ])
                );
                expect(JSON.stringify(body)).not.toContain(seeded.employee.phoneNumber);
            });

        await request(app)
            .get('/api/v1/attendance/summary?from=2026-09-12T00:00:00.000Z&to=2026-09-13T00:00:00.000Z')
            .set('Authorization', `Bearer ${token}`)
            .expect(200)
            .expect(({ body }) => {
                expect(body.data.totals).toMatchObject({
                    records: 1,
                    late: 1,
                    gpsWarnings: 1
                });
                expect(body.data.daily).toEqual([
                    expect.objectContaining({
                        date: '2026-09-12',
                        records: 1,
                        late: 1
                    })
                ]);
                expect(body.data.recentRecords[0]).toMatchObject({
                    id: expect.any(String),
                    status: 'LATE',
                    gpsVerdict: 'WARNING',
                    hasLocationWarning: true
                });
                expect(JSON.stringify(body)).not.toContain('48.8566');
                expect(JSON.stringify(body)).not.toContain('storage.example');
            });
    });

    it('rejects idempotency conflicts and cross-tenant recipients', async () => {
        const tenantA = await seedTenantGraph('PublicApiTenantA');
        const tenantB = await seedTenantGraph('PublicApiTenantB');
        const { token } = await createPublicApiKey({
            tenantId: tenantA.tenant.id,
            name: 'Messaging',
            scopes: ['messages:send']
        });
        const { createApp } = await import('../../src/app');
        const app = createApp();

        await request(app)
            .post('/api/v1/messages')
            .set('Authorization', `Bearer ${token}`)
            .set('Idempotency-Key', 'recipient-check-1')
            .send({
                employeeId: tenantB.employee.id,
                message: 'Bonjour'
            })
            .expect(404)
            .expect(({ body }) => {
                expect(body.error.code).toBe('recipient_not_found');
            });

        await request(app)
            .post('/api/v1/messages')
            .set('Authorization', `Bearer ${token}`)
            .set('Idempotency-Key', 'conflict-check-1')
            .send({
                employeeId: tenantA.employee.id,
                message: 'Premier message'
            })
            .expect(202);

        await request(app)
            .post('/api/v1/messages')
            .set('Authorization', `Bearer ${token}`)
            .set('Idempotency-Key', 'conflict-check-1')
            .send({
                employeeId: tenantA.employee.id,
                message: 'Message différent'
            })
            .expect(409)
            .expect(({ body }) => {
                expect(body.error.code).toBe('idempotency_conflict');
            });
    });
});
