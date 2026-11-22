import { CENTER_INDEX, COLOR_NAME, COLOR_OF_FACE, FACES, type Face } from './facelets';

export type Validation = { ok: true } | { ok: false; message: string; highlight: number[] };

// Sticker positions of each corner and edge slot, U/D sticker first for corners.
const CORNERS = [
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
  [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
];
const CORNER_COLORS: Face[][] = [
  ['U', 'R', 'F'], ['U', 'F', 'L'], ['U', 'L', 'B'], ['U', 'B', 'R'],
  ['D', 'F', 'R'], ['D', 'L', 'F'], ['D', 'B', 'L'], ['D', 'R', 'B'],
];
const EDGES = [
  [5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25],
  [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14],
];
const EDGE_COLORS: Face[][] = [
  ['U', 'R'], ['U', 'F'], ['U', 'L'], ['U', 'B'], ['D', 'R'], ['D', 'F'],
  ['D', 'L'], ['D', 'B'], ['F', 'R'], ['F', 'L'], ['B', 'L'], ['B', 'R'],
];

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

function parity(perm: number[]): number {
  const seen = new Array(perm.length).fill(false);
  let swaps = 0;
  for (let i = 0; i < perm.length; i++) {
    if (seen[i]) continue;
    let len = 0;
    for (let j = i; !seen[j]; j = perm[j]) { seen[j] = true; len++; }
    swaps += len - 1;
  }
  return swaps % 2;
}

export function validate(state: string): Validation {
  const s = state.split('') as Face[];

  for (const face of FACES) {
    const count = s.filter((x) => x === face).length;
    if (count !== 9) {
      const name = COLOR_NAME[COLOR_OF_FACE[face]];
      const highlight = s.flatMap((x, i) => (x === face && !CENTER_INDEX.includes(i) ? [i] : []));
      return {
        ok: false,
        message: count > 9
          ? `There are ${count} ${name} squares. A cube has 9. Find the one that is a different color.`
          : `There are only ${count} ${name} squares. A cube has 9. One of the others should be ${name}.`,
        highlight,
      };
    }
  }

  const centers = CENTER_INDEX.map((i) => s[i]);
  if (new Set(centers).size !== 6) {
    return { ok: false, message: 'Two middle squares have the same color. Each side has its own middle color.', highlight: CENTER_INDEX };
  }

  const cornerPerm: number[] = [];
  let twist = 0;
  const twisted: number[] = [];
  for (let slot = 0; slot < 8; slot++) {
    const stickers = CORNERS[slot].map((i) => s[i]);
    const piece = CORNER_COLORS.findIndex((cols) => sameSet(cols, stickers));
    if (piece < 0) {
      return { ok: false, message: 'This corner has colors that cannot sit together on a real cube. Check these 3 squares.', highlight: CORNERS[slot] };
    }
    if (cornerPerm.includes(piece)) {
      const other = cornerPerm.indexOf(piece);
      return { ok: false, message: 'Two corners have the same colors. One of them is wrong.', highlight: [...CORNERS[other], ...CORNERS[slot]] };
    }
    cornerPerm.push(piece);
    const ori = stickers.findIndex((x) => x === 'U' || x === 'D');
    twist += ori;
    if (ori !== 0) twisted.push(...CORNERS[slot]);
  }

  const edgePerm: number[] = [];
  let flip = 0;
  const flipped: number[] = [];
  for (let slot = 0; slot < 12; slot++) {
    const stickers = EDGES[slot].map((i) => s[i]);
    const piece = EDGE_COLORS.findIndex((cols) => sameSet(cols, stickers));
    if (piece < 0) {
      return { ok: false, message: 'This edge has colors that cannot sit together on a real cube. Check these 2 squares.', highlight: EDGES[slot] };
    }
    if (edgePerm.includes(piece)) {
      const other = edgePerm.indexOf(piece);
      return { ok: false, message: 'Two edges have the same colors. One of them is wrong.', highlight: [...EDGES[other], ...EDGES[slot]] };
    }
    edgePerm.push(piece);
    const ori = stickers[0] === EDGE_COLORS[piece][0] ? 0 : 1;
    flip += ori;
    if (ori) flipped.push(...EDGES[slot]);
  }

  if (twist % 3 !== 0) {
    return { ok: false, message: 'One corner looks twisted. Check the colors on the corners.', highlight: twisted };
  }
  if (flip % 2 !== 0) {
    return { ok: false, message: 'One edge looks flipped. Check the colors on the edges.', highlight: flipped };
  }
  if (parity(cornerPerm) !== parity(edgePerm)) {
    return { ok: false, message: 'Two pieces look swapped. Check the colors again, side by side.', highlight: [] };
  }
  return { ok: true };
}
