import type { RGB } from '../app/session';
import { CENTER_INDEX, COLOR_OF_FACE, FACES, type Color } from '../cube/facelets';
import { toLab, type Lab } from './sample';

export interface Classified {
  colors: Color[]; // 54, solver order
  checkMe: number[]; // stickers that only just won their color
}

// Close calls: if the best and second-best color are this near, ask the child to look.
const CHECK_MARGIN = 0.25;

const dist = (p: Lab, q: Lab) => (0.5 * (p[0] - q[0])) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;

// Each side's middle sticker never moves, so it is the reference for its color under the same light.
// Every sticker goes to its nearest middle color, most certain first, and no color takes more than 9.
export function classify(samples: RGB[]): Classified {
  if (samples.length !== 54) throw new Error('Need 54 samples');
  const labs = samples.map(toLab);
  const refs = FACES.map((face, f) => ({ color: COLOR_OF_FACE[face], lab: labs[CENTER_INDEX[f]] }));

  const colors: (Color | null)[] = new Array(54).fill(null);
  const left = new Map<Color, number>(refs.map((r) => [r.color, 8]));
  CENTER_INDEX.forEach((i, f) => { colors[i] = refs[f].color; });

  const options: Array<{ i: number; color: Color; d: number }> = [];
  const checkMe: number[] = [];
  labs.forEach((lab, i) => {
    if (CENTER_INDEX.includes(i)) return;
    const ds = refs.map((r) => ({ color: r.color, d: dist(lab, r.lab) })).sort((a, b) => a.d - b.d);
    if (ds[1].d > 0 && (Math.sqrt(ds[1].d) - Math.sqrt(ds[0].d)) / Math.sqrt(ds[1].d) < CHECK_MARGIN) checkMe.push(i);
    for (const { color, d } of ds) options.push({ i, color, d });
  });

  options.sort((a, b) => a.d - b.d);
  for (const { i, color } of options) {
    if (colors[i] !== null || left.get(color)! === 0) continue;
    colors[i] = color;
    left.set(color, left.get(color)! - 1);
  }

  return { colors: colors as Color[], checkMe };
}
