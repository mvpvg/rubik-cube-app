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

test('More help opens another website in a new tab', async ({ page }) => {
  await page.goto('/');
  const link = page.getByRole('link', { name: 'More help (another website)' });
  await expect(link).toHaveAttribute('href', 'https://rubikscu.be/how-to-solve/');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noreferrer/);
});

test('the move letters screen opens from home', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'What do the move letters mean?' }).click();
  await expect(page.getByRole('heading', { name: 'Moves' })).toBeVisible();
  await page.getByRole('button', { name: /^R Right side up$/ }).click();
  await expect(page.locator('twisty-player')).toBeAttached();
});

// A checked cube saved a moment ago, waiting on the color check.
const seedWork = (page: import('@playwright/test').Page) => page.addInitScript(() => localStorage.setItem('cube.session', JSON.stringify({
  version: 1, savedAt: Date.now(), route: 'review', samples: null, colors: null, checkMe: [], filled: [],
  facelets: 'FLFLUFBDDRRUURRDBURLBRFBRDRFFFFDDDRBDBUFLBLUULULUBLLDB', solve: null, learn: null,
})));

test('Back from an untouched typed-color screen returns home with no question, and the saved work stays', async ({ page }) => {
  await seedWork(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Type in the colors instead' }).click();
  await expect(page.getByRole('heading', { name: 'Type in the colors' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('button', { name: 'Keep going' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('"Start a new cube" asks first: Esc keeps the work, "Delete and start over" clears it and opens the scan', async ({ page }) => {
  await seedWork(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a new cube' }).click();
  await expect(page.getByRole('dialog')).toContainText('Your saved cube will be deleted.');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Keep going' })).toBeVisible();

  await page.getByRole('button', { name: 'Start a new cube' }).click();
  await page.getByRole('button', { name: 'Delete and start over' }).click();
  await expect(page).toHaveURL(/#\/scan$/);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('button', { name: 'Scan my cube' })).toBeVisible();
  await expect(page.getByText('Welcome back')).toHaveCount(0);
});
