import type { RGB } from '../app/session';
import { CENTER_INDEX, COLOR_OF_FACE, FACES, type Color } from '../cube/facelets';
import { labDist as dist, nominalLab, toLab } from './sample';

export interface Classified {
  colors: Color[]; // 54, solver order
  checkMe: number[]; // stickers that only just won their color
}

// Close calls: if the best and second-best color are this near, ask the child to look.
const CHECK_MARGIN = 0.25;

// Each side's middle sticker never moves, so it is the reference for its color under the same light.
export function classify(samples: RGB[]): Classified {
  if (samples.length !== 54) throw new Error('Need 54 samples');
  const colors: (Color | null)[] = new Array(54).fill(null);
  CENTER_INDEX.forEach((i, f) => { colors[i] = COLOR_OF_FACE[FACES[f]]; });
  const left = new Map<Color, number>(FACES.map((face) => [COLOR_OF_FACE[face], 8]));
  const squares = samples.map((_, i) => i).filter((i) => !CENTER_INDEX.includes(i));
  const { close } = matchSquares(samples, squares, colors, left);
  return { colors: colors as Color[], checkMe: close };
}

// Gives each listed square its nearest middle color, most certain first, while that color has squares `left`.
// Fills `colors` in place. Returns the close calls, and the squares that did not get their nearest color.
export function matchSquares(samples: (RGB | null)[], squares: number[], colors: (Color | null)[], left: Map<Color, number>): { close: number[]; missed: number[] } {
  const refs = FACES.map((face, f) => ({ color: COLOR_OF_FACE[face], lab: toLab(samples[CENTER_INDEX[f]]!) }));
  const options: Array<{ i: number; color: Color; d: number }> = [];
  const nearest = new Map<number, Color>();
  const close: number[] = [];
  for (const i of squares) {
    const lab = toLab(samples[i]!);
    const ds = refs.map((r) => ({ color: r.color, d: dist(lab, r.lab) })).sort((a, b) => a.d - b.d);
    if (ds[1].d > 0 && (Math.sqrt(ds[1].d) - Math.sqrt(ds[0].d)) / Math.sqrt(ds[1].d) < CHECK_MARGIN) close.push(i);
    nearest.set(i, ds[0].color);
    for (const { color, d } of ds) options.push({ i, color, d });
  }

  options.sort((a, b) => a.d - b.d);
  const done = new Set<number>();
  for (const { i, color } of options) {
    if (done.has(i) || (left.get(color) ?? 0) <= 0) continue;
    colors[i] = color;
    done.add(i);
    left.set(color, left.get(color)! - 1);
  }
  return { close, missed: squares.filter((i) => colors[i] !== nearest.get(i)) };
}

// The colors read from one side's 9 samples alone, so they can be worked out again from saved samples.
// The side's own middle is the reference for its color under that light; the sticker colors stand in for
// the other five. A side kept with "Use it anyway" has an untrusted middle, so it uses sticker colors for all six.
export function sideColors(samples: RGB[], asked: Color, anyway: boolean): Color[] {
  const refs = FACES.map((face) => {
    const color = COLOR_OF_FACE[face];
    return { color, lab: color === asked && !anyway ? toLab(samples[4]) : nominalLab(color) };
  });
  return samples.map((rgb, i) => {
    if (i === 4) return asked;
    const lab = toLab(rgb);
    return refs.reduce((a, b) => (dist(lab, b.lab) < dist(lab, a.lab) ? b : a)).color;
  });
}
