import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The 3D player needs WebGL and the solver needs a worker; the mocks record what the screen asks for.
const t = vi.hoisted(() => ({
  playAt: [] as number[],
  load: [] as { setup: string[]; moves: string[] }[],
  resolve: (_moves: string[]) => {},
}));

vi.mock('../../src/ui/player', () => ({
  CubePlayer: class {
    el = document.createElement('div');
    load(setup: string[], moves: string[]) { t.load.push({ setup, moves }); }
    playAt(index: number) { t.playAt.push(index); return 1000; }
    dispose() {}
  },
}));
vi.mock('../../src/solve/fast-solve', () => ({
  solveInWorker: () => new Promise<string[]>((r) => { t.resolve = r; }),
}));

const { session } = await import('../../src/app/session');
const { solveScreen } = await import('../../src/solve/solve-screen');

const button = (root: HTMLElement, name: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === name) as HTMLButtonElement;
const tap = (root: HTMLElement, name: string) => button(root, name).click();
const counter = (root: HTMLElement) => root.querySelector('.card .muted')?.textContent;

async function mountSolved(moves = ['R', 'U', "F'"]): Promise<HTMLElement> {
  const root = document.createElement('main');
  document.body.replaceChildren(root);
  solveScreen(root);
  t.resolve(moves);
  await vi.advanceTimersByTimeAsync(0);
  return root;
}

// Waits out the button lock while a move plays.
const moveEnds = () => vi.advanceTimersByTimeAsync(1000);

describe('solve screen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    t.playAt = [];
    t.load = [];
    session.facelets = 'scrambled';
  });
  afterEach(() => vi.useRealTimers());

  it('shows move 1 and plays it as soon as the moves are known', async () => {
    const root = await mountSolved();
    expect(counter(root)).toBe('Move 1 of 3');
    expect(t.load).toEqual([{ setup: ['F', "U'", "R'"], moves: ['R', 'U', "F'"] }]);
    expect(t.playAt).toEqual([0]);
  });

  it('keeps Next and Back off until the moves are known, so Solved! never shows early', () => {
    const root = document.createElement('main');
    document.body.replaceChildren(root);
    solveScreen(root);
    expect(button(root, 'Next move').disabled).toBe(true);
    expect(button(root, 'Back').disabled).toBe(true);
    tap(root, 'Next move');
    expect(root.textContent).not.toContain('Solved!');
    expect(t.playAt).toEqual([]);
  });

  it('Next then Back returns to move 1 and replays it', async () => {
    const root = await mountSolved();
    await moveEnds();
    tap(root, 'Next move');
    expect(counter(root)).toBe('Move 2 of 3');
    await moveEnds();
    tap(root, 'Back');
    expect(counter(root)).toBe('Move 1 of 3');
    expect(t.playAt).toEqual([0, 1, 0]);
  });

  it('Show again keeps the move and replays it', async () => {
    const root = await mountSolved();
    await moveEnds();
    tap(root, 'Next move');
    await moveEnds();
    tap(root, 'Show again');
    expect(counter(root)).toBe('Move 2 of 3');
    expect(t.playAt).toEqual([0, 1, 1]);
  });

  it('Next on the last move shows Solved!, and Back returns to the last move', async () => {
    const root = await mountSolved();
    for (let i = 0; i < 3; i++) {
      await moveEnds();
      tap(root, 'Next move');
    }
    expect(root.textContent).toContain('Solved!');
    tap(root, 'Back');
    expect(counter(root)).toBe('Move 3 of 3');
    expect(t.playAt).toEqual([0, 1, 2, 2]);
  });

  it('a fast second tap on Next waits until the move has played', async () => {
    const root = await mountSolved();
    await moveEnds();
    tap(root, 'Next move');
    tap(root, 'Next move');
    expect(counter(root)).toBe('Move 2 of 3');
    expect(button(root, 'Next move').hasAttribute('disabled')).toBe(true);
    await moveEnds();
    tap(root, 'Next move');
    expect(counter(root)).toBe('Move 3 of 3');
  });
});
