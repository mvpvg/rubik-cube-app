import { CENTER_INDEX, COLOR_NAME, COLOR_OF_FACE, CORNER_SLOTS as CORNERS, EDGE_SLOTS as EDGES, FACES, sameSet, type Face } from './facelets';

export type Validation = { ok: true } | { ok: false; message: string; help: string; highlight: number[] };

const CORNER_COLORS: Face[][] = [
  ['U', 'R', 'F'], ['U', 'F', 'L'], ['U', 'L', 'B'], ['U', 'B', 'R'],
  ['D', 'F', 'R'], ['D', 'L', 'F'], ['D', 'B', 'L'], ['D', 'R', 'B'],
];
const EDGE_COLORS: Face[][] = [
  ['U', 'R'], ['U', 'F'], ['U', 'L'], ['U', 'B'], ['D', 'R'], ['D', 'F'],
  ['D', 'L'], ['D', 'B'], ['F', 'R'], ['F', 'L'], ['B', 'L'], ['B', 'R'],
];

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
        help: count > 9
          ? `Look at the squares that are lit up and check which one is not really ${name}.`
          : `Look for a square that you typed as another color but that is really ${name}.`,
        highlight,
      };
    }
  }

  const centers = CENTER_INDEX.map((i) => s[i]);
  if (new Set(centers).size !== 6) {
    return { ok: false, message: 'Two middle squares have the same color. Each side has its own middle color.', help: 'Turn the cube and look at the middle square of each side. They must be six different colors.', highlight: CENTER_INDEX };
  }

  const cornerPerm: number[] = [];
  let twist = 0;
  const twisted: number[] = [];
  for (let slot = 0; slot < 8; slot++) {
    const stickers = CORNERS[slot].map((i) => s[i]);
    const ori = stickers.findIndex((x) => x === 'U' || x === 'D');
    // Read clockwise from the white or yellow sticker: a corner with its two side colors
    // swapped has the right colors but can never exist on a real cube.
    const clockwise = [0, 1, 2].map((k) => stickers[(ori + k) % 3]).join('');
    const piece = CORNER_COLORS.findIndex((cols) => sameSet(cols, stickers) && cols.join('') === clockwise);
    if (piece < 0) {
      return { ok: false, message: 'This corner has colors that cannot sit together on a real cube. Check these 3 squares.', help: 'Hold the cube and look at the lit-up corner. Check each of its 3 colors again.', highlight: CORNERS[slot] };
    }
    if (cornerPerm.includes(piece)) {
      const other = cornerPerm.indexOf(piece);
      return { ok: false, message: 'Two corners have the same colors. One of them is wrong.', help: 'A cube has only one corner with each set of 3 colors. Look at both lit-up corners and check their colors.', highlight: [...CORNERS[other], ...CORNERS[slot]] };
    }
    cornerPerm.push(piece);
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
      return { ok: false, message: 'This edge has colors that cannot sit together on a real cube. Check these 2 squares.', help: 'Look at the lit-up edge on the real cube and check each of its 2 colors again.', highlight: EDGES[slot] };
    }
    if (edgePerm.includes(piece)) {
      const other = edgePerm.indexOf(piece);
      return { ok: false, message: 'Two edges have the same colors. One of them is wrong.', help: 'A cube has only one edge with each pair of colors. Look at both lit-up edges and check their colors.', highlight: [...EDGES[other], ...EDGES[slot]] };
    }
    edgePerm.push(piece);
    const ori = stickers[0] === EDGE_COLORS[piece][0] ? 0 : 1;
    flip += ori;
    if (ori) flipped.push(...EDGES[slot]);
  }

  if (twist % 3 !== 0) {
    return { ok: false, message: 'One corner looks twisted. Check the colors on the corners.', help: 'Look at the lit-up corners. One of them has its colors in the wrong order, so check each one against your cube.', highlight: twisted };
  }
  if (flip % 2 !== 0) {
    return { ok: false, message: 'One edge looks flipped. Check the colors on the edges.', help: 'Look at the lit-up edges. One of them has its two colors the wrong way round, so check each one against your cube.', highlight: flipped };
  }
  if (parity(cornerPerm) !== parity(edgePerm)) {
    return { ok: false, message: 'Two pieces look swapped. Check the colors again, side by side.', help: 'Pick two pieces of the same kind, like two edges, and check that you typed them exactly as they are on your cube.', highlight: [] };
  }
  return { ok: true };
}
