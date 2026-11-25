// A cube is a 54-character string in the standard solver order: the U, R, F, D, L, B faces,
// nine stickers each, read row by row. Each character names the color by the face it belongs
// to when the cube is solved and held with white on top and green in front:
// U = white, R = red, F = green, D = yellow, L = orange, B = blue.

export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
export type Color = 'W' | 'Y' | 'R' | 'O' | 'G' | 'B';

export const FACES: Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];
export const SOLVED = FACES.map((f) => f.repeat(9)).join('');

export const COLOR_OF_FACE: Record<Face, Color> = { U: 'W', R: 'R', F: 'G', D: 'Y', L: 'O', B: 'B' };
export const FACE_OF_COLOR: Record<Color, Face> = { W: 'U', R: 'R', G: 'F', Y: 'D', O: 'L', B: 'B' };
export const COLOR_HEX: Record<Color, string> = {
  W: '#FFFFFF', Y: '#FFD500', R: '#C41E3A', O: '#FF5800', G: '#009E60', B: '#0051BA',
};
export const COLOR_NAME: Record<Color, string> = {
  W: 'white', Y: 'yellow', R: 'red', O: 'orange', G: 'green', B: 'blue',
};
// Text color that reads on each sticker color.
export const TEXT_ON: Record<Color, string> = { W: '#1C1D22', Y: '#1C1D22', O: '#1C1D22', R: '#FFFFFF', G: '#FFFFFF', B: '#FFFFFF' };
export const CENTER_INDEX = [4, 13, 22, 31, 40, 49];

// Sticker positions of each corner and edge slot, U/D sticker first.
// Corners: UFR UFL UBL UBR, then DFR DFL DBL DBR.
export const CORNER_SLOTS = [
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
  [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
];
// Edges: UR UF UL UB, DR DF DL DB, FR FL BL BR.
export const EDGE_SLOTS = [
  [5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25],
  [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14],
];

// Each slot's home piece as the faces it touches, read in the same order as the slot's stickers.
// Corners go clockwise from the white or yellow sticker.
export const CORNER_PIECES: Face[][] = [
  ['U', 'R', 'F'], ['U', 'F', 'L'], ['U', 'L', 'B'], ['U', 'B', 'R'],
  ['D', 'F', 'R'], ['D', 'L', 'F'], ['D', 'B', 'L'], ['D', 'R', 'B'],
];
export const EDGE_PIECES: Face[][] = [
  ['U', 'R'], ['U', 'F'], ['U', 'L'], ['U', 'B'], ['D', 'R'], ['D', 'F'],
  ['D', 'L'], ['D', 'B'], ['F', 'R'], ['F', 'L'], ['B', 'L'], ['B', 'R'],
];

// Every way a piece can sit in a slot: the faces seen at each sticker position.
export function placements(piece: Face[], corner: boolean): Face[][] {
  if (!corner) return [piece, [piece[1], piece[0]]];
  return [0, 1, 2].map((ori) => [0, 1, 2].map((j) => piece[(j - ori + 3) % 3]));
}

// Which piece a slot's colors show, or null when a color is missing or no real piece looks like that.
export function pieceAt(stickers: (Color | null)[], pieces: Face[][], corner: boolean): number | null {
  if (stickers.some((c) => c === null)) return null;
  const faces = stickers.map((c) => FACE_OF_COLOR[c as Color]);
  const found = pieces.findIndex((p) => placements(p, corner).some((pl) => pl.every((f, k) => f === faces[k])));
  return found >= 0 ? found : null;
}

// Every corner and edge slot with the pieces that can sit in it.
export const PIECE_SLOTS = [
  ...CORNER_SLOTS.map((idx) => ({ idx, pieces: CORNER_PIECES, corner: true })),
  ...EDGE_SLOTS.map((idx) => ({ idx, pieces: EDGE_PIECES, corner: false })),
];

export const faceOf = (i: number) => Math.floor(i / 9);
export const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

type Vec = [number, number, number];

// Position and outward direction of each sticker. x points right, y up, z toward the viewer.
const FACE_GEOMETRY: Record<Face, { normal: Vec; pos: (r: number, c: number) => Vec }> = {
  U: { normal: [0, 1, 0], pos: (r, c) => [c - 1, 1, r - 1] },
  R: { normal: [1, 0, 0], pos: (r, c) => [1, 1 - r, 1 - c] },
  F: { normal: [0, 0, 1], pos: (r, c) => [c - 1, 1 - r, 1] },
  D: { normal: [0, -1, 0], pos: (r, c) => [c - 1, -1, 1 - r] },
  L: { normal: [-1, 0, 0], pos: (r, c) => [-1, 1 - r, c - 1] },
  B: { normal: [0, 0, -1], pos: (r, c) => [1 - c, 1 - r, -1] },
};

const STICKERS: Array<{ pos: Vec; normal: Vec }> = [];
for (const face of FACES) {
  const g = FACE_GEOMETRY[face];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) STICKERS.push({ pos: g.pos(r, c), normal: g.normal });
}
const keyOf = (pos: Vec, normal: Vec) => `${pos.join(',')}|${normal.join(',')}`;
const INDEX_BY_KEY = new Map(STICKERS.map((s, i) => [keyOf(s.pos, s.normal), i]));

// Quarter turn clockwise as seen looking at the face from outside: rotate -90 degrees about the axis.
function quarter(v: Vec, a: Vec): Vec {
  const cross: Vec = [a[1] * v[2] - a[2] * v[1], a[2] * v[0] - a[0] * v[2], a[0] * v[1] - a[1] * v[0]];
  const dot = a[0] * v[0] + a[1] * v[1] + a[2] * v[2];
  return [-cross[0] + a[0] * dot, -cross[1] + a[1] * dot, -cross[2] + a[2] * dot].map((n) => n + 0) as Vec;
}

// Each base move: the axis it turns around and which layers along that axis it moves.
const BASE: Record<string, { axis: Vec; layers: number[] }> = {
  U: { axis: [0, 1, 0], layers: [1] },
  D: { axis: [0, -1, 0], layers: [1] },
  R: { axis: [1, 0, 0], layers: [1] },
  L: { axis: [-1, 0, 0], layers: [1] },
  F: { axis: [0, 0, 1], layers: [1] },
  B: { axis: [0, 0, -1], layers: [1] },
  M: { axis: [-1, 0, 0], layers: [0] },
  E: { axis: [0, -1, 0], layers: [0] },
  S: { axis: [0, 0, 1], layers: [0] },
  x: { axis: [1, 0, 0], layers: [-1, 0, 1] },
  y: { axis: [0, 1, 0], layers: [-1, 0, 1] },
  z: { axis: [0, 0, 1], layers: [-1, 0, 1] },
};

// perm[i] = where the sticker at i goes after one clockwise quarter turn.
const PERMS: Record<string, number[]> = {};
for (const [name, { axis, layers }] of Object.entries(BASE)) {
  PERMS[name] = STICKERS.map((s, i) => {
    const depth = s.pos[0] * axis[0] + s.pos[1] * axis[1] + s.pos[2] * axis[2];
    if (!layers.includes(depth)) return i;
    const to = INDEX_BY_KEY.get(keyOf(quarter(s.pos, axis), quarter(s.normal, axis)));
    if (to === undefined) throw new Error(`bad geometry for ${name}`);
    return to;
  });
}

export function parseMoves(alg: string | string[]): string[] {
  const tokens = Array.isArray(alg) ? alg : alg.trim().split(/\s+/).filter(Boolean);
  return tokens.map((t) => t.replace('′', "'"));
}

function turn(state: string, base: string, times: number): string {
  const perm = PERMS[base];
  if (!perm) throw new Error(`Unknown move: ${base}`);
  let cur = state.split('');
  for (let t = 0; t < times; t++) {
    const next = cur.slice();
    perm.forEach((to, from) => { next[to] = cur[from]; });
    cur = next;
  }
  return cur.join('');
}

export function applyMoves(state: string, alg: string | string[]): string {
  let s = state;
  for (const move of parseMoves(alg)) {
    const base = move[0];
    const suffix = move.slice(1);
    const times = suffix === '' ? 1 : suffix === "'" ? 3 : suffix === '2' || suffix === "2'" ? 2 : NaN;
    if (Number.isNaN(times)) throw new Error(`Unknown move: ${move}`);
    s = turn(s, base, times);
  }
  return s;
}

export function invertMoves(alg: string | string[]): string[] {
  return parseMoves(alg).slice().reverse().map((m) => {
    if (m.endsWith('2') || m.endsWith("2'")) return m[0] + '2';
    return m.endsWith("'") ? m[0] : `${m}'`;
  });
}

// Solved means every side is one color, however the whole cube is turned.
export function isSolved(state: string): boolean {
  for (let f = 0; f < 6; f++) {
    const side = state.slice(f * 9, f * 9 + 9);
    if (side !== side[0].repeat(9)) return false;
  }
  return true;
}

export function fromColors(colors: Color[]): string {
  if (colors.length !== 54) throw new Error('A cube has 54 stickers');
  return colors.map((c) => FACE_OF_COLOR[c]).join('');
}

export function toColors(state: string): Color[] {
  return state.split('').map((f) => COLOR_OF_FACE[f as Face]);
}
