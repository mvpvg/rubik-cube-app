import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RGB } from '../../src/app/session';
import { applyMoves, SOLVED, toColors, type Face } from '../../src/cube/facelets';

// The camera is faked: each "Take picture" sees whatever side the test puts in front of it.
const t = vi.hoisted(() => ({ cells: null as RGB[] | null, broken: false }));
vi.mock('../../src/scan/camera', () => ({
  startCamera: () => (t.broken ? Promise.reject(new Error('no camera')) : Promise.resolve({ getTracks: () => [] })),
  stopCamera: () => {},
  grabCells: (_v: unknown, _c: unknown, size: number) => (size === 300 ? t.cells : null),
}));
vi.mock('../../src/scan/classify', async (real) => {
  const actual = await real<typeof import('../../src/scan/classify')>();
  return { ...actual, classify: vi.fn(actual.classify) };
});

const { loadSession, saveSession, session, setCube, setLearn, setSolve } = await import('../../src/app/session');
const { classify } = await import('../../src/scan/classify');
const { scanAgain, scanScreen } = await import('../../src/scan/scan-screen');
const { register, start } = await import('../../src/app/router');
const { STAGES } = await import('../../src/learn/beginner-solver');
const { reviewScreen } = await import('../../src/review/net-editor');

const RGB_OF: Record<Face, RGB> = {
  U: [255, 255, 255], R: [196, 30, 58], F: [0, 158, 96], D: [255, 213, 0], L: [255, 88, 0], B: [0, 81, 186],
};
// The sides in the order the scan asks for them: green, red, blue, orange, white, yellow.
const ORDER: Face[] = ['F', 'R', 'B', 'L', 'U', 'D'];
const CUBE = applyMoves(SOLVED, 'R U');
const stored = () => JSON.parse(localStorage.getItem('cube.session')!);

function mount(param?: string): { root: HTMLElement; close: () => void } {
  const root = document.createElement('main');
  document.body.replaceChildren(root);
  return { root, close: scanScreen(root, param) };
}

const buttonNamed = (root: HTMLElement, name: string) =>
  [...root.querySelectorAll('button')].find((b) => !b.hidden && (b.textContent === name || b.getAttribute('aria-label') === name)) as HTMLButtonElement | undefined;
const headline = (root: HTMLElement) => root.querySelector('h1')!.textContent;

// jsdom has no modal dialog; the real one (Esc, the back gesture) is proven in the browser tests.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
const settle = () => new Promise((r) => setTimeout(r));

// Answers the question about the old work, then lets the waiting picture land.
async function answer(root: HTMLElement, name: 'Keep my cube' | 'Delete and start over'): Promise<void> {
  buttonNamed(root, name)!.click();
  await settle();
}

function take(root: HTMLElement, face: Face): void {
  t.cells = Array(9).fill(RGB_OF[face]);
  [...root.querySelectorAll('button')].find((b) => b.textContent === 'Take picture')!.click();
}

describe('scan screen saving', () => {
  let close = () => {};
  beforeEach(() => {
    localStorage.clear();
    loadSession();
    vi.mocked(classify).mockClear();
    // Saved Learn work on another cube.
    setCube(CUBE);
    session.colors = toColors(CUBE);
    session.route = 'learn';
    setLearn(0, 0);
  });
  afterEach(() => {
    close();
    vi.restoreAllMocks();
  });

  it('opening the scan and taking no picture leaves the saved Learn work alone', () => {
    const scan = mount();
    close = scan.close;
    scan.close();
    loadSession();
    expect(session.route).toBe('learn');
    expect(session.learn).toEqual({ cube: CUBE, stage: 0, move: 0 });
  });

  it('the first picture asks first; "Delete and start over" replaces the old work, and each picture is saved with the scan as the route', async () => {
    const scan = mount();
    close = scan.close;
    take(scan.root, 'F');
    expect(scan.root.querySelector('dialog')!.textContent).toContain('Your saved cube will be deleted.');
    await answer(scan.root, 'Delete and start over');
    expect(scan.root.querySelector('dialog')).toBeNull();
    expect(headline(scan.root)).toBe('Show the red side');
    loadSession();
    expect(session.route).toBe('scan');
    expect(session.facelets).toBeNull();
    expect(session.learn).toBeNull();
    expect(session.colors).toBeNull();
    expect(session.samples!.filter(Boolean)).toHaveLength(9);
    take(scan.root, 'R');
    loadSession();
    expect(session.samples!.filter(Boolean)).toHaveLength(18);
  });

  it('the sixth picture writes the samples, colors, flags, and the color check route in one save, and the color check does not match again', async () => {
    const scan = mount();
    close = scan.close;
    take(scan.root, 'F');
    await answer(scan.root, 'Delete and start over');
    ORDER.slice(1, 5).forEach((face) => take(scan.root, face));
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    take(scan.root, 'D');
    expect(setItem).toHaveBeenCalledTimes(1);
    const saved = stored();
    expect(saved.route).toBe('review');
    expect(saved.samples.every(Boolean)).toBe(true);
    expect(saved.colors).toEqual(toColors(SOLVED));
    expect(saved.checkMe).toEqual([]);
    expect(location.hash).toBe('#/review');
    expect(classify).toHaveBeenCalledTimes(1);

    loadSession();
    const root = document.createElement('main');
    document.body.replaceChildren(root);
    reviewScreen(root);
    expect(classify).toHaveBeenCalledTimes(1);
    expect([...root.querySelectorAll('.net-sticker')].map((s) => s.textContent).join('')).toBe(toColors(SOLVED).join(''));
  });
});

describe('scan screen, asking before the old work is deleted', () => {
  let close = () => {};
  beforeEach(() => {
    localStorage.clear();
    loadSession();
    setCube(CUBE);
    session.colors = toColors(CUBE);
    session.route = 'learn';
    setLearn(0, 0);
  });
  afterEach(() => close());

  it('while the question waits, the saved record holds the old work and not the picture; "Keep my cube" drops the picture', async () => {
    const before = localStorage.getItem('cube.session');
    const scan = mount();
    close = scan.close;
    take(scan.root, 'F');
    expect(scan.root.querySelector('dialog')!.open).toBe(true);
    expect(localStorage.getItem('cube.session')).toBe(before);
    expect(stored().samples).toBeNull();
    await answer(scan.root, 'Keep my cube');
    expect(scan.root.querySelector('dialog')).toBeNull();
    expect(localStorage.getItem('cube.session')).toBe(before);
    expect(headline(scan.root)).toBe('Show the green side');
    expect(buttonNamed(scan.root, 'Green side, now')).toBeDefined();
  });

  it('Esc (the dialog\'s cancel) keeps the old work', async () => {
    const before = localStorage.getItem('cube.session');
    const scan = mount();
    close = scan.close;
    take(scan.root, 'F');
    scan.root.querySelector('dialog')!.dispatchEvent(new Event('cancel'));
    await settle();
    expect(scan.root.querySelector('dialog')).toBeNull();
    expect(localStorage.getItem('cube.session')).toBe(before);
  });

  it('a screen change while the question waits removes it, and the delete never runs later', async () => {
    const before = localStorage.getItem('cube.session');
    const scan = mount();
    take(scan.root, 'F');
    scan.close();
    scan.root.replaceChildren();
    await settle();
    expect(document.querySelector('dialog')).toBeNull();
    expect(localStorage.getItem('cube.session')).toBe(before);
  });

  it('finished work (Learn past the last stage) is replaced at the first picture with no question', () => {
    setLearn(STAGES.length, 0);
    const scan = mount();
    close = scan.close;
    take(scan.root, 'F');
    expect(scan.root.querySelector('dialog')).toBeNull();
    loadSession();
    expect(session.route).toBe('scan');
    expect(session.learn).toBeNull();
    expect(session.samples!.filter(Boolean)).toHaveLength(9);
  });

  it('after "No, scan it again" at the cube check, the first picture replaces the work with no second question', () => {
    scanAgain();
    expect(location.hash).toBe('#/scan');
    const scan = mount();
    close = scan.close;
    take(scan.root, 'F');
    expect(scan.root.querySelector('dialog')).toBeNull();
    loadSession();
    expect(session.learn).toBeNull();
    expect(session.samples!.filter(Boolean)).toHaveLength(9);
  });

  it('a half-done scan goes on with no question', () => {
    const scan = mount();
    take(scan.root, 'F');
    return answer(scan.root, 'Delete and start over').then(() => {
      scan.close();
      const again = mount();
      close = again.close;
      take(again.root, 'R');
      expect(again.root.querySelector('dialog')).toBeNull();
      expect(stored().samples.filter(Boolean)).toHaveLength(18);
    });
  });
});

describe('scan screen Back', () => {
  const hashChange = () => new Promise((r) => window.addEventListener('hashchange', r, { once: true }));
  const app = () => document.getElementById('app')!;
  beforeAll(() => {
    // The scan as the first page the app opened on.
    history.replaceState(null, '', '#/scan');
    document.body.replaceChildren(Object.assign(document.createElement('main'), { id: 'app' }));
    register('home', (root) => { root.append('Home'); });
    register('solve', (root) => { root.append(`Solve, move ${session.solve!.position + 1}`); });
    register('scan', scanScreen);
    localStorage.clear();
    loadSession();
    setCube(CUBE);
    session.route = 'solve';
    setSolve(['U\'', 'R\''], 1);
    start();
  });

  it('opened as the first page, Back goes Home; opened from Solve, Back goes back to Solve at the saved move, with no question and nothing deleted', async () => {
    const before = localStorage.getItem('cube.session');
    buttonNamed(app(), 'Back')!.click();
    await hashChange();
    expect(location.hash).toBe('#/home');

    location.hash = '#/solve';
    await hashChange();
    location.hash = '#/scan';
    await hashChange();
    buttonNamed(app(), 'Back')!.click();
    await hashChange();
    expect(location.hash).toBe('#/solve');
    expect(app().textContent).toBe('Solve, move 2');
    expect(document.querySelector('dialog')).toBeNull();
    expect(localStorage.getItem('cube.session')).toBe(before);
  });
});

describe('scan screen, taking a side again', () => {
  let close = () => {};
  const SOLVED_SAMPLES = () => SOLVED.split('').map((f) => RGB_OF[f as Face]);
  beforeEach(() => {
    localStorage.clear();
    loadSession();
    t.broken = false;
    location.hash = '';
  });
  afterEach(() => close());

  it('opening the scan when the saved step is the scan goes on from the saved sides, and replaces nothing', () => {
    const scan = mount();
    close = scan.close;
    take(scan.root, 'F');
    take(scan.root, 'R');
    scan.close();
    loadSession();
    const again = mount();
    close = again.close;
    expect(headline(again.root)).toBe('Show the blue side');
    expect(again.root.querySelector('.scan-text p')!.textContent).toMatch(/^Start with white on top and green facing you\./);
    take(again.root, 'B');
    loadSession();
    expect(session.route).toBe('scan');
    expect(session.samples!.filter(Boolean)).toHaveLength(27);
  });

  it('mid-scan on side 5, taking side 2 again then "Keep my old one" goes back to side 5 with side 2 unchanged', () => {
    const scan = mount();
    close = scan.close;
    ORDER.slice(0, 4).forEach((face) => take(scan.root, face));
    const before = stored().samples;
    expect(buttonNamed(scan.root, 'Keep my old one')).toBeUndefined();
    expect(buttonNamed(scan.root, 'Yellow side, not taken yet')!.disabled).toBe(true);
    buttonNamed(scan.root, 'Red side, taken. Tap to take again')!.click();
    expect(headline(scan.root)).toBe('Show the red side');
    buttonNamed(scan.root, 'Keep my old one')!.click();
    expect(headline(scan.root)).toBe('Show the white side');
    expect(stored().samples).toEqual(before);
  });

  it('mid-scan, side 2 taken again lands its new picture and goes back to side 5', () => {
    const scan = mount();
    close = scan.close;
    ORDER.slice(0, 4).forEach((face) => take(scan.root, face));
    buttonNamed(scan.root, 'Red side, taken. Tap to take again')!.click();
    t.cells = Array(9).fill([190, 35, 60]);
    buttonNamed(scan.root, 'Take picture')!.click();
    expect(headline(scan.root)).toBe('Show the white side');
    expect(stored().samples.slice(9, 18)).toEqual(Array(9).fill([190, 35, 60]));
    expect(stored().samples.filter(Boolean)).toHaveLength(36);
  });

  describe('one side from the color check', () => {
    const checkMe = [10, 14, 46]; // two on the red side, one on the blue side
    beforeEach(() => {
      session.samples = SOLVED_SAMPLES();
      session.colors = toColors(SOLVED);
      session.checkMe = checkMe;
      session.route = 'review';
      saveSession();
    });

    it('opening it shows "Keep my old one" at once, never offers "Use it anyway", and keeps the color check as the saved step', () => {
      const scan = mount('R');
      close = scan.close;
      expect(headline(scan.root)).toBe('Show the red side');
      expect(buttonNamed(scan.root, 'Keep my old one')).toBeDefined();
      take(scan.root, 'L');
      take(scan.root, 'L');
      expect(buttonNamed(scan.root, 'Use it anyway')).toBeUndefined();
      loadSession();
      expect(session.route).toBe('review');
      buttonNamed(scan.root, 'Keep my old one')!.click();
      expect(location.hash).toBe('#/review/R');
      loadSession();
      expect(session.colors).toEqual(toColors(SOLVED));
      expect(session.checkMe).toEqual(checkMe);
    });

    it('has no side buttons and no "Type in the colors instead"', () => {
      const scan = mount('R');
      close = scan.close;
      expect(scan.root.querySelector('.scan-sides')).toBeNull();
      expect(buttonNamed(scan.root, 'Type in the colors instead')).toBeUndefined();
    });

    it('Back goes to the color check on that side with the same colors and flags', () => {
      const scan = mount('R');
      close = scan.close;
      buttonNamed(scan.root, 'Back')!.click();
      expect(location.hash).toBe('#/review/R');
      loadSession();
      expect(session.colors).toEqual(toColors(SOLVED));
      expect(session.checkMe).toEqual(checkMe);
    });

    it('a matching picture replaces only that side and goes back to the color check on it', () => {
      const scan = mount('R');
      close = scan.close;
      take(scan.root, 'R');
      expect(location.hash).toBe('#/review/R');
      loadSession();
      expect(session.route).toBe('review');
      expect(session.colors).toEqual(toColors(SOLVED));
      expect(session.checkMe).toEqual([46]);
    });

    it('when the camera fails, the only way out is back to the color check', async () => {
      t.broken = true;
      const scan = mount('R');
      close = scan.close;
      await Promise.resolve();
      await Promise.resolve();
      expect(scan.root.textContent).toContain('The camera is not working. Go back and fix the squares by hand.');
      expect(buttonNamed(scan.root, 'Type in the colors')).toBeUndefined();
      buttonNamed(scan.root, 'Go back to the colors')!.click();
      expect(location.hash).toBe('#/review/R');
    });

    it('with no saved colors it goes Home', () => {
      localStorage.clear();
      loadSession();
      close = mount('R').close;
      expect(location.hash).toBe('#/home');
    });
  });
});
