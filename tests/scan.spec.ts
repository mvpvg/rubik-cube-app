import { test, expect, type Page } from '@playwright/test';

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
  await expect(page.locator('.scan-live')).toHaveText('Green side found');
});

// Where the camera, the live line, the grid, and the main button sit on screen.
const layout = (page: Page) => page.evaluate(() => {
  const box = (el: Element | null) => el!.getBoundingClientRect();
  const main = [...document.querySelectorAll<HTMLElement>('.scan-take')].find((b) => !b.hidden)!;
  return {
    camera: box(document.querySelector('.scan-camera')).width,
    grid: box(document.querySelector('.scan-grid')).bottom,
    line: box(document.querySelector('.scan-live')),
    problem: box(document.querySelector('.scan-problem')),
    main: box(main).bottom,
    height: window.innerHeight,
  };
});

// A short phone may scroll, but the camera keeps a real size and the main button stays on screen.
for (const [width, height, camera] of [[360, 560, 240], [360, 640, 280]]) {
  test(`at ${width}x${height} the camera is at least ${camera} px and the main button is on screen, with the big cube open and closed`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/#/scan');
    await expect(page.locator('.scan-guide')).toBeVisible();
    let now = await layout(page);
    expect(now.camera).toBeGreaterThanOrEqual(camera);
    expect(now.main).toBeLessThanOrEqual(now.height);
    await page.getByRole('button', { name: "I'm ready" }).click();
    now = await layout(page);
    expect(now.camera).toBeGreaterThanOrEqual(camera);
    expect(now.main).toBeLessThanOrEqual(now.height);
    // The live words sit under the camera, so they never cover a square.
    expect(now.line.top).toBeGreaterThanOrEqual(now.grid);
  });

  test(`at ${width}x${height} the main button stays on screen while "Keep my old one" shows`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/#/scan');
    await page.getByRole('button', { name: "I'm ready" }).click();
    await page.getByRole('button', { name: 'Take picture' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Green side, taken. Tap to take again' }).click();
    await expect(page.getByRole('button', { name: 'Keep my old one' })).toBeVisible();
    const now = await layout(page);
    expect(now.main).toBeLessThanOrEqual(now.height);
  });

  test(`at ${width}x${height} the colors show inside the camera box, with Take it again and Next both on screen`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/#/scan');
    await page.getByRole('button', { name: "I'm ready" }).click();
    await page.getByRole('button', { name: 'Take picture' }).click();
    const panel = page.locator('.scan-check');
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Green', { exact: true })).toHaveCount(9);
    const boxes = await page.evaluate(() => {
      const box = (el: Element) => el.getBoundingClientRect();
      const named = (name: string) => [...document.querySelectorAll('button')].find((b) => b.textContent === name)!;
      return {
        camera: box(document.querySelector('.scan-camera')!),
        panel: box(document.querySelector('.scan-check')!),
        again: box(named('Take it again')),
        next: box(named('Next')),
        width: window.innerWidth,
        height: window.innerHeight,
      };
    });
    expect(boxes.panel.top).toBeGreaterThanOrEqual(boxes.camera.top);
    expect(boxes.panel.bottom).toBeLessThanOrEqual(boxes.camera.bottom);
    expect(boxes.camera.width).toBeGreaterThanOrEqual(camera);
    for (const button of [boxes.again, boxes.next]) {
      expect(button.top).toBeGreaterThanOrEqual(0);
      expect(button.bottom).toBeLessThanOrEqual(boxes.height);
      expect(button.left).toBeGreaterThanOrEqual(0);
      expect(button.right).toBeLessThanOrEqual(boxes.width);
    }
    // Side by side, in the one place the main button uses.
    expect(boxes.again.top).toBe(boxes.next.top);
    await page.screenshot({ path: `test-results/scan-check-${width}x${height}.png` });
  });
}

test('at 412x700 the camera is at least 280 px and the live words do not cover the squares', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 700 });
  await page.goto('/#/scan');
  await page.getByRole('button', { name: "I'm ready" }).click();
  const now = await layout(page);
  expect(now.camera).toBeGreaterThanOrEqual(280);
  expect(now.line.top).toBeGreaterThanOrEqual(now.grid);
});

test('at 360x560 a picture of the wrong side shows its message above the bottom of the main button', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 560 });
  await page.goto('/#/scan');
  await page.getByRole('button', { name: "I'm ready" }).click();
  await page.getByRole('button', { name: 'Take picture' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  // The fake camera reads as green, so the red side's picture is the wrong side.
  await page.getByRole('button', { name: 'I turned it' }).click();
  await expect(page.getByRole('button', { name: 'Take picture' })).toBeEnabled();
  await page.getByRole('button', { name: 'Take picture' }).click();
  await expect(page.getByRole('alert')).toHaveText('That looks like the green side. Show the red-center side.');
  const now = await layout(page);
  expect(now.problem.bottom).toBeLessThanOrEqual(now.main);
  expect(now.main).toBeLessThanOrEqual(now.height);
});

test('the live line keeps its height when its words change, and the squares keep their 8% inset', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  // Time stands still until the test moves it, so the plain words show before the side is found.
  await page.clock.install();
  await page.goto('/#/scan');
  await expect.poll(() => page.evaluate(() => (document.querySelector('video.scan-video') as HTMLVideoElement | null)?.videoWidth ?? 0)).toBeGreaterThan(0);
  await page.getByRole('button', { name: "I'm ready" }).click();
  const line = page.locator('.scan-live');
  await expect(line).toHaveText('Fit the side in the squares');
  const plain = (await line.boundingBox())!.height;
  await page.clock.runFor(1000);
  await expect(line).toHaveText('Green side found');
  expect((await line.boundingBox())!.height).toBe(plain);
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
  const next = page.getByRole('button', { name: 'Next' });
  const turned = page.getByRole('button', { name: /^(I'm ready|I turned it)$/ });
  await expect.poll(() => page.evaluate(() => (document.querySelector('video.scan-video') as HTMLVideoElement | null)?.videoWidth ?? 0)).toBeGreaterThan(0);
  // Each side: the big cube shows the turn, "I turned it", "Take picture" once it wakes up, then Next on the colors.
  while (!page.url().includes('#/review')) {
    if (await next.isVisible()) await next.click();
    else if (await anyway.isVisible()) await anyway.click();
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
  await next.click();

  await expect(page).toHaveURL(/#\/review\/G$/);
  await expect(page.locator('.zoom-title')).toHaveText('Green side');
});

test.describe('on a computer', () => {
  test.use({ hasTouch: false, isMobile: false, viewport: { width: 1280, height: 800 } });

  test('"Scan with your phone" shows a QR code and the scan link, and Esc closes it', async ({ page }) => {
    await page.goto('/#/scan');
    const opener = page.getByRole('button', { name: 'Scan with your phone' });
    await opener.click();
    const panel = page.getByRole('dialog', { name: 'Scan with your phone' });
    await expect(panel.getByRole('img', { name: 'QR code that opens the scan on a phone' })).toBeVisible();
    const url = new URL(page.url());
    await expect(panel.getByText(`${url.origin}${url.pathname}#/scan`, { exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.screenshot({ path: 'test-results/phone-qr.png' });
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(opener).toBeFocused();
  });
});
