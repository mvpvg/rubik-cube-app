import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Cube from 'cubejs';
import { applyMoves } from '../../src/cube/facelets';
import { solveBeginner } from '../../src/learn/beginner-solver';

// The 3D player needs WebGL and the fast solver needs a worker; the mocks record what the screen
// asks the player for, and the solver answers only when a test says so.
const t = vi.hoisted(() => ({
  load: [] as number[],
  playAt: [] as number[],
  resolve: (_moves: string[]) => {},
  reject: () => {},
}));
vi.mock('../../src/ui/player', () => ({
  FULL_MASK: 'full',
  CubePlayer: class {
    el = document.createElement('div');
    ready = Promise.resolve();
    load(_setup: string[], _moves: string[], done = 0) { t.load.push(done); }
    playAt(index: number) { t.playAt.push(index); return Promise.resolve(1000); }
    dispose() {}
    highlight() {}
  },
}));
vi.mock('../../src/solve/fast-solve', () => ({
  solveInWorker: () => new Promise<string[]>((resolve, reject) => { t.resolve = resolve; t.reject = reject; }),
}));

const { loadSession, session, setLearn } = await import('../../src/app/session');
const { learnScreen } = await import('../../src/learn/learn-screen');

function mount(param?: string): HTMLElement {
  const root = document.createElement('main');
  document.body.replaceChildren(root);
  learnScreen(root, param);
  return root;
}

// The top bar's buttons show words too ("Back"), so only the buttons below it are searched.
const buttonNamed = (root: HTMLElement, name: string) =>
  [...root.querySelectorAll('button')].find((b) => !b.closest('.topbar') && b.textContent?.trim() === name) as HTMLButtonElement | undefined;
const title = (root: HTMLElement) => root.querySelector('h1')?.textContent;

function finishStage(root: HTMLElement): void {
  for (let guard = 0; guard < 400 && !buttonNamed(root, 'I did it!'); guard++) buttonNamed(root, 'Next move')!.click();
  buttonNamed(root, 'I did it!')!.click();
}

describe('learn screen', () => {
  let cube: string;
  beforeEach(() => {
    localStorage.clear();
    loadSession();
    t.load = [];
    t.playAt = [];
    // A cube whose white cross needs at least three moves.
    do cube = Cube.random().asString(); while (solveBeginner(cube)[0].subSteps.flatMap((s) => s.moves).length < 3);
    session.facelets = cube;
  });
  afterEach(() => vi.useRealTimers());

  it('opens at white cross and shows "I did it!" only after the last move', () => {
    const root = mount();
    expect(title(root)).toBe('White cross');
    expect(buttonNamed(root, 'I did it!')).toBeUndefined();
    expect(root.textContent).toMatch(/Step 1 of/);
    for (let guard = 0; guard < 400 && !buttonNamed(root, 'I did it!'); guard++) buttonNamed(root, 'Next move')!.click();
    expect(buttonNamed(root, 'I did it!')).toBeDefined();
  });

  it('Back undoes one move', () => {
    const root = mount();
    const first = root.querySelector('.chip.now')?.textContent;
    buttonNamed(root, 'Next move')!.click();
    buttonNamed(root, 'Back')!.click();
    expect(root.querySelector('.chip.now')?.textContent).toBe(first);
  });

  it('after finishing stage one, reloading reopens at stage two of the same cube', () => {
    finishStage(mount());
    const again = mount();
    expect(title(again)).toBe('White corners');
  });

  it('rescanning a cube whose cross is done opens at white corners', () => {
    const plan = solveBeginner(cube);
    session.facelets = applyMoves(cube, plan[0].subSteps.flatMap((s) => s.moves));
    expect(title(mount())).toBe('White corners');
  });

  it('colors that cannot make a real cube send the child back to check them', () => {
    // Up-right-front corner with its red and green swapped: right counts, impossible cube.
    session.facelets = cube.split('').map((c, i) => (i === 9 ? cube[20] : i === 20 ? cube[9] : c)).join('');
    const root = mount();
    expect(title(root)).toBe('Let’s check the colors');
    expect(buttonNamed(root, 'Check the colors')).toBeDefined();
  });

  it('Practice this stage opens Practice for the current stage', () => {
    const root = mount();
    buttonNamed(root, 'Practice this stage')!.click();
    expect(location.hash).toBe('#/practice/white-cross');
  });

  it('a new scramble replaces the saved progress', () => {
    finishStage(mount());
    let other: string;
    do other = Cube.random().asString(); while (solveBeginner(other)[0].subSteps.length === 0);
    session.facelets = other;
    expect(title(mount())).toBe('White cross');
  });

  it('without the 3D cube, Next still moves through the cards and the player is left alone', () => {
    const root = mount();
    const first = root.querySelector('.card')!.innerHTML;
    buttonNamed(root, 'Next move')!.click();
    expect(root.querySelector('.card')!.innerHTML).not.toBe(first);
    expect(buttonNamed(root, 'Back')!.disabled).toBe(false);
    expect(t.load).toEqual([]);
    expect(t.playAt).toEqual([]);
  });

  it('when the 3D cube is ready at move 3, it loads at move 3 and plays it', async () => {
    const root = mount();
    buttonNamed(root, 'Next move')!.click();
    buttonNamed(root, 'Next move')!.click();
    t.resolve(['R']);
    await Promise.resolve();
    await Promise.resolve();
    expect(t.load).toEqual([2]);
    expect(t.playAt).toEqual([2]);
  });

  it('a fast second tap on Next waits until the move has played', async () => {
    vi.useFakeTimers();
    const root = mount();
    t.resolve(['R']);
    await vi.advanceTimersByTimeAsync(1000);
    buttonNamed(root, 'Next move')!.click();
    buttonNamed(root, 'Next move')!.click();
    expect(t.playAt).toEqual([0, 1]);
    await vi.advanceTimersByTimeAsync(1000);
    buttonNamed(root, 'Show again')!.click();
    expect(t.playAt).toEqual([0, 1, 1]);
  });

  it('when the solver fails, Next and Back keep working', async () => {
    const root = mount();
    const first = root.querySelector('.chip.now')?.textContent;
    t.reject();
    await Promise.resolve();
    await Promise.resolve();
    buttonNamed(root, 'Next move')!.click();
    expect(buttonNamed(root, 'Back')!.disabled).toBe(false);
    buttonNamed(root, 'Back')!.click();
    expect(root.querySelector('.chip.now')?.textContent).toBe(first);
  });

  it('focus on Next move stays there when the card redraws', () => {
    const root = mount();
    buttonNamed(root, 'Next move')!.focus();
    buttonNamed(root, 'Next move')!.click();
    expect(document.activeElement).toBe(buttonNamed(root, 'Next move'));
  });

  it('if the browser drops focus from the locked Next move, focus comes back once the move has played', async () => {
    vi.useFakeTimers();
    const root = mount();
    t.resolve(['R']);
    await vi.advanceTimersByTimeAsync(1000);
    buttonNamed(root, 'Next move')!.focus();
    buttonNamed(root, 'Next move')!.click();
    buttonNamed(root, 'Next move')!.blur(); // jsdom keeps focus on a disabled button; browsers may not
    await vi.advanceTimersByTimeAsync(1000);
    expect(document.activeElement).toBe(buttonNamed(root, 'Next move'));
  });

  it('the step card is read aloud when it changes', () => {
    expect(mount().querySelector('.card')?.getAttribute('aria-live')).toBe('polite');
  });

  it('at stage 3 move 2, a reload from storage opens at stage 3 move 2', () => {
    do cube = Cube.random().asString(); while (solveBeginner(cube)[2].subSteps.flatMap((s) => s.moves).length < 2);
    session.facelets = cube;
    const root = mount();
    finishStage(root);
    finishStage(root);
    buttonNamed(root, 'Next move')!.click();
    const card = root.querySelector('.card')!.innerHTML;
    loadSession();
    const again = mount();
    expect(again.querySelector('.muted')?.textContent).toMatch(/^Stage 3 of/);
    expect(again.querySelector('.card')!.innerHTML).toBe(card);
    expect(session.learn).toMatchObject({ stage: 2, move: 1 });
    expect(localStorage.getItem('learn.progress')).toBeNull();
  });

  describe('cube check', () => {
    const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

    it('rests before the current move, and "Yes, keep going" plays it', async () => {
      setLearn(0, 2);
      const root = mount('check');
      t.resolve(['R']);
      await settle();
      expect(root.textContent).toContain('Does your cube look like this?');
      expect(t.load).toEqual([2]);
      expect(t.playAt).toEqual([]);
      buttonNamed(root, 'Yes, keep going')!.click();
      expect(t.playAt).toEqual([2]);
      expect(root.querySelector('.chip.now')).not.toBeNull();
    });

    it('on a "Stage done!" card, "No" offers "Scan it again" at once, with no second look', async () => {
      setLearn(0, solveBeginner(cube)[0].subSteps.flatMap((s) => s.moves).length);
      const root = mount('check');
      t.resolve(['R']);
      await settle();
      expect(buttonNamed(root, 'Yes, keep going')).toBeDefined();
      expect(buttonNamed(root, 'No, it looks different')).toBeUndefined();
      buttonNamed(root, 'No, scan it again')!.click();
      expect(location.hash).toBe('#/scan');
    });

    it('while the solver works it says "Getting your cube ready…" with no answer buttons and no 3D cube, and Back still works', () => {
      const root = mount('check');
      expect(root.textContent).toContain('Getting your cube ready…');
      expect(buttonNamed(root, 'Yes, keep going')).toBeUndefined();
      expect(root.querySelector<HTMLElement>('.player-box')!.style.display).toBe('none');
      expect(root.querySelector<HTMLButtonElement>('[aria-label="Back to checking colors"]')!.disabled).toBe(false);
    });

    it('when the solver fails, it shows a flat color map of the cube with both buttons', async () => {
      const root = mount('check');
      t.reject();
      await settle();
      expect(root.querySelectorAll('.net .net-sticker')).toHaveLength(54);
      expect(buttonNamed(root, 'Yes, keep going')).toBeDefined();
      expect(buttonNamed(root, 'No, it looks different')).toBeDefined();
    });
  });
});
