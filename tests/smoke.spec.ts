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
