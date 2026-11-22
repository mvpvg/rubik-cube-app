// The seven stages of the beginner (layer-by-layer) method: what each one is called, the goal
// the child reads, how to check that goal on a cube, and the moves each stage teaches.
// Goal checks find the white and yellow centers first, so they work however the cube is held.

import { COLOR_NAME, COLOR_OF_FACE, CORNER_SLOTS, EDGE_SLOTS, faceOf, sameSet, type Face } from '../cube/facelets';

export { CORNER_SLOTS, EDGE_SLOTS, faceOf, sameSet };

export type StageId =
  | 'white-cross'
  | 'white-corners'
  | 'middle-layer'
  | 'yellow-cross'
  | 'yellow-edges'
  | 'yellow-corners-place'
  | 'yellow-corners-twist';

export interface StageInfo {
  id: StageId;
  title: string;
  goal: string;
}

export const STAGES: readonly StageInfo[] = [
  { id: 'white-cross', title: 'White cross', goal: 'Make a white cross on top, with each edge matching the center next to it.' },
  { id: 'white-corners', title: 'White corners', goal: 'Put the four white corners in, so the whole white side is done.' },
  { id: 'middle-layer', title: 'Middle layer', goal: 'Put the four middle edges in, so the bottom two layers are done.' },
  { id: 'yellow-cross', title: 'Yellow cross', goal: 'Make a yellow cross on top.' },
  { id: 'yellow-edges', title: 'Yellow edges', goal: 'Turn the yellow edges so each one matches the center below it.' },
  { id: 'yellow-corners-place', title: 'Yellow corners: places', goal: 'Move each yellow corner to its own spot, even if it is twisted.' },
  { id: 'yellow-corners-twist', title: 'Yellow corners: twist', goal: 'Twist the yellow corners so the whole cube is solved.' },
];

// The beginner algorithms, in standard notation.
export const ALGS = {
  cornerInsert: "R U R' U'",
  middleRight: "U R U' R' U' F' U F",
  middleLeft: "U' L' U L U F U' F'",
  yellowCross: "F R U R' U' F'",
  yellowEdges: "R U R' U R U2 R' U",
  cornerPlace: "U R U' L' U R' U' L",
  cornerTwist: "R' D' R D",
} as const;

const WHITE = 'U';
const YELLOW = 'D';

export const centerOf = (state: string, i: number) => state[faceOf(i) * 9 + 4];
export const stickerOk = (state: string, i: number) => state[i] === centerOf(state, i);
export const colorName = (c: string) => COLOR_NAME[COLOR_OF_FACE[c as Face]];

function centerFace(state: string, color: string): number {
  for (let f = 0; f < 6; f++) if (state[f * 9 + 4] === color) return f;
  throw new Error(`No ${colorName(color)} center`);
}

const touches = (slot: number[], face: number) => slot.some((i) => faceOf(i) === face);
const allOk = (state: string, slots: number[][]) => slots.every((slot) => slot.every((i) => stickerOk(state, i)));

const GOALS: Record<StageId, (state: string) => boolean> = {
  'white-cross': (s) => {
    const w = centerFace(s, WHITE);
    return allOk(s, EDGE_SLOTS.filter((e) => touches(e, w)));
  },
  'white-corners': (s) => {
    const w = centerFace(s, WHITE);
    return allOk(s, CORNER_SLOTS.filter((c) => touches(c, w)));
  },
  'middle-layer': (s) => {
    const w = centerFace(s, WHITE);
    const y = centerFace(s, YELLOW);
    return allOk(s, EDGE_SLOTS.filter((e) => !touches(e, w) && !touches(e, y)));
  },
  'yellow-cross': (s) => {
    const y = centerFace(s, YELLOW);
    return EDGE_SLOTS.filter((e) => touches(e, y)).every((e) => e.every((i) => faceOf(i) !== y || stickerOk(s, i)));
  },
  'yellow-edges': (s) => {
    const y = centerFace(s, YELLOW);
    return allOk(s, EDGE_SLOTS.filter((e) => touches(e, y)));
  },
  'yellow-corners-place': (s) => {
    const y = centerFace(s, YELLOW);
    return CORNER_SLOTS.filter((c) => touches(c, y)).every((c) => sameSet(c.map((i) => s[i]), c.map((i) => centerOf(s, i))));
  },
  'yellow-corners-twist': (s) => {
    const y = centerFace(s, YELLOW);
    return allOk(s, CORNER_SLOTS.filter((c) => touches(c, y)));
  },
};

// Goals build on each other: a stage is done only when it and every stage before it are done.
export function stageDone(id: StageId, state: string): boolean {
  for (const stage of STAGES) {
    if (!GOALS[stage.id](state)) return false;
    if (stage.id === id) return true;
  }
  return false;
}

export function firstUnfinishedStage(state: string): StageId | null {
  for (const stage of STAGES) if (!GOALS[stage.id](state)) return stage.id;
  return null;
}

export type YellowCrossCase = 'dot' | 'L' | 'line' | 'cross';

// Which yellow-cross shape the yellow side shows, counting only its edge stickers.
export function yellowCrossCase(state: string): YellowCrossCase {
  const y = centerFace(state, YELLOW);
  const up = (k: number) => state[y * 9 + k] === YELLOW;
  const n = [1, 3, 5, 7].filter(up).length;
  if (n === 4) return 'cross';
  if (n === 0) return 'dot';
  return (up(1) && up(7)) || (up(3) && up(5)) ? 'line' : 'L';
}
