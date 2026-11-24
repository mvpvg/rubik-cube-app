import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMoves, invertMoves, SOLVED, toColors, type Color } from '../../src/cube/facelets';
import { STAGES } from '../../src/learn/stages';
import {
  clearAll, expireIfOld, hasWorkToKeep, isFinished, loadSession, saveSession, session, setCube, setLearn, setSolve,
  type RGB,
} from '../../src/app/session';

const KEY = 'cube.session';
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const NOW = Date.UTC(2026, 10, 24, 12);

const SCRAMBLE = "R U F' L2 D B' R' U2 F D' L B2 R2 U' F2 D2 L' B R F'".split(' ');
const CUBE = applyMoves(SOLVED, SCRAMBLE);
const FIX = invertMoves(SCRAMBLE);
const OTHER = applyMoves(SOLVED, 'R U');

function record(fields: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 1, savedAt: NOW, route: null, samples: null, colors: null, checkMe: [], filled: [],
    facelets: null, solve: null, learn: null, ...fields,
  };
}
const put = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));
const stored = () => localStorage.getItem(KEY);

// Samples for the first `sides` sides, empty after that.
function samples(sides: number): (RGB | null)[] {
  return Array.from({ length: 54 }, (_, i) => (i < sides * 9 ? [i, 100, 255] as RGB : null));
}

describe('saved session', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    loadSession();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps a record saved 6 days and 23 hours ago and throws away one saved 7 days and 1 minute ago', () => {
    put(KEY, record({ facelets: CUBE, savedAt: NOW - 6 * DAY - 23 * 60 * MIN }));
    loadSession();
    expect(session.facelets).toBe(CUBE);

    put(KEY, record({ facelets: CUBE, savedAt: NOW - 7 * DAY - MIN }));
    loadSession();
    expect(session.facelets).toBeNull();
    expect(stored()).toBeNull();
  });

  it('saving refreshes the time, so work used every 3 days never runs out', () => {
    session.facelets = CUBE;
    saveSession();
    for (let visit = 1; visit <= 4; visit++) {
      vi.setSystemTime(NOW + visit * 3 * DAY);
      loadSession();
      expect(session.facelets).toBe(CUBE);
      saveSession();
    }
  });

  it.each([
    ['an unknown version', JSON.stringify(record({ version: 99, facelets: CUBE }))],
    ['JSON that does not parse', '{"version":1,'],
    ['a missing time', JSON.stringify(record({ facelets: CUBE, savedAt: undefined }))],
    ['a time that is not a number', JSON.stringify(record({ facelets: CUBE, savedAt: 'yesterday' }))],
    ['a time two days in the future', JSON.stringify(record({ facelets: CUBE, savedAt: NOW + 2 * DAY }))],
  ])('starts empty with no error for %s', (_, raw) => {
    localStorage.setItem(KEY, raw);
    expect(() => loadSession()).not.toThrow();
    expect(session.facelets).toBeNull();
    expect(hasWorkToKeep()).toBe(false);
  });

  it('throws the work away when the app comes back after 7 days, since hiding it saved nothing', () => {
    put(KEY, record({ facelets: CUBE, route: 'review', savedAt: NOW - 6 * DAY }));
    loadSession();
    expect(expireIfOld()).toBe(false);
    vi.setSystemTime(NOW + 2 * DAY);
    expect(expireIfOld()).toBe(true);
    expect(session.facelets).toBeNull();
    expect(stored()).toBeNull();
  });

  it('counts a solved Solve or a Learn past the last stage as finished, not as work to keep', () => {
    setCube(CUBE);
    setSolve(FIX, FIX.length);
    expect(isFinished()).toBe(true);
    expect(hasWorkToKeep()).toBe(false);

    clearAll();
    setCube(CUBE);
    setLearn(STAGES.length, 0);
    expect(isFinished()).toBe(true);
    expect(hasWorkToKeep()).toBe(false);
  });

  it('counts one saved picture and nothing else as work to keep', () => {
    session.samples = samples(1);
    expect(isFinished()).toBe(false);
    expect(hasWorkToKeep()).toBe(true);
  });

  it('keeps 3 scanned sides through a save and a load, with the other 27 squares still empty', () => {
    session.samples = samples(3);
    saveSession();
    loadSession();
    expect(session.samples).toEqual(samples(3));
    expect(session.samples!.filter((s) => s === null)).toHaveLength(27);
  });

  it('loads typed colors with 30 empty squares as they were, on the color check', () => {
    const colors: (Color | null)[] = toColors(SOLVED);
    for (let i = 0, gaps = 0; gaps < 30; i++) if (i % 9 !== 4) { colors[i] = null; gaps++; }
    put(KEY, record({ colors, route: 'review' }));
    loadSession();
    expect(session.colors).toEqual(colors);
    expect(session.route).toBe('review');
  });

  it('loads colors with 10 greens and no checked cube, on the color check', () => {
    const colors: Color[] = toColors(SOLVED);
    colors[0] = 'G';
    put(KEY, record({ colors, checkMe: [0], filled: [53], route: 'review' }));
    loadSession();
    expect(session.colors).toEqual(colors);
    expect(session.checkMe).toEqual([0]);
    expect(session.filled).toEqual([53]);
    expect(session.route).toBe('review');
  });

  it('drops a checked cube that is not a real cube and both positions, and keeps colors and samples', () => {
    const bad = 'U'.repeat(54);
    const colors = toColors(CUBE);
    put(KEY, record({
      facelets: bad, colors, samples: samples(6), route: 'solve',
      solve: { cube: bad, moves: FIX, position: 2 }, learn: { cube: bad, stage: 1, move: 0 },
    }));
    loadSession();
    expect(session.facelets).toBeNull();
    expect(session.solve).toBeNull();
    expect(session.learn).toBeNull();
    expect(session.colors).toEqual(colors);
    expect(session.samples).toEqual(samples(6));
    expect(session.route).toBe('review');
  });

  it.each([
    ['a sample value of 300', (() => { const s = samples(1); s[3] = [300, 0, 0]; return s; })()],
    ['a side with 4 samples and 5 empty', samples(1).map((s, i) => (i >= 4 && i < 9 ? null : s))],
  ])('throws the whole record away for %s', (_, bad) => {
    put(KEY, record({ samples: bad, facelets: CUBE }));
    loadSession();
    expect(session.samples).toBeNull();
    expect(session.facelets).toBeNull();
    expect(stored()).toBeNull();
  });

  it.each([
    ['moves that do not solve the cube', { moves: FIX.slice(1), position: 0 }],
    ['position 99 for a 20-move list', { moves: FIX, position: 99 }],
  ])('drops saved Solve moves for %s, so Solve asks the solver again', (_, solve) => {
    put(KEY, record({ facelets: CUBE, solve: { cube: CUBE, ...solve } }));
    loadSession();
    expect(session.facelets).toBe(CUBE);
    expect(session.solve).toBeNull();
  });

  it('keeps saved Solve moves that solve the cube', () => {
    put(KEY, record({ facelets: CUBE, solve: { cube: CUBE, moves: FIX, position: 5 } }));
    loadSession();
    expect(session.solve).toEqual({ cube: CUBE, moves: FIX, position: 5 });
  });

  it('clamps a Learn stage of -1 or 99 without crashing', () => {
    put(KEY, record({ facelets: CUBE, learn: { cube: CUBE, stage: -1, move: 0 } }));
    loadSession();
    expect(session.learn).toEqual({ cube: CUBE, stage: 0, move: 0 });

    put(KEY, record({ facelets: CUBE, learn: { cube: CUBE, stage: 99, move: 99 } }));
    loadSession();
    expect(session.learn).toEqual({ cube: CUBE, stage: STAGES.length, move: 0 });
    expect(isFinished()).toBe(true);
  });

  it('moves the old checked cube and its matching Learn place into the record, then removes the old keys', () => {
    put('cube.facelets', CUBE);
    put('learn.progress', { cube: CUBE, stage: 1, move: 0 });
    loadSession();
    expect(session.facelets).toBe(CUBE);
    expect(session.colors).toEqual(toColors(CUBE));
    expect(session.learn).toEqual({ cube: CUBE, stage: 1, move: 0 });
    expect(session.route).toBe('learn');
    expect(localStorage.getItem('cube.facelets')).toBeNull();
    expect(localStorage.getItem('learn.progress')).toBeNull();
    expect(JSON.parse(stored()!).savedAt).toBe(NOW);
  });

  it('does not carry over an old Learn place that belongs to another cube', () => {
    put('cube.facelets', CUBE);
    put('learn.progress', { cube: OTHER, stage: 2, move: 3 });
    loadSession();
    expect(session.facelets).toBe(CUBE);
    expect(session.learn).toBeNull();
    expect(session.route).toBe('review');
  });

  it('does not carry over an old cube that is not a real cube, and removes both old keys', () => {
    put('cube.facelets', 'U'.repeat(54));
    put('learn.progress', { cube: 'U'.repeat(54), stage: 0, move: 0 });
    loadSession();
    expect(session.facelets).toBeNull();
    expect(stored()).toBeNull();
    expect(localStorage.getItem('cube.facelets')).toBeNull();
    expect(localStorage.getItem('learn.progress')).toBeNull();
  });

  it('keeps the old keys when the new record cannot be written, and tries again next load', () => {
    put('cube.facelets', CUBE);
    put('learn.progress', { cube: CUBE, stage: 1, move: 0 });
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    loadSession();
    expect(session.facelets).toBe(CUBE);
    expect(localStorage.getItem('cube.facelets')).not.toBeNull();
    expect(localStorage.getItem('learn.progress')).not.toBeNull();

    write.mockRestore();
    loadSession();
    expect(session.learn).toEqual({ cube: CUBE, stage: 1, move: 0 });
    expect(stored()).not.toBeNull();
    expect(localStorage.getItem('cube.facelets')).toBeNull();
  });

  it('"clear all" removes the record and the old keys, and the next load starts empty', () => {
    setCube(CUBE);
    put('cube.facelets', CUBE);
    put('learn.progress', { cube: CUBE, stage: 1, move: 0 });
    clearAll();
    expect(stored()).toBeNull();
    expect(localStorage.getItem('cube.facelets')).toBeNull();
    expect(localStorage.getItem('learn.progress')).toBeNull();
    loadSession();
    expect(session.facelets).toBeNull();
  });

  it('expiry also removes the old keys', () => {
    put(KEY, record({ facelets: CUBE, savedAt: NOW - 8 * DAY }));
    put('cube.facelets', CUBE);
    put('learn.progress', { cube: CUBE, stage: 1, move: 0 });
    loadSession();
    expect(localStorage.getItem('cube.facelets')).toBeNull();
    expect(localStorage.getItem('learn.progress')).toBeNull();
    loadSession();
    expect(session.facelets).toBeNull();
  });

  it('"clear all" leaves other saved keys alone', () => {
    put('install.dismissed', true);
    setCube(CUBE);
    clearAll();
    expect(localStorage.getItem('install.dismissed')).toBe('true');
  });

  it('setting a new cube drops a Solve position for the old cube and keeps one for the same cube', () => {
    setCube(CUBE);
    setSolve(FIX, 3);
    setCube(CUBE);
    expect(session.solve).toEqual({ cube: CUBE, moves: FIX, position: 3 });
    setCube(OTHER);
    expect(session.solve).toBeNull();
    loadSession();
    expect(session.facelets).toBe(OTHER);
    expect(session.solve).toBeNull();
  });

  it('works in memory with no error when localStorage throws on every call', () => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error('blocked'); });
    }
    expect(() => {
      loadSession();
      setCube(CUBE);
      setSolve(FIX, 1);
      setLearn(0, 0);
      clearAll();
      setCube(CUBE);
    }).not.toThrow();
    expect(session.facelets).toBe(CUBE);
    expect(hasWorkToKeep()).toBe(true);
  });
});
