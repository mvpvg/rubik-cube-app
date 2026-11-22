import type { RGB } from '../app/session';
import { applyMoves, COLOR_NAME, type Color } from '../cube/facelets';
import { nearestColor } from './sample';

export type Step = {
  center: Color; // color of the center sticker on the side to show
  topColor: Color; // color at the top edge of the picture
  turn: string; // how to get the cube from the last picture to this one
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
// White: from green, tip the top toward you (x'). Yellow: from green, tip the bottom toward you (x).
const HOLDS: Array<Omit<Step, 'cells'> & { hold: string }> = [
  { center: 'G', topColor: 'W', hold: '', turn: 'Hold white on top and green facing you.', hint: 'Keep white on top' },
  { center: 'R', topColor: 'W', hold: 'y', turn: 'Turn the cube left. Red comes to the front.', hint: 'Keep white on top' },
  { center: 'B', topColor: 'W', hold: 'y2', turn: 'Turn the cube left. Blue comes to the front.', hint: 'Keep white on top' },
  { center: 'O', topColor: 'W', hold: "y'", turn: 'Turn the cube left. Orange comes to the front.', hint: 'Keep white on top' },
  { center: 'W', topColor: 'B', hold: "x'", turn: 'Turn left once more to green. Then tip the top toward you.', hint: 'Blue on top, green at the bottom' },
  { center: 'Y', topColor: 'G', hold: 'x', turn: 'Tip it back to green. Then tip the bottom toward you.', hint: 'Green on top' },
];

export const STEPS: Step[] = HOLDS.map(({ hold, ...step }) => ({ ...step, cells: cellsFor(hold) }));

export type CaptureResult =
  | { ok: true }
  | { ok: false; message: string; canUseAnyway: boolean };

// Six pictures in a fixed order. Each accepted picture's nine colors land on their solver stickers.
export class ScanFlow {
  index = 0;
  private failures = 0;
  private rejected: RGB[] | null = null;
  private readonly stickers: RGB[] = new Array(54);

  get done(): boolean {
    return this.index >= STEPS.length;
  }

  get step(): Step {
    return STEPS[Math.min(this.index, STEPS.length - 1)];
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
      canUseAnyway: this.failures >= 2,
    };
  }

  // Keep the last rejected picture; the review screen lets the child fix colors later.
  useAnyway(): void {
    if (this.rejected) this.accept(this.rejected);
  }

  samples(): RGB[] {
    return this.stickers.slice();
  }

  private accept(cells: RGB[]): void {
    this.step.cells.forEach((sticker, i) => { this.stickers[sticker] = cells[i]; });
    this.index++;
    this.failures = 0;
    this.rejected = null;
  }
}
