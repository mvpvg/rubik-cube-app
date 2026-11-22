import { test, expect } from '@playwright/test';

// The cube after R U F' L2 D B R' U2 F D' L B2 U R2, in solver order (white on top, green in front).
const SCRAMBLED = 'FLFLUFBDDRRUURRDBURLBRFBRDRFFFFDDDRBDBUFLBLUULULUBLLDB';

test('solve screen steps through a solution on the 3D cube', async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem('cube.facelets', JSON.stringify(s)), SCRAMBLED);
  await page.goto('/#/solve');
  await expect(page.getByRole('heading', { name: /moves to solve it/ })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/Move 1 of \d+/)).toBeVisible();
  await expect(page.locator('twisty-player')).toBeAttached();
  await page.getByRole('button', { name: 'Next move' }).click();
  await expect(page.getByText(/Move 2 of \d+/)).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByText(/Move 1 of \d+/)).toBeVisible();
});
