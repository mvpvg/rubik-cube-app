import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Cube from 'cubejs';
import { applyMoves, isSolved, SOLVED } from '../../src/cube/facelets';
import { solveFast } from '../../src/solve/fast-solve';

describe('fast solve', () => {
  it('solves 1,000 random cubes in 22 moves or fewer', () => {
    let longest = 0;
    for (let i = 0; i < 1000; i++) {
      const state = Cube.random().asString();
      const moves = solveFast(state);
      expect(isSolved(applyMoves(state, moves))).toBe(true);
      longest = Math.max(longest, moves.length);
    }
    expect(longest).toBeLessThanOrEqual(22);
  }, 300_000);

  it('an already solved cube needs no moves', () => {
    expect(solveFast(SOLVED)).toEqual([]);
  });
});

// jsdom has no Worker; this one records what it is sent and never answers, so any answer comes from the main thread.
class FakeWorker {
  static made: FakeWorker[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  constructor() { FakeWorker.made.push(this); }
  postMessage() {}
  terminate() {}
}

describe('solving in the worker', () => {
  const CUBE = applyMoves(SOLVED, 'R U');
  let solveInWorker: (state: string) => Promise<string[]>;

  beforeEach(async () => {
    FakeWorker.made = [];
    vi.stubGlobal('Worker', FakeWorker);
    vi.resetModules();
    ({ solveInWorker } = await import('../../src/solve/fast-solve'));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('a worker that fails while a solve waits: that solve gets a main-thread solution', async () => {
    const waiting = solveInWorker(CUBE);
    FakeWorker.made[0].onerror!();
    expect(isSolved(applyMoves(CUBE, await waiting))).toBe(true);
  }, 20_000);

  it('after the worker fails on its first solve, the next solve runs on the main thread and no second worker starts', async () => {
    void solveInWorker(CUBE).catch(() => {});
    FakeWorker.made[0].onerror!();
    expect(isSolved(applyMoves(CUBE, await solveInWorker(CUBE)))).toBe(true);
    expect(FakeWorker.made).toHaveLength(1);
  }, 20_000);

  it('a main-thread solve that throws rejects instead of throwing or hanging', async () => {
    vi.stubGlobal('Worker', undefined);
    vi.spyOn(Cube, 'fromString').mockImplementation(() => { throw new Error('bad cube'); });
    await expect(solveInWorker(CUBE)).rejects.toThrow('bad cube');
  });
});
