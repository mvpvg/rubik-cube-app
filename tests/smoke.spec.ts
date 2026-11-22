import { test, expect } from '@playwright/test';

test('home shows the two ways to start', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Cube Coach' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Scan my cube' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Type in the colors instead' })).toBeVisible();
});

test('the browser back button returns home', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Type in the colors instead' }).click();
  await expect(page).toHaveURL(/#\/review\/manual$/);
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Scan my cube' })).toBeVisible();
});
