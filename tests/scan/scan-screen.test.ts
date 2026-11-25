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

// The relay is faked: a test hands the computer a message, or reads the room it listens to.
const relay = vi.hoisted(() => ({ room: '', onText: (_text: string) => {}, stop: vi.fn() }));
vi.mock('../../src/app/relay', async (real) => ({
  ...(await real<typeof import('../../src/app/relay')>()),
  listen: vi.fn((room: string, onText: (text: string) => void) => {
    Object.assign(relay, { room, onText });
    return relay.stop;
  }),
}));
vi.mock('../../src/ui/qr', async (real) => {
  const actual = await real<typeof import('../../src/ui/qr')>();
  return { ...actual, qrCode: vi.fn(actual.qrCode) };
});

const { loadSession, saveSession, session, setCube, setLearn, setSolve } = await import('../../src/app/session');
const { classify } = await import('../../src/scan/classify');
const { scanAgain, scanScreen } = await import('../../src/scan/scan-screen');
const { register, start } = await import('../../src/app/router');
const { STAGES } = await import('../../src/learn/beginner-solver');
const { reviewScreen } = await import('../../src/review/net-editor');
const { keepScreenOn } = await import('../../src/ui/wake-lock');
const { qrCode } = await import('../../src/ui/qr');

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
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
});
// Every test runs on fake time, so the button locks take no real time.
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });
const settle = () => vi.advanceTimersByTimeAsync(0);
// Long enough for "Take picture" to wake up after "I turned it", and for Next to wake up after a picture.
const LOCK = 700;
const panel = (root: HTMLElement) => root.querySelector<HTMLElement>('.scan-check')!;
const panelNames = (root: HTMLElement) => [...panel(root).children].map((s) => s.textContent);

// Answers the question about the old work, then lets the waiting picture land.
async function answer(root: HTMLElement, name: 'Keep my cube' | 'Delete and start over'): Promise<void> {
  buttonNamed(root, name)!.click();
  await settle();
}

// Taps "I'm ready" or "I turned it" when the big cube shows, waits out the lock, and takes the picture.
function snap(root: HTMLElement, face: Face | RGB | RGB[]): void {
  (buttonNamed(root, 'I turned it') ?? buttonNamed(root, "I'm ready"))?.click();
  vi.advanceTimersByTime(LOCK);
  t.cells = Array.isArray(face[0]) ? face as RGB[] : Array(9).fill(typeof face === 'string' ? RGB_OF[face] : face);
  const button = buttonNamed(root, 'Take picture')!;
  expect(off(button)).toBe(false);
  button.click();
}

// Takes the picture and, when the colors show, taps Next once it wakes up.
function take(root: HTMLElement, face: Face | RGB | RGB[]): void {
  snap(root, face);
  vi.advanceTimersByTime(LOCK);
  buttonNamed(root, 'Next')?.click();
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
    // The color check opens on the green side; the small map has no letters, the close-up card does.
    expect([...root.querySelectorAll('.zoom-sticker')].map((s) => s.textContent).join('')).toBe('GGGGGGGGG');
  });

  it('a square the final match reads differently from that side\'s check is flagged, and squares that match are not', async () => {
    const scan = mount();
    close = scan.close;
    // A clearly white square on the green side: the check shows white, but the cube already has 9 white squares.
    const green: RGB[] = Array(9).fill(RGB_OF.F);
    green[0] = [235, 250, 235];
    take(scan.root, green);
    await answer(scan.root, 'Delete and start over');
    ORDER.slice(1).forEach((face) => take(scan.root, face));
    const saved = stored();
    expect(saved.colors[18]).toBe('G');
    expect(saved.checkMe).toEqual([18]);
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

  it('the question comes after Next on the first side, not before the colors show', () => {
    const scan = mount();
    close = scan.close;
    snap(scan.root, 'F');
    expect(scan.root.querySelector('dialog')).toBeNull();
    expect(scan.root.querySelector<HTMLElement>('.scan-check')!.hidden).toBe(false);
    vi.advanceTimersByTime(LOCK);
    buttonNamed(scan.root, 'Next')!.click();
    expect(scan.root.querySelector('dialog')!.open).toBe(true);
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
    take(scan.root, [190, 35, 60]);
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

describe('scan screen turn guide', () => {
  let close = () => {};
  const css = ([r, g, b]: RGB) => `rgb(${r}, ${g}, ${b})`;
  const guide = (root: HTMLElement) => root.querySelector<HTMLElement>('.scan-guide')!;
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
    vi.mocked(classify).mockClear();
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
    expect(panel(scan.root).hidden).toBe(false);
  });

  it('a good picture shows its 9 colors with their names in the camera box, and saves nothing until Next', () => {
    const scan = mount();
    close = scan.close;
    snap(scan.root, 'F');
    expect(stored()?.samples ?? null).toBeNull();
    expect(panel(scan.root).hidden).toBe(false);
    expect(panel(scan.root).closest('.scan-camera')).not.toBeNull();
    expect(panel(scan.root).closest('[aria-hidden]')).toBeNull();
    expect(panelNames(scan.root)).toEqual(Array(9).fill('Green'));
    expect(panel(scan.root).children[2].getAttribute('aria-label')).toBe('Square 3, green');
    expect(turnWords(scan.root)).toBe('Check the colors.');
    expect(guide(scan.root).hidden).toBe(true);
    expect(buttonNamed(scan.root, 'Take picture')).toBeUndefined();
    expect(buttonNamed(scan.root, 'Take it again')).toBeDefined();
    expect(off(buttonNamed(scan.root, 'Next')!)).toBe(true);
    vi.advanceTimersByTime(LOCK);
    expect(off(buttonNamed(scan.root, 'Next')!)).toBe(false);
    // The small cube still shows the side as not taken: nothing is in the scan yet.
    expect(blank(smallFace(scan.root, 'G'))).toBe(8);
  });

  it('each square names the color the app read for it, in the order the camera shows', () => {
    const scan = mount();
    close = scan.close;
    const cells: RGB[] = Array(9).fill(RGB_OF.F);
    cells[0] = RGB_OF.U;
    cells[5] = RGB_OF.R;
    cells[8] = RGB_OF.D;
    snap(scan.root, cells);
    expect(panelNames(scan.root)).toEqual(['White', 'Green', 'Green', 'Green', 'Green', 'Red', 'Green', 'Green', 'Yellow']);
    const square = panel(scan.root).children[0] as HTMLElement;
    expect(square.style.background).toBe(css(RGB_OF.U));
    expect(square.style.color).toBe('rgb(28, 29, 34)');
  });

  it('Next saves the side and plays the turn to the next side', () => {
    const scan = mount();
    close = scan.close;
    take(scan.root, 'F');
    expect(stored().samples.filter(Boolean)).toHaveLength(9);
    expect(panel(scan.root).hidden).toBe(true);
    expect(guide(scan.root).hidden).toBe(false);
    expect(bigFace(scan.root, 'G').map((s) => s.style.background)).toEqual(Array(9).fill(css(RGB_OF.F)));
    expect(smallFace(scan.root, 'G').map((s) => s.style.background)).toEqual(Array(9).fill(css(RGB_OF.F)));
    expect(headline(scan.root)).toBe('Show the red side');
    expect(turnWords(scan.root)).toBe('Turn the cube left. Red comes to the front.');
    expect(buttonNamed(scan.root, 'I turned it')).toBeDefined();
    expect(buttonNamed(scan.root, 'Next')).toBeUndefined();
    expect(buttonNamed(scan.root, 'Take it again')).toBeUndefined();
    expect(arrows(scan.root)).toBe(1);
  });

  it('Take it again saves nothing, stays on the same side, and wakes "Take picture" after the lock', () => {
    const scan = mount();
    close = scan.close;
    take(scan.root, 'F');
    const before = localStorage.getItem('cube.session');
    snap(scan.root, [190, 35, 60]);
    expect(panel(scan.root).hidden).toBe(false);
    buttonNamed(scan.root, 'Take it again')!.click();
    expect(localStorage.getItem('cube.session')).toBe(before);
    expect(panel(scan.root).hidden).toBe(true);
    expect(guide(scan.root).hidden).toBe(true);
    expect(headline(scan.root)).toBe('Show the red side');
    expect(buttonNamed(scan.root, 'Red side, now')).toBeDefined();
    expect(scan.root.querySelector('.scan-live')!.textContent).toBe('Fit the side in the squares');
    const button = buttonNamed(scan.root, 'Take picture')!;
    expect(off(button)).toBe(true);
    vi.advanceTimersByTime(LOCK);
    expect(off(button)).toBe(false);
  });

  it('Take it again tapped before Next wakes does not bring Next back later', () => {
    const scan = mount();
    close = scan.close;
    take(scan.root, 'F');
    snap(scan.root, [190, 35, 60]);
    vi.advanceTimersByTime(300);
    buttonNamed(scan.root, 'Take it again')!.click();
    vi.advanceTimersByTime(400);
    expect(buttonNamed(scan.root, 'Next')).toBeUndefined();
    expect(buttonNamed(scan.root, 'Take picture')).toBeDefined();
  });

  it('a fast second tap on "Take picture" lands on Next while it waits, and saves nothing', () => {
    const scan = mount();
    close = scan.close;
    snap(scan.root, 'F');
    buttonNamed(scan.root, 'Next')!.click();
    expect(stored()?.samples ?? null).toBeNull();
    expect(panel(scan.root).hidden).toBe(false);
  });

  it('while the colors show, the side buttons are off, the live check pauses, and "Show me again" does nothing', () => {
    session.samples = SAVED(['F', 'R']);
    session.route = 'scan';
    saveSession();
    const scan = mount();
    close = scan.close;
    snap(scan.root, 'B');
    expect(buttonNamed(scan.root, 'Green side, taken. Tap to take again')!.disabled).toBe(true);
    t.live = Array(9).fill(RGB_OF.B);
    vi.advanceTimersByTime(1000);
    t.live = null;
    expect(scan.root.querySelector('.scan-camera.ready')).toBeNull();
    expect(scan.root.querySelector('.scan-live')!.textContent).toBe('');
    buttonNamed(scan.root, 'Show me again')!.click();
    expect(guide(scan.root).hidden).toBe(true);
    buttonNamed(scan.root, 'Take it again')!.click();
    expect(buttonNamed(scan.root, 'Green side, taken. Tap to take again')!.disabled).toBe(false);
  });

  it('a picture of the wrong side does not open the big cube; "Use it anyway" shows its colors read with plain colors, and saves on Next', () => {
    const scan = mount();
    close = scan.close;
    snap(scan.root, 'R');
    expect(guide(scan.root).hidden).toBe(true);
    expect(scan.root.querySelector('.scan-problem')!.textContent).toBe('That looks like the red side. Show the green-center side.');
    buttonNamed(scan.root, 'Take picture')!.click();
    expect(guide(scan.root).hidden).toBe(true);
    buttonNamed(scan.root, 'Use it anyway')!.click();
    expect(stored()?.samples ?? null).toBeNull();
    // The middle square is the side asked for; the rest are matched to plain sticker colors.
    expect(panelNames(scan.root)).toEqual(['Red', 'Red', 'Red', 'Red', 'Green', 'Red', 'Red', 'Red', 'Red']);
    // The old message and its button go away, so a second tap cannot save the picture again.
    expect(buttonNamed(scan.root, 'Use it anyway')).toBeUndefined();
    expect(scan.root.querySelector<HTMLElement>('.scan-problem')!.hidden).toBe(true);
    vi.advanceTimersByTime(LOCK);
    buttonNamed(scan.root, 'Next')!.click();
    expect(stored().samples.filter(Boolean)).toHaveLength(9);
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

  it('Next on the sixth side runs the color match once and goes to the color check in place of the scan, so Back skips the camera', () => {
    const scan = mount();
    close = scan.close;
    ORDER.slice(0, 5).forEach((face) => take(scan.root, face));
    snap(scan.root, 'D');
    expect(location.hash).toBe('');
    expect(classify).not.toHaveBeenCalled();
    const entries = history.length;
    vi.advanceTimersByTime(LOCK);
    buttonNamed(scan.root, 'Next')!.click();
    expect(classify).toHaveBeenCalledTimes(1);
    expect(location.hash).toBe('#/review');
    expect(history.length).toBe(entries);
  });

  it('with five sides saved and the sixth on the check, a fresh screen opens on the sixth side and the color match has not run', () => {
    const scan = mount();
    ORDER.slice(0, 5).forEach((face) => take(scan.root, face));
    snap(scan.root, 'D');
    scan.close();
    loadSession();
    const again = mount();
    close = again.close;
    expect(headline(again.root)).toBe('Show the yellow side');
    expect(stored().samples.filter(Boolean)).toHaveLength(45);
    expect(stored().route).toBe('scan');
    expect(classify).not.toHaveBeenCalled();
  });

  it('leaving the screen while the colors show saves nothing and fires nothing later', () => {
    const scan = mount();
    snap(scan.root, 'F');
    scan.close();
    vi.advanceTimersByTime(5000);
    expect(location.hash).toBe('');
    expect(stored()?.samples ?? null).toBeNull();
  });

  it('mid-scan, taking the blue side again, then Take it again and "Keep my old one", keeps the old blue picture and goes back', () => {
    const scan = mount();
    close = scan.close;
    ORDER.slice(0, 4).forEach((face) => take(scan.root, face));
    const before = stored().samples;
    buttonNamed(scan.root, 'Blue side, taken. Tap to take again')!.click();
    snap(scan.root, [10, 70, 200]);
    expect(buttonNamed(scan.root, 'Keep my old one')).toBeUndefined();
    buttonNamed(scan.root, 'Take it again')!.click();
    buttonNamed(scan.root, 'Keep my old one')!.click();
    expect(headline(scan.root)).toBe('Show the white side');
    expect(stored().samples).toEqual(before);
  });

  describe('one side from the color check', () => {
    beforeEach(() => {
      session.samples = SOLVED.split('').map((f) => RGB_OF[f as Face]);
      session.colors = toColors(SOLVED);
      session.route = 'review';
      saveSession();
    });

    it('shows the colors that will be saved, with the other sides counted in', () => {
      const scan = mount('R');
      close = scan.close;
      const cells: RGB[] = Array(9).fill(RGB_OF.R);
      cells[0] = RGB_OF.L; // read alone this is orange, but all nine orange squares are on other sides
      snap(scan.root, cells);
      expect(panelNames(scan.root)).toEqual(Array(9).fill('Red'));
    });

    it('Back before Next leaves the saved cube as it was', () => {
      const before = localStorage.getItem('cube.session');
      const scan = mount('R');
      close = scan.close;
      snap(scan.root, Array(9).fill([190, 35, 60]));
      buttonNamed(scan.root, 'Back')!.click();
      expect(location.hash).toBe('#/review/R');
      expect(localStorage.getItem('cube.session')).toBe(before);
    });

    it('Next saves the side and goes back to the color check on it in place of the scan', () => {
      const scan = mount('R');
      close = scan.close;
      snap(scan.root, Array(9).fill([190, 35, 60]));
      expect(location.hash).toBe('');
      const entries = history.length;
      vi.advanceTimersByTime(LOCK);
      buttonNamed(scan.root, 'Next')!.click();
      expect(location.hash).toBe('#/review/R');
      expect(history.length).toBe(entries);
      expect(stored().samples.slice(9, 18)).toEqual(Array(9).fill([190, 35, 60]));
    });
  });

  it('with motion turned off, the colors show with nothing moving, and Next and Take it again work', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const scan = mount();
    close = scan.close;
    snap(scan.root, 'F');
    expect(panel(scan.root).hidden).toBe(false);
    buttonNamed(scan.root, 'Take it again')!.click();
    expect(panel(scan.root).hidden).toBe(true);
    take(scan.root, 'F');
    expect(stored().samples.filter(Boolean)).toHaveLength(9);
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
    expect(root.querySelector<HTMLElement>('.scan-check')!.hidden).toBe(false);
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

  it('after a good picture, focus moves from "Take picture" to Next, then to "I turned it" when the big cube shows', () => {
    const scan = mount();
    close = scan.close;
    buttonNamed(scan.root, "I'm ready")!.click();
    vi.advanceTimersByTime(LOCK);
    const button = buttonNamed(scan.root, 'Take picture')!;
    button.focus();
    t.cells = Array(9).fill(RGB_OF.F);
    button.click();
    const next = buttonNamed(scan.root, 'Next')!;
    expect(document.activeElement).toBe(next);
    vi.advanceTimersByTime(LOCK);
    expect(document.activeElement).toBe(next);
    next.click();
    expect(document.activeElement).toBe(buttonNamed(scan.root, 'I turned it'));
  });

  it('after Take it again, focus is on "Take picture"', () => {
    const scan = mount();
    close = scan.close;
    snap(scan.root, 'F');
    const again = buttonNamed(scan.root, 'Take it again')!;
    again.focus();
    again.click();
    expect(document.activeElement).toBe(buttonNamed(scan.root, 'Take picture'));
  });

  it('after "I turned it", focus is on "Take picture" once it wakes up', () => {
    const scan = mount();
    close = scan.close;
    take(scan.root, 'F');
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

  it('when the camera stops while the colors show, the colors stay until Next saves the side, then the camera-failed state shows', async () => {
    const scan = mount();
    close = scan.close;
    await settle();
    take(scan.root, 'F');
    snap(scan.root, 'R');
    t.track.dispatchEvent(new Event('ended'));
    expect(scan.root.querySelectorAll('.scan-check-square')).toHaveLength(9);
    expect(scan.root.textContent).not.toContain('The camera is not working here');
    expect(buttonNamed(scan.root, 'Take it again')).toBeUndefined();
    vi.advanceTimersByTime(LOCK);
    buttonNamed(scan.root, 'Next')!.click();
    expect(scan.root.textContent).toContain('The camera is not working here. You can type in the colors instead.');
    expect(stored().samples.filter(Boolean)).toHaveLength(18);
    expect(buttonNamed(scan.root, 'I turned it')).toBeUndefined();
    expect(off(buttonNamed(scan.root, 'Take picture')!)).toBe(true);
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

describe('scan screen, scan with your phone', () => {
  let close = () => {};
  beforeEach(() => {
    localStorage.clear();
    loadSession();
    t.broken = false;
  });
  afterEach(() => { close(); vi.unstubAllGlobals(); t.broken = false; });
  const pointer = (coarse: boolean) =>
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(any-pointer: coarse)' ? coarse : false }));

  it('shows on a computer and not on a phone', () => {
    pointer(false);
    let scan = mount();
    expect(buttonNamed(scan.root, 'Scan with your phone')).toBeDefined();
    scan.close();
    pointer(true);
    scan = mount();
    close = scan.close;
    expect(buttonNamed(scan.root, 'Scan with your phone')).toBeUndefined();
  });

  it('shows on a phone too when the camera fails', async () => {
    pointer(true);
    t.broken = true;
    const scan = mount();
    close = scan.close;
    await settle();
    expect(buttonNamed(scan.root, 'Scan with your phone')).toBeDefined();
  });

  it('opens a panel with the QR code and the scan link for a new room, waits for the phone, and Close stops waiting and gives focus back', async () => {
    pointer(false);
    const scan = mount();
    close = scan.close;
    const opener = buttonNamed(scan.root, 'Scan with your phone')!;
    opener.focus();
    opener.click();
    await vi.waitFor(() => expect(scan.root.querySelector('dialog svg[aria-label]')).not.toBeNull());
    const dialog = scan.root.querySelector('dialog')!;
    expect(dialog.open).toBe(true);
    expect(relay.room).toMatch(/^cube-[a-z0-9]{26,}$/);
    const link = `${location.origin}${location.pathname}#/scan/${relay.room}`;
    expect(dialog.querySelector('.phone-link')!.textContent).toBe(link);
    expect(qrCode).toHaveBeenCalledWith(link, expect.any(String));
    expect(dialog.querySelector('[role="status"]')!.textContent).toBe('Waiting for your phone…');
    expect(dialog.contains(document.activeElement)).toBe(true);
    buttonNamed(dialog, 'Close')!.click();
    expect(dialog.open).toBe(false);
    expect(relay.stop).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(opener);
  });

  describe('on the phone, the room from the QR code', () => {
    const ROOM = 'cube-' + '0123456789abcdef'.repeat(2);
    const room = () => sessionStorage.getItem('cube.room');
    beforeEach(() => { sessionStorage.clear(); });
    afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); });

    it('is kept for the send when the scan opens from the QR link', () => {
      close = mount(ROOM).close;
      expect(room()).toBe(ROOM);
    });

    it('is kept when one side is taken again', () => {
      sessionStorage.setItem('cube.room', ROOM);
      session.colors = toColors(CUBE);
      close = mount('G').close;
      expect(room()).toBe(ROOM);
    });

    it('is not taken from a link with any other shape', () => {
      close = mount('x?email=a@b.c').close;
      expect(room()).toBeNull();
    });

    it('is dropped when a full scan opens with no room', () => {
      sessionStorage.setItem('cube.room', ROOM);
      close = mount().close;
      expect(room()).toBeNull();
    });

    it('the scan still opens when sessionStorage throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
      const scan = mount(ROOM);
      close = scan.close;
      expect(headline(scan.root)).toBe('Show the green side');
    });
  });

  describe('when the phone sends', () => {
    beforeEach(() => {
      relay.stop.mockClear();
      history.replaceState(null, '', '#/scan');
    });
    const openWindow = () => {
      pointer(false);
      const scan = mount();
      close = scan.close;
      buttonNamed(scan.root, 'Scan with your phone')!.click();
      return { ...scan, dialog: scan.root.querySelector('dialog')! };
    };

    it('a cube from the phone closes the window, stops waiting, and opens the cube as a cube link', () => {
      const { dialog } = openWindow();
      relay.onText(CUBE);
      expect(dialog.open).toBe(false);
      expect(relay.stop).toHaveBeenCalled();
      expect(location.hash).toBe(`#/cube/${CUBE}`);
    });

    it('a message that is not a usable cube changes nothing, and the window keeps waiting', () => {
      const { dialog } = openWindow();
      const movedCenter = SOLVED.slice(0, 4) + 'R' + SOLVED.slice(5, 13) + 'U' + SOLVED.slice(14);
      relay.onText('hello');
      relay.onText(movedCenter);
      expect(dialog.open).toBe(true);
      expect(relay.stop).not.toHaveBeenCalled();
      expect(location.hash).toBe('#/scan');
    });

    it('leaving the scan with the window open stops waiting', () => {
      const scan = openWindow();
      scan.close();
      expect(relay.stop).toHaveBeenCalled();
    });
  });
});
