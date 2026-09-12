import { expect, type Page } from '@playwright/test';
import {
    E2E_MANAGER_OTP,
    E2E_MANAGER_PHONE,
    E2E_SUPERADMIN_EMAIL,
    E2E_SUPERADMIN_PASSWORD
} from './db';

export async function loginAsE2eManager(page: Page) {
    await page.route('**/auth/request-otp', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: 'Si ce numéro est associé à un compte, un code a été envoyé via WhatsApp.'
            })
        });
    });

    await page.goto('/login');
    await page.getByRole('button', { name: 'Accepter' }).click();
    await page.getByPlaceholder('+33 6 12 34 56 78').fill(E2E_MANAGER_PHONE);
    await page.getByRole('button', { name: /Recevoir le code sur WhatsApp/i }).click();
    await expect(page.getByRole('heading', { name: 'Vérification' })).toBeVisible();

    const digits = E2E_MANAGER_OTP.split('');
    const inputs = page.locator('input[inputmode="numeric"]');
    for (const [index, digit] of digits.entries()) {
        await inputs.nth(index).fill(digit);
    }

    await expect(page).toHaveURL(/\/dashboard$/);
}

export async function loginAsE2eSuperAdmin(page: Page) {
    await page.goto('/superadmin/login');

    const acceptCookies = page.getByRole('button', { name: 'Accepter' });
    if (await acceptCookies.isVisible().catch(() => false)) {
        await acceptCookies.click();
    }

    await page.getByPlaceholder('admin@whatspoint.app').fill(E2E_SUPERADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(E2E_SUPERADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Accéder au Backoffice' }).click();

    await expect(page).toHaveURL(/\/superadmin\/?$/);
}
