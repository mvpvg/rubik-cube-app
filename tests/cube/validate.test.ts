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
    const s = set(SOLVED, { 8: 'U', 9: 'F', 20: 'L', 6: 'U', 18: 'R', 38: 'F' });
    const r = validate(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/swapped/);
  });

  it('a corner with its two side colors swapped is impossible', () => {
    // Mirror the up-right-front corner: red and green trade places.
    const r = validate(set(SOLVED, { 9: 'F', 20: 'R' }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(/cannot sit together/);
      expect(r.highlight.sort((a, b) => a - b)).toEqual([8, 9, 20]);
    }
  });

  it('too few squares of one color', () => {
    // Up face first, so the short count is reported before the extra one.
    const r = validate(set(SOLVED, { 0: 'R' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/only 8 white/);
  });

  it('two middle squares the same color', () => {
    const r = validate(set(SOLVED, { 13: 'F', 18: 'R' }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(/middle squares/);
      expect(r.highlight).toEqual([4, 13, 22, 31, 40, 49]);
    }
  });

  it('two corners with the same colors', () => {
    // The up-front-left corner is painted as a second up-right-front corner; the up-right-front
    // stickers take its colors so every color still appears nine times.
    const r = validate(set(SOLVED, { 6: 'U', 18: 'R', 38: 'F', 9: 'F', 20: 'L' }));
    expect(r.ok).toBe(false);
  });

  it('two edges with the same colors', () => {
    // Up-front edge painted white-red like up-right; the down-right red sticker turns green to keep counts.
    const r = validate(set(SOLVED, { 19: 'R', 16: 'F' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/Two edges/);
  });

  it('impossible edge colors', () => {
    // White and yellow can never share an edge.
    const r = validate(set(SOLVED, { 10: 'D', 28: 'R' }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(/This edge has colors that cannot sit together/);
      expect(r.highlight).toHaveLength(2);
    }
  });

  it('impossible corner colors', () => {
    const r = validate(set(SOLVED, { 9: 'D', 29: 'R' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/cannot sit together/);
  });
});
