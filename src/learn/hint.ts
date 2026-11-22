// The Hint button. It follows one stored beginner-method plan: while the cube is where that plan
// says it should be, the hint is simply the plan's next sub-step. Solving again on every tap would
// go in circles, because the corner-twist stage messes up the lower layers on purpose and ties
// between equally good pieces can flip back and forth. Only a cube that has left the plan (other
// moves, Undo, a new cube) is solved again.

import { applyMoves, isSolved } from '../cube/facelets';
import { solveBeginner } from './beginner-solver';
import { STAGES, firstUnfinishedStage, stageDone, type StageId } from './stages';

export const HOLD_NOTE = 'Hold your cube with white on top and green facing you';

export interface HintStep {
  kind: 'step';
  // Index into STAGES (0 = white cross), so the card can say "Stage {stageIndex + 1} of 7".
  stageIndex: number;
  stageId: StageId;
  title: string;
  note: string;
  moves: string[];
  // Pieces to show, named as in the beginner solver (for example 'UF' is the white-green edge).
  // Empty for whole-cube turns, which show the whole cube.
  pieces: string[];
}

export type Hint = { kind: 'solved' } | HintStep;

export interface Hinter {
  next(state: string): Hint;
}

const ROTATIONS = ['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'];
const inScanFrame = (s: string) => s[4] === 'U' && s[22] === 'F';

// The fewest whole-cube turns (at most two) that bring white to the top and green to the front.
function holdMoves(state: string): string[] {
  for (const a of ROTATIONS) if (inScanFrame(applyMoves(state, a))) return [a];
  for (const a of ROTATIONS) {
    for (const b of ROTATIONS) if (inScanFrame(applyMoves(state, [a, b]))) return [a, b];
  }
  throw new Error('No whole-cube turn brings white to the top and green to the front');
}

// The solver builds the white cross in the scan frame, and every later stage needs white on the
// top or the bottom.
function needsHold(state: string): boolean {
  if (inScanFrame(state)) return false;
  return !stageDone('white-cross', state) || (state[4] !== 'U' && state[31] !== 'U');
}

const copy = (step: HintStep): HintStep => ({ ...step, moves: [...step.moves], pieces: [...step.pieces] });

export function createHinter(): Hinter {
  // states[k] is the cube before plan step k; the last entry is the solved cube.
  let states: string[] = [];
  let steps: HintStep[] = [];

  function solve(state: string) {
    states = [state];
    steps = [];
    solveBeginner(state).forEach((plan, stageIndex) => {
      for (const sub of plan.subSteps) {
        if (!sub.moves.length) continue;
        steps.push({
          kind: 'step', stageIndex, stageId: plan.id, title: plan.title,
          note: sub.note, moves: sub.moves, pieces: sub.pieces ?? [],
        });
        states.push(applyMoves(states[states.length - 1], sub.moves));
      }
    });
  }

  return {
    next(state) {
      if (isSolved(state)) return { kind: 'solved' };
      // The latest match, in case the plan passes through the same cube twice.
      const k = states.lastIndexOf(state);
      if (k >= 0 && k < steps.length) return copy(steps[k]);
      if (needsHold(state)) {
        const stageIndex = STAGES.findIndex((s) => s.id === firstUnfinishedStage(state));
        const stage = STAGES[stageIndex];
        return {
          kind: 'step', stageIndex, stageId: stage.id, title: stage.title,
          note: HOLD_NOTE, moves: holdMoves(state), pieces: [],
        };
      }
      solve(state);
      return copy(steps[0]);
    },
  };
}
