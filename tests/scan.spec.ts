import { test, expect } from '@playwright/test';

test.use({
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  permissions: ['camera'],
});

test('scan screen opens the camera and asks for the green side first', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Scan my cube' }).click();
  await expect(page.getByRole('heading', { name: 'Show the green side' })).toBeVisible();
  await expect(page.getByText('1 of 6')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Take picture' })).toBeEnabled();
});
