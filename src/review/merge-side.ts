import type { RGB } from '../app/session';
import { CENTER_INDEX, COLOR_OF_FACE, FACES, type Color } from '../cube/facelets';
import { matchSquares } from '../scan/classify';
import { nearestColor } from '../scan/sample';

type Work = { samples: (RGB | null)[] | null; colors: (Color | null)[]; checkMe: number[]; filled: number[] };

// One side taken again: its 9 new samples replace that side's samples and colors, and nothing else changes.
// Each color may only take what the other sides leave of its 9, counted from the current colors with the
// child's fixes, not from the raw samples, so a fix elsewhere cannot push a right square to a wrong color.
export function mergeSide(work: Work, face: number, cells: RGB[]): Work & { samples: (RGB | null)[] } {
  const side = cells.map((_, k) => face * 9 + k);
  const mine = new Set(side);
  const center = CENTER_INDEX[face];
  const ring = side.filter((i) => i !== center);
  const samples = work.samples?.slice() ?? new Array(54).fill(null);
  side.forEach((i, k) => { samples[i] = cells[k]; });
  const colors = work.colors.slice();
  ring.forEach((i) => { colors[i] = null; });

  let flags: number[];
  if (CENTER_INDEX.every((i) => samples[i])) {
    const left = new Map(FACES.map((f) => [COLOR_OF_FACE[f], 9] as [Color, number]));
    colors.forEach((c) => { if (c) left.set(c, left.get(c)! - 1); });
    const { close, missed } = matchSquares(samples, ring, colors, left);
    flags = [...new Set([...close, ...missed])];
  } else {
    // Without all six middle samples (typed colors) there is nothing to compare against under this light.
    ring.forEach((i) => { colors[i] = nearestColor(samples[i]!); });
    flags = ring;
  }
  return {
    samples,
    colors,
    checkMe: [...work.checkMe.filter((i) => !mine.has(i)), ...flags],
    filled: work.filled.filter((i) => !mine.has(i)),
  };
}
