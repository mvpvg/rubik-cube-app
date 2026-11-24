import { afterEach, describe, expect, it, vi } from 'vitest';

// Solve needs WebGL and a worker; these stand-ins let it open in jsdom.
vi.mock('../../src/ui/player', () => ({
  CubePlayer: class {
    el = document.createElement('div');
    ready = Promise.resolve();
    load() {}
    playAt() { return 1000; }
    dispose() {}
  },
}));
vi.mock('../../src/solve/fast-solve', () => ({ solveInWorker: () => new Promise(() => {}) }));

const { setCube } = await import('../../src/app/session');
const { applyMoves, SOLVED } = await import('../../src/cube/facelets');
const { solveScreen } = await import('../../src/solve/solve-screen');
const { keepScreenOn } = await import('../../src/ui/wake-lock');

const flush = () => new Promise((r) => setTimeout(r, 0));

function fakeWakeLock(request: () => Promise<unknown>) {
  const spy = vi.fn(request);
  Object.defineProperty(navigator, 'wakeLock', { value: { request: spy }, configurable: true });
  return spy;
}
function setVisibility(state: DocumentVisibilityState): void {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('screen stays on', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (navigator as { wakeLock?: unknown }).wakeLock;
  });

  it('Solve asks for the lock when it opens, its cleanup lets it go, and coming back after hiding asks again', async () => {
    const release = vi.fn(async () => {});
    const request = fakeWakeLock(async () => ({ release }));
    setCube(applyMoves(SOLVED, ['R', 'U']));
    const root = document.createElement('main');
    document.body.replaceChildren(root);
    const cleanup = solveScreen(root)!;
    await flush();
    expect(request).toHaveBeenCalledWith('screen');

    setVisibility('hidden');
    setVisibility('visible');
    await flush();
    expect(request).toHaveBeenCalledTimes(2);

    cleanup();
    expect(release).toHaveBeenCalled();
    setVisibility('visible');
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does nothing, and throws nothing, when the browser has no wake lock', async () => {
    const stop = keepScreenOn();
    setVisibility('visible');
    await flush();
    expect(() => stop()).not.toThrow();
  });

  it('throws nothing when the browser refuses the lock', async () => {
    const onError = vi.fn();
    window.addEventListener('unhandledrejection', onError);
    fakeWakeLock(() => Promise.reject(new DOMException('no', 'NotAllowedError')));
    const stop = keepScreenOn();
    await flush();
    fakeWakeLock(() => { throw new DOMException('no', 'NotAllowedError'); });
    setVisibility('visible');
    await flush();
    expect(() => stop()).not.toThrow();
    window.removeEventListener('unhandledrejection', onError);
    expect(onError).not.toHaveBeenCalled();
  });
});
