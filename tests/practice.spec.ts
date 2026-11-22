import { test, expect } from '@playwright/test';

test('practice: open from home, scramble, and turn a side', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Practice on a screen cube' }).click();
  await expect(page.getByRole('heading', { name: 'Practice' })).toBeVisible();
  await expect(page.locator('twisty-player')).toBeAttached();
  await page.getByRole('button', { name: 'Scramble' }).click();
  await page.getByRole('button', { name: /^R: / }).click();
  await expect(page.locator('.practice-status')).toContainText('1 move');
});
