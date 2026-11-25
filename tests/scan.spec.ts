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
  await expect(page.getByRole('button', { name: 'Take picture' })).toHaveCount(0);
  await page.getByRole('button', { name: "I'm ready" }).click();
  await expect(page.getByRole('button', { name: 'Take picture' })).toBeEnabled();
  // The fake camera's picture reads as green, so the camera box says the green side is found.
  await expect(page.locator('.scan-camera.ready')).toBeVisible();
  await expect(page.getByText('Green side found. Take the picture.')).toBeVisible();
});

test('the scan fits a small phone with no scrolling, with the big cube open and closed', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/#/scan');
  // Everything inside .fit is on screen; "Type in the colors instead" may sit below it by design.
  const fits = () => page.evaluate(() => document.querySelector('.fit')!.getBoundingClientRect().bottom <= window.innerHeight);
  await expect(page.locator('.scan-guide')).toBeVisible();
  expect(await fits()).toBe(true);
  await page.getByRole('button', { name: "I'm ready" }).click();
  expect(await fits()).toBe(true);
  // The squares still sit where the app reads the picture: 8% in from each edge.
  const inset = await page.evaluate(() => {
    const box = document.querySelector('.scan-camera')!.getBoundingClientRect();
    const grid = document.querySelector('.scan-grid')!.getBoundingClientRect();
    return [(grid.left - box.left) / box.width, (grid.top - box.top) / box.height];
  });
  inset.forEach((v) => expect(v).toBeCloseTo(0.08, 2));
});

// The fake camera's picture reads as green, so the green side matches and the others need "Use it anyway".
test('a finished scan can take the green side again from the color check and come back to it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Scan my cube' }).click();
  const take = page.getByRole('button', { name: 'Take picture' });
  const anyway = page.getByRole('button', { name: 'Use it anyway' });
  const turned = page.getByRole('button', { name: /^(I'm ready|I turned it)$/ });
  await expect.poll(() => page.evaluate(() => (document.querySelector('video.scan-video') as HTMLVideoElement | null)?.videoWidth ?? 0)).toBeGreaterThan(0);
  // Each side: the big cube shows the turn, "I turned it", then "Take picture" once it wakes up.
  while (!page.url().includes('#/review')) {
    if (await anyway.isVisible()) await anyway.click();
    else if (await turned.isVisible()) await turned.click();
    else if (await take.isEnabled()) await take.click();
    else await page.waitForTimeout(100);
  }
  await expect(page.getByRole('heading', { name: 'Check the colors' })).toBeVisible();

  await page.getByRole('button', { name: 'Show the green side' }).click();
  await page.getByRole('button', { name: 'Take this side again' }).click();
  await expect(page).toHaveURL(/#\/scan\/G$/);
  await expect(page.getByRole('button', { name: 'Keep my old one' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (document.querySelector('video.scan-video') as HTMLVideoElement | null)?.videoWidth ?? 0)).toBeGreaterThan(0);
  await turned.click();
  await take.click();

  await expect(page).toHaveURL(/#\/review\/G$/);
  await expect(page.locator('.zoom-title')).toHaveText('Green side');
});
