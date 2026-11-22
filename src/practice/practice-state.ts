import { applyMoves, FACES, isSolved, SOLVED } from '../cube/facelets';

const SUFFIXES = ['', "'", '2'];

export function randomScramble(length = 20): string[] {
  const moves: string[] = [];
  while (moves.length < length) {
    const face = FACES[Math.floor(Math.random() * FACES.length)];
    if (moves.length && moves[moves.length - 1][0] === face) continue;
    moves.push(face + SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)]);
  }
  return moves;
}

type Snapshot = { start: string[]; history: string[] };
type UndoEntry = { kind: 'move'; prev: string } | { kind: 'replace'; before: Snapshot; prev: string };

// The on-screen practice cube: a starting setup plus the moves made since.
// The 3D player draws it from the same moves, so screen and logic always agree.
export class PracticeCube {
  private start: string[];
  private history: string[] = [];
  private undoLog: UndoEntry[] = [];
  private current: string;

  constructor(start: string[] = []) {
    this.start = start.slice();
    this.current = applyMoves(SOLVED, this.start);
  }

  // Moves that take a solved cube to what is on screen now.
  get setup(): string[] {
    return [...this.start, ...this.history];
  }

  get state(): string {
    return this.current;
  }

  get solved(): boolean {
    return isSolved(this.current);
  }

  get moveCount(): number {
    return this.history.length;
  }

  get canUndo(): boolean {
    return this.undoLog.length > 0;
  }

  apply(move: string): void {
    this.undoLog.push({ kind: 'move', prev: this.current });
    this.history.push(move);
    this.current = applyMoves(this.current, [move]);
  }

  undo(): void {
    const last = this.undoLog.pop();
    if (!last) return;
    if (last.kind === 'move') this.history.pop();
    else {
      this.start = last.before.start;
      this.history = last.before.history;
    }
    this.current = last.prev;
  }

  // Back to this cube's start; Undo can bring the replaced cube back.
  reset(): void {
    this.replace(this.start);
  }

  scramble(): void {
    this.replace(randomScramble());
  }

  // A new starting cube, such as a fresh stage-practice cube.
  replace(start: string[]): void {
    this.undoLog.push({ kind: 'replace', before: { start: this.start, history: this.history }, prev: this.current });
    this.start = start.slice();
    this.history = [];
    this.current = applyMoves(SOLVED, this.start);
  }
}
