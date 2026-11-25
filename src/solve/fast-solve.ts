import Cube from 'cubejs';
import { parseMoves, SOLVED } from '../cube/facelets';

let ready = false;

// Kociemba two-phase solve: 22 moves or fewer. The first call builds lookup tables (a few seconds),
// so the app runs this inside a worker that starts when the app loads.
export function initFastSolver(): void {
  if (ready) return;
  Cube.initSolver();
  ready = true;
}

export function solveFast(state: string): string[] {
  if (state === SOLVED) return [];
  initFastSolver();
  return parseMoves(Cube.fromString(state).solve());
}

type Pending = { state: string; resolve: (moves: string[]) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let broken = false; // a worker failed once, so every solve from now on runs on the main thread
let nextId = 0;
const pending = new Map<number, Pending>();

export function warmUpSolver(): void {
  if (worker || broken || typeof Worker === 'undefined') return;
  worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<{ id: number; moves?: string[]; error?: string }>) => {
    const job = pending.get(e.data.id);
    if (!job) return;
    pending.delete(e.data.id);
    if (e.data.moves) job.resolve(e.data.moves);
    else job.reject(new Error(e.data.error ?? 'Solver failed'));
  };
  // If the worker cannot load or crashes, the waiting solves and every later one run on the main thread.
  const fail = () => {
    worker?.terminate();
    worker = null;
    broken = true;
    const waiting = [...pending.values()];
    pending.clear();
    for (const job of waiting) solveHere(job.state).then(job.resolve, job.reject);
  };
  worker.onerror = fail;
  worker.onmessageerror = fail;
  worker.postMessage({ id: -1, warm: true });
}

// Async, so a throw reaches the caller's .catch() instead of escaping.
const solveHere = async (state: string) => solveFast(state);

// Solve off the main thread so the page never freezes while tables build.
export function solveInWorker(state: string): Promise<string[]> {
  warmUpSolver();
  if (!worker) return solveHere(state);
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { state, resolve, reject });
    worker!.postMessage({ id, state });
  });
}
