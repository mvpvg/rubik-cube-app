import { applyMoves, CENTER_INDEX, COLOR_OF_FACE, FACES, isSolved, toColors, type Color } from '../cube/facelets';
import { validate } from '../cube/validate';
import { solveBeginner, STAGES } from '../learn/beginner-solver';
import { load, remove, save } from './storage';

export type RGB = [number, number, number];
// A position counts the moves finished with Next. It belongs to the cube stored next to it,
// so it never plays moves meant for a different cube.
export type SolvePosition = { cube: string; moves: string[]; position: number };
export type LearnPosition = { cube: string; stage: number; move: number };

interface Work {
  route: string | null; // the screen "Keep going" opens, as the hash path: 'review', 'solve', 'learn', ...
  samples: (RGB | null)[] | null; // 54 camera samples in solver sticker order, null for a square not taken yet
  colors: (Color | null)[] | null; // may differ from the checked cube while the child is fixing them
  checkMe: number[]; // squares flagged "check me"
  filled: number[]; // squares "filled in for you"
  facelets: string | null; // the checked cube in solver order
  solve: SolvePosition | null;
  learn: LearnPosition | null;
}

const KEY = 'cube.session';
// Keys written by the earlier version of the app, read only to carry that work over once.
const OLD_CUBE = 'cube.facelets';
const OLD_LEARN = 'learn.progress';
const VERSION = 1;
const DAY = 24 * 60 * 60 * 1000;
const KEEP_FOR = 7 * DAY; // counted from the last save, so a learner who keeps coming back keeps their place

const empty = (): Work => ({
  route: null, samples: null, colors: null, checkMe: [], filled: [], facelets: null, solve: null, learn: null,
});

// What the app knows about the child's cube right now. Screens change it, then save.
export const session: Work & { savedAt: number | null } = { ...empty(), savedAt: null };

const use = (work: Work, savedAt: number | null) => Object.assign(session, work, { savedAt });

const whole = (x: unknown): x is number => Number.isInteger(x);
const within = (x: unknown, lo: number, hi: number) => whole(x) && x >= lo && x <= hi;
const list = (x: unknown, ok: (v: unknown) => boolean) => Array.isArray(x) && x.every(ok);
const COLOR_LETTERS = new Set<unknown>(Object.values(COLOR_OF_FACE));

// Saved data is untrusted: the app wrote it, so any wrong shape means a bug or an old version.
function wellFormed(r: any, now: number): boolean {
  if (!r || typeof r !== 'object' || r.version !== VERSION) return false;
  if (!Number.isFinite(r.savedAt) || r.savedAt > now + DAY || now - r.savedAt > KEEP_FOR) return false;
  const c = r.colors;
  const colorsOk = c === null || (Array.isArray(c) && c.length === 54
    && c.every((x) => x === null || COLOR_LETTERS.has(x))
    && CENTER_INDEX.every((i, f) => c[i] === COLOR_OF_FACE[FACES[f]]));
  const s = r.samples;
  const samplesOk = s === null || (Array.isArray(s) && s.length === 54 && FACES.every((_, f) => {
    const side = s.slice(f * 9, f * 9 + 9);
    return side.every((x: unknown) => x === null) || list(side, (x) => list(x, (v) => within(v, 0, 255)) && (x as unknown[]).length === 3);
  }));
  const square = (x: unknown) => within(x, 0, 53);
  const solveOk = r.solve === null || (typeof r.solve?.cube === 'string' && list(r.solve.moves, (m) => typeof m === 'string') && whole(r.solve.position));
  const learnOk = r.learn === null || (typeof r.learn?.cube === 'string' && whole(r.learn.stage) && whole(r.learn.move));
  return colorsOk && samplesOk && solveOk && learnOk && list(r.checkMe, square) && list(r.filled, square)
    && (r.route === null || typeof r.route === 'string') && (r.facelets === null || typeof r.facelets === 'string');
}

const fields = (r: any): Work => ({
  route: r.route, samples: r.samples, colors: r.colors, checkMe: r.checkMe, filled: r.filled,
  facelets: r.facelets, solve: r.solve, learn: r.learn,
});

// Saved Solve moves are kept only if they really solve this cube: wrong moves would scramble the real one.
function solveFits(s: SolvePosition, cube: string | null): boolean {
  if (s.cube !== cube || s.position < 0 || s.position > s.moves.length) return false;
  try {
    return isSolved(applyMoves(s.cube, s.moves));
  } catch {
    return false;
  }
}

// The beginner plan is worked out again here, because an app update can change it.
function clampLearn({ cube, stage, move }: LearnPosition): LearnPosition | null {
  const at = Math.min(Math.max(stage, 0), STAGES.length);
  try {
    const moves = at < STAGES.length ? solveBeginner(cube)[at].subSteps.flatMap((s) => s.moves).length : 0;
    return { cube, stage: at, move: Math.min(Math.max(move, 0), moves) };
  } catch {
    return null;
  }
}

// The checked cube must be a real cube before it reaches the solver. Positions follow their cube.
function settle(w: Work): Work {
  if (w.facelets !== null && (w.facelets.length !== 54 || !validate(w.facelets).ok)) {
    w.facelets = null;
    w.route = 'review';
  }
  if (w.solve && !solveFits(w.solve, w.facelets)) w.solve = null;
  if (w.learn) w.learn = w.learn.cube === w.facelets ? clampLearn(w.learn) : null;
  return w;
}

function migrate(): void {
  const cube = load<unknown>(OLD_CUBE);
  if (cube === null) return;
  if (typeof cube !== 'string' || cube.length !== 54 || !validate(cube).ok) {
    remove(OLD_CUBE, OLD_LEARN);
    return;
  }
  const old = load<Partial<LearnPosition>>(OLD_LEARN);
  const learn = old?.cube === cube && whole(old.stage) && whole(old.move) ? { cube, stage: old.stage, move: old.move } : null;
  use(settle({ ...empty(), route: learn ? 'learn' : 'review', colors: toColors(cube), facelets: cube, learn }), null);
  // The old keys go only once the new record is safely written; otherwise the next load tries again.
  if (saveSession()) remove(OLD_CUBE, OLD_LEARN);
}

export function loadSession(): void {
  const raw = load<unknown>(KEY);
  use(empty(), null);
  if (raw === null) return migrate();
  if (wellFormed(raw, Date.now())) {
    const r = raw as { savedAt: number };
    use(settle(fields(r)), r.savedAt);
  } else remove(KEY, OLD_CUBE, OLD_LEARN);
}

// Every save restarts the 7 days. Returns false when the write did not happen (the work stays in memory).
export function saveSession(): boolean {
  session.savedAt = Date.now();
  return save(KEY, { version: VERSION, ...session });
}

// Removes only this app's work, never the rest of localStorage.
export function clearAll(): void {
  use(empty(), null);
  remove(KEY, OLD_CUBE, OLD_LEARN);
}

// An installed app can come back from the background after days. Hiding it saves nothing,
// so this checks the age of the work in memory; true means the work was thrown away.
export function expireIfOld(): boolean {
  if (session.savedAt === null || Date.now() - session.savedAt <= KEEP_FOR) return false;
  clearAll();
  return true;
}

// Throws away the old work and writes the new work in one save, so there is never a moment
// when the old work is gone and the new work is not saved yet.
export function startNewWork(work: Partial<Work>): boolean {
  use({ ...empty(), ...work }, null);
  return saveSession();
}

export function setCube(facelets: string): void {
  session.facelets = facelets;
  if (session.solve?.cube !== facelets) session.solve = null;
  if (session.learn?.cube !== facelets) session.learn = null;
  saveSession();
}

export function setSolve(moves: string[], position: number): void {
  if (session.facelets === null) return;
  session.solve = { cube: session.facelets, moves, position };
  saveSession();
}

export function setLearn(stage: number, move: number): void {
  if (session.facelets === null) return;
  session.learn = { cube: session.facelets, stage, move };
  saveSession();
}

// Solved work is not offered again, and replacing it needs no question.
// Judged by the step the child is on, so Learn progress after a finished Solve is still kept.
export function isFinished(): boolean {
  const { facelets, solve, learn, route } = session;
  return (facelets !== null && isSolved(facelets))
    || (route === 'solve' && solve !== null && solve.position === solve.moves.length)
    || (route === 'learn' && learn !== null && learn.stage >= STAGES.length);
}

// Any picture, color pick, or checked cube that is not finished.
export function hasWorkToKeep(): boolean {
  if (isFinished()) return false;
  return Boolean(session.samples?.some(Boolean))
    || Boolean(session.colors?.some((c, i) => c !== null && !CENTER_INDEX.includes(i)))
    || session.facelets !== null;
}

loadSession();
