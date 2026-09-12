import { afterAll, afterEach, beforeEach, expect, vi } from 'vitest';
import prisma from '../../src/lib/prisma';
import {
    assignExistingNumberToTenant,
    assignNumberToTenant,
    getSystemNumberPoolHealth,
    unassignNumberFromTenant
} from '../../src/services/numberAllocationService';
import {
    getCredentialsForTenant,
    upsertWhatsAppConfig
} from '../../src/services/whatsappConfigService';
import {
    describeIntegration,
    disconnectTestDatabase,
    resetTestDatabase,
    seedTenantGraph
} from './helpers/db';

describeIntegration('system WhatsApp number allocation', () => {
    afterAll(disconnectTestDatabase);

    beforeEach(async () => {
        await resetTestDatabase();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('does not increment tenantCount when assigning the same tenant twice', async () => {
        const seeded = await seedTenantGraph('NumberIdempotent');
        const number = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId: 'phone_idempotent',
                displayNumber: '+33111111111',
                countryCode: 'FR',
                accessToken: 'token_idempotent',
                wabaId: 'waba_idempotent',
                isActive: true
            }
        });

        const first = await assignExistingNumberToTenant(seeded.tenant.id, number.id);
        const second = await assignExistingNumberToTenant(seeded.tenant.id, number.id);

        expect(first?.tenantCount).toBe(1);
        expect(second?.tenantCount).toBe(1);

        const refreshed = await prisma.systemPhoneNumber.findUniqueOrThrow({
            where: { id: number.id }
        });
        expect(refreshed.tenantCount).toBe(1);
    });

    it('decrements the previous number count when reassigning a tenant', async () => {
        const seeded = await seedTenantGraph('NumberReassign');
        const firstNumber = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId: 'phone_reassign_first',
                displayNumber: '+33111111112',
                countryCode: 'FR',
                accessToken: 'token_reassign_first',
                wabaId: 'waba_reassign_first',
                isActive: true
            }
        });
        const secondNumber = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId: 'phone_reassign_second',
                displayNumber: '+33111111113',
                countryCode: 'FR',
                accessToken: 'token_reassign_second',
                wabaId: 'waba_reassign_second',
                isActive: true
            }
        });

        await assignExistingNumberToTenant(seeded.tenant.id, firstNumber.id);
        const reassigned = await assignExistingNumberToTenant(seeded.tenant.id, secondNumber.id);

        const refreshedFirst = await prisma.systemPhoneNumber.findUniqueOrThrow({
            where: { id: firstNumber.id }
        });
        const refreshedSecond = await prisma.systemPhoneNumber.findUniqueOrThrow({
            where: { id: secondNumber.id }
        });

        expect(reassigned?.tenantCount).toBe(1);
        expect(refreshedFirst.tenantCount).toBe(0);
        expect(refreshedSecond.tenantCount).toBe(1);
    });

    it('keeps dedicated assignment exclusive when requested', async () => {
        const firstTenant = await seedTenantGraph('NumberExclusiveFirst');
        const secondTenant = await seedTenantGraph('NumberExclusiveSecond');
        const number = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId: 'phone_exclusive',
                displayNumber: '+33111111114',
                countryCode: 'FR',
                accessToken: 'token_exclusive',
                wabaId: 'waba_exclusive',
                isActive: true
            }
        });

        const first = await assignExistingNumberToTenant(firstTenant.tenant.id, number.id, { exclusive: true });
        const second = await assignExistingNumberToTenant(secondTenant.tenant.id, number.id, { exclusive: true });

        expect(first?.tenantCount).toBe(1);
        expect(second).toBeNull();

        const refreshed = await prisma.systemPhoneNumber.findUniqueOrThrow({
            where: { id: number.id }
        });
        expect(refreshed.tenantCount).toBe(1);
    });

    it('auto-assigns an already assigned tenant idempotently', async () => {
        const seeded = await seedTenantGraph('NumberAutoIdempotent');
        const number = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId: 'phone_auto_idempotent',
                displayNumber: '+33111111115',
                countryCode: 'FR',
                accessToken: 'token_auto_idempotent',
                wabaId: 'waba_auto_idempotent',
                isActive: true
            }
        });

        await assignExistingNumberToTenant(seeded.tenant.id, number.id);
        const second = await assignNumberToTenant(seeded.tenant.id, 'FR');

        expect(second?.id).toBe(number.id);
        expect(second?.tenantCount).toBe(1);
    });

    it('recalculates tenantCount when unassigning instead of going negative', async () => {
        const seeded = await seedTenantGraph('NumberUnassign');
        const number = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId: 'phone_unassign',
                displayNumber: '+33111111116',
                countryCode: 'FR',
                accessToken: 'token_unassign',
                wabaId: 'waba_unassign',
                isActive: true
            }
        });

        await assignExistingNumberToTenant(seeded.tenant.id, number.id);
        await unassignNumberFromTenant(seeded.tenant.id);
        await unassignNumberFromTenant(seeded.tenant.id);

        const refreshed = await prisma.systemPhoneNumber.findUniqueOrThrow({
            where: { id: number.id }
        });
        const tenant = await prisma.tenant.findUniqueOrThrow({
            where: { id: seeded.tenant.id }
        });

        expect(refreshed.tenantCount).toBe(0);
        expect(tenant.assignedSystemNumberId).toBeNull();
    });

    it('allows shared numbers up to their configured capacity', async () => {
        const firstTenant = await seedTenantGraph('SharedCapacityFirst');
        const secondTenant = await seedTenantGraph('SharedCapacitySecond');
        const thirdTenant = await seedTenantGraph('SharedCapacityThird');
        const number = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId: 'phone_shared_capacity',
                displayNumber: '+33111111117',
                countryCode: 'FR',
                accessToken: 'token_shared_capacity',
                wabaId: 'waba_shared_capacity',
                isActive: true,
                channelType: 'SHARED',
                setupStatus: 'ACTIVE',
                maxTenants: 2
            }
        });

        const first = await assignExistingNumberToTenant(firstTenant.tenant.id, number.id);
        const second = await assignExistingNumberToTenant(secondTenant.tenant.id, number.id);
        const third = await assignExistingNumberToTenant(thirdTenant.tenant.id, number.id);

        expect(first?.tenantCount).toBe(1);
        expect(second?.tenantCount).toBe(2);
        expect(third).toBeNull();

        const refreshed = await prisma.systemPhoneNumber.findUniqueOrThrow({
            where: { id: number.id }
        });
        expect(refreshed.tenantCount).toBe(2);
        expect(refreshed.maxTenants).toBe(2);
    });

    it('auto-allocation skips a full shared number and uses the next available number', async () => {
        const firstTenant = await seedTenantGraph('AutoCapacityFirst');
        const secondTenant = await seedTenantGraph('AutoCapacitySecond');
        const fullNumber = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId: 'phone_auto_capacity_full',
                displayNumber: '+33111111118',
                countryCode: 'FR',
                accessToken: 'token_auto_capacity_full',
                wabaId: 'waba_auto_capacity_full',
                isActive: true,
                channelType: 'SHARED',
                setupStatus: 'ACTIVE',
                maxTenants: 1
            }
        });
        const fallbackNumber = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId: 'phone_auto_capacity_next',
                displayNumber: '+33111111119',
                countryCode: 'FR',
                accessToken: 'token_auto_capacity_next',
                wabaId: 'waba_auto_capacity_next',
                isActive: true,
                channelType: 'SHARED',
                setupStatus: 'ACTIVE',
                maxTenants: 1
            }
        });

        await assignExistingNumberToTenant(firstTenant.tenant.id, fullNumber.id);
        const assigned = await assignNumberToTenant(secondTenant.tenant.id, 'FR');

        expect(assigned?.id).toBe(fallbackNumber.id);
        expect(assigned?.tenantCount).toBe(1);
    });

    it('prefers a shared number scoped to the tenant plan before a generic number', async () => {
        const seeded = await seedTenantGraph('PlanScoped');
        const genericNumber = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId: 'phone_plan_any',
                displayNumber: '+33111111120',
                countryCode: 'FR',
                accessToken: 'token_plan_any',
                wabaId: 'waba_plan_any',
                isActive: true,
                channelType: 'SHARED',
                setupStatus: 'ACTIVE',
                planScope: 'ANY',
                maxTenants: 10
            }
        });
        const proNumber = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId: 'phone_plan_pro',
                displayNumber: '+33111111121',
                countryCode: 'FR',
                accessToken: 'token_plan_pro',
                wabaId: 'waba_plan_pro',
                isActive: true,
                channelType: 'SHARED',
                setupStatus: 'ACTIVE',
                planScope: 'PRO',
                maxTenants: 10
            }
        });

        const assigned = await assignNumberToTenant(seeded.tenant.id, 'FR');

        expect(assigned?.id).toBe(proNumber.id);
        expect(assigned?.id).not.toBe(genericNumber.id);
    });

    it('blocks manual assignment when the number is reserved for another plan', async () => {
        const seeded = await seedTenantGraph('PlanMismatch');
        const enterpriseNumber = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId: 'phone_plan_enterprise',
                displayNumber: '+33111111122',
                countryCode: 'FR',
                accessToken: 'token_plan_enterprise',
                wabaId: 'waba_plan_enterprise',
                isActive: true,
                channelType: 'SHARED',
                setupStatus: 'ACTIVE',
                planScope: 'ENTERPRISE',
                maxTenants: 10
            }
        });

        const assigned = await assignExistingNumberToTenant(seeded.tenant.id, enterpriseNumber.id);

        expect(assigned).toBeNull();
    });

    it('reports pool health alerts for missing capacity and risky assignments', async () => {
        const healthyTenant = await seedTenantGraph('HealthOk');
        const fullTenant = await seedTenantGraph('HealthFull');
        const unassignedTenant = await seedTenantGraph('HealthUnassigned');
        const suspendedTenant = await seedTenantGraph('HealthSuspended');
        const mismatchedTenant = await seedTenantGraph('HealthMismatch');

        await prisma.tenant.update({
            where: { id: unassignedTenant.tenant.id },
            data: { assignedSystemNumberId: null }
        });

        const healthyNumber = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId: 'phone_health_ok',
                displayNumber: '+33111111123',
                countryCode: 'FR',
                accessToken: 'token_health_ok',
                wabaId: 'waba_health_ok',
                isActive: true,
                channelType: 'SHARED',
                setupStatus: 'ACTIVE',
                planScope: 'PRO',
                maxTenants: 2
            }
        });
        const fullNumber = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId: 'phone_health_full',
                displayNumber: '+33111111124',
                countryCode: 'FR',
                accessToken: 'token_health_full',
                wabaId: 'waba_health_full',
                isActive: true,
                channelType: 'SHARED',
                setupStatus: 'ACTIVE',
                planScope: 'TRIAL',
                maxTenants: 1
            }
        });
        const suspendedNumber = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId: 'phone_health_suspended',
                displayNumber: '+33111111125',
                countryCode: 'FR',
                accessToken: 'token_health_suspended',
                wabaId: 'waba_health_suspended',
                isActive: false,
                channelType: 'DEDICATED',
                setupStatus: 'SUSPENDED',
                planScope: 'PRO',
                maxTenants: 1
            }
        });
        const mismatchedNumber = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId: 'phone_health_mismatch',
                displayNumber: '+12125550123',
                countryCode: 'US',
                accessToken: 'token_health_mismatch',
                wabaId: 'waba_health_mismatch',
                isActive: true,
                channelType: 'SHARED',
                setupStatus: 'ACTIVE',
                planScope: 'ENTERPRISE',
                maxTenants: 10
            }
        });

        await prisma.tenant.update({
            where: { id: healthyTenant.tenant.id },
            data: { assignedSystemNumberId: healthyNumber.id }
        });
        await prisma.tenant.update({
            where: { id: fullTenant.tenant.id },
            data: { plan: 'TRIAL', assignedSystemNumberId: fullNumber.id }
        });
        await prisma.tenant.update({
            where: { id: suspendedTenant.tenant.id },
            data: { assignedSystemNumberId: suspendedNumber.id }
        });
        await prisma.tenant.update({
            where: { id: mismatchedTenant.tenant.id },
            data: { assignedSystemNumberId: mismatchedNumber.id }
        });

        const health = await getSystemNumberPoolHealth();

        expect(health.summary.totalAlerts).toBeGreaterThanOrEqual(4);
        expect(health.alerts).toEqual(expect.arrayContaining([
            expect.objectContaining({ kind: 'NO_AVAILABLE_NUMBER', countryCode: 'FR', planScope: 'TRIAL' }),
            expect.objectContaining({ kind: 'HIGH_CAPACITY', displayNumber: '+33111111124' }),
            expect.objectContaining({ kind: 'UNASSIGNED_TENANT', tenantName: unassignedTenant.tenant.name }),
            expect.objectContaining({ kind: 'ASSIGNED_UNHEALTHY_NUMBER', displayNumber: '+33111111125' }),
            expect.objectContaining({ kind: 'POTENTIAL_MISROUTING', displayNumber: '+12125550123' })
        ]));
    });

    it('prioritizes tenant WhatsApp credentials as BYON, then assigned system number, then default', async () => {
        vi.stubEnv('WHATSAPP_PHONE_ID', 'phone_default_priority');
        vi.stubEnv('WHATSAPP_API_TOKEN', 'token_default_priority');

        const seeded = await seedTenantGraph('CredentialPriority');
        const systemNumber = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId: 'phone_priority_system',
                displayNumber: '+33111111130',
                countryCode: 'FR',
                accessToken: 'token_priority_system',
                wabaId: 'waba_priority_system',
                isActive: true,
                channelType: 'DEDICATED',
                setupStatus: 'ACTIVE',
                planScope: 'PRO',
                maxTenants: 1
            }
        });
        await prisma.tenant.update({
            where: { id: seeded.tenant.id },
            data: { assignedSystemNumberId: systemNumber.id }
        });
        await upsertWhatsAppConfig(seeded.tenant.id, {
            phoneNumberId: 'phone_priority_byon',
            accessToken: 'token_priority_byon',
            wabaId: 'waba_priority_byon',
            displayName: 'Tenant Priority BYON'
        });

        await expect(getCredentialsForTenant(seeded.tenant.id)).resolves.toEqual({
            phoneNumberId: 'phone_priority_byon',
            accessToken: 'token_priority_byon',
            displayName: 'Tenant Priority BYON'
        });

        await prisma.whatsAppConfig.update({
            where: { tenantId: seeded.tenant.id },
            data: { isActive: false }
        });

        await expect(getCredentialsForTenant(seeded.tenant.id)).resolves.toEqual({
            phoneNumberId: 'phone_priority_system',
            accessToken: 'token_priority_system',
            displayName: '+33111111130'
        });

        await prisma.systemPhoneNumber.update({
            where: { id: systemNumber.id },
            data: { setupStatus: 'SUSPENDED' }
        });

        await expect(getCredentialsForTenant(seeded.tenant.id)).resolves.toEqual({
            phoneNumberId: 'phone_default_priority',
            accessToken: 'token_default_priority',
            displayName: 'WhatsPoint'
        });
    });
});
