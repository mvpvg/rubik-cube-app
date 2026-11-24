import type { RGB } from '../app/session';
import { applyMoves, COLOR_NAME, type Color } from '../cube/facelets';
import { nearestColor } from './sample';

export type Step = {
  center: Color; // color of the center sticker on the side to show
  topColor: Color; // color at the top edge of the picture
  hold: string; // whole-cube turns from white on top, green facing you
  turns: string[]; // whole-cube turns from the last picture's hold, one at a time
  startTurns: string[]; // whole-cube turns from white on top, green facing you
  turn: string; // the words for `turns`
  startTurn: string; // the words for `startTurns`
  hint: string; // short reminder under the headline
  cells: number[]; // sticker index (solver order) for each of the 9 grid cells, row by row
};

// Grid cells as the camera sees them: the front side, read row by row.
const FRONT = [18, 19, 20, 21, 22, 23, 24, 25, 26];
const ID_CHARS = Array.from({ length: 54 }, (_, i) => String.fromCharCode(48 + i)).join('');

// Which original sticker ends up in each grid cell after turning the whole cube by `hold`.
function cellsFor(hold: string): number[] {
  const turned = applyMoves(ID_CHARS, hold);
  return FRONT.map((i) => turned.charCodeAt(i) - 48);
}

// The child starts with white on top and green facing the camera.
// "Turn the cube left" brings the right side to the front (a y turn).
// "Tip the top toward you" brings white to the front (x'). "Tip the bottom toward you" brings yellow to the front (x).
const TURN_WORDS: Record<string, string> = {
  y: 'turn the cube left',
  "y'": 'turn the cube right',
  "x'": 'tip the top toward you',
  x: 'tip the bottom toward you',
};
const START = 'white on top and green facing you.';
export const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// The words name the same turns as the picture, in the same order.
function say(turns: string[], center: Color): string {
  const said = turns.map((t, i) => cap(`${i ? 'then ' : ''}${TURN_WORDS[t]}.`));
  return [...said, `${cap(COLOR_NAME[center])} comes to the front.`].join(' ');
}

const HOLDS: Array<Pick<Step, 'center' | 'topColor' | 'hold' | 'turns' | 'startTurns' | 'hint'>> = [
  { center: 'G', topColor: 'W', hold: '', turns: [], startTurns: [], hint: 'Keep white on top' },
  { center: 'R', topColor: 'W', hold: 'y', turns: ['y'], startTurns: ['y'], hint: 'Keep white on top' },
  { center: 'B', topColor: 'W', hold: 'y2', turns: ['y'], startTurns: ['y', 'y'], hint: 'Keep white on top' },
  { center: 'O', topColor: 'W', hold: "y'", turns: ['y'], startTurns: ["y'"], hint: 'Keep white on top' },
  { center: 'W', topColor: 'B', hold: "x'", turns: ['y', "x'"], startTurns: ["x'"], hint: 'Blue on top, green at the bottom' },
  { center: 'Y', topColor: 'G', hold: 'x', turns: ['x', 'x'], startTurns: ['x'], hint: 'Green on top' },
];

export const STEPS: Step[] = HOLDS.map((step) => ({
  ...step,
  turn: step.turns.length ? say(step.turns, step.center) : `Hold ${START}`,
  startTurn: step.startTurns.length ? `Start with ${START} ${say(step.startTurns, step.center)}` : `Hold ${START}`,
  cells: cellsFor(step.hold),
}));

// Where the turn picture starts, the turns it plays, and the words for them.
// A side out of order (taken again, or the first after reopening a scan) starts from white on top, green facing you.
export function turnFor(index: number, inOrder: boolean): { from: string; turns: string[]; words: string } {
  const step = STEPS[index];
  return inOrder
    ? { from: STEPS[index - 1]?.hold ?? '', turns: step.turns, words: step.turn }
    : { from: '', turns: step.startTurns, words: step.startTurn };
}

export type CaptureResult =
  | { ok: true }
  | { ok: false; message: string; canUseAnyway: boolean };

// Six sides, asked for in a fixed order. Which sides are taken is read from the samples themselves,
// so it can never disagree with them. Any taken side can be taken again; then the scan goes back to
// the side the child was on.
export class ScanFlow {
  index: number;
  private failures = 0;
  private rejected: RGB[] | null = null;
  private back: number | null = null; // the side to go back to after a side taken again
  private last: number | null = null; // the side taken just before, in this sitting
  private readonly stickers: (RGB | null)[];

  constructor(saved: (RGB | null)[] | null = null) {
    this.stickers = saved?.slice() ?? new Array(54).fill(null);
    this.index = this.firstNotTaken();
  }

  get done(): boolean {
    return this.index >= STEPS.length;
  }

  get step(): Step {
    return STEPS[Math.min(this.index, STEPS.length - 1)];
  }

  get retaking(): boolean {
    return this.back !== null;
  }

  // In order only right after the side before it; otherwise the turn picture starts from the starting hold.
  get inOrder(): boolean {
    return this.last === this.index - 1;
  }

  taken(index: number): boolean {
    return STEPS[index].cells.every((i) => this.stickers[i] !== null);
  }

  retake(index: number): void {
    if (this.back === null) this.back = this.index;
    this.index = index;
    this.last = null;
    this.reset();
  }

  keepOld(): void {
    if (this.back === null) return;
    this.index = this.back;
    this.back = null;
    this.reset();
  }

  capture(cells: RGB[]): CaptureResult {
    const step = this.step;
    const seen = nearestColor(cells[4]);
    if (seen === step.center) {
      this.accept(cells);
      return { ok: true };
    }
    this.failures++;
    this.rejected = cells;
    return {
      ok: false,
      message: `That looks like the ${COLOR_NAME[seen]} side. Show the ${COLOR_NAME[step.center]}-center side.`,
      // A side taken again must never silently swap a good picture for the wrong side.
      canUseAnyway: this.failures >= 2 && !this.retaking,
    };
  }

  // Keep the last rejected picture; the review screen lets the child fix colors later.
  useAnyway(): void {
    if (this.rejected && !this.retaking) this.accept(this.rejected);
  }

  samples(): (RGB | null)[] {
    return this.stickers.slice();
  }

  private firstNotTaken(): number {
    const next = STEPS.findIndex((_, i) => !this.taken(i));
    return next < 0 ? STEPS.length : next;
  }

  private reset(): void {
    this.failures = 0;
    this.rejected = null;
  }

  private accept(cells: RGB[]): void {
    this.step.cells.forEach((sticker, i) => { this.stickers[sticker] = cells[i]; });
    this.last = this.index;
    this.index = this.back ?? this.firstNotTaken();
    this.back = null;
    this.reset();
  }
}
