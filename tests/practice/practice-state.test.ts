import { describe, expect, it } from 'vitest';
import { applyMoves, isSolved, SOLVED } from '../../src/cube/facelets';
import { PracticeCube, randomScramble } from '../../src/practice/practice-state';

describe('practice cube', () => {
  it('R then R prime returns to solved and counts two moves', () => {
    const cube = new PracticeCube();
    cube.apply('R');
    cube.apply("R'");
    expect(cube.state).toBe(SOLVED);
    expect(cube.moveCount).toBe(2);
  });

  it('Scramble gives an unsolved cube and Reset goes back to the start', () => {
    const cube = new PracticeCube();
    cube.scramble();
    expect(cube.solved).toBe(false);
    const scrambled = cube.state;
    cube.apply('U');
    cube.reset();
    expect(cube.state).toBe(scrambled);
    expect(cube.moveCount).toBe(0);
  });

  it('Reset on a fresh practice cube returns to solved', () => {
    const cube = new PracticeCube();
    cube.apply('F');
    cube.reset();
    expect(cube.state).toBe(SOLVED);
  });

  it('Undo after three moves equals the state after two', () => {
    const cube = new PracticeCube();
    cube.apply('R');
    cube.apply('U');
    const afterTwo = cube.state;
    cube.apply('F');
    cube.undo();
    expect(cube.state).toBe(afterTwo);
  });

  it('Undo right after Scramble or Reset brings back the replaced cube', () => {
    const cube = new PracticeCube();
    cube.apply('R');
    const before = cube.state;
    cube.scramble();
    cube.undo();
    expect(cube.state).toBe(before);
    cube.reset();
    cube.undo();
    expect(cube.state).toBe(before);
  });

  it('a whole-cube turn moves the front center but keeps the cube solved', () => {
    const cube = new PracticeCube();
    cube.apply('y');
    expect(cube.solved).toBe(true);
    expect(cube.state[22]).not.toBe(SOLVED[22]);
  });

  it('a cube started from setup moves shows those moves applied', () => {
    const cube = new PracticeCube(['R', 'U']);
    expect(cube.state).toBe(applyMoves(SOLVED, 'R U'));
    expect(cube.setup).toEqual(['R', 'U']);
  });

  it('random scrambles are 20 face moves that never repeat a side twice in a row', () => {
    const s = randomScramble();
    expect(s).toHaveLength(20);
    s.forEach((m, i) => { if (i) expect(m[0]).not.toBe(s[i - 1][0]); });
    expect(isSolved(applyMoves(SOLVED, s))).toBe(false);
  });
});
