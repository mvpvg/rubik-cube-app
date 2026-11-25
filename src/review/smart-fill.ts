import { COLOR_OF_FACE, PIECE_SLOTS, pieceAt, placements, type Color } from '../cube/facelets';

type Slot = Color | null;
export type Fill = { index: number; color: Color };

// Works out squares that can only be one color, given the squares the child has set.
// Only empty squares are filled, and each fill is a real piece that is not already on the cube.
export function smartFill(slots: Slot[]): Fill[] {
  const work = slots.slice();
  const fills: Fill[] = [];

  for (let changed = true; changed;) {
    changed = false;
    const count: Record<string, number> = {};
    for (const c of work) if (c) count[c] = (count[c] ?? 0) + 1;
    const used = [new Set<number>(), new Set<number>()];
    for (const g of PIECE_SLOTS) {
      const p = pieceAt(g.idx.map((i) => work[i]), g.pieces, g.corner);
      if (p !== null) used[g.corner ? 0 : 1].add(p);
    }

    for (const g of PIECE_SLOTS) {
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
