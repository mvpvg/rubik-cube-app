import { describe, expect, it } from 'vitest';
import Cube from 'cubejs';
import type { RGB } from '../../src/app/session';
import { applyMoves, CENTER_INDEX, COLOR_HEX, SOLVED, toColors, type Color } from '../../src/cube/facelets';
import { classify } from '../../src/scan/classify';

const hex = (c: Color): RGB => {
  const n = parseInt(COLOR_HEX[c].slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// Deterministic noise so failures reproduce.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

// A cube scrambled from a seed, so every run sees the same cubes.
function seededCube(seed: number): Color[] {
  const r = rng(seed * 7919);
  const moves = Array.from({ length: 25 }, () => 'URFDLB'[Math.floor(r() * 6)] + ['', "'", '2'][Math.floor(r() * 3)]);
  return toColors(applyMoves(SOLVED, moves));
}

const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

function photograph(colors: Color[], light: (rgb: RGB) => RGB, noise: number, seed: number): RGB[] {
  const r = rng(seed);
  return colors.map((c) => light(hex(c)).map((v) => clamp(v + (r() - 0.5) * 2 * noise)) as RGB);
}

const room = (rgb: RGB): RGB => [rgb[0] * 0.85, rgb[1] * 0.85, rgb[2] * 0.85];
const warmLamp = ([r, g, b]: RGB): RGB => [r * 0.95 + 20, g * 0.75 + 10, b * 0.45];
const errors = (got: Color[], want: Color[]) => got.filter((c, i) => c !== want[i]).length;

describe('classify', () => {
  it('reads room-light scans with no errors', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const truth = seededCube(seed);
      const { colors } = classify(photograph(truth, room, 18, seed));
      expect(errors(colors, truth)).toBe(0);
    }
  });

  it('reads at least 99 in 100 warm-lamp scans with three or fewer errors', () => {
    let tooMany = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const truth = seededCube(seed);
      const { colors } = classify(photograph(truth, warmLamp, 18, seed));
      if (errors(colors, truth) > 3) tooMany++;
    }
    expect(tooMany).toBeLessThanOrEqual(3);
  });

  it('splits close red and orange samples nine and nine', () => {
    const truth = toColors(Cube.random().asString());
    // Red and orange drawn almost the same; only a small push separates them.
    const samples = truth.map((c): RGB => (c === 'R' ? [205, 70, 40] : c === 'O' ? [215, 85, 35] : hex(c)));
    const { colors } = classify(samples);
    expect(colors.filter((c) => c === 'R')).toHaveLength(9);
    expect(colors.filter((c) => c === 'O')).toHaveLength(9);
  });

  it('marks close calls for the child to check, never the middles', () => {
    const truth = toColors(Cube.random().asString());
    const samples = truth.map((c): RGB => (c === 'R' ? [205, 70, 40] : c === 'O' ? [215, 85, 35] : hex(c)));
    // One red sticker that looks halfway between the red and orange middles.
    const unsure = truth.findIndex((c, i) => c === 'R' && !CENTER_INDEX.includes(i));
    samples[unsure] = [210, 77, 37];
    const { checkMe } = classify(samples);
    expect(checkMe).toContain(unsure);
    for (const i of CENTER_INDEX) expect(checkMe).not.toContain(i);
  });
});
