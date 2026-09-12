import { test, expect } from '@playwright/test';
import { disconnectE2eDatabase, resetE2eDatabase, seedPendingGpsAttendance } from './support/db';
import { loginAsE2eManager } from './support/auth';

test.afterAll(disconnectE2eDatabase);

test('dashboard shows core WhatsPoint supervision without legacy operations links', async ({ page }) => {
    await resetE2eDatabase();
    await seedPendingGpsAttendance('Dashboard');

    await loginAsE2eManager(page);

    await expect(page.getByText('Pointages GPS à contrôler')).toBeVisible();
    await expect(page.getByText('GPS attendu').first()).toBeVisible();
    await expect(page.getByText('Employee E2E Dashboard').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Dispatch|Devis|Stock|CRM/i })).toHaveCount(0);
});
