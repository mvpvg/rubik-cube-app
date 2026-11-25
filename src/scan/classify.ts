import type { RGB } from '../app/session';
import { CENTER_INDEX, COLOR_OF_FACE, FACES, PIECE_SLOTS, pieceAt, type Color } from '../cube/facelets';
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
  const { close, choices } = matchSquares(samples, squares, colors, left);
  repairPieces(colors as Color[], choices);
  return { colors: colors as Color[], checkMe: close };
}

// Gives the listed squares the colors with the lowest total difference from the middle colors, with each
// color taking at most the squares it has `left`. Fills `colors` in place. Returns the close calls with
// their two nearest colors, and the squares that did not get their nearest color.
export function matchSquares(samples: (RGB | null)[], squares: number[], colors: (Color | null)[], left: Map<Color, number>): { close: number[]; missed: number[]; choices: Map<number, [Color, Color]> } {
  const refs = FACES.map((face, f) => ({ color: COLOR_OF_FACE[face], lab: toLab(samples[CENTER_INDEX[f]]!) }));
  const choices = new Map<number, [Color, Color]>();
  const rows = squares.map((i) => {
    const lab = toLab(samples[i]!);
    const ds = refs.map((r) => ({ color: r.color, d: Math.sqrt(dist(lab, r.lab)) }));
    const [a, b] = ds.slice().sort((x, y) => x.d - y.d);
    if (b.d > 0 && (b.d - a.d) / b.d < CHECK_MARGIN) choices.set(i, [a.color, b.color]);
    return { i, ds, nearest: a.color };
  });
  // One column per place a color has left. The callers always leave at least as many places as squares.
  const slots = refs.flatMap((r, f) => new Array(Math.max(0, left.get(r.color) ?? 0)).fill(f) as number[]);
  const cols = assign(rows.map((row) => slots.map((f) => row.ds[f].d)));
  rows.forEach((row, k) => { colors[row.i] = refs[slots[cols[k]]].color; });
  return { close: [...choices.keys()], missed: rows.filter((row) => colors[row.i] !== row.nearest).map((row) => row.i), choices };
}

// The Hungarian method: gives each row of `cost` its own column (rows <= columns) so the total cost is
// the lowest. Returns the column for each row.
export function assign(cost: number[][]): number[] {
  const n = cost.length, m = n ? cost[0].length : 0;
  const u = new Array(n + 1).fill(0), v = new Array(m + 1).fill(0);
  const rowOn = new Array(m + 1).fill(0); // 1-based row on each column; column 0 holds the row being added
  const way = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    rowOn[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(Infinity), used = new Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = rowOn[j0];
      let delta = Infinity, j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) { u[rowOn[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      }
      j0 = j1;
    } while (rowOn[j0] !== 0);
    // Shift the rows along the path that reached the free column.
    do { const j1 = way[j0]; rowOn[j0] = rowOn[j1]; j0 = j1; } while (j0);
  }
  const col = new Array<number>(n);
  for (let j = 1; j <= m; j++) if (rowOn[j]) col[rowOn[j] - 1] = j - 1;
  return col;
}

// Slots whose colors are no real piece, or a piece that also sits in another slot.
function badSlots(colors: Color[]): Set<number> {
  const at = new Map<string, number[]>();
  const bad = new Set<number>();
  PIECE_SLOTS.forEach((g, s) => {
    const p = pieceAt(g.idx.map((i) => colors[i]), g.pieces, g.corner);
    if (p === null) return bad.add(s);
    const key = `${g.corner}${p}`;
    at.set(key, [...(at.get(key) ?? []), s]);
  });
  for (const slots of at.values()) if (slots.length > 1) slots.forEach((s) => bad.add(s));
  return bad;
}

// Every color already has 9, so one color change would break the count. For each bad piece, swap two
// close calls, A (read X, next nearest Y) and B (read Y, next nearest X), one of them on that piece. A swap
// stays only if every piece it touches is real afterward and there are fewer bad pieces.
function repairPieces(colors: Color[], choices: Map<number, [Color, Color]>): void {
  const slotOf = (i: number) => PIECE_SLOTS.findIndex((g) => g.idx.includes(i));
  const other = (i: number) => {
    const [a, b] = choices.get(i)!;
    return colors[i] === a ? b : colors[i] === b ? a : null;
  };
  for (let fixed = true; fixed;) {
    fixed = false;
    const bad = badSlots(colors);
    search: for (const s of bad) {
      for (const a of PIECE_SLOTS[s].idx.filter((i) => choices.has(i))) {
        for (const b of choices.keys()) {
          const [x, y] = [colors[a], other(a)];
          if (b === a || !y || colors[b] !== y || other(b) !== x) continue;
          colors[a] = y; colors[b] = x;
          const after = badSlots(colors);
          if (after.size < bad.size && !after.has(slotOf(a)) && !after.has(slotOf(b))) { fixed = true; break search; }
          colors[a] = x; colors[b] = y;
        }
      }
    }
  }
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
