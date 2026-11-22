import { describe, expect, it } from 'vitest';
import Cube from 'cubejs';
import { SOLVED } from '../../src/cube/facelets';
import { validate } from '../../src/cube/validate';

const set = (s: string, changes: Record<number, string>) => s.split('').map((c, i) => changes[i] ?? c).join('');

describe('validate', () => {
  it('accepts the solved cube', () => {
    expect(validate(SOLVED).ok).toBe(true);
  });

  it('accepts 1,000 random cubes', () => {
    for (let i = 0; i < 1000; i++) expect(validate(Cube.random().asString()).ok).toBe(true);
  });

  it('too many white squares', () => {
    const r = validate(set(SOLVED, { 9: 'U' }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(/10 white/);
      expect(r.highlight).toContain(9);
    }
  });

  it('a single twisted corner highlights that corner', () => {
    // Twist the up-right-front corner in place: U9, R1, F3 rotate.
    const r = validate(set(SOLVED, { 8: 'F', 9: 'U', 20: 'R' }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(/twisted/);
      expect(r.highlight.sort((a, b) => a - b)).toEqual([8, 9, 20]);
    }
  });

  it('a flipped edge', () => {
    const r = validate(set(SOLVED, { 7: 'F', 19: 'U' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/flipped/);
  });

  it('two swapped corners only', () => {
    // Swap the URF and UFL corners without twisting them.
    const s = set(SOLVED, { 8: 'U', 9: 'L', 20: 'F', 6: 'U', 18: 'R', 38: 'F' });
    const r = validate(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/swapped/);
  });

  it('impossible corner colors', () => {
    const r = validate(set(SOLVED, { 9: 'D', 29: 'R' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/cannot sit together/);
  });
});
