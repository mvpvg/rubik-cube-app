import { describe, expect, it, vi } from 'vitest';

// The 3D player needs WebGL; these tests check the screen's own behavior.
vi.mock('../../src/ui/player', () => ({
  FULL_MASK: 'full',
  CubePlayer: class {
    el = document.createElement('div');
    load() {}
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
  practiceScreen(root);
  return root;
}

const byLabel = (root: HTMLElement, label: RegExp) =>
  [...root.querySelectorAll('button')].find((b) => label.test(b.getAttribute('aria-label') ?? b.textContent ?? '')) as HTMLButtonElement;
const status = (root: HTMLElement) => root.querySelector('.practice-status')?.textContent ?? '';

describe('practice screen', () => {
  it('shows a button for every side both ways, plus whole-cube turns', () => {
    const root = mount();
    expect(root.querySelectorAll('.move-grid .move-btn')).toHaveLength(12);
    expect(root.querySelectorAll('.turn-row .move-btn')).toHaveLength(3);
  });

  it('counts moves and says Solved! when the cube comes back', () => {
    const root = mount();
    byLabel(root, /^R: /).click();
    expect(status(root)).toMatch(/1 move/);
    byLabel(root, /^R′: /).click();
    expect(status(root)).toMatch(/Solved!/);
  });

  it('Undo is off until something can be undone', () => {
    const root = mount();
    const undo = byLabel(root, /^Undo$/);
    expect(undo.disabled).toBe(true);
    byLabel(root, /^U: /).click();
    expect(undo.disabled).toBe(false);
  });
});

describe('practice screen: hints and stage mode', () => {
  it('Hint shows the stage and a Do it for me button on a scrambled cube', () => {
    const root = document.createElement('main');
    document.body.replaceChildren(root);
    practiceScreen(root);
    [...root.querySelectorAll('button')].find((b) => b.textContent === 'Scramble')!.click();
    [...root.querySelectorAll('button')].find((b) => b.textContent === 'Hint')!.click();
    expect(root.querySelector('.hint-card')?.textContent).toMatch(/Stage \d of 7/);
    expect([...root.querySelectorAll('button')].some((b) => b.textContent === 'Do it for me')).toBe(true);
  });

  it('Do it for me locks the buttons while it plays, then unlocks them', async () => {
    vi.useFakeTimers();
    const root = document.createElement('main');
    document.body.replaceChildren(root);
    practiceScreen(root);
    const button = (t: string) => [...root.querySelectorAll('button')].find((b) => b.textContent === t)!;
    button('Scramble').click();
    button('Hint').click();
    button('Do it for me').click();
    expect(button('Undo').disabled).toBe(true);
    expect(root.querySelector('.hint-card')?.textContent).toMatch(/Playing/);
    await vi.runAllTimersAsync();
    expect(button('Undo').disabled).toBe(false);
    vi.useRealTimers();
  });

  it('Practice this stage opens a stage cube, and Reset goes back to it', () => {
    const root = document.createElement('main');
    document.body.replaceChildren(root);
    practiceScreen(root, 'white-corners');
    expect(root.querySelector('h1')?.textContent).toBe('Practice: White corners');
    const button = (t: string) => [...root.querySelectorAll('button')].find((b) => b.textContent === t || b.getAttribute('aria-label')?.startsWith(t))!;
    button('U:').click();
    button('Reset').click();
    expect(root.querySelector('.practice-status')?.textContent).toMatch(/0 moves/);
  });
});
