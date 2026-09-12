import { expect, test } from '@playwright/test';
import prisma from '../../src/lib/prisma';
import { loginAsE2eSuperAdmin } from './support/auth';
import {
    disconnectE2eDatabase,
    resetE2eDatabase,
    seedE2eSuperAdmin,
    seedE2eTenant
} from './support/db';

test.describe('superadmin WhatsApp number pool', () => {
    test.afterAll(async () => {
        await disconnectE2eDatabase();
    });

    test('imports, assigns and surfaces health alerts for a FR PRO shared number', async ({ page }) => {
        await resetE2eDatabase();
        await seedE2eSuperAdmin();
        const seeded = await seedE2eTenant('WhatsAppPool');

        await loginAsE2eSuperAdmin(page);
        await page.goto('/superadmin/whatsapp-numbers');

        await expect(page.getByRole('heading', { name: 'Numéros WhatsApp' })).toBeVisible();
        await expect(page.getByText("Aucun numéro mutualisé disponible pour FR + PRO.")).toBeVisible();
        await expect(page.getByText(`${seeded.tenant.name} n'a aucun numéro WhatsApp assigné.`)).toBeVisible();

        await page.getByLabel('Numéro affiché').fill('+33144445555');
        await page.getByLabel('Phone Number ID Meta').fill('phone_e2e_pool_fr_pro');
        await page.getByLabel('Pays du numéro').fill('FR');
        await page.getByLabel('WABA ID').fill('waba_e2e_pool');
        await page.getByLabel('Type de canal').selectOption('SHARED');
        await page.getByLabel('Statut de setup').selectOption('ACTIVE');
        await page.getByLabel('Plan cible').selectOption('PRO');
        await page.getByLabel('Capacité clients').fill('1');
        await page.getByLabel('Access token system user').fill('token_e2e_pool');
        await page.getByRole('button', { name: /^Importer$/ }).click();

        await expect(page.getByText('Numéro WhatsApp importé.')).toBeVisible();

        const number = await prisma.systemPhoneNumber.findUniqueOrThrow({
            where: { phoneNumberId: 'phone_e2e_pool_fr_pro' }
        });
        const card = page.getByTestId('whatsapp-number-card').filter({ hasText: '+33144445555' });

        await expect(card).toBeVisible();
        await page.getByLabel('Assigner +33144445555').selectOption(seeded.tenant.id);
        await card.getByRole('button', { name: /^Assigner$/ }).click();

        await expect(page.getByText('Numéro WhatsApp assigné.')).toBeVisible();
        await expect(card.getByText(`${seeded.tenant.name}`)).toBeVisible();
        await expect(page.getByText('+33144445555 est utilisé à 1/1 clients.')).toBeVisible();

        await expect.poll(async () => {
            const tenant = await prisma.tenant.findUniqueOrThrow({
                where: { id: seeded.tenant.id },
                select: { assignedSystemNumberId: true }
            });
            return tenant.assignedSystemNumberId;
        }).toBe(number.id);

        await card.getByRole('button', { name: 'Actif' }).click();

        await expect(page.getByText('Numéro désactivé.')).toBeVisible();
        await expect(page.getByText("+33144445555 n'est pas prêt mais reste assigné à 1 client(s).")).toBeVisible();
        await expect(page.getByText(`${seeded.tenant.name} est attaché à un numéro non prêt.`)).toBeVisible();

        await page.getByRole('button', { name: "Tester l'alerte" }).click();
        await expect(page.getByText(/Controle effectue : \d+ alerte\(s\), \d+ notification\(s\) envoyee\(s\)\./)).toBeVisible();
    });

    test('surfaces potential country misrouting for an assigned tenant', async ({ page }) => {
        await resetE2eDatabase();
        await seedE2eSuperAdmin();
        const seeded = await seedE2eTenant('Misrouting');

        const number = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId: 'phone_e2e_pool_es_pro',
                displayNumber: '+34911112222',
                countryCode: 'ES',
                accessToken: 'token_e2e_pool_es',
                wabaId: 'waba_e2e_pool_es',
                isActive: true,
                channelType: 'SHARED',
                setupStatus: 'ACTIVE',
                planScope: 'PRO',
                maxTenants: 10,
                tenantCount: 1
            }
        });

        await prisma.tenant.update({
            where: { id: seeded.tenant.id },
            data: { assignedSystemNumberId: number.id }
        });

        await loginAsE2eSuperAdmin(page);
        await page.goto('/superadmin/whatsapp-numbers');

        await expect(page.getByRole('heading', { name: 'Numéros WhatsApp' })).toBeVisible();
        await expect(page.getByText(`${seeded.tenant.name} (FR) est routé vers +34911112222 (ES).`)).toBeVisible();
    });

    test('surfaces a full FR PRO segment while another active tenant remains unassigned', async ({ page }) => {
        await resetE2eDatabase();
        await seedE2eSuperAdmin();
        const assigned = await seedE2eTenant('FullSegmentAssigned');
        const waiting = await seedE2eTenant('FullSegmentWaiting');

        const number = await prisma.systemPhoneNumber.create({
            data: {
                phoneNumberId: 'phone_e2e_pool_fr_pro_full',
                displayNumber: '+33155556666',
                countryCode: 'FR',
                accessToken: 'token_e2e_pool_full',
                wabaId: 'waba_e2e_pool_full',
                isActive: true,
                channelType: 'SHARED',
                setupStatus: 'ACTIVE',
                planScope: 'PRO',
                maxTenants: 1,
                tenantCount: 1
            }
        });

        await prisma.tenant.update({
            where: { id: assigned.tenant.id },
            data: { assignedSystemNumberId: number.id }
        });

        await loginAsE2eSuperAdmin(page);
        await page.goto('/superadmin/whatsapp-numbers');

        await expect(page.getByRole('heading', { name: 'Numéros WhatsApp' })).toBeVisible();
        await expect(page.getByText('+33155556666 est utilisé à 1/1 clients.')).toBeVisible();
        await expect(page.getByText('Aucun numéro mutualisé disponible pour FR + PRO.')).toBeVisible();
        await expect(page.getByText(`${waiting.tenant.name} n'a aucun numéro WhatsApp assigné.`)).toBeVisible();
        await expect(page.getByTestId('whatsapp-number-card').filter({ hasText: '+33155556666' }).getByText('0 place(s)')).toBeVisible();
    });
});
