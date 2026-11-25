import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RGB } from '../../src/app/session';
import { applyMoves, SOLVED, toColors, type Color, type Face } from '../../src/cube/facelets';

// The camera is faked: each "Take picture" sees whatever side the test puts in front of it.
// Its video track is an event target, so a test can stop the camera mid-scan.
const t = vi.hoisted(() => ({ cells: null as RGB[] | null, live: null as RGB[] | null, broken: false, track: new EventTarget() }));
vi.mock('../../src/scan/camera', () => ({
  startCamera: () => {
    if (t.broken) return Promise.reject(new Error('no camera'));
    t.track = new EventTarget();
    return Promise.resolve({ getTracks: () => [t.track], getVideoTracks: () => [t.track] });
  },
  stopCamera: () => {},
  // Size 300 is "Take picture"; the live preview reads a smaller picture.
  grabCells: (_v: unknown, _c: unknown, size: number) => (size === 300 ? t.cells : t.live),
}));
const letScreenDim = vi.hoisted(() => vi.fn());
vi.mock('../../src/ui/wake-lock', () => ({ keepScreenOn: vi.fn(() => letScreenDim) }));
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
const { keepScreenOn } = await import('../../src/ui/wake-lock');

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
// "Take picture" is turned off with aria-disabled, so it keeps keyboard focus while it waits.
const off = (button: HTMLButtonElement) => button.getAttribute('aria-disabled') === 'true';

// jsdom has no modal dialog; the real one (Esc, the back gesture) is proven in the browser tests.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
// Every test runs on fake time, so the waits for "Got it!" and the button lock take no real time.
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });
const settle = () => vi.advanceTimersByTimeAsync(0);
// Long enough for "Got it!" to end, and for "Take picture" to wake up after "I turned it".
const BEAT = 1500;
const LOCK = 700;
const done = () => vi.advanceTimersByTime(BEAT);

// Answers the question about the old work, then lets the waiting picture land.
async function answer(root: HTMLElement, name: 'Keep my cube' | 'Delete and start over'): Promise<void> {
  buttonNamed(root, name)!.click();
  await settle();
}

// Lets "Got it!" end, taps "I'm ready" or "I turned it" when the big cube shows, waits out the lock, and takes the picture.
function take(root: HTMLElement, face: Face | RGB): void {
  done();
  (buttonNamed(root, 'I turned it') ?? buttonNamed(root, "I'm ready"))?.click();
  vi.advanceTimersByTime(LOCK);
  t.cells = Array(9).fill(typeof face === 'string' ? RGB_OF[face] : face);
  const button = buttonNamed(root, 'Take picture')!;
  expect(off(button)).toBe(false);
  button.click();
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
    done();
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
    done();
    expect(location.hash).toBe('#/review');
    expect(classify).toHaveBeenCalledTimes(1);

    loadSession();
    const root = document.createElement('main');
    document.body.replaceChildren(root);
    reviewScreen(root);
    expect(classify).toHaveBeenCalledTimes(1);
    // The color check opens on the green side; the small map has no letters, the close-up card does.
    expect([...root.querySelectorAll('.zoom-sticker')].map((s) => s.textContent).join('')).toBe('GGGGGGGGG');
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
  // jsdom fires hashchange on a real timer.
  beforeEach(() => { vi.useRealTimers(); });
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
    done();
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
    done();
    buttonNamed(scan.root, 'Red side, taken. Tap to take again')!.click();
    take(scan.root, [190, 35, 60]);
    done();
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
      done();
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

describe('scan screen turn guide', () => {
  let close = () => {};
  const css = ([r, g, b]: RGB) => `rgb(${r}, ${g}, ${b})`;
  const guide = (root: HTMLElement) => root.querySelector<HTMLElement>('.scan-guide')!;
  const badge = (root: HTMLElement) => root.querySelector<HTMLElement>('.scan-gotit')!;
  const bigFace = (root: HTMLElement, color: Color) => [...guide(root).querySelectorAll<HTMLElement>(`.turn-face[data-color="${color}"] > div`)];
  const smallFace = (root: HTMLElement, color: Color) => [...root.querySelectorAll<HTMLElement>(`.turn-picture:not(.big) .turn-face[data-color="${color}"] > div`)];
  const blank = (squares: HTMLElement[]) => squares.filter((s) => s.classList.contains('turn-blank')).length;
  const arrows = (root: HTMLElement) => guide(root).querySelectorAll('.turn-arrow').length;
  const turnWords = (root: HTMLElement) => root.querySelector('.scan-text p')!.textContent;
  const SAVED = (faces: Face[]) => SOLVED.split('').map((f) => (faces.includes(f as Face) ? RGB_OF[f as Face] : null));

  beforeEach(() => {
    localStorage.clear();
    loadSession();
    t.broken = false;
    location.hash = '';
  });
  afterEach(() => { close(); vi.unstubAllGlobals(); });

  it('opens on the first side with "I\'m ready" in place of "Take picture"; tapping it closes the big cube', () => {
    const scan = mount();
    close = scan.close;
    expect(guide(scan.root).hidden).toBe(false);
    expect(guide(scan.root).getAttribute('aria-hidden')).toBe('true');
    expect(buttonNamed(scan.root, 'Take picture')).toBeUndefined();
    buttonNamed(scan.root, "I'm ready")!.click();
    expect(guide(scan.root).hidden).toBe(true);
    expect(buttonNamed(scan.root, "I'm ready")).toBeUndefined();
    expect(buttonNamed(scan.root, 'Take picture')).toBeDefined();
  });

  it('"Take picture" stays off for a short time after the turn, so a double tap takes no picture', () => {
    const scan = mount();
    close = scan.close;
    buttonNamed(scan.root, "I'm ready")!.click();
    t.cells = Array(9).fill(RGB_OF.F);
    const button = buttonNamed(scan.root, 'Take picture')!;
    expect(off(button)).toBe(true);
    button.click();
    expect(stored()?.samples ?? null).toBeNull();
    vi.advanceTimersByTime(LOCK);
    expect(off(button)).toBe(false);
    button.click();
    expect(stored().samples.filter(Boolean)).toHaveLength(9);
  });

  it('an accepted picture is saved, then shows "Got it!" on the side just taken, then plays the turn to the next side', () => {
    const scan = mount();
    close = scan.close;
    take(scan.root, 'F');
    expect(stored().samples.filter(Boolean)).toHaveLength(9);
    expect(guide(scan.root).hidden).toBe(false);
    expect(badge(scan.root).hidden).toBe(false);
    expect(bigFace(scan.root, 'G').map((s) => s.style.background)).toEqual(Array(9).fill(css(RGB_OF.F)));
    expect(smallFace(scan.root, 'G').map((s) => s.style.background)).toEqual(Array(9).fill(css(RGB_OF.F)));
    expect(off(buttonNamed(scan.root, 'Take picture')!)).toBe(true);
    expect(turnWords(scan.root)).toBe('Got it.');
    done();
    expect(badge(scan.root).hidden).toBe(true);
    expect(headline(scan.root)).toBe('Show the red side');
    expect(turnWords(scan.root)).toBe('Turn the cube left. Red comes to the front.');
    expect(buttonNamed(scan.root, 'I turned it')).toBeDefined();
    expect(buttonNamed(scan.root, 'Take picture')).toBeUndefined();
    expect(arrows(scan.root)).toBe(1);
  });

  it('a picture of the wrong side does not open the big cube; the message and "Use it anyway" work as before', () => {
    const scan = mount();
    close = scan.close;
    take(scan.root, 'R');
    expect(guide(scan.root).hidden).toBe(true);
    expect(scan.root.querySelector('.scan-problem')!.textContent).toBe('That looks like the red side. Show the green-center side.');
    buttonNamed(scan.root, 'Take picture')!.click();
    expect(guide(scan.root).hidden).toBe(true);
    buttonNamed(scan.root, 'Use it anyway')!.click();
    expect(stored().samples.filter(Boolean)).toHaveLength(9);
    expect(badge(scan.root).hidden).toBe(false);
    // The old message and its button go away, so a second tap cannot save the picture again.
    expect(buttonNamed(scan.root, 'Use it anyway')).toBeUndefined();
    expect(scan.root.querySelector<HTMLElement>('.scan-problem')!.hidden).toBe(true);
  });

  it('a reopened scan paints the saved sides on both cubes and plays the turns from the starting hold', () => {
    session.samples = SAVED(['F', 'R', 'B']);
    session.route = 'scan';
    saveSession();
    const scan = mount();
    close = scan.close;
    expect(headline(scan.root)).toBe('Show the orange side');
    for (const color of ['G', 'R', 'B'] as Color[]) {
      expect(blank(bigFace(scan.root, color))).toBe(0);
      expect(blank(smallFace(scan.root, color))).toBe(0);
    }
    expect(blank(bigFace(scan.root, 'O'))).toBe(8);
    expect(blank(smallFace(scan.root, 'W'))).toBe(8);
    expect(guide(scan.root).hidden).toBe(false);
    expect(buttonNamed(scan.root, 'I turned it')).toBeDefined();
    expect(arrows(scan.root)).toBe(1);
  });

  it('a side taken again opens the big cube from the starting hold; "Keep my old one" opens it for the side the child was on', () => {
    const scan = mount();
    close = scan.close;
    ORDER.slice(0, 4).forEach((face) => take(scan.root, face));
    done();
    buttonNamed(scan.root, 'I turned it')!.click();
    buttonNamed(scan.root, 'Red side, taken. Tap to take again')!.click();
    expect(guide(scan.root).hidden).toBe(false);
    expect(arrows(scan.root)).toBe(1);
    buttonNamed(scan.root, 'I turned it')!.click();
    expect(guide(scan.root).hidden).toBe(true);
    buttonNamed(scan.root, 'Keep my old one')!.click();
    expect(headline(scan.root)).toBe('Show the white side');
    expect(guide(scan.root).hidden).toBe(false);
    expect(smallFace(scan.root, 'R').map((s) => s.style.background)).toEqual(Array(9).fill(css(RGB_OF.R)));
  });

  it('"Show me again" opens the big cube and plays the turns again', () => {
    const scan = mount();
    close = scan.close;
    take(scan.root, 'F');
    done();
    buttonNamed(scan.root, 'I turned it')!.click();
    expect(guide(scan.root).hidden).toBe(true);
    buttonNamed(scan.root, 'Show me again')!.click();
    expect(guide(scan.root).hidden).toBe(false);
    expect(buttonNamed(scan.root, 'I turned it')).toBeDefined();
  });

  it('while the question about old work waits, the picture is not painted; "Keep my cube" leaves every side gray and does not open the big cube', async () => {
    setCube(CUBE);
    session.colors = toColors(CUBE);
    session.route = 'learn';
    setLearn(0, 0);
    const scan = mount();
    close = scan.close;
    take(scan.root, 'F');
    expect(blank(smallFace(scan.root, 'G'))).toBe(8);
    expect(guide(scan.root).hidden).toBe(true);
    await answer(scan.root, 'Keep my cube');
    for (const color of ['W', 'G', 'R', 'B', 'O', 'Y'] as Color[]) expect(blank(smallFace(scan.root, color))).toBe(8);
    expect(guide(scan.root).hidden).toBe(true);
    expect(headline(scan.root)).toBe('Show the green side');
  });

  it('the sixth picture shows "Got it!" with the button off, then goes to the color check', () => {
    const scan = mount();
    close = scan.close;
    ORDER.forEach((face) => take(scan.root, face));
    expect(badge(scan.root).hidden).toBe(false);
    expect(off(buttonNamed(scan.root, 'Take picture')!)).toBe(true);
    expect(location.hash).toBe('');
    done();
    expect(location.hash).toBe('#/review');
  });

  it('a side tap during the last "Got it!" does nothing, and the scan still goes to the color check', () => {
    const scan = mount();
    close = scan.close;
    ORDER.forEach((face) => take(scan.root, face));
    scan.root.querySelector<HTMLButtonElement>('.scan-side')!.click();
    done();
    expect(location.hash).toBe('#/review');
  });

  it('"Take picture" stays off for the whole "Got it!" second, even when the button lock was still running', () => {
    const scan = mount();
    close = scan.close;
    take(scan.root, 'R');
    take(scan.root, 'R');
    buttonNamed(scan.root, 'Show me again')!.click();
    buttonNamed(scan.root, "I'm ready")!.click();
    buttonNamed(scan.root, 'Use it anyway')!.click();
    expect(badge(scan.root).hidden).toBe(false);
    vi.advanceTimersByTime(LOCK);
    expect(off(buttonNamed(scan.root, 'Take picture')!)).toBe(true);
  });

  it('leaving the screen during "Got it!" fires no move to the color check later', () => {
    const scan = mount();
    ORDER.forEach((face) => take(scan.root, face));
    scan.close();
    done();
    expect(location.hash).toBe('');
  });

  it('one side from the color check shows "Got it!", then goes back to the color check on that side', () => {
    session.samples = SOLVED.split('').map((f) => RGB_OF[f as Face]);
    session.colors = toColors(SOLVED);
    session.route = 'review';
    saveSession();
    const scan = mount('R');
    close = scan.close;
    take(scan.root, 'R');
    expect(badge(scan.root).hidden).toBe(false);
    expect(location.hash).toBe('');
    done();
    expect(location.hash).toBe('#/review/R');
  });

  it('with motion turned off, the big cube shows the final pose and all arrows, and "Got it!" still lasts about a second', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const scan = mount();
    close = scan.close;
    take(scan.root, 'F');
    vi.advanceTimersByTime(500);
    expect(badge(scan.root).hidden).toBe(false);
    done();
    expect(arrows(scan.root)).toBe(1);
    expect(vi.getTimerCount()).toBe(1); // only the camera preview
  });

  it('when the camera fails, the big cube and its button go away and never come back', async () => {
    session.samples = SAVED(['F', 'R']);
    session.route = 'scan';
    saveSession();
    t.broken = true;
    const scan = mount();
    close = scan.close;
    await settle();
    expect(buttonNamed(scan.root, 'I turned it')).toBeUndefined();
    expect(scan.root.querySelector('.scan-guide')).toBeNull();
    buttonNamed(scan.root, 'Green side, taken. Tap to take again')!.click();
    expect(buttonNamed(scan.root, 'I turned it')).toBeUndefined();
    expect(buttonNamed(scan.root, "I'm ready")).toBeUndefined();
    buttonNamed(scan.root, 'Type in the colors')!.click();
    expect(location.hash).toBe('#/review/manual');
  });
});

describe('scan screen live check', () => {
  let close = () => {};
  const css = ([r, g, b]: RGB) => `rgb(${r}, ${g}, ${b})`;
  const HEX_RGB: Record<string, RGB> = { W: [255, 255, 255], B: [0, 81, 186], G: [0, 158, 96] };
  const words = (root: HTMLElement) => root.querySelector('.scan-live')!.textContent;
  const ready = (root: HTMLElement) => root.querySelector('.scan-camera')!.classList.contains('ready');
  const ticks = (n: number) => vi.advanceTimersByTime(250 * n);
  const see = (rgb: RGB) => { t.live = Array(9).fill(rgb); };
  const SAVED = (n: number) => SOLVED.split('').map((f, i) => (STEPS_BEFORE(n).includes(i) ? RGB_OF[f as Face] : null));
  const STEPS_BEFORE = (n: number) => ORDER.slice(0, n).flatMap((face) => Array.from({ length: 9 }, (_, k) => ['U', 'R', 'F', 'D', 'L', 'B'].indexOf(face) * 9 + k));
  const aim = (root: HTMLElement) => (buttonNamed(root, 'I turned it') ?? buttonNamed(root, "I'm ready"))!.click();

  beforeEach(() => {
    localStorage.clear();
    loadSession();
    t.broken = false;
    t.live = null;
    location.hash = '';
  });
  afterEach(() => { close(); t.live = null; });

  function at(sides: number): HTMLElement {
    if (sides) {
      session.samples = SAVED(sides);
      session.route = 'scan';
      saveSession();
    }
    const scan = mount();
    close = scan.close;
    return scan.root;
  }

  it('two ticks of the asked side show the ready border and words; one tick alone does not', () => {
    const root = at(0);
    aim(root);
    see(RGB_OF.F);
    ticks(1);
    expect(ready(root)).toBe(false);
    expect(words(root)).toBe('Fit the side in the squares');
    ticks(1);
    expect(ready(root)).toBe(true);
    expect(words(root)).toBe('Green side found');
  });

  it('two unclear ticks put the plain words back', () => {
    const root = at(0);
    aim(root);
    see(RGB_OF.F);
    ticks(2);
    see([128, 128, 128]);
    ticks(1);
    expect(ready(root)).toBe(true);
    ticks(1);
    expect(ready(root)).toBe(false);
    expect(words(root)).toBe('Fit the side in the squares');
  });

  it('three ticks of another side say which side it sees; "Take picture" still checks the side as before', () => {
    const root = at(0);
    aim(root);
    vi.advanceTimersByTime(LOCK);
    see(RGB_OF.R);
    ticks(2);
    expect(words(root)).toBe('Fit the side in the squares');
    ticks(1);
    expect(words(root)).toBe('That looks like red');
    t.cells = Array(9).fill(RGB_OF.R);
    buttonNamed(root, 'Take picture')!.click();
    expect(root.querySelector('.scan-problem')!.textContent).toBe('That looks like the red side. Show the green-center side.');
  });

  it('says "may be" for colors that are easy to mix up', () => {
    const root = at(4);
    expect(headline(root)).toBe('Show the white side');
    aim(root);
    see(RGB_OF.D);
    ticks(3);
    expect(words(root)).toBe('That may be yellow');
  });

  it('a ready side hides the message from the last wrong picture, and the picture is taken', () => {
    const root = at(0);
    aim(root);
    vi.advanceTimersByTime(LOCK);
    t.cells = Array(9).fill(RGB_OF.R);
    buttonNamed(root, 'Take picture')!.click();
    expect(root.querySelector<HTMLElement>('.scan-problem')!.hidden).toBe(false);
    see(RGB_OF.F);
    ticks(2);
    expect(root.querySelector<HTMLElement>('.scan-problem')!.hidden).toBe(true);
    t.cells = Array(9).fill(RGB_OF.F);
    buttonNamed(root, 'Take picture')!.click();
    expect(stored().samples.filter(Boolean)).toHaveLength(9);
  });

  it('does nothing while the big cube shows, and the line under the camera stays empty', () => {
    const root = at(0);
    see(RGB_OF.F);
    ticks(4);
    expect(ready(root)).toBe(false);
    expect(words(root)).toBe('');
  });

  it('the live words change inside one line under the camera, not inside the camera', () => {
    const root = at(0);
    aim(root);
    const line = root.querySelector('.scan-live')!;
    expect(line.closest('.scan-camera')).toBeNull();
    expect(line.textContent).toBe('Fit the side in the squares');
    see(RGB_OF.F);
    ticks(2);
    expect(root.querySelector('.scan-live')).toBe(line);
    expect(line.className).toBe('scan-live');
    expect(line.textContent).toBe('Green side found');
  });

  it('a problem message takes the place of the live words while it shows', () => {
    const root = at(0);
    aim(root);
    vi.advanceTimersByTime(LOCK);
    t.cells = Array(9).fill(RGB_OF.R);
    buttonNamed(root, 'Take picture')!.click();
    expect(root.querySelector<HTMLElement>('.scan-live')!.hidden).toBe(true);
    expect(root.querySelector('[role="alert"]')!.textContent).toBe('That looks like the red side. Show the green-center side.');
    see(RGB_OF.F);
    ticks(2);
    expect(root.querySelector<HTMLElement>('.scan-live')!.hidden).toBe(false);
    expect(root.querySelector<HTMLElement>('[role="alert"]')!.hidden).toBe(true);
  });

  it('the top band and the square by the hint show the top color for each side', () => {
    const band = (root: HTMLElement) => root.querySelector<HTMLElement>('.scan-band')!;
    const swatch = (root: HTMLElement) => root.querySelector<HTMLElement>('.scan-swatch')!;
    for (const [sides, top] of [[0, 'W'], [3, 'W'], [4, 'B'], [5, 'G']] as const) {
      const root = at(sides);
      expect(band(root).style.background).toBe(css(HEX_RGB[top]));
      expect(swatch(root).style.background).toBe(css(HEX_RGB[top]));
      expect(band(root).getAttribute('aria-hidden')).toBe('true');
      close();
    }
  });

  it('the live words are not read out as they change', () => {
    const root = at(0);
    expect(root.querySelector('.scan-live')!.closest('[aria-live]')).toBeNull();
  });

  it('after the camera fails, no live state shows and the ticks do not break', async () => {
    t.broken = true;
    const root = at(0);
    await settle();
    see(RGB_OF.F);
    ticks(4);
    expect(root.querySelector('.scan-camera.ready')).toBeNull();
  });
});

describe('scan screen focus, camera start and stop, and screen on', () => {
  let close = () => {};
  beforeEach(() => {
    localStorage.clear();
    loadSession();
    t.broken = false;
    t.cells = null;
    location.hash = '';
  });
  afterEach(() => close());

  it('after a good picture, focus moves from "Take picture" to "I turned it" when the big cube shows', () => {
    const scan = mount();
    close = scan.close;
    buttonNamed(scan.root, "I'm ready")!.click();
    vi.advanceTimersByTime(LOCK);
    const button = buttonNamed(scan.root, 'Take picture')!;
    button.focus();
    t.cells = Array(9).fill(RGB_OF.F);
    button.click();
    expect(document.activeElement).toBe(button);
    done();
    expect(document.activeElement).toBe(buttonNamed(scan.root, 'I turned it'));
  });

  it('after "I turned it", focus is on "Take picture" once it wakes up', () => {
    const scan = mount();
    close = scan.close;
    take(scan.root, 'F');
    done();
    const turned = buttonNamed(scan.root, 'I turned it')!;
    turned.focus();
    turned.click();
    expect(document.activeElement).toBe(buttonNamed(scan.root, 'Take picture'));
    vi.advanceTimersByTime(LOCK);
    expect(document.activeElement).toBe(buttonNamed(scan.root, 'Take picture'));
  });

  it('"Take picture" before the camera has a picture says the camera is starting, and saves nothing', () => {
    const scan = mount();
    close = scan.close;
    buttonNamed(scan.root, "I'm ready")!.click();
    vi.advanceTimersByTime(LOCK);
    t.cells = null;
    buttonNamed(scan.root, 'Take picture')!.click();
    expect(scan.root.querySelector('[role="alert"]')!.textContent).toBe('The camera is starting. Try again in a moment.');
    expect(scan.root.querySelector<HTMLElement>('[role="alert"]')!.hidden).toBe(false);
    expect(stored()?.samples ?? null).toBeNull();
  });

  it('when the camera stops after two sides, the camera-failed state shows and the two sides stay saved', async () => {
    const scan = mount();
    close = scan.close;
    await settle();
    take(scan.root, 'F');
    take(scan.root, 'R');
    t.track.dispatchEvent(new Event('ended'));
    expect(scan.root.textContent).toContain('The camera is not working here. You can type in the colors instead.');
    loadSession();
    expect(session.samples!.filter(Boolean)).toHaveLength(18);
  });

  it('keeps the screen on while the scan is open, and lets it dim on leaving', () => {
    vi.mocked(keepScreenOn).mockClear();
    letScreenDim.mockClear();
    const scan = mount();
    expect(keepScreenOn).toHaveBeenCalledTimes(1);
    expect(letScreenDim).not.toHaveBeenCalled();
    scan.close();
    expect(letScreenDim).toHaveBeenCalledTimes(1);
  });
});
