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

type Pending = { resolve: (moves: string[]) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, Pending>();

export function warmUpSolver(): void {
  if (worker || typeof Worker === 'undefined') return;
  worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<{ id: number; moves?: string[]; error?: string }>) => {
    const job = pending.get(e.data.id);
    if (!job) return;
    pending.delete(e.data.id);
    if (e.data.moves) job.resolve(e.data.moves);
    else job.reject(new Error(e.data.error ?? 'Solver failed'));
  };
  // If the worker cannot load or crashes, fail the waiting solves and fall back to the main thread.
  const fail = () => {
    worker?.terminate();
    worker = null;
    for (const job of pending.values()) job.reject(new Error('Solver stopped'));
    pending.clear();
  };
  worker.onerror = fail;
  worker.onmessageerror = fail;
  worker.postMessage({ id: -1, warm: true });
}

// Solve off the main thread so the page never freezes while tables build.
export function solveInWorker(state: string): Promise<string[]> {
  warmUpSolver();
  if (!worker) return Promise.resolve(solveFast(state));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker!.postMessage({ id, state });
  });
}
