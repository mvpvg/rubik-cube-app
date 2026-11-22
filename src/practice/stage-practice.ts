import { applyMoves, SOLVED } from '../cube/facelets';
import { solveBeginner, stageDone, STAGES, type StageId } from '../learn/beginner-solver';
import { randomScramble } from './practice-state';

// A fresh cube for practicing one stage: a random scramble, then the beginner moves for every
// earlier stage, so only the chosen stage (and later ones) is left to do.
export function makeStageCube(id: StageId): { setup: string[]; hold: string } {
  const index = STAGES.findIndex((s) => s.id === id);
  for (;;) {
    const scramble = randomScramble();
    const plans = solveBeginner(applyMoves(SOLVED, scramble));
    const earlier = plans.slice(0, index).flatMap((p) => p.subSteps.flatMap((s) => s.moves));
    const setup = [...scramble, ...earlier];
    if (!stageDone(id, applyMoves(SOLVED, setup))) return { setup, hold: plans[index].hold };
  }
}
