import { describe, expect, it } from 'vitest';
import { applyMoves, SOLVED } from '../../src/cube/facelets';
import { STAGES, stageDone } from '../../src/learn/beginner-solver';
import { makeStageCube } from '../../src/practice/stage-practice';

describe('stage practice cubes', () => {
  it('for every stage, earlier stages are done and the target stage is not', () => {
    STAGES.forEach((stage, k) => {
      for (let i = 0; i < 200; i++) {
        const { setup, hold } = makeStageCube(stage.id);
        const state = applyMoves(SOLVED, setup);
        for (const earlier of STAGES.slice(0, k)) expect(stageDone(earlier.id, state), `${stage.id} needs ${earlier.id}`).toBe(true);
        expect(stageDone(stage.id, state), stage.id).toBe(false);
        expect(hold.length).toBeGreaterThan(5);
      }
    });
  }, 120_000);

  it('white cross practice is a plain scramble', () => {
    const { setup } = makeStageCube('white-cross');
    expect(setup).toHaveLength(20);
    expect(setup.every((m) => /^[UDRLFB]/.test(m))).toBe(true);
  });
});
