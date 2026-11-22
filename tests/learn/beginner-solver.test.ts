import { describe, expect, it } from 'vitest';
import Cube from 'cubejs';
import {
  CORNER_SLOTS, EDGE_SLOTS, FACES, SOLVED, applyMoves, faceOf, invertMoves, isSolved, sameSet,
} from '../../src/cube/facelets';
import { solveBeginner, type StagePlan } from '../../src/learn/beginner-solver';
import { STAGES, firstUnfinishedStage, stageDone, yellowCrossCase, type StageId } from '../../src/learn/stages';

const ORDER: StageId[] = [
  'white-cross', 'white-corners', 'middle-layer', 'yellow-cross',
  'yellow-edges', 'yellow-corners-place', 'yellow-corners-twist',
];
const WHOLE_CUBE = /^[xyz]/;

// Build a scan-frame cube (white on top, green in front) by doing `alg` while holding
// yellow on top, the way the later stages are taught.
const yellowUp = (alg: string) => applyMoves(SOLVED, ['z2', ...alg.split(' '), 'z2']);
const faceMoves = (plans: StagePlan[]) =>
  plans.flatMap((p) => p.subSteps.flatMap((s) => s.moves)).filter((m) => !WHOLE_CUBE.test(m)).length;
const stage = (plans: StagePlan[], id: StageId) => plans.find((p) => p.id === id)!;

function checkPlans(start: string, plans: StagePlan[]) {
  expect(plans.map((p) => p.id)).toEqual(ORDER);
  let state = start;
  plans.forEach((plan, i) => {
    expect(plan.startState).toBe(state);
    for (const sub of plan.subSteps) {
      expect(sub.moves.length).toBeGreaterThan(0);
      expect(sub.note.length).toBeGreaterThan(0);
      // A hold/turn-the-cube sub-step contains only whole-cube turns.
      const turns = sub.moves.filter((m) => WHOLE_CUBE.test(m)).length;
      expect(turns === 0 || turns === sub.moves.length).toBe(true);
      state = applyMoves(state, sub.moves);
    }
    expect(plan.endState).toBe(state);
    for (let j = 0; j <= i; j++) expect(stageDone(ORDER[j], state)).toBe(true);
  });
  expect(isSolved(state)).toBe(true);
}

describe('stage metadata', () => {
  it('lists the seven stages in order with a title and goal', () => {
    expect(STAGES.map((s) => s.id)).toEqual(ORDER);
    for (const s of STAGES) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.goal.length).toBeGreaterThan(0);
    }
  });

  it('a solved cube has every stage done, however it is held', () => {
    for (const turn of ['', 'z2', 'x', "y'", 'x z']) {
      const s = applyMoves(SOLVED, turn);
      for (const id of ORDER) expect(stageDone(id, s)).toBe(true);
      expect(firstUnfinishedStage(s)).toBeNull();
    }
  });

  it('stage goals are cumulative', () => {
    // These moves only disturb pieces off the white cross.
    const crossOnly = applyMoves(SOLVED, "R' D' R D2 F D F'");
    expect(stageDone('white-cross', crossOnly)).toBe(true);
    expect(stageDone('white-corners', crossOnly)).toBe(false);
    expect(stageDone('yellow-corners-twist', crossOnly)).toBe(false);
    expect(firstUnfinishedStage(crossOnly)).toBe('white-corners');
  });
});

describe('solveBeginner', () => {
  it('returns seven empty stages for a solved cube', () => {
    const plans = solveBeginner(SOLVED);
    checkPlans(SOLVED, plans);
    for (const p of plans) {
      expect(p.subSteps).toEqual([]);
      expect(p.hold).toBe('White on top, green facing you');
    }
  });

  it('an already-done white cross returns an empty stage', () => {
    const start = applyMoves(SOLVED, "R' D' R D2 F D F' L D2 L' B' D B");
    const plans = solveBeginner(start);
    checkPlans(start, plans);
    const cross = stage(plans, 'white-cross');
    expect(cross.subSteps).toEqual([]);
    expect(cross.note).toBe('Already done, nice!');
    // The flip to yellow-on-top opens the next stage.
    expect(stage(plans, 'white-corners').subSteps[0].moves).toEqual(['z2']);
  });

  describe('yellow cross cases', () => {
    const alg = "F R U R' U' F'";
    const line = yellowUp(invertMoves(alg).join(' '));
    const ell = yellowUp(`${invertMoves(alg).join(' ')} U ${invertMoves(alg).join(' ')}`);
    const dot = yellowUp(`${alg} U2 ${invertMoves(alg).join(' ')}`);

    it.each([
      ['line', line, 1],
      ['L', ell, 2],
      ['dot', dot, 3],
    ] as const)('recognizes the %s', (name, cube, algs) => {
      expect(firstUnfinishedStage(cube)).toBe('yellow-cross');
      expect(yellowCrossCase(cube)).toBe(name);
      const plans = solveBeginner(cube);
      checkPlans(cube, plans);
      const yc = stage(plans, 'yellow-cross');
      const runs = yc.subSteps.filter((s) => s.moves.join(' ') === alg).length;
      expect(runs).toBe(algs);
    });

    it('recognizes the finished cross', () => {
      expect(yellowCrossCase(SOLVED)).toBe('cross');
    });
  });

  it('twists just two corners when only two need it', () => {
    const twist = "R' D' R D R' D' R D";
    const cube = yellowUp(`${twist} U ${twist} ${twist} U'`);
    expect(firstUnfinishedStage(cube)).toBe('yellow-corners-twist');
    const plans = solveBeginner(cube);
    checkPlans(cube, plans);
    const tw = stage(plans, 'yellow-corners-twist');
    const twistSteps = tw.subSteps.filter((s) => s.moves.every((m) => /^[RD]/.test(m)));
    expect(twistSteps).toHaveLength(2);
    for (const p of plans.slice(0, 6)) expect(p.subSteps.filter((s) => !WHOLE_CUBE.test(s.moves[0]))).toEqual([]);
  });

  it('solves 1,000 random cubes stage by stage in under 200 face moves', () => {
    let max = 0;
    for (let i = 0; i < 1000; i++) {
      const start = Cube.random().asString();
      const plans = solveBeginner(start);
      checkPlans(start, plans);
      const n = faceMoves(plans);
      max = Math.max(max, n);
      expect(n).toBeLessThan(200);
    }
    console.log(`longest beginner solve: ${max} face moves (whole-cube turns not counted)`);
  }, 60_000);
});

describe('pieces named by each sub-step', () => {
  const REAL = new Set([...CORNER_SLOTS, ...EDGE_SLOTS].map((slot) => slot.map((i) => FACES[faceOf(i)]).sort().join('')));
  const ONE_PIECE: StageId[] = ['white-cross', 'white-corners', 'middle-layer', 'yellow-corners-place'];
  const YELLOW_EDGES = ['DR', 'DF', 'DL', 'DB'];

  it('every move sub-step names real pieces, and whole-cube turns name none', () => {
    for (let i = 0; i < 200; i++) {
      for (const plan of solveBeginner(Cube.random().asString())) {
        for (const sub of plan.subSteps) {
          if (sub.moves.every((m) => WHOLE_CUBE.test(m))) {
            expect(sub.pieces ?? []).toEqual([]);
            continue;
          }
          const pieces = sub.pieces ?? [];
          expect(pieces.length).toBeGreaterThan(0);
          expect(new Set(pieces).size).toBe(pieces.length);
          for (const p of pieces) expect(REAL.has(p.split('').sort().join(''))).toBe(true);
          if (ONE_PIECE.includes(plan.id)) expect(pieces).toHaveLength(1);
          if (plan.id === 'yellow-cross' || plan.id === 'yellow-edges') expect(sameSet(pieces, YELLOW_EDGES)).toBe(true);
          if (plan.id === 'yellow-corners-twist' && sub.moves.length > 1) expect(pieces).toHaveLength(1);
        }
      }
    }
  });

  it('a white cross sub-step names the edge it brings home', () => {
    const start = Cube.random().asString();
    let state = start;
    for (const sub of solveBeginner(start)[0].subSteps) {
      state = applyMoves(state, sub.moves);
      const [edge] = sub.pieces!;
      const slot = EDGE_SLOTS.find((e) => sameSet(e.map((i) => FACES[faceOf(i)]), edge.split('')))!;
      expect(slot.map((i) => state[i]).join('')).toBe(slot.map((i) => FACES[faceOf(i)]).join(''));
    }
  });
});
