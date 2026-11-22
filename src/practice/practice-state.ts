import { applyMoves, isSolved, SOLVED } from '../cube/facelets';

const FACES = ['U', 'D', 'R', 'L', 'F', 'B'];
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
type UndoEntry = { kind: 'move' } | { kind: 'replace'; before: Snapshot };

// The on-screen practice cube: a starting setup plus the moves made since.
// The 3D player draws it from the same moves, so screen and logic always agree.
export class PracticeCube {
  private start: string[];
  private history: string[] = [];
  private undoLog: UndoEntry[] = [];

  constructor(start: string[] = []) {
    this.start = start.slice();
  }

  // Moves that take a solved cube to what is on screen now.
  get setup(): string[] {
    return [...this.start, ...this.history];
  }

  get state(): string {
    return applyMoves(SOLVED, this.setup);
  }

  get solved(): boolean {
    return isSolved(this.state);
  }

  get moveCount(): number {
    return this.history.length;
  }

  get canUndo(): boolean {
    return this.undoLog.length > 0;
  }

  apply(move: string): void {
    this.history.push(move);
    this.undoLog.push({ kind: 'move' });
  }

  undo(): void {
    const last = this.undoLog.pop();
    if (!last) return;
    if (last.kind === 'move') this.history.pop();
    else {
      this.start = last.before.start;
      this.history = last.before.history;
    }
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
    this.undoLog.push({ kind: 'replace', before: { start: this.start, history: this.history } });
    this.start = start.slice();
    this.history = [];
  }
}
