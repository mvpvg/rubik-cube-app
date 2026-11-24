import { test, expect } from '@playwright/test';

// The cube after R U F' L2 D B R' U2 F D' L B2 U R2, in solver order (white on top, green in front).
const SCRAMBLED = 'FLFLUFBDDRRUURRDBURLBRFBRDRFFFFDDDRBDBUFLBLUULULUBLLDB';
// The moves that undo that scramble.
const SOLUTION = ['R2', "U'", 'B2', "L'", 'D', "F'", 'U2', 'R', "B'", "D'", 'L2', 'F', "U'", "R'"];

// Seeds the key the earlier version of the app wrote, so this also proves it carries over.
test('solve screen steps through a solution on the 3D cube', async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem('cube.facelets', JSON.stringify(s)), SCRAMBLED);
  await page.goto('/#/solve');
  await expect(page.getByRole('heading', { name: /moves to solve it/ })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/Move 1 of \d+/)).toBeVisible();
  await expect(page.locator('twisty-player')).toBeAttached();
  // Each button waits, disabled, while a move plays; Playwright waits for it to be enabled.
  await page.getByRole('button', { name: 'Next move' }).click();
  await expect(page.getByText(/Move 2 of \d+/)).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByText(/Move 1 of \d+/)).toBeVisible();
  await page.getByRole('button', { name: 'Show again' }).click();
  await expect(page.getByText(/Move 1 of \d+/)).toBeVisible();
});

test('Keep going on Home asks about the cube, then continues Solve at the saved move', async ({ page }) => {
  await page.addInitScript(([cube, moves]) => localStorage.setItem('cube.session', JSON.stringify({
    version: 1, savedAt: Date.now(), route: 'solve', samples: null, colors: null, checkMe: [], filled: [],
    facelets: cube, solve: { cube, moves, position: 2 }, learn: null,
  })), [SCRAMBLED, SOLUTION] as const);
  await page.goto('/');
  await expect(page.getByText('Welcome back')).toBeVisible();
  await page.getByRole('button', { name: 'Keep going' }).click();
  await expect(page.getByText('Does your cube look like this?')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, keep going' }).click();
  await expect(page.getByText(`Move 3 of ${SOLUTION.length}`)).toBeVisible();
});
