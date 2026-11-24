import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RGB } from '../../src/app/session';
import { applyMoves, SOLVED, toColors, type Face } from '../../src/cube/facelets';

// The camera is faked: each "Take picture" sees whatever side the test puts in front of it.
const t = vi.hoisted(() => ({ cells: null as RGB[] | null }));
vi.mock('../../src/scan/camera', () => ({
  startCamera: () => Promise.resolve({ getTracks: () => [] }),
  stopCamera: () => {},
  grabCells: (_v: unknown, _c: unknown, size: number) => (size === 300 ? t.cells : null),
}));
vi.mock('../../src/scan/classify', async (real) => {
  const actual = await real<typeof import('../../src/scan/classify')>();
  return { classify: vi.fn(actual.classify) };
});

const { loadSession, session, setCube, setLearn } = await import('../../src/app/session');
const { classify } = await import('../../src/scan/classify');
const { scanScreen } = await import('../../src/scan/scan-screen');
const { reviewScreen } = await import('../../src/review/net-editor');

const RGB_OF: Record<Face, RGB> = {
  U: [255, 255, 255], R: [196, 30, 58], F: [0, 158, 96], D: [255, 213, 0], L: [255, 88, 0], B: [0, 81, 186],
};
// The sides in the order the scan asks for them: green, red, blue, orange, white, yellow.
const ORDER: Face[] = ['F', 'R', 'B', 'L', 'U', 'D'];
const CUBE = applyMoves(SOLVED, 'R U');
const stored = () => JSON.parse(localStorage.getItem('cube.session')!);

function mount(): { root: HTMLElement; close: () => void } {
  const root = document.createElement('main');
  document.body.replaceChildren(root);
  return { root, close: scanScreen(root) };
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

  it('the first picture replaces the old work, and each picture is saved with the scan as the route', () => {
    const scan = mount();
    close = scan.close;
    take(scan.root, 'F');
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

  it('the sixth picture writes the samples, colors, flags, and the color check route in one save, and the color check does not match again', () => {
    const scan = mount();
    close = scan.close;
    ORDER.slice(0, 5).forEach((face) => take(scan.root, face));
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
