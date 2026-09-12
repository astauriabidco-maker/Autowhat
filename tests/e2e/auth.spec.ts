import { test, expect } from '@playwright/test';
import { disconnectE2eDatabase, resetE2eDatabase, seedE2eTenant } from './support/db';
import { loginAsE2eManager } from './support/auth';

test.afterAll(disconnectE2eDatabase);

test('manager logs in with the WhatsApp OTP flow', async ({ page }) => {
    await resetE2eDatabase();
    await seedE2eTenant('Auth');

    await loginAsE2eManager(page);

    await expect(page.getByRole('heading', { name: /Vue d'ensemble/i })).toBeVisible();
    await expect(page.getByText('Tenant E2E Auth')).toBeVisible();
});
