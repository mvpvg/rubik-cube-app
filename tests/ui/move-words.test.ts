import { describe, expect, it } from 'vitest';
import { moveWords, prettyMove } from '../../src/ui/move-words';

const ALL = ['U', 'D', 'R', 'L', 'F', 'B', 'x', 'y', 'z'].flatMap((b) => [b, `${b}'`, `${b}2`]);

describe('move words', () => {
  it('every face move and whole-cube turn has words', () => {
    for (const m of ALL) {
      const w = moveWords(m);
      expect(w, m).not.toBe(m);
      expect(w.length, m).toBeGreaterThan(5);
    }
  });

  it('a move and its opposite never share words', () => {
    for (const b of ['U', 'D', 'R', 'L', 'F', 'B', 'x', 'y', 'z']) expect(moveWords(b)).not.toBe(moveWords(`${b}'`));
  });

  it('describes the right side turning up', () => {
    expect(moveWords('R')).toBe('Right side up');
    expect(moveWords("U'")).toBe('Top to the right');
  });

  it('shows a real prime mark', () => {
    expect(prettyMove("R'")).toBe('R′');
  });
});
