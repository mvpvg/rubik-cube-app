import { describe, expect, it } from 'vitest';
import Cube from 'cubejs';
import { applyMoves, invertMoves, isSolved, SOLVED } from '../../src/cube/facelets';

const FACE_MOVES = ['U', 'R', 'F', 'D', 'L', 'B'].flatMap((f) => [f, `${f}'`, `${f}2`]);

function randomAlg(n: number): string[] {
  return Array.from({ length: n }, () => FACE_MOVES[Math.floor(Math.random() * FACE_MOVES.length)]);
}

describe('facelets', () => {
  it('matches the reference solver for every face move', () => {
    for (const m of FACE_MOVES) {
      expect(applyMoves(SOLVED, m), m).toBe(new Cube().move(m).asString());
    }
  });

  it('matches the reference solver on long random sequences', () => {
    for (let i = 0; i < 50; i++) {
      const alg = randomAlg(30);
      expect(applyMoves(SOLVED, alg)).toBe(new Cube().move(alg.join(' ')).asString());
    }
  });

  it('a scramble then its inverse returns to solved', () => {
    const alg = randomAlg(25);
    expect(applyMoves(applyMoves(SOLVED, alg), invertMoves(alg))).toBe(SOLVED);
  });

  it('whole-cube turns keep the cube solved and move the centers', () => {
    const turned = applyMoves(SOLVED, 'x');
    expect(isSolved(turned)).toBe(true);
    expect(turned[4]).toBe('F'); // green comes to the top
    expect(applyMoves(SOLVED, 'y')[22]).toBe('R'); // red comes to the front
    expect(applyMoves(SOLVED, 'z')[4]).toBe('L'); // orange comes to the top
  });

  it('x matches R plus M prime plus L prime', () => {
    const scrambled = applyMoves(SOLVED, randomAlg(20));
    expect(applyMoves(scrambled, 'x')).toBe(applyMoves(scrambled, "R M' L'"));
  });
});
