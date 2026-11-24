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
    load(_setup: string[], _moves: string[], done = 0) { t.load.push(done); }
    playAt(index: number) { t.playAt.push(index); return 1000; }
    dispose() {}
    highlight() {}
  },
}));
vi.mock('../../src/solve/fast-solve', () => ({
  solveInWorker: () => new Promise<string[]>((resolve, reject) => { t.resolve = resolve; t.reject = reject; }),
}));

const { session } = await import('../../src/app/session');
const { learnScreen } = await import('../../src/learn/learn-screen');

function mount(): HTMLElement {
  const root = document.createElement('main');
  document.body.replaceChildren(root);
  learnScreen(root);
  return root;
}

const buttonNamed = (root: HTMLElement, name: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === name) as HTMLButtonElement | undefined;
const title = (root: HTMLElement) => root.querySelector('h1')?.textContent;

function finishStage(root: HTMLElement): void {
  for (let guard = 0; guard < 400 && !buttonNamed(root, 'I did it!'); guard++) buttonNamed(root, 'Next move')!.click();
  buttonNamed(root, 'I did it!')!.click();
}

describe('learn screen', () => {
  let cube: string;
  beforeEach(() => {
    localStorage.clear();
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

  it('the step card is read aloud when it changes', () => {
    expect(mount().querySelector('.card')?.getAttribute('aria-live')).toBe('polite');
  });
});
