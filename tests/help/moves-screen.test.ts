import { describe, expect, it, vi } from 'vitest';

const loads: Array<{ setup: string[]; moves: string[] }> = [];
vi.mock('../../src/ui/player', () => ({
  CubePlayer: class {
    el = document.createElement('div');
    load(setup: string[], moves: string[]) { loads.push({ setup, moves }); }
    next() {}
    dispose() {}
  },
}));

const { movesScreen } = await import('../../src/help/moves-screen');
const { register, start } = await import('../../src/app/router');

describe('moves screen', () => {
  it('lists all 18 face moves and 9 whole-cube turns, each with words', () => {
    const root = document.createElement('main');
    movesScreen(root);
    const rows = [...root.querySelectorAll('.move-row')];
    expect(rows).toHaveLength(27);
    for (const r of rows) expect(r.querySelector('span')?.textContent?.length ?? 0).toBeGreaterThan(5);
  });

  it('tapping R plays R on the cube', () => {
    const root = document.createElement('main');
    movesScreen(root);
    const r = [...root.querySelectorAll<HTMLButtonElement>('.move-row')].find((b) => b.querySelector('b')?.textContent === 'R')!;
    r.click();
    expect(loads.at(-1)).toEqual({ setup: [], moves: ['R'] });
    expect(r.getAttribute('aria-pressed')).toBe('true');
  });

  it('opened as the first page, Back goes Home instead of leaving the app', async () => {
    history.replaceState(null, '', '#/moves');
    document.body.replaceChildren(Object.assign(document.createElement('main'), { id: 'app' }));
    register('home', (root) => { root.append('Home'); });
    register('moves', movesScreen);
    start();
    document.querySelector<HTMLButtonElement>('[aria-label="Back"]')!.click();
    await new Promise((r) => window.addEventListener('hashchange', r, { once: true }));
    expect(location.hash).toBe('#/home');
    expect(document.getElementById('app')!.textContent).toBe('Home');
  });
});
