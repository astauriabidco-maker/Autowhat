import { test, expect } from '@playwright/test';
import prisma from '../../src/lib/prisma';
import { disconnectE2eDatabase, resetE2eDatabase, seedPendingGpsAttendance } from './support/db';
import { loginAsE2eManager } from './support/auth';

test.afterAll(disconnectE2eDatabase);

test('manager can approve an attendance waiting for GPS proof', async ({ page }) => {
    await resetE2eDatabase();
    const seeded = await seedPendingGpsAttendance('GpsDecision');

    await loginAsE2eManager(page);
    await page.getByRole('button', { name: /Ouvrir les pointages/i }).click();
    await expect(page).toHaveURL(/\/attendance$/);

    await page.getByRole('button', { name: /GPS attendu/i }).click();
    await expect(page.getByRole('table').getByText('Employee E2E GpsDecision')).toBeVisible();
    await page.getByRole('button', { name: /Détails/i }).first().click();
    await expect(page.getByText('Position GPS attendue').last()).toBeVisible();

    await page.getByRole('button', { name: /Valider exception/i }).click();
    await expect(page.getByRole('table').getByText('Employee E2E GpsDecision')).toBeVisible();
    await expect(page.getByText('Accepté').first()).toBeVisible();

    await expect.poll(async () => {
        const attendance = await prisma.attendance.findUniqueOrThrow({
            where: { id: seeded.attendance.id }
        });

        return {
            status: attendance.status,
            gpsVerdict: attendance.gpsVerdict,
            locationWarning: attendance.locationWarning
        };
    }).toEqual({
        status: 'PRESENT',
        gpsVerdict: 'APPROVED',
        locationWarning: false
    });

    await expect.poll(async () => (
        await prisma.attendanceDecisionEvent.count({
            where: { attendanceId: seeded.attendance.id, action: 'APPROVE_EXCEPTION' }
        })
    )).toBe(1);
});
