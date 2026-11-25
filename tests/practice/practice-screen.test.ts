import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The 3D player needs WebGL; these tests check the screen's own behavior.
const calls = vi.hoisted(() => ({ playMove: [] as string[], highlight: [] as string[] }));

vi.mock('../../src/ui/player', () => ({
  FULL_MASK: 'full',
  DEFAULT_TEMPO: 1.2,
  CubePlayer: class {
    el = document.createElement('div');
    load() {}
    next() {}
    back() {}
    dispose() {}
    highlight(mask = 'full') { calls.highlight.push(mask); }
    setTempo() {}
    playMove(_setup: string[], move: string) { calls.playMove.push(move); }
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
    const hintMoves = [...root.querySelectorAll('.hint-card .chip b')].length;
    expect(calls.highlight.at(-1)).not.toBe('full');
    calls.playMove.length = 0;
    button('Do it for me').click();
    expect(button('Undo').disabled).toBe(true);
    expect(root.querySelector('.hint-card')?.textContent).toMatch(/Playing/);
    await vi.runAllTimersAsync();
    expect(button('Undo').disabled).toBe(false);
    expect(calls.playMove).toHaveLength(hintMoves);
    expect(calls.highlight.at(-1)).toBe('full');
    expect(root.querySelector('.practice-status')?.textContent).toMatch(/Done! Tap Hint|Solved|Stage done/);
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

describe('practice screen Exit', () => {
  // jsdom has no modal dialog; Esc is proven in the browser tests.
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
  });
  beforeEach(() => { localStorage.clear(); });
  const exitWords = (root: HTMLElement) => {
    [...root.querySelectorAll('button')].find((b) => b.textContent === 'Exit')!.click();
    return root.querySelector('dialog .confirm-question')!.textContent;
  };

  it('after moves, says the practice cube will be lost', () => {
    const root = mount();
    byLabel(root, /^R: /).click();
    byLabel(root, /^U: /).click();
    byLabel(root, /^F: /).click();
    expect(exitWords(root)).toContain('Your practice cube will be lost.');
  });

  it('with no moves and nothing saved, asks only "Go back Home?"', () => {
    expect(exitWords(mount())).toBe('Go back Home?');
  });
});
