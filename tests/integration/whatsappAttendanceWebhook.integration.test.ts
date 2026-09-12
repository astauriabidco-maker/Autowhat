import crypto from 'crypto';
import request from 'supertest';
import { beforeEach, expect, vi } from 'vitest';
import prisma from '../../src/lib/prisma';
import { getSystemNumberPoolHealth } from '../../src/services/numberAllocationService';
import {
    describeIntegration,
    disconnectTestDatabase,
    resetTestDatabase,
    seedTenantGraph
} from './helpers/db';

const whatsappServiceMocks = vi.hoisted(() => ({
    registerWebhookChannelCredentials: vi.fn(),
    sendMessage: vi.fn(),
    sendInteractiveList: vi.fn(),
    sendInteractiveButtons: vi.fn(),
    sendDocument: vi.fn(),
    sendTemplateMessage: vi.fn()
}));

const webhookServiceMocks = vi.hoisted(() => ({
    dispatchWebhook: vi.fn(),
    WEBHOOK_EVENTS: {
        CHECK_IN: 'CHECK_IN',
        CHECK_OUT: 'CHECK_OUT',
        LATE_ARRIVAL: 'LATE_ARRIVAL'
    }
}));

const notificationServiceMocks = vi.hoisted(() => ({
    notifyAllManagers: vi.fn()
}));

vi.mock('../../src/services/whatsappService', () => whatsappServiceMocks);
vi.mock('../../src/services/webhookService', () => webhookServiceMocks);
vi.mock('../../src/services/notificationService', () => notificationServiceMocks);

function whatsappBody(message: Record<string, any>, phoneNumberId = 'phone_number_test') {
    return {
        object: 'whatsapp_business_account',
        entry: [
            {
                changes: [
                    {
                        value: {
                            metadata: {
                                phone_number_id: phoneNumberId
                            },
                            messages: [message]
                        }
                    }
                ]
            }
        ]
    };
}

function signedHeaders(body: unknown) {
    const raw = JSON.stringify(body);
    return {
        raw,
        signature: `sha256=${crypto
            .createHmac('sha256', process.env.WHATSAPP_APP_SECRET || 'test-meta-secret')
            .update(raw)
            .digest('hex')}`
    };
}

describeIntegration('WhatsApp attendance webhook integration', () => {
    afterAll(disconnectTestDatabase);

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.stubEnv('WHATSAPP_APP_SECRET', 'test-meta-secret');
        await resetTestDatabase();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('activates a new employee on the first WhatsApp text without creating attendance yet', async () => {
        const seeded = await seedTenantGraph('WhatsAppActivation');
        const body = whatsappBody({
            id: 'wamid.activation',
            from: seeded.employee.phoneNumber,
            timestamp: `${Math.floor(new Date('2026-09-11T07:50:00.000Z').getTime() / 1000)}`,
            type: 'text',
            text: {
                body: 'Bonjour'
            }
        });
        const { raw, signature } = signedHeaders(body);
        const { createApp } = await import('../../src/app');

        await request(createApp())
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', signature)
            .send(raw)
            .expect(200);

        const employee = await prisma.employee.findUniqueOrThrow({
            where: { id: seeded.employee.id }
        });
        const attendanceCount = await prisma.attendance.count({
            where: {
                employeeId: seeded.employee.id,
                tenantId: seeded.tenant.id
            }
        });

        expect(employee.hasCompletedOnboarding).toBe(true);
        expect(attendanceCount).toBe(0);
        expect(whatsappServiceMocks.sendInteractiveButtons).toHaveBeenCalledWith(
            seeded.employee.phoneNumber,
            expect.stringContaining('Votre accès WhatsPoint est actif'),
            expect.arrayContaining([
                expect.objectContaining({ id: 'btn_employee_first_checkin' })
            ]),
            'phone_number_test'
        );
    });

    it('does not activate a new employee when the first WhatsApp text is STOP', async () => {
        const seeded = await seedTenantGraph('WhatsAppActivationStop');
        const body = whatsappBody({
            id: 'wamid.activation.stop',
            from: seeded.employee.phoneNumber,
            timestamp: `${Math.floor(new Date('2026-09-11T07:50:00.000Z').getTime() / 1000)}`,
            type: 'text',
            text: {
                body: 'STOP'
            }
        });
        const { raw, signature } = signedHeaders(body);
        const { createApp } = await import('../../src/app');

        await request(createApp())
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', signature)
            .send(raw)
            .expect(200);

        const employee = await prisma.employee.findUniqueOrThrow({
            where: { id: seeded.employee.id }
        });
        const attendanceCount = await prisma.attendance.count({
            where: {
                employeeId: seeded.employee.id,
                tenantId: seeded.tenant.id
            }
        });

        expect(employee.hasCompletedOnboarding).toBe(false);
        expect(attendanceCount).toBe(0);
        expect(whatsappServiceMocks.sendInteractiveButtons).not.toHaveBeenCalledWith(
            seeded.employee.phoneNumber,
            expect.stringContaining('Votre accès WhatsPoint est actif'),
            expect.anything(),
            'phone_number_test'
        );
    });

    it('creates the first pending GPS check-in from the employee activation button', async () => {
        const seeded = await seedTenantGraph('WhatsAppFirstButton');
        await prisma.employee.update({
            where: { id: seeded.employee.id },
            data: { hasCompletedOnboarding: true }
        });
        const body = whatsappBody({
            id: 'wamid.first.button',
            from: seeded.employee.phoneNumber,
            timestamp: `${Math.floor(new Date('2026-09-11T07:55:00.000Z').getTime() / 1000)}`,
            type: 'interactive',
            interactive: {
                type: 'button_reply',
                button_reply: {
                    id: 'btn_employee_first_checkin',
                    title: 'Pointer'
                }
            }
        });
        const { raw, signature } = signedHeaders(body);
        const { createApp } = await import('../../src/app');

        await request(createApp())
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', signature)
            .send(raw)
            .expect(200);

        const attendance = await prisma.attendance.findFirstOrThrow({
            where: {
                employeeId: seeded.employee.id,
                tenantId: seeded.tenant.id
            }
        });
        const firstCheckinEvent = await prisma.onboardingEvent.findFirstOrThrow({
            where: {
                tenantId: seeded.tenant.id,
                employeeId: seeded.employee.id,
                type: 'FIRST_CHECKIN'
            }
        });

        expect(attendance).toMatchObject({
            status: 'PENDING_GPS',
            gpsVerdict: 'PENDING',
            locationWarning: true,
            siteId: seeded.site.id
        });
        expect(firstCheckinEvent.metadata).toMatchObject({ source: 'WHATSAPP' });
        expect(whatsappServiceMocks.sendMessage).toHaveBeenCalledWith(
            seeded.employee.phoneNumber,
            expect.stringContaining('Envoyez maintenant votre position WhatsApp'),
            'phone_number_test'
        );
    });

    it('opens the main menu from the employee activation menu button without creating attendance', async () => {
        const seeded = await seedTenantGraph('WhatsAppFirstMenuButton');
        await prisma.employee.update({
            where: { id: seeded.employee.id },
            data: { hasCompletedOnboarding: true }
        });
        const body = whatsappBody({
            id: 'wamid.first.menu.button',
            from: seeded.employee.phoneNumber,
            timestamp: `${Math.floor(new Date('2026-09-11T07:55:00.000Z').getTime() / 1000)}`,
            type: 'interactive',
            interactive: {
                type: 'button_reply',
                button_reply: {
                    id: 'btn_employee_first_menu',
                    title: 'Menu'
                }
            }
        });
        const { raw, signature } = signedHeaders(body);
        const { createApp } = await import('../../src/app');

        await request(createApp())
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', signature)
            .send(raw)
            .expect(200);

        const attendanceCount = await prisma.attendance.count({
            where: {
                employeeId: seeded.employee.id,
                tenantId: seeded.tenant.id
            }
        });

        expect(attendanceCount).toBe(0);
        expect(whatsappServiceMocks.sendInteractiveList).toHaveBeenCalledWith(
            seeded.employee.phoneNumber,
            expect.stringContaining('Que souhaitez-vous faire'),
            'Ouvrir le Menu',
            expect.any(Array),
            'phone_number_test'
        );
    });

    it('does not duplicate attendance when the first check-in button is replayed', async () => {
        const seeded = await seedTenantGraph('WhatsAppFirstButtonReplay');
        await prisma.employee.update({
            where: { id: seeded.employee.id },
            data: { hasCompletedOnboarding: true }
        });
        const { createApp } = await import('../../src/app');
        const app = createApp();

        for (const id of ['wamid.first.button.replay.1', 'wamid.first.button.replay.2']) {
            const body = whatsappBody({
                id,
                from: seeded.employee.phoneNumber,
                timestamp: `${Math.floor(new Date('2026-09-11T07:55:00.000Z').getTime() / 1000)}`,
                type: 'interactive',
                interactive: {
                    type: 'button_reply',
                    button_reply: {
                        id: 'btn_employee_first_checkin',
                        title: 'Pointer'
                    }
                }
            });
            const { raw, signature } = signedHeaders(body);

            await request(app)
                .post('/webhook')
                .set('Content-Type', 'application/json')
                .set('X-Hub-Signature-256', signature)
                .send(raw)
                .expect(200);
        }

        const attendanceCount = await prisma.attendance.count({
            where: {
                employeeId: seeded.employee.id,
                tenantId: seeded.tenant.id
            }
        });

        expect(attendanceCount).toBe(1);
        expect(whatsappServiceMocks.sendMessage).toHaveBeenCalledWith(
            seeded.employee.phoneNumber,
            expect.stringContaining('Vous avez déjà pointé aujourd'),
            'phone_number_test'
        );
    });

    it('creates a pending GPS check-in through the WhatsApp webhook and asks for location proof', async () => {
        const seeded = await seedTenantGraph('WhatsAppCheckin');
        await prisma.employee.update({
            where: { id: seeded.employee.id },
            data: { hasCompletedOnboarding: true }
        });
        const body = whatsappBody({
            id: 'wamid.checkin',
            from: seeded.employee.phoneNumber,
            timestamp: `${Math.floor(new Date('2026-09-11T07:55:00.000Z').getTime() / 1000)}`,
            type: 'text',
            text: {
                body: 'Hi'
            }
        });
        const { raw, signature } = signedHeaders(body);
        const { createApp } = await import('../../src/app');

        await request(createApp())
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', signature)
            .send(raw)
            .expect(200);

        const attendance = await prisma.attendance.findFirstOrThrow({
            where: {
                employeeId: seeded.employee.id,
                tenantId: seeded.tenant.id
            }
        });

        expect(attendance).toMatchObject({
            status: 'PENDING_GPS',
            gpsVerdict: 'PENDING',
            locationWarning: true,
            siteId: seeded.site.id
        });
        expect(whatsappServiceMocks.sendMessage).toHaveBeenCalledWith(
            seeded.employee.phoneNumber,
            expect.stringContaining('Envoyez maintenant votre position WhatsApp'),
            'phone_number_test'
        );
    });

    it('routes inbound BYON messages by phone number id before matching duplicate employee phones', async () => {
        const firstTenant = await seedTenantGraph('WhatsAppByonFirst');
        const secondTenant = await seedTenantGraph('WhatsAppByonSecond');
        await prisma.employee.update({
            where: { id: firstTenant.employee.id },
            data: {
                phoneNumber: '+33699000001',
                hasCompletedOnboarding: true
            }
        });
        await prisma.employee.update({
            where: { id: secondTenant.employee.id },
            data: {
                phoneNumber: '+33699000001',
                hasCompletedOnboarding: true
            }
        });
        await prisma.whatsAppConfig.create({
            data: {
                tenantId: secondTenant.tenant.id,
                phoneNumberId: 'phone_byon_second',
                accessToken: 'token_byon_second',
                displayName: 'Second Tenant WhatsApp',
                isActive: true
            }
        });

        const body = whatsappBody({
            id: 'wamid.byon.scoped',
            from: '33699000001',
            timestamp: `${Math.floor(new Date('2026-09-11T07:55:00.000Z').getTime() / 1000)}`,
            type: 'text',
            text: { body: 'Hi' }
        }, 'phone_byon_second');
        const { raw, signature } = signedHeaders(body);
        const { createApp } = await import('../../src/app');

        await request(createApp())
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', signature)
            .send(raw)
            .expect(200);

        const firstAttendanceCount = await prisma.attendance.count({
            where: {
                employeeId: firstTenant.employee.id,
                tenantId: firstTenant.tenant.id
            }
        });
        const secondAttendanceCount = await prisma.attendance.count({
            where: {
                employeeId: secondTenant.employee.id,
                tenantId: secondTenant.tenant.id
            }
        });

        expect(firstAttendanceCount).toBe(0);
        expect(secondAttendanceCount).toBe(1);
        expect(whatsappServiceMocks.registerWebhookChannelCredentials).toHaveBeenCalledWith(
            'phone_byon_second',
            expect.objectContaining({
                phoneNumberId: 'phone_byon_second',
                accessToken: 'token_byon_second',
                displayName: 'Second Tenant WhatsApp'
            })
        );
        expect(whatsappServiceMocks.sendMessage).toHaveBeenCalledWith(
            '33699000001',
            expect.stringContaining('Envoyez maintenant votre position WhatsApp'),
            'phone_byon_second'
        );
    });

    it('routes inbound shared system-number messages through the tenants assigned to that number', async () => {
        const firstTenant = await seedTenantGraph('WhatsAppSystemFirst');
        const secondTenant = await seedTenantGraph('WhatsAppSystemSecond');
        const systemNumber = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId: 'phone_system_second',
                displayNumber: '+33100000002',
                countryCode: 'FR',
                accessToken: 'token_system_second',
                wabaId: 'waba_system_second',
                isActive: true,
                channelType: 'SHARED',
                setupStatus: 'ACTIVE',
                maxTenants: 10
            }
        });
        await prisma.employee.update({
            where: { id: firstTenant.employee.id },
            data: {
                phoneNumber: '+33699000002',
                hasCompletedOnboarding: true
            }
        });
        await prisma.employee.update({
            where: { id: secondTenant.employee.id },
            data: {
                phoneNumber: '+33699000002',
                hasCompletedOnboarding: true
            }
        });
        await prisma.tenant.update({
            where: { id: secondTenant.tenant.id },
            data: { assignedSystemNumberId: systemNumber.id }
        });

        const body = whatsappBody({
            id: 'wamid.system.scoped',
            from: '33699000002',
            timestamp: `${Math.floor(new Date('2026-09-11T07:55:00.000Z').getTime() / 1000)}`,
            type: 'text',
            text: { body: 'Hi' }
        }, 'phone_system_second');
        const { raw, signature } = signedHeaders(body);
        const { createApp } = await import('../../src/app');

        await request(createApp())
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', signature)
            .send(raw)
            .expect(200);

        const firstAttendanceCount = await prisma.attendance.count({
            where: {
                employeeId: firstTenant.employee.id,
                tenantId: firstTenant.tenant.id
            }
        });
        const secondAttendanceCount = await prisma.attendance.count({
            where: {
                employeeId: secondTenant.employee.id,
                tenantId: secondTenant.tenant.id
            }
        });

        expect(firstAttendanceCount).toBe(0);
        expect(secondAttendanceCount).toBe(1);
        expect(whatsappServiceMocks.registerWebhookChannelCredentials).toHaveBeenCalledWith(
            'phone_system_second',
            expect.objectContaining({
                phoneNumberId: 'phone_system_second',
                accessToken: 'token_system_second',
                displayName: '+33100000002'
            })
        );
        expect(whatsappServiceMocks.sendMessage).toHaveBeenCalledWith(
            '33699000002',
            expect.stringContaining('Envoyez maintenant votre position WhatsApp'),
            'phone_system_second'
        );
    });

    it('routes inbound dedicated system-number messages to the exclusively assigned tenant', async () => {
        const firstTenant = await seedTenantGraph('WhatsAppDedicatedFirst');
        const secondTenant = await seedTenantGraph('WhatsAppDedicatedSecond');
        const dedicatedNumber = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId: 'phone_dedicated_second',
                displayNumber: '+33100000003',
                countryCode: 'FR',
                accessToken: 'token_dedicated_second',
                wabaId: 'waba_dedicated_second',
                isActive: true,
                channelType: 'DEDICATED',
                setupStatus: 'ACTIVE',
                maxTenants: 1
            }
        });
        await prisma.employee.update({
            where: { id: firstTenant.employee.id },
            data: {
                phoneNumber: '+33699000003',
                hasCompletedOnboarding: true
            }
        });
        await prisma.employee.update({
            where: { id: secondTenant.employee.id },
            data: {
                phoneNumber: '+33699000003',
                hasCompletedOnboarding: true
            }
        });
        await prisma.tenant.update({
            where: { id: secondTenant.tenant.id },
            data: { assignedSystemNumberId: dedicatedNumber.id }
        });

        const body = whatsappBody({
            id: 'wamid.dedicated.scoped',
            from: '33699000003',
            timestamp: `${Math.floor(new Date('2026-09-11T07:55:00.000Z').getTime() / 1000)}`,
            type: 'text',
            text: { body: 'Hi' }
        }, 'phone_dedicated_second');
        const { raw, signature } = signedHeaders(body);
        const { createApp } = await import('../../src/app');

        await request(createApp())
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', signature)
            .send(raw)
            .expect(200);

        const firstAttendanceCount = await prisma.attendance.count({
            where: {
                employeeId: firstTenant.employee.id,
                tenantId: firstTenant.tenant.id
            }
        });
        const secondAttendanceCount = await prisma.attendance.count({
            where: {
                employeeId: secondTenant.employee.id,
                tenantId: secondTenant.tenant.id
            }
        });

        expect(firstAttendanceCount).toBe(0);
        expect(secondAttendanceCount).toBe(1);
        expect(whatsappServiceMocks.registerWebhookChannelCredentials).toHaveBeenCalledWith(
            'phone_dedicated_second',
            expect.objectContaining({
                phoneNumberId: 'phone_dedicated_second',
                accessToken: 'token_dedicated_second',
                displayName: '+33100000003'
            })
        );
        expect(whatsappServiceMocks.sendMessage).toHaveBeenCalledWith(
            '33699000003',
            expect.stringContaining('Envoyez maintenant votre position WhatsApp'),
            'phone_dedicated_second'
        );
    });

    it('ignores inbound messages for known suspended system numbers instead of falling back to global routing', async () => {
        const seeded = await seedTenantGraph('WhatsAppSuspendedSystem');
        const suspendedNumber = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId: 'phone_system_suspended',
                displayNumber: '+33100000004',
                countryCode: 'FR',
                accessToken: 'token_system_suspended',
                wabaId: 'waba_system_suspended',
                isActive: true,
                channelType: 'DEDICATED',
                setupStatus: 'SUSPENDED',
                maxTenants: 1
            }
        });
        await prisma.employee.update({
            where: { id: seeded.employee.id },
            data: {
                phoneNumber: '+33699000004',
                hasCompletedOnboarding: true
            }
        });
        await prisma.tenant.update({
            where: { id: seeded.tenant.id },
            data: { assignedSystemNumberId: suspendedNumber.id }
        });

        const body = whatsappBody({
            id: 'wamid.suspended.ignored',
            from: '33699000004',
            timestamp: `${Math.floor(new Date('2026-09-11T07:55:00.000Z').getTime() / 1000)}`,
            type: 'text',
            text: { body: 'Hi' }
        }, 'phone_system_suspended');
        const { raw, signature } = signedHeaders(body);
        const { createApp } = await import('../../src/app');

        await request(createApp())
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', signature)
            .send(raw)
            .expect(200);

        const attendanceCount = await prisma.attendance.count({
            where: {
                employeeId: seeded.employee.id,
                tenantId: seeded.tenant.id
            }
        });

        expect(attendanceCount).toBe(0);
        expect(whatsappServiceMocks.registerWebhookChannelCredentials).not.toHaveBeenCalledWith(
            'phone_system_suspended',
            expect.anything()
        );
        expect(whatsappServiceMocks.sendMessage).not.toHaveBeenCalled();
        expect(whatsappServiceMocks.sendInteractiveButtons).not.toHaveBeenCalled();

        const refreshedNumber = await prisma.systemPhoneNumber.findUniqueOrThrow({
            where: { id: suspendedNumber.id }
        });
        expect(refreshedNumber.disabledWebhookCount).toBe(1);
        expect(refreshedNumber.lastDisabledWebhookAt).toBeInstanceOf(Date);

        const health = await getSystemNumberPoolHealth();
        expect(health.alerts).toEqual(expect.arrayContaining([
            expect.objectContaining({
                kind: 'DISABLED_NUMBER_TRAFFIC',
                displayNumber: '+33100000004'
            })
        ]));
    });

    it('updates the open attendance when the employee sends compliant GPS proof', async () => {
        const seeded = await seedTenantGraph('WhatsAppLocationOk');
        const { checkIn } = await import('../../src/services/attendanceService');

        await checkIn({
            ...seeded.employee,
            tenant: seeded.tenant
        }, new Date('2026-09-11T07:55:00.000Z'));

        const body = whatsappBody({
            id: 'wamid.location.ok',
            from: seeded.employee.phoneNumber,
            timestamp: `${Math.floor(new Date('2026-09-11T08:00:00.000Z').getTime() / 1000)}`,
            type: 'location',
            location: {
                latitude: seeded.site.latitude,
                longitude: seeded.site.longitude
            }
        });
        const { raw, signature } = signedHeaders(body);
        const { createApp } = await import('../../src/app');

        await request(createApp())
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', signature)
            .send(raw)
            .expect(200);

        const attendance = await prisma.attendance.findFirstOrThrow({
            where: {
                employeeId: seeded.employee.id,
                tenantId: seeded.tenant.id
            }
        });

        expect(attendance.status).toBe('PRESENT');
        expect(attendance.gpsVerdict).toBe('APPROVED');
        expect(attendance.locationWarning).toBe(false);
        expect(attendance.distanceFromSite).toBe(0);
        expect(attendance.proofReceivedAt).toBeInstanceOf(Date);
        expect(whatsappServiceMocks.sendMessage).toHaveBeenCalledWith(
            seeded.employee.phoneNumber,
            expect.stringContaining('Pointage validé'),
            'phone_number_test'
        );
    });

    it('rejects a strict-site GPS proof outside the allowed radius and notifies managers', async () => {
        const seeded = await seedTenantGraph('WhatsAppLocationKo');
        const { checkIn } = await import('../../src/services/attendanceService');

        await checkIn({
            ...seeded.employee,
            tenant: seeded.tenant
        }, new Date('2026-09-11T07:55:00.000Z'));

        const body = whatsappBody({
            id: 'wamid.location.ko',
            from: seeded.employee.phoneNumber,
            timestamp: `${Math.floor(new Date('2026-09-11T08:00:00.000Z').getTime() / 1000)}`,
            type: 'location',
            location: {
                latitude: 43.2965,
                longitude: 5.3698
            }
        });
        const { raw, signature } = signedHeaders(body);
        const { createApp } = await import('../../src/app');

        await request(createApp())
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', signature)
            .send(raw)
            .expect(200);

        const attendance = await prisma.attendance.findFirstOrThrow({
            where: {
                employeeId: seeded.employee.id,
                tenantId: seeded.tenant.id
            }
        });

        expect(attendance.status).toBe('REJECTED');
        expect(attendance.gpsVerdict).toBe('REJECTED');
        expect(attendance.locationWarning).toBe(true);
        expect(attendance.distanceFromSite).toBeGreaterThan(1000);
        expect(notificationServiceMocks.notifyAllManagers).toHaveBeenCalledWith(
            seeded.tenant.id,
            'GEOFENCE',
            'Pointage refusé hors zone',
            expect.stringContaining('hors zone stricte'),
            seeded.employee.id
        );
    });

    it('allows checkout by WhatsApp after a strict GPS proof has approved the check-in', async () => {
        const seeded = await seedTenantGraph('WhatsAppCheckoutAfterGps');
        await prisma.employee.update({
            where: { id: seeded.employee.id },
            data: { hasCompletedOnboarding: true }
        });
        const { createApp } = await import('../../src/app');
        const app = createApp();

        const checkinBody = whatsappBody({
            id: 'wamid.checkout.checkin',
            from: seeded.employee.phoneNumber,
            timestamp: `${Math.floor(new Date('2026-09-11T07:55:00.000Z').getTime() / 1000)}`,
            type: 'text',
            text: { body: 'Hi' }
        });
        const checkinSigned = signedHeaders(checkinBody);
        await request(app)
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', checkinSigned.signature)
            .send(checkinSigned.raw)
            .expect(200);

        const locationBody = whatsappBody({
            id: 'wamid.checkout.location',
            from: seeded.employee.phoneNumber,
            timestamp: `${Math.floor(new Date('2026-09-11T08:00:00.000Z').getTime() / 1000)}`,
            type: 'location',
            location: {
                latitude: seeded.site.latitude,
                longitude: seeded.site.longitude
            }
        });
        const locationSigned = signedHeaders(locationBody);
        await request(app)
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', locationSigned.signature)
            .send(locationSigned.raw)
            .expect(200);

        const checkoutBody = whatsappBody({
            id: 'wamid.checkout.bye',
            from: seeded.employee.phoneNumber,
            timestamp: `${Math.floor(new Date('2026-09-11T16:30:00.000Z').getTime() / 1000)}`,
            type: 'text',
            text: { body: 'Bye' }
        });
        const checkoutSigned = signedHeaders(checkoutBody);
        await request(app)
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', checkoutSigned.signature)
            .send(checkoutSigned.raw)
            .expect(200);

        const attendance = await prisma.attendance.findFirstOrThrow({
            where: {
                employeeId: seeded.employee.id,
                tenantId: seeded.tenant.id
            }
        });

        expect(attendance.status).toBe('PRESENT');
        expect(attendance.gpsVerdict).toBe('APPROVED');
        expect(attendance.checkOut?.toISOString()).toBe('2026-09-11T16:30:00.000Z');
        expect(whatsappServiceMocks.sendMessage).toHaveBeenCalledWith(
            seeded.employee.phoneNumber,
            expect.stringContaining('Départ enregistré'),
            'phone_number_test'
        );
    });

    it('prevents checkout by WhatsApp while the check-in still waits for GPS proof', async () => {
        const seeded = await seedTenantGraph('WhatsAppCheckoutBeforeGps');
        await prisma.employee.update({
            where: { id: seeded.employee.id },
            data: { hasCompletedOnboarding: true }
        });
        const { createApp } = await import('../../src/app');
        const app = createApp();

        const checkinBody = whatsappBody({
            id: 'wamid.checkout.blocked.checkin',
            from: seeded.employee.phoneNumber,
            timestamp: `${Math.floor(new Date('2026-09-11T07:55:00.000Z').getTime() / 1000)}`,
            type: 'text',
            text: { body: 'Hi' }
        });
        const checkinSigned = signedHeaders(checkinBody);
        await request(app)
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', checkinSigned.signature)
            .send(checkinSigned.raw)
            .expect(200);

        const checkoutBody = whatsappBody({
            id: 'wamid.checkout.blocked.bye',
            from: seeded.employee.phoneNumber,
            timestamp: `${Math.floor(new Date('2026-09-11T16:30:00.000Z').getTime() / 1000)}`,
            type: 'text',
            text: { body: 'Bye' }
        });
        const checkoutSigned = signedHeaders(checkoutBody);
        await request(app)
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', checkoutSigned.signature)
            .send(checkoutSigned.raw)
            .expect(200);

        const attendance = await prisma.attendance.findFirstOrThrow({
            where: {
                employeeId: seeded.employee.id,
                tenantId: seeded.tenant.id
            }
        });

        expect(attendance.status).toBe('PENDING_GPS');
        expect(attendance.checkOut).toBeNull();
        expect(whatsappServiceMocks.sendMessage).toHaveBeenCalledWith(
            seeded.employee.phoneNumber,
            expect.stringContaining('attend encore votre position WhatsApp'),
            'phone_number_test'
        );
    });

    it('keeps a WARNING site check-in open but flags an out-of-radius GPS proof for manager review', async () => {
        const seeded = await seedTenantGraph('WhatsAppWarningGps');
        await prisma.site.update({
            where: { id: seeded.site.id },
            data: { gpsMode: 'WARNING', radius: 100 }
        });
        await prisma.employee.update({
            where: { id: seeded.employee.id },
            data: { hasCompletedOnboarding: true }
        });
        const { createApp } = await import('../../src/app');
        const app = createApp();

        const checkinBody = whatsappBody({
            id: 'wamid.warning.checkin',
            from: seeded.employee.phoneNumber,
            timestamp: `${Math.floor(new Date('2026-09-11T07:55:00.000Z').getTime() / 1000)}`,
            type: 'text',
            text: { body: 'Hi' }
        });
        const checkinSigned = signedHeaders(checkinBody);
        await request(app)
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', checkinSigned.signature)
            .send(checkinSigned.raw)
            .expect(200);

        const locationBody = whatsappBody({
            id: 'wamid.warning.location',
            from: seeded.employee.phoneNumber,
            timestamp: `${Math.floor(new Date('2026-09-11T08:00:00.000Z').getTime() / 1000)}`,
            type: 'location',
            location: {
                latitude: 43.2965,
                longitude: 5.3698
            }
        });
        const locationSigned = signedHeaders(locationBody);
        await request(app)
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', locationSigned.signature)
            .send(locationSigned.raw)
            .expect(200);

        const attendance = await prisma.attendance.findFirstOrThrow({
            where: {
                employeeId: seeded.employee.id,
                tenantId: seeded.tenant.id
            }
        });

        expect(attendance.status).toBe('WARNING');
        expect(attendance.gpsVerdict).toBe('WARNING');
        expect(attendance.locationWarning).toBe(true);
        expect(attendance.distanceFromSite).toBeGreaterThan(1000);
        expect(attendance.checkOut).toBeNull();
        expect(notificationServiceMocks.notifyAllManagers).toHaveBeenCalledWith(
            seeded.tenant.id,
            'GEOFENCE',
            'Pointage sous réserve',
            expect.stringContaining('pointé hors zone'),
            seeded.employee.id
        );
    });

    it('allows checkout after a WARNING out-of-radius GPS proof', async () => {
        const seeded = await seedTenantGraph('WhatsAppWarningCheckout');
        await prisma.site.update({
            where: { id: seeded.site.id },
            data: { gpsMode: 'WARNING', radius: 100 }
        });
        await prisma.employee.update({
            where: { id: seeded.employee.id },
            data: { hasCompletedOnboarding: true }
        });
        const { createApp } = await import('../../src/app');
        const app = createApp();

        const checkinBody = whatsappBody({
            id: 'wamid.warning.checkout.checkin',
            from: seeded.employee.phoneNumber,
            timestamp: `${Math.floor(new Date('2026-09-11T07:55:00.000Z').getTime() / 1000)}`,
            type: 'text',
            text: { body: 'Hi' }
        });
        const checkinSigned = signedHeaders(checkinBody);
        await request(app)
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', checkinSigned.signature)
            .send(checkinSigned.raw)
            .expect(200);

        const locationBody = whatsappBody({
            id: 'wamid.warning.checkout.location',
            from: seeded.employee.phoneNumber,
            timestamp: `${Math.floor(new Date('2026-09-11T08:00:00.000Z').getTime() / 1000)}`,
            type: 'location',
            location: {
                latitude: 43.2965,
                longitude: 5.3698
            }
        });
        const locationSigned = signedHeaders(locationBody);
        await request(app)
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', locationSigned.signature)
            .send(locationSigned.raw)
            .expect(200);

        const checkoutBody = whatsappBody({
            id: 'wamid.warning.checkout.bye',
            from: seeded.employee.phoneNumber,
            timestamp: `${Math.floor(new Date('2026-09-11T16:30:00.000Z').getTime() / 1000)}`,
            type: 'text',
            text: { body: 'Bye' }
        });
        const checkoutSigned = signedHeaders(checkoutBody);
        await request(app)
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('X-Hub-Signature-256', checkoutSigned.signature)
            .send(checkoutSigned.raw)
            .expect(200);

        const attendance = await prisma.attendance.findFirstOrThrow({
            where: {
                employeeId: seeded.employee.id,
                tenantId: seeded.tenant.id
            }
        });

        expect(attendance.status).toBe('WARNING');
        expect(attendance.gpsVerdict).toBe('WARNING');
        expect(attendance.checkOut?.toISOString()).toBe('2026-09-11T16:30:00.000Z');
        expect(whatsappServiceMocks.sendMessage).toHaveBeenCalledWith(
            seeded.employee.phoneNumber,
            expect.stringContaining('Départ enregistré'),
            'phone_number_test'
        );
    });
});
