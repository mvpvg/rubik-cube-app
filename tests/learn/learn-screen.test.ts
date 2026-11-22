import { beforeEach, describe, expect, it, vi } from 'vitest';
import Cube from 'cubejs';
import { applyMoves } from '../../src/cube/facelets';
import { solveBeginner } from '../../src/learn/beginner-solver';

// The 3D player needs WebGL and the fast solver needs a worker; neither matters to these tests.
vi.mock('../../src/ui/player', () => ({
  CubePlayer: class {
    el = document.createElement('div');
    load() {}
    next() {}
    back() {}
  },
}));
vi.mock('../../src/solve/fast-solve', () => ({ solveInWorker: () => new Promise(() => {}) }));

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
    // A cube whose white cross is not done yet, so stage one has moves.
    do cube = Cube.random().asString(); while (solveBeginner(cube)[0].subSteps.length === 0);
    session.facelets = cube;
  });

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

  it('a new scramble replaces the saved progress', () => {
    finishStage(mount());
    let other: string;
    do other = Cube.random().asString(); while (solveBeginner(other)[0].subSteps.length === 0);
    session.facelets = other;
    expect(title(mount())).toBe('White cross');
  });
});
