// Solves a cube with the beginner (layer-by-layer) method, one stage at a time, and splits each
// stage into small sub-steps a child can follow. The white cross is built with white on top;
// the cube is then flipped so yellow is on top for every later stage.

import { applyMoves, invertMoves, parseMoves } from '../cube/facelets';
import {
  ALGS, CORNER_SLOTS, EDGE_SLOTS, STAGES, centerOf, colorName, sameSet, stageDone, stickerOk,
  type StageId,
} from './stages';

export type { StageId } from './stages';
export { STAGES, firstUnfinishedStage, stageDone } from './stages';

export interface SubStep {
  note: string;
  moves: string[];
}

export interface StagePlan {
  id: StageId;
  title: string;
  goal: string;
  hold: string;
  // "Already done, nice!" when the stage needs no moves.
  note: string;
  subSteps: SubStep[];
  startState: string;
  endState: string;
}

const Y_TURNS = ['', 'y', 'y2', "y'"];
const U_TURNS = ['', 'U', 'U2', "U'"];
const FACE_MOVES = ['U', 'R', 'F', 'D', 'L', 'B'].flatMap((f) => [f, `${f}'`, `${f}2`]);
const UFR = 0;
const DFR = 4;
const UF = 1;
const FR = 8;
const TOP_CORNERS = [0, 1, 2, 3];
const BOTTOM_CORNERS = [4, 5, 6, 7];
const TOP_EDGES = [0, 1, 2, 3];
const MIDDLE_EDGES = [8, 9, 10, 11];
// Most pieces go in with one choice each; this bound on choices in a row only catches a bug.
const MAX_PASSES = 12;

const apply = (state: string, moves: string | string[]) => (moves.length ? applyMoves(state, moves) : state);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const colorsAt = (state: string, slot: number[]) => slot.map((i) => state[i]);
const frontColor = (state: string) => colorName(state[22]);

function holdText(state: string): string {
  return `${cap(colorName(state[4]))} on top, ${colorName(state[22])} facing you`;
}

function stuck(stage: string): never {
  throw new Error(`Beginner solver made no progress on the ${stage}`);
}

class Steps {
  list: SubStep[] = [];
  constructor(public state: string) {}

  add(note: string, moves: string[]) {
    const real = moves.filter(Boolean);
    if (!real.length) return;
    this.list.push({ note, moves: real });
    this.state = apply(this.state, real);
  }

  // Turn the whole cube (y turns) until `ok` holds; ok must hold for one of the four turns.
  turnCubeUntil(ok: (s: string) => boolean, note = (s: string) => `Turn the whole cube so the ${frontColor(s)} center faces you`) {
    const t = Y_TURNS.find((r) => ok(apply(this.state, r)));
    if (t === undefined) stuck('cube turn');
    if (t) this.add(note(apply(this.state, t)), [t]);
  }
}

// ---------- White cross: one edge at a time, each by the shortest move sequence. ----------

// Every edge sticker position, as slot * 2 + which of its two stickers.
const EDGE_POS_OF_STICKER = new Map<number, number>();
EDGE_SLOTS.forEach((slot, e) => slot.forEach((i, o) => EDGE_POS_OF_STICKER.set(i, e * 2 + o)));

// Where each move sends an edge position (slot and flip together).
const EDGE_MOVE: number[][] = FACE_MOVES.map((m) => {
  const labels = Array.from({ length: 54 }, (_, i) => String.fromCharCode(0x100 + i)).join('');
  const after = applyMoves(labels, m);
  return Array.from({ length: 24 }, (_, p) => {
    const sticker = EDGE_SLOTS[p >> 1][p & 1];
    return EDGE_POS_OF_STICKER.get(after.indexOf(labels[sticker]))!;
  });
});

// The white edges, in the scan frame: white-red goes to UR, white-green to UF, and so on.
// Edge k's home is slot k with its white sticker up, which is position 2k.
const CROSS_COLORS = ['R', 'F', 'L', 'B'];

// Distance tables: for a set of white edges, how many moves until all of them are home.
const crossTables = new Map<number, Int8Array>();

function crossTable(mask: number): Int8Array {
  const cached = crossTables.get(mask);
  if (cached) return cached;
  const edges = [0, 1, 2, 3].filter((k) => mask & (1 << k));
  const size = 24 ** edges.length;
  const dist = new Int8Array(size).fill(-1);
  const goal = edges.reduce((acc, k, j) => acc + 2 * k * 24 ** j, 0);
  dist[goal] = 0;
  let frontier = [goal];
  for (let d = 0; frontier.length; d++) {
    const next: number[] = [];
    for (const idx of frontier) {
      for (const table of EDGE_MOVE) {
        let n = 0;
        for (let j = 0, rest = idx, w = 1; j < edges.length; j++, rest = Math.floor(rest / 24), w *= 24) {
          n += table[rest % 24] * w;
        }
        if (dist[n] < 0) {
          dist[n] = d + 1;
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  crossTables.set(mask, dist);
  return dist;
}

function whiteEdgePositions(state: string): number[] {
  return CROSS_COLORS.map((c) => {
    for (let e = 0; e < 12; e++) {
      const [a, b] = EDGE_SLOTS[e];
      if (state[a] === 'U' && state[b] === c) return e * 2;
      if (state[b] === 'U' && state[a] === c) return e * 2 + 1;
    }
    throw new Error('White edge not found');
  });
}

const indexOf = (pos: number[], mask: number) =>
  [0, 1, 2, 3].filter((k) => mask & (1 << k)).reduce((acc, k, j) => acc + pos[k] * 24 ** j, 0);

function solveWhiteCross(steps: Steps) {
  if (steps.state[4] !== 'U' || steps.state[22] !== 'F') {
    throw new Error('The white cross starts with white on top and green in front');
  }
  for (let pass = 0; ; pass++) {
    if (pass > 4) stuck('white cross');
    let pos = whiteEdgePositions(steps.state);
    const homeMask = [0, 1, 2, 3].reduce((m, k) => (pos[k] === 2 * k ? m | (1 << k) : m), 0);
    if (homeMask === 15) return;
    // Next edge: the one that is quickest to bring home without moving the ones already home.
    let best = -1;
    let bestDist = Infinity;
    for (let k = 0; k < 4; k++) {
      if (homeMask & (1 << k)) continue;
      const d = crossTable(homeMask | (1 << k))[indexOf(pos, homeMask | (1 << k))];
      if (d < bestDist) { best = k; bestDist = d; }
    }
    const mask = homeMask | (1 << best);
    const table = crossTable(mask);
    const moves: string[] = [];
    for (let d = bestDist; d > 0; d--) {
      const m = FACE_MOVES.findIndex((_, i) => table[indexOf(pos.map((p) => EDGE_MOVE[i][p]), mask)] === d - 1);
      moves.push(FACE_MOVES[m]);
      pos = pos.map((p) => EDGE_MOVE[m][p]);
    }
    const color = colorName(CROSS_COLORS[best]);
    steps.add(`Bring the white-${color} edge to the top: white up, ${color} next to the ${color} center`, moves);
  }
}

// ---------- White corners (yellow on top, white on the bottom). ----------

const cornerSolved = (s: string, slot: number) => CORNER_SLOTS[slot].every((i) => stickerOk(s, i));
const centersAt = (s: string, slot: number[]) => slot.map((i) => centerOf(s, i));

// How to repeat `alg` until `done` holds: forwards, or backwards when that is shorter
// (four forward runs are the same as two backward runs, five the same as one).
interface Repeats { moves: string[]; say: string }

function repeatsUntil(state: string, alg: string, done: (s: string) => boolean): Repeats {
  const count = (moves: string[]) => {
    let s = state;
    for (let n = 0; n <= 5; n++) {
      if (done(s)) return n;
      s = applyMoves(s, moves);
    }
    return Infinity;
  };
  const fwd = parseMoves(alg);
  const back = invertMoves(fwd);
  const nf = count(fwd);
  const nb = count(back);
  if (!Number.isFinite(Math.min(nf, nb))) stuck(`repeats of ${alg}`);
  const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
  return nf <= nb
    ? { moves: repeat(fwd, nf), say: `Do ${alg} ${times(nf)}` }
    : { moves: repeat(back, nb), say: `Do ${alg} backwards ${times(nb)}: ${back.join(' ')}` };
}

const repeat = (moves: string[], n: number) => Array.from({ length: n }, () => moves).flat();

const faceMoveCount = (list: SubStep[]) => list.reduce((n, sub) => n + sub.moves.filter((m) => !/^[xyz]/.test(m)).length, 0);

// The white-corner and middle-layer stages put in one piece at a time. Each pass offers a few
// beginner-method choices (which piece next, or which stuck piece to lift out); this picks the
// sequence of choices with the fewest face moves.
function solveCheapest(steps: Steps, stage: string, done: (s: string) => boolean, options: (s: string) => Steps[]) {
  const memo = new Map<string, { cost: number; list: SubStep[] }>();
  const best = (s: string, depth: number): { cost: number; list: SubStep[] } => {
    if (done(s)) return { cost: 0, list: [] };
    if (depth > MAX_PASSES) return { cost: Infinity, list: [] };
    const known = memo.get(s);
    if (known) return known;
    let result = { cost: Infinity, list: [] as SubStep[] };
    for (const option of options(s)) {
      const rest = best(option.state, depth + 1);
      const cost = faceMoveCount(option.list) + rest.cost;
      if (cost < result.cost) result = { cost, list: [...option.list, ...rest.list] };
    }
    memo.set(s, result);
    return result;
  };
  const plan = best(steps.state, 0);
  if (!Number.isFinite(plan.cost)) stuck(stage);
  for (const sub of plan.list) steps.add(sub.note, sub.moves);
}

// ---------- White corners (yellow on top, white on the bottom). ----------

function whiteCornerOptions(s: string): Steps[] {
  // A white corner on top: bring it over its spot and repeat R U R' U' until it drops in.
  const top = TOP_CORNERS.map((slot) => colorsAt(s, CORNER_SLOTS[slot])).filter((c) => c.includes('U'));
  if (top.length) {
    return top.map((colors) => {
      const name = colors.map(colorName).join('-');
      const steps = new Steps(s);
      steps.turnCubeUntil((x) => sameSet(centersAt(x, CORNER_SLOTS[DFR]), colors),
        (x) => `Turn the whole cube so the ${name} corner's spot is at the bottom front right, ${frontColor(x)} facing you`);
      const up = U_TURNS.find((u) => sameSet(colorsAt(apply(steps.state, u), CORNER_SLOTS[UFR]), colors))!;
      steps.add(`Turn the top until the ${name} corner sits right above its spot`, [up]);
      const reps = repeatsUntil(steps.state, ALGS.cornerInsert, (x) => cornerSolved(x, DFR));
      steps.add(`${reps.say}, until the corner drops in with white on the bottom`, reps.moves);
      return steps;
    });
  }
  // No white corner on top: one is in the bottom layer, in the wrong spot or twisted.
  return BOTTOM_CORNERS.filter((c) => !cornerSolved(s, c)).map((slot) => {
    const colors = colorsAt(s, CORNER_SLOTS[slot]);
    const name = colors.map(colorName).join('-');
    const steps = new Steps(s);
    steps.turnCubeUntil((x) => sameSet(colorsAt(x, CORNER_SLOTS[DFR]), colors),
      (x) => `Turn the whole cube so the ${name} corner is at the bottom front right, ${frontColor(x)} facing you`);
    if (sameSet(centersAt(steps.state, CORNER_SLOTS[DFR]), colors)) {
      const reps = repeatsUntil(steps.state, ALGS.cornerInsert, (x) => cornerSolved(x, DFR));
      steps.add(`This corner is in its spot but twisted. ${reps.say}, until white is on the bottom`, reps.moves);
    } else {
      steps.add(`This corner is in the wrong spot. Do ${ALGS.cornerInsert} once to lift it to the top`, parseMoves(ALGS.cornerInsert));
    }
    return steps;
  });
}

function solveWhiteCorners(steps: Steps) {
  solveCheapest(steps, 'white corners', (s) => BOTTOM_CORNERS.every((c) => cornerSolved(s, c)), whiteCornerOptions);
}

// ---------- Middle layer. ----------

const edgeSolved = (s: string, slot: number) => EDGE_SLOTS[slot].every((i) => stickerOk(s, i));
const isMiddlePiece = (colors: string[]) => !colors.includes('U') && !colors.includes('D');

function middleEdgeOptions(s: string): Steps[] {
  // A middle edge on top: line it up with its front center, then send it right or left.
  const top = TOP_EDGES.map((slot) => colorsAt(s, EDGE_SLOTS[slot])).filter(isMiddlePiece);
  if (top.length) {
    return top.map(([up, side]) => {
      const name = `${colorName(side)}-${colorName(up)}`;
      const steps = new Steps(s);
      steps.turnCubeUntil((x) => x[22] === side);
      const turn = U_TURNS.find((u) => {
        const x = apply(steps.state, u);
        return x[EDGE_SLOTS[UF][0]] === up && x[EDGE_SLOTS[UF][1]] === side;
      })!;
      steps.add(`Turn the top until the ${name} edge sits above the ${colorName(side)} center`, [turn]);
      if (steps.state[13] === up) {
        steps.add(`The edge goes down to the right: ${ALGS.middleRight}`, parseMoves(ALGS.middleRight));
      } else {
        steps.add(`The edge goes down to the left: ${ALGS.middleLeft}`, parseMoves(ALGS.middleLeft));
      }
      return steps;
    });
  }
  // Every top edge has yellow, so a middle edge is stuck in the wrong slot or flipped.
  return MIDDLE_EDGES.filter((e) => !edgeSolved(s, e)).map((slot) => {
    const colors = colorsAt(s, EDGE_SLOTS[slot]);
    const name = colors.map(colorName).join('-');
    const steps = new Steps(s);
    steps.turnCubeUntil((x) => sameSet(colorsAt(x, EDGE_SLOTS[FR]), colors),
      (x) => `Turn the whole cube so the ${name} edge is at the front right, ${frontColor(x)} facing you`);
    steps.add(`This edge is stuck. Do the right-hand moves once to lift it to the top: ${ALGS.middleRight}`,
      parseMoves(ALGS.middleRight));
    return steps;
  });
}

function solveMiddleLayer(steps: Steps) {
  solveCheapest(steps, 'middle layer', (s) => MIDDLE_EDGES.every((e) => edgeSolved(s, e)), middleEdgeOptions);
}

// ---------- Yellow cross. ----------

const yellowUp = (s: string, k: number) => s[k] === 'D';
const yellowEdgesUp = (s: string) => [1, 3, 5, 7].filter((k) => yellowUp(s, k));

function solveYellowCross(steps: Steps) {
  for (let pass = 0; ; pass++) {
    if (pass > 3) stuck('yellow cross');
    const up = yellowEdgesUp(steps.state);
    if (up.length === 4) return;
    if (up.length === 0) {
      steps.add(`You have a yellow dot. Do ${ALGS.yellowCross} to make an L`, parseMoves(ALGS.yellowCross));
    } else if (yellowUp(steps.state, 3) === yellowUp(steps.state, 5) && yellowUp(steps.state, 1) === yellowUp(steps.state, 7)) {
      const turn = U_TURNS.find((u) => yellowUp(apply(steps.state, u), 3) && yellowUp(apply(steps.state, u), 5))!;
      steps.add('You have a yellow line. Turn the top so the line goes left to right', [turn]);
      steps.add(`Do ${ALGS.yellowCross} to finish the cross`, parseMoves(ALGS.yellowCross));
    } else {
      const turn = U_TURNS.find((u) => yellowUp(apply(steps.state, u), 1) && yellowUp(apply(steps.state, u), 3))!;
      steps.add('You have a yellow L. Turn the top so the L points to the back and the left', [turn]);
      steps.add(`Do ${ALGS.yellowCross} to make a line`, parseMoves(ALGS.yellowCross));
    }
  }
}

// ---------- Yellow edges. ----------

const edgeMatches = (s: string) => TOP_EDGES.filter((e) => stickerOk(s, EDGE_SLOTS[e][1]));
const bestTopTurn = (s: string) =>
  U_TURNS.reduce((a, b) => (edgeMatches(apply(s, b)).length > edgeMatches(apply(s, a)).length ? b : a));

function solveYellowEdges(steps: Steps) {
  for (let pass = 0; ; pass++) {
    if (pass > 4) stuck('yellow edges');
    const up = bestTopTurn(steps.state);
    if (edgeMatches(apply(steps.state, up)).length === 4) {
      steps.add('Turn the top until every yellow edge matches the center below it', [up]);
      return;
    }
    steps.add('Turn the top until two yellow edges match the centers below them', [up]);
    const matched = edgeMatches(steps.state);
    // UF and UL are the edges the moves swap; matched edges next to each other go at the back and right.
    const adjacent = !(matched.includes(0) && matched.includes(2)) && !(matched.includes(1) && matched.includes(3));
    if (adjacent) {
      steps.turnCubeUntil((x) => sameSet(edgeMatches(x).map(String), ['0', '3']),
        () => 'Turn the whole cube so the two matching edges are at the back and on the right');
      steps.add(`Do ${ALGS.yellowEdges} to swap the front and left edges`, parseMoves(ALGS.yellowEdges));
    } else {
      steps.add(`The matching edges are across from each other. Do ${ALGS.yellowEdges} once, then look again`,
        parseMoves(ALGS.yellowEdges));
    }
  }
}

// ---------- Yellow corners: places. ----------

const cornerPlaced = (s: string, slot: number) => sameSet(colorsAt(s, CORNER_SLOTS[slot]), centersAt(s, CORNER_SLOTS[slot]));

function placeYellowCorners(steps: Steps) {
  for (let pass = 0; ; pass++) {
    if (pass > 4) stuck('yellow corner places');
    const placed = TOP_CORNERS.filter((c) => cornerPlaced(steps.state, c));
    if (placed.length === 4) return;
    if (placed.length) {
      steps.turnCubeUntil((x) => cornerPlaced(x, UFR),
        () => 'Turn the whole cube so the corner already in its spot is at the top front right');
      const reps = repeatsUntil(steps.state, ALGS.cornerPlace, (x) => TOP_CORNERS.every((c) => cornerPlaced(x, c)));
      steps.add(`Keep that corner at the front right. ${reps.say}, and every corner is in its spot`, reps.moves);
    } else {
      steps.add(`No yellow corner is in its spot yet. Do ${ALGS.cornerPlace} once, then look again`, parseMoves(ALGS.cornerPlace));
    }
  }
}

// ---------- Yellow corners: twist. Hold the cube still and only turn the top between corners. ----------

function twistYellowCorners(steps: Steps) {
  for (let pass = 0; ; pass++) {
    if (pass > 8) stuck('yellow corner twist');
    const s = steps.state;
    const twisted = U_TURNS.find((u) => !yellowUp(apply(s, u), CORNER_SLOTS[UFR][0]));
    if (twisted === undefined) {
      const finish = U_TURNS.find((u) => stageDone('yellow-corners-twist', apply(s, u)));
      if (finish === undefined) stuck('yellow corner twist');
      steps.add('Turn the top to finish your cube!', [finish]);
      return;
    }
    steps.add('Turn only the top so a twisted yellow corner is at the front right', [twisted]);
    const reps = repeatsUntil(steps.state, ALGS.cornerTwist, (x) => yellowUp(x, CORNER_SLOTS[UFR][0]));
    steps.add(`${reps.say}, until yellow is on top. The bottom gets messy, that's OK!`, reps.moves);
  }
}

const SOLVERS: Record<StageId, (steps: Steps) => void> = {
  'white-cross': solveWhiteCross,
  'white-corners': solveWhiteCorners,
  'middle-layer': solveMiddleLayer,
  'yellow-cross': solveYellowCross,
  'yellow-edges': solveYellowEdges,
  'yellow-corners-place': placeYellowCorners,
  'yellow-corners-twist': twistYellowCorners,
};

// `state` must be in the scan frame: white center on top, green center in front.
export function solveBeginner(state: string): StagePlan[] {
  let current = state;
  // After the white cross the cube is flipped; the flip opens the next stage that has moves.
  let flip: SubStep | null = null;
  return STAGES.map(({ id, title, goal }) => {
    const startState = current;
    const steps = new Steps(flip ? apply(current, flip.moves) : current);
    if (!stageDone(id, steps.state)) {
      SOLVERS[id](steps);
      if (!stageDone(id, steps.state)) stuck(title);
    }
    const hold = holdText(startState);
    if (id === 'white-cross' && steps.state[4] === 'U') {
      flip = { note: 'Flip your cube over: yellow on top, white on the bottom', moves: ['z2'] };
    }
    if (!steps.list.length) {
      return { id, title, goal, hold, note: 'Already done, nice!', subSteps: [], startState, endState: startState };
    }
    const subSteps = id !== 'white-cross' && flip ? [flip, ...steps.list] : steps.list;
    if (id !== 'white-cross') flip = null;
    current = steps.state;
    return { id, title, goal, hold, note: STAGE_NOTES[id], subSteps, startState, endState: current };
  });
}

const STAGE_NOTES: Record<StageId, string> = {
  'white-cross': 'Do one white edge at a time.',
  'white-corners': 'Do one white corner at a time.',
  'middle-layer': 'Do one middle edge at a time.',
  'yellow-cross': 'Look at the yellow side: dot, L, line, or cross?',
  'yellow-edges': 'Make the yellow edges match the centers below them.',
  'yellow-corners-place': 'Get every yellow corner into its own spot.',
  'yellow-corners-twist': 'Twist each yellow corner until yellow is on top.',
};
