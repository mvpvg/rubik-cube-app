import { describe, expect, it } from 'vitest';
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
