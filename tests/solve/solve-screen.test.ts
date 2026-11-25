import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The 3D player needs WebGL and the solver needs a worker; the mocks record what the screen asks for.
const t = vi.hoisted(() => ({
  playAt: [] as number[],
  load: [] as { setup: string[]; moves: string[]; done?: number }[],
  solverCalls: 0,
  resolve: (_moves: string[]) => {},
  viewReady: Promise.resolve(), // when the 3D view has loaded
}));

vi.mock('../../src/ui/player', () => ({
  CubePlayer: class {
    el = document.createElement('div');
    ready = Promise.resolve();
    load(setup: string[], moves: string[], done = 0) { t.load.push(done ? { setup, moves, done } : { setup, moves }); }
    playAt(index: number) { t.playAt.push(index); return t.viewReady.then(() => 1000); }
    dispose() {}
  },
}));
vi.mock('../../src/solve/fast-solve', () => ({
  solveInWorker: () => { t.solverCalls++; return new Promise<string[]>((r) => { t.resolve = r; }); },
}));

const { loadSession, session, setCube, setSolve } = await import('../../src/app/session');
const { applyMoves, invertMoves, SOLVED } = await import('../../src/cube/facelets');
const { solveScreen } = await import('../../src/solve/solve-screen');

// The top bar's buttons show words too ("Back"), so only the buttons below it are searched.
const button = (root: HTMLElement, name: string) =>
  [...root.querySelectorAll('button')].find((b) => !b.closest('.topbar') && b.textContent?.trim() === name) as HTMLButtonElement;
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
    t.solverCalls = 0;
    session.facelets = 'scrambled';
    session.solve = null;
    t.viewReady = Promise.resolve();
  });
  afterEach(() => vi.useRealTimers());

  it('keeps Next locked while the 3D view is still loading, so move 1 is not cut off', async () => {
    let loaded = () => {};
    t.viewReady = new Promise((r) => { loaded = r; });
    const root = await mountSolved();
    await vi.advanceTimersByTimeAsync(3000);
    expect(button(root, 'Next move').disabled).toBe(true);
    loaded();
    await vi.advanceTimersByTimeAsync(999);
    expect(button(root, 'Next move').disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(button(root, 'Next move').disabled).toBe(false);
  });

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

  it('focus on Next move stays there while the move plays and after it', async () => {
    const root = await mountSolved();
    await moveEnds();
    button(root, 'Next move').focus();
    tap(root, 'Next move');
    expect(document.activeElement).toBe(button(root, 'Next move'));
    await moveEnds();
    expect(document.activeElement).toBe(button(root, 'Next move'));
  });

  it('if the browser drops focus from the locked Next move, focus comes back once the move has played', async () => {
    const root = await mountSolved();
    await moveEnds();
    button(root, 'Next move').focus();
    tap(root, 'Next move');
    button(root, 'Next move').blur(); // jsdom keeps focus on a disabled button; browsers may not
    await moveEnds();
    expect(document.activeElement).toBe(button(root, 'Next move'));
  });

  describe('saved position', () => {
    // A real cube and the 6 moves that solve it, so the saved list passes the check on load.
    const SCRAMBLE = ['R', 'U', "F'", 'L', 'D2', 'B'];
    const CUBE = applyMoves(SOLVED, SCRAMBLE);
    const MOVES = invertMoves(SCRAMBLE);
    const mountAt = (param?: string) => {
      const root = document.createElement('main');
      document.body.replaceChildren(root);
      solveScreen(root, param);
      return root;
    };
    const yes = (root: HTMLElement) => tap(root, 'Yes, keep going');

    beforeEach(() => {
      localStorage.clear();
      loadSession();
      setCube(CUBE);
      location.hash = '#/solve/check';
    });

    it('at move 4, a reload shows move 4 and plays it without asking the solver', async () => {
      t.solverCalls = 0;
      const root = mountAt();
      t.resolve(MOVES);
      await vi.advanceTimersByTimeAsync(0);
      for (let i = 0; i < 3; i++) {
        await moveEnds();
        tap(root, 'Next move');
      }
      expect(counter(root)).toBe('Move 4 of 6');
      loadSession();
      t.solverCalls = 0;
      t.playAt = [];
      const again = mountAt();
      expect(counter(again)).toBe('Move 4 of 6');
      expect(t.playAt).toEqual([3]);
      expect(t.solverCalls).toBe(0);
      expect(again.textContent).not.toContain('Does your cube look like this?');
    });

    it('a saved position for a different cube is not used: it starts at move 1 and asks the solver', async () => {
      setCube(applyMoves(SOLVED, 'R U'));
      session.solve = { cube: CUBE, moves: MOVES, position: 3 };
      t.solverCalls = 0;
      const root = mountAt();
      expect(t.solverCalls).toBe(1);
      t.resolve(['U\'', 'R\'']);
      await vi.advanceTimersByTimeAsync(0);
      expect(counter(root)).toBe('Move 1 of 2');
    });

    it('the cube check at position 3 shows the cube after 3 moves with nothing playing; "Yes, keep going" shows move 4 and plays it', async () => {
      setSolve(MOVES, 3);
      const root = mountAt('check');
      expect(root.textContent).toContain('Does your cube look like this?');
      expect(t.load).toEqual([{ setup: invertMoves(MOVES), moves: MOVES, done: 3 }]);
      expect(t.playAt).toEqual([]);
      expect(button(root, 'Next move')).toBeUndefined();
      yes(root);
      expect(counter(root)).toBe('Move 4 of 6');
      expect(t.playAt).toEqual([3]);
      expect(location.hash).toBe('#/solve');
    });

    it('"No, it looks different" plays move 4 and asks again; then "Yes, keep going" shows move 5 and saves position 4', async () => {
      setSolve(MOVES, 3);
      const root = mountAt('check');
      tap(root, 'No, it looks different');
      expect(t.playAt).toEqual([3]);
      expect(root.textContent).toContain('Does your cube look like this?');
      expect(button(root, 'Yes, keep going').disabled).toBe(true);
      await moveEnds();
      yes(root);
      expect(counter(root)).toBe('Move 5 of 6');
      expect(t.playAt).toEqual([3, 4]);
      loadSession();
      expect(session.solve?.position).toBe(4);
    });

    it('"No, scan it again" after the second look goes to the scan', async () => {
      setSolve(MOVES, 3);
      const root = mountAt('check');
      tap(root, 'No, it looks different');
      await moveEnds();
      tap(root, 'No, scan it again');
      expect(location.hash).toBe('#/scan');
    });
  });
});

describe('solve screen Exit', () => {
  // jsdom has no modal dialog; Esc is proven in the browser tests.
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
  });
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    loadSession();
    session.facelets = 'scrambled';
    session.route = 'solve';
  });
  afterEach(() => vi.useRealTimers());

  it('on move 5, says the cube is saved and Home has "Keep going"', async () => {
    const root = await mountSolved(['R', 'U', "F'", 'L', 'D', 'B']);
    await moveEnds();
    for (let i = 0; i < 4; i++) { tap(root, 'Next move'); await moveEnds(); }
    expect(counter(root)).toContain('5');
    [...root.querySelectorAll('.topbar button')].find((b) => b.textContent === 'Exit')!.dispatchEvent(new MouseEvent('click'));
    expect(root.querySelector('dialog .confirm-question')!.textContent).toBe('Go back Home? Your cube is saved. Tap "Keep going" on Home to come back.');
  });
});
