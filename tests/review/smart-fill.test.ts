import { describe, expect, it } from 'vitest';
import Cube from 'cubejs';
import { CORNER_SLOTS, CENTER_INDEX, toColors, type Color } from '../../src/cube/facelets';
import { smartFill } from '../../src/review/smart-fill';

const blank = (truth: Color[], indexes: number[]): (Color | null)[] => truth.map((c, i) => (indexes.includes(i) ? null : c));

describe('smartFill', () => {
  it('restores one blanked square of a valid cube', () => {
    for (let t = 0; t < 50; t++) {
      const truth = toColors(Cube.random().asString());
      const i = [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 14, 20, 29, 30, 50, 53][t % 18];
      expect(smartFill(blank(truth, [i]))).toEqual([{ index: i, color: truth[i] }]);
    }
  });

  it('fills nothing when two squares of one corner are blank', () => {
    const truth = toColors(Cube.random().asString());
    const [a, b] = CORNER_SLOTS[0];
    expect(smartFill(blank(truth, [a, b]))).toEqual([]);
  });

  it('never changes a square that is already set, and returns only empty squares', () => {
    const truth = toColors(Cube.random().asString());
    const slots = blank(truth, [0, 5, 9]);
    slots[20] = truth[20] === 'W' ? 'Y' : 'W'; // a wrong pick by the child
    const before = slots.slice();
    const fills = smartFill(slots);
    expect(slots).toEqual(before);
    for (const f of fills) expect(before[f.index]).toBeNull();
  });

  it('with 20 random squares blanked, everything it sets matches the true cube', () => {
    for (let t = 0; t < 200; t++) {
      const truth = toColors(Cube.random().asString());
      const pool = truth.map((_, i) => i).filter((i) => !CENTER_INDEX.includes(i));
      const gone: number[] = [];
      while (gone.length < 20) gone.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
      for (const f of smartFill(blank(truth, gone))) {
        expect(gone).toContain(f.index);
        expect(f.color).toBe(truth[f.index]);
      }
    }
  });

  it('does not fill a color that would make a piece already on the cube', () => {
    const truth = toColors(Cube.random().asString());
    const [a, b, c] = CORNER_SLOTS[1];
    const slots = blank(truth, [c]);
    // Make the neighbor corner a duplicate of the piece this hole would need.
    const other = CORNER_SLOTS[2];
    slots[other[0]] = truth[a]; slots[other[1]] = truth[b]; slots[other[2]] = truth[c];
    expect(smartFill(slots).find((f) => f.index === c)).toBeUndefined();
  });
});
