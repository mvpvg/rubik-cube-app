import { CORNER_SLOTS, EDGE_SLOTS, FACE_OF_COLOR, COLOR_OF_FACE, type Color, type Face } from '../cube/facelets';

type Slot = Color | null;
export type Fill = { index: number; color: Color };

// Pieces as the faces they touch. Corners are listed clockwise starting from the
// white or yellow sticker, the same order the corner slots use.
const CORNER_PIECES: Face[][] = [
  ['U', 'R', 'F'], ['U', 'F', 'L'], ['U', 'L', 'B'], ['U', 'B', 'R'],
  ['D', 'F', 'R'], ['D', 'L', 'F'], ['D', 'B', 'L'], ['D', 'R', 'B'],
];
const EDGE_PIECES: Face[][] = [
  ['U', 'R'], ['U', 'F'], ['U', 'L'], ['U', 'B'], ['D', 'R'], ['D', 'F'],
  ['D', 'L'], ['D', 'B'], ['F', 'R'], ['F', 'L'], ['B', 'L'], ['B', 'R'],
];

// Every way a piece can sit in a slot: the faces seen at each sticker position.
function placements(piece: Face[], corner: boolean): Face[][] {
  if (!corner) return [piece, [piece[1], piece[0]]];
  return [0, 1, 2].map((ori) => [0, 1, 2].map((j) => piece[(j - ori + 3) % 3]));
}

function pieceAt(stickers: Slot[], pieces: Face[][], corner: boolean): number | null {
  if (stickers.some((c) => c === null)) return null;
  const faces = stickers.map((c) => FACE_OF_COLOR[c as Color]);
  const found = pieces.findIndex((p) => placements(p, corner).some((pl) => pl.every((f, k) => f === faces[k])));
  return found >= 0 ? found : null;
}

// Works out squares that can only be one color, given the squares the child has set.
// Only empty squares are filled, and each fill is a real piece that is not already on the cube.
export function smartFill(slots: Slot[]): Fill[] {
  const work = slots.slice();
  const fills: Fill[] = [];
  const groups = [
    ...CORNER_SLOTS.map((idx) => ({ idx, pieces: CORNER_PIECES, corner: true })),
    ...EDGE_SLOTS.map((idx) => ({ idx, pieces: EDGE_PIECES, corner: false })),
  ];

  for (let changed = true; changed;) {
    changed = false;
    const count: Record<string, number> = {};
    for (const c of work) if (c) count[c] = (count[c] ?? 0) + 1;
    const used = [new Set<number>(), new Set<number>()];
    for (const g of groups) {
      const p = pieceAt(g.idx.map((i) => work[i]), g.pieces, g.corner);
      if (p !== null) used[g.corner ? 0 : 1].add(p);
    }

    for (const g of groups) {
      const stickers = g.idx.map((i) => work[i]);
      if (stickers.filter((c) => c === null).length !== 1) continue;
      const hole = stickers.findIndex((c) => c === null);
      const options = new Set<Color>();
      g.pieces.forEach((piece, n) => {
        if (used[g.corner ? 0 : 1].has(n)) return;
        for (const pl of placements(piece, g.corner)) {
          if (pl.every((f, k) => k === hole || COLOR_OF_FACE[f] === stickers[k])) options.add(COLOR_OF_FACE[pl[hole]]);
        }
      });
      if (options.size !== 1) continue;
      const [color] = options;
      if ((count[color] ?? 0) >= 9) continue;
      work[g.idx[hole]] = color;
      fills.push({ index: g.idx[hole], color });
      changed = true;
      break; // counts and used pieces changed; recompute before the next fill
    }
  }
  return fills;
}
