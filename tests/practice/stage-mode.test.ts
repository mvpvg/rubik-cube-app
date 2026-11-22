import { describe, expect, it, vi } from 'vitest';

// A white cross practice cube one move away from done: R' knocks one cross edge out, R puts it back.
vi.mock('../../src/practice/stage-practice', () => ({
  makeStageCube: () => ({ setup: ["R'"], hold: 'White on top, green facing you' }),
}));

const loads = vi.hoisted(() => [] as string[][]);
vi.mock('../../src/ui/player', () => ({
  FULL_MASK: 'full',
  DEFAULT_TEMPO: 1.2,
  CubePlayer: class {
    el = document.createElement('div');
    load(setup: string[]) { loads.push(setup); }
    playMove() {}
    next() {}
    back() {}
    dispose() {}
    highlight() {}
    setTempo() {}
  },
}));

const { practiceScreen } = await import('../../src/practice/practice-screen');

function mount(): HTMLElement {
  const root = document.createElement('main');
  document.body.replaceChildren(root);
  practiceScreen(root, 'white-cross');
  return root;
}
const button = (root: HTMLElement, label: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent === label || b.getAttribute('aria-label')?.startsWith(label)) as HTMLButtonElement | undefined;

describe('practice one stage', () => {
  it('says Stage done! with next steps when the stage is finished, and drops it when broken again', () => {
    const root = mount();
    button(root, 'R:')!.click();
    expect(root.querySelector('.practice-status')?.textContent).toMatch(/Stage done!/);
    expect(button(root, 'Next stage')).toBeDefined();
    expect(button(root, 'Back to Learn')).toBeDefined();
    button(root, "R′:")!.click();
    expect(root.querySelector('.practice-status')?.textContent).not.toMatch(/Stage done!/);
  });

  it('Reset goes back to the stage cube, not a solved cube', () => {
    const root = mount();
    button(root, 'U:')!.click();
    loads.length = 0;
    button(root, 'Reset')!.click();
    expect(loads.at(-1)).toEqual(["R'"]);
  });
});
