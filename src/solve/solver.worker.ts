import { initFastSolver, solveFast } from './fast-solve';

self.onmessage = (e: MessageEvent<{ id: number; state?: string; warm?: boolean }>) => {
  const { id, state, warm } = e.data;
  try {
    if (warm) {
      initFastSolver();
      return;
    }
    self.postMessage({ id, moves: solveFast(state ?? '') });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
