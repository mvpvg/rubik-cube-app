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
  await expect.poll(() => page.evaluate(() => {
    const video = document.querySelector('video.scan-video') as HTMLVideoElement | null;
    return !!video?.srcObject && video.videoWidth > 0;
  })).toBe(true);
  await expect(page.getByText('The camera is not working here')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Take picture' })).toBeEnabled();
});

// The fake camera's picture reads as green, so the green side matches and the others need "Use it anyway".
test('a finished scan can take the green side again from the color check and come back to it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Scan my cube' }).click();
  const take = page.getByRole('button', { name: 'Take picture' });
  const anyway = page.getByRole('button', { name: 'Use it anyway' });
  await expect.poll(() => page.evaluate(() => (document.querySelector('video.scan-video') as HTMLVideoElement | null)?.videoWidth ?? 0)).toBeGreaterThan(0);
  while (!page.url().includes('#/review')) {
    await take.click();
    if (await anyway.isVisible()) await anyway.click();
  }
  await expect(page.getByRole('heading', { name: 'Check the colors' })).toBeVisible();

  await page.getByRole('button', { name: 'Show the green side' }).click();
  await page.getByRole('button', { name: 'Take this side again' }).click();
  await expect(page).toHaveURL(/#\/scan\/G$/);
  await expect(page.getByRole('button', { name: 'Keep my old one' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (document.querySelector('video.scan-video') as HTMLVideoElement | null)?.videoWidth ?? 0)).toBeGreaterThan(0);
  await take.click();

  await expect(page).toHaveURL(/#\/review\/G$/);
  await expect(page.locator('.zoom-title')).toHaveText('Green side');
});
