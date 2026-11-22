import { describe, expect, it } from 'vitest';
import Cube from 'cubejs';
import { CORNER_SLOTS, EDGE_SLOTS, FACES, SOLVED, applyMoves, faceOf, isSolved } from '../../src/cube/facelets';
import { solveBeginner } from '../../src/learn/beginner-solver';
import { HOLD_NOTE, createHinter, type Hint, type HintStep } from '../../src/learn/hint';
import { STAGES, firstUnfinishedStage, stageDone } from '../../src/learn/stages';

const WHOLE_CUBE = /^[xyz]/;
const ROTATIONS = ['y', "y'", 'y2', 'x', "x'", 'x2', 'z', "z'", 'z2', 'x y', "z y'", "x' y2", 'z2 y'];
const FACE_MOVES = FACES.flatMap((f) => [f, `${f}'`, `${f}2`]);
const PIECES = new Set([...CORNER_SLOTS, ...EDGE_SLOTS].map((slot) => slot.map((i) => FACES[faceOf(i)]).sort().join('')));
const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const inScanFrame = (s: string) => s[4] === 'U' && s[22] === 'F';

function checkStep(h: Hint): HintStep {
  expect(h.kind).toBe('step');
  const step = h as HintStep;
  expect(step.stageId).toBe(STAGES[step.stageIndex].id);
  expect(step.title).toBe(STAGES[step.stageIndex].title);
  expect(step.note.length).toBeGreaterThan(0);
  expect(step.moves.length).toBeGreaterThan(0);
  const turns = step.moves.filter((m) => WHOLE_CUBE.test(m)).length;
  if (turns === step.moves.length) {
    expect(step.pieces).toEqual([]);
  } else {
    expect(turns).toBe(0);
    expect(step.pieces.length).toBeGreaterThan(0);
    for (const p of step.pieces) expect(PIECES.has(p.split('').sort().join(''))).toBe(true);
  }
  return step;
}

// Taps Hint and does its moves until the cube is solved; returns how many hints it took.
function followHints(start: string, hinter = createHinter(), onStep?: (step: HintStep, before: string) => void): number {
  let state = start;
  for (let n = 0; n <= 60; n++) {
    const h = hinter.next(state);
    if (h.kind === 'solved') {
      expect(isSolved(state)).toBe(true);
      return n;
    }
    const step = checkStep(h);
    onStep?.(step, state);
    state = applyMoves(state, step.moves);
  }
  throw new Error('More than 60 hints');
}

describe('hint', () => {
  it('a solved cube is already solved, however it is held', () => {
    expect(createHinter().next(SOLVED)).toEqual({ kind: 'solved' });
    expect(createHinter().next(applyMoves(SOLVED, 'x y'))).toEqual({ kind: 'solved' });
  });

  it('a cube with only the white cross done gets a white corners hint', () => {
    const crossOnly = applyMoves(SOLVED, "R' D' R D2 F D F'");
    expect(checkStep(createHinter().next(crossOnly)).stageId).toBe('white-corners');
    const start = Cube.random().asString();
    const afterCross = solveBeginner(start)[0].endState;
    expect(stageDone('white-corners', afterCross)).toBe(false);
    const step = checkStep(createHinter().next(afterCross));
    expect(step.stageId).toBe('white-corners');
    expect(step.stageIndex).toBe(1);
  });

  it('following hints solves 1,000 random cubes within 60 hints, never going back a stage', () => {
    let max = 0;
    for (let i = 0; i < 1000; i++) {
      let stage = 0;
      const n = followHints(Cube.random().asString(), createHinter(), (step) => {
        expect(step.stageIndex).toBeGreaterThanOrEqual(stage);
        stage = step.stageIndex;
      });
      max = Math.max(max, n);
    }
    console.log(`most hints for one cube: ${max}`);
  }, 60_000);

  it('a cube held the wrong way first gets the hold-your-cube hint, then solves within 60 hints', () => {
    let max = 0;
    for (let i = 0; i < 1000; i++) {
      const start = applyMoves(Cube.random().asString(), pick(ROTATIONS));
      expect(stageDone('white-cross', start)).toBe(false);
      const hinter = createHinter();
      const hold = checkStep(hinter.next(start));
      expect(hold.note).toBe(HOLD_NOTE);
      expect(hold.stageId).toBe('white-cross');
      expect(hold.pieces).toEqual([]);
      expect(hold.moves.every((m) => WHOLE_CUBE.test(m))).toBe(true);
      expect(inScanFrame(applyMoves(start, hold.moves))).toBe(true);
      max = Math.max(max, followHints(start, hinter));
    }
    console.log(`most hints for one turned cube: ${max}`);
  }, 60_000);

  it('in the middle of the corner twist the next hint is still a twist step', () => {
    let checked = 0;
    let lowerLayersBroken = 0;
    for (let i = 0; i < 100; i++) {
      let afterTwist: string | null = null;
      const hinter = createHinter();
      followHints(Cube.random().asString(), hinter, (step, before) => {
        if (afterTwist === before) {
          expect(step.stageId).toBe('yellow-corners-twist');
          checked++;
          if (firstUnfinishedStage(before) !== 'yellow-corners-twist') lowerLayersBroken++;
        }
        const twists = step.stageId === 'yellow-corners-twist' && step.moves.some((m) => m[0] === 'D');
        afterTwist = twists ? applyMoves(before, step.moves) : null;
      });
    }
    expect(checked).toBeGreaterThan(0);
    // Mid-twist the bottom is messy, so solving again from scratch would start over.
    expect(lowerLayersBroken).toBeGreaterThan(0);
  }, 30_000);

  it('partway through a step, the next hint keeps going forward instead of starting over', () => {
    let checked = 0;
    for (let i = 0; i < 100; i++) {
      const hinter = createHinter();
      let state = Cube.random().asString();
      for (let n = 0; n < 60 && !isSolved(state); n++) {
        const hint = hinter.next(state) as HintStep;
        if (hint.moves.length >= 2 && hint.note !== HOLD_NOTE) {
          const part = applyMoves(state, hint.moves.slice(0, 1));
          const again = hinter.next(part) as HintStep;
          expect(again.stageIndex).toBeGreaterThanOrEqual(hint.stageIndex);
          expect(again.note).not.toBe(HOLD_NOTE);
          expect(again.moves.length).toBeGreaterThan(0);
          // Following on from there still solves the cube.
          expect(followHints(part, hinter)).toBeLessThanOrEqual(60);
          checked++;
        }
        state = applyMoves(state, hint.moves);
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('after an unrelated move the hint solves again from the new cube, and still finishes', () => {
    for (let i = 0; i < 200; i++) {
      const hinter = createHinter();
      const path: string[] = [];
      const onPlan = new Set<string>();
      followHints(Cube.random().asString(), hinter, (step, before) => {
        path.push(before);
        let cube = before;
        for (const m of step.moves) { onPlan.add(cube); cube = applyMoves(cube, [m]); }
      });
      // Stop somewhere along the plan and make a move that leaves it.
      const state = pick(path);
      const offPlan = FACE_MOVES.map((m) => applyMoves(state, m)).filter((s) => !onPlan.has(s) && !isSolved(s));
      const moved = pick(offPlan);
      expect(hinter.next(moved)).toEqual(createHinter().next(moved));
      followHints(moved, hinter);
    }
  }, 30_000);

  it('going back to a cube the plan passed through picks the plan up there', () => {
    const hinter = createHinter();
    const path: Array<{ before: string; step: HintStep }> = [];
    followHints(Cube.random().asString(), hinter, (step, before) => path.push({ before, step }));
    for (const { before, step } of path) expect(hinter.next(before)).toEqual(step);
  });

  it('a whole-cube turn that puts white on a side after the cross still gets a hint', () => {
    const afterCross = solveBeginner(Cube.random().asString())[0].endState;
    for (const turn of ['x', "z'", 'x y']) {
      const start = applyMoves(afterCross, turn);
      const hold = checkStep(createHinter().next(start));
      expect(hold.note).toBe(HOLD_NOTE);
      expect(inScanFrame(applyMoves(start, hold.moves))).toBe(true);
      followHints(start);
    }
  });

  it('hands out copies, so changing a hint does not change the stored plan', () => {
    const start = Cube.random().asString();
    const hinter = createHinter();
    const first = checkStep(hinter.next(start));
    const expected = checkStep(hinter.next(start));
    first.moves.length = 0;
    first.pieces.length = 0;
    expect(checkStep(hinter.next(start))).toEqual(expected);
  });
});
