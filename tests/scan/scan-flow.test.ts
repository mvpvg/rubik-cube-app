import { describe, expect, it } from 'vitest';
import { ScanFlow, STEPS, turnFor } from '../../src/scan/scan-flow';
import { sampleGrid } from '../../src/scan/sample';
import { applyMoves, SOLVED, type Face } from '../../src/cube/facelets';
import type { RGB } from '../../src/app/session';

const RGB_OF: Record<Face, RGB> = {
  U: [255, 255, 255], R: [196, 30, 58], F: [0, 158, 96], D: [255, 213, 0], L: [255, 88, 0], B: [0, 81, 186],
};

// How the child holds the cube for each picture, as whole-cube turns from white on top, green in front.
const HOLDS = ['', 'y', 'y2', "y'", "x'", 'x'];

function faceImage(cube: string, hold: string): Uint8ClampedArray {
  const front = applyMoves(cube, hold).slice(18, 27);
  const size = 300, data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = RGB_OF[front[Math.floor(y / 100) * 3 + Math.floor(x / 100)] as Face];
      data.set([...c, 255], (y * size + x) * 4);
    }
  }
  return data;
}

const solidFace = (face: Face): RGB[] => Array(9).fill(RGB_OF[face]);

describe('scan flow', () => {
  it('asks for green, red, blue, orange, white, yellow in order, then is done with 54 samples', () => {
    const flow = new ScanFlow();
    const seen: string[] = [];
    for (const face of ['F', 'R', 'B', 'L', 'U', 'D'] as Face[]) {
      expect(flow.done).toBe(false);
      seen.push(flow.step.center);
      expect(flow.capture(solidFace(face)).ok).toBe(true);
    }
    expect(seen).toEqual(['G', 'R', 'B', 'O', 'W', 'Y']);
    expect(flow.done).toBe(true);
    expect(flow.samples()).toHaveLength(54);
  });

  it('each step reads its own face in solver reading order', () => {
    const faceStart: Record<string, number> = { W: 0, R: 9, G: 18, Y: 27, O: 36, B: 45 };
    for (const step of STEPS) {
      const start = faceStart[step.center];
      expect(step.cells).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => start + i));
    }
  });

  it('stays on the step and names the expected face when the center is wrong', () => {
    const flow = new ScanFlow();
    flow.capture(solidFace('F'));
    const result = flow.capture(solidFace('L')); // orange shown when red is expected
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('Show the red-center side');
    expect(flow.step.center).toBe('R');
  });

  it('offers "use it anyway" after two failed tries and then moves on', () => {
    const flow = new ScanFlow();
    const first = flow.capture(solidFace('B'));
    expect(!first.ok && first.canUseAnyway).toBe(false);
    const second = flow.capture(solidFace('B'));
    expect(!second.ok && second.canUseAnyway).toBe(true);
    flow.useAnyway();
    expect(flow.step.center).toBe('R');
  });

  it('turns six held-face pictures of a scrambled cube into its 54 stickers in solver order', () => {
    const cube = applyMoves(SOLVED, "R U2 F' L D B2 R' U F2 D' L2 B U' R2");
    const flow = new ScanFlow();
    for (const hold of HOLDS) {
      expect(flow.capture(sampleGrid(faceImage(cube, hold), 300, 300)).ok).toBe(true);
    }
    const expected = cube.split('').map((f) => RGB_OF[f as Face]);
    expect(flow.samples()).toEqual(expected);
  });

  it('each step keeps its hold, and both turn lists get there', () => {
    const ID = Array.from({ length: 54 }, (_, i) => String.fromCharCode(48 + i)).join('');
    expect(STEPS.map((s) => s.hold)).toEqual(HOLDS);
    STEPS.forEach((step, i) => {
      const goal = applyMoves(ID, step.hold);
      expect(applyMoves(applyMoves(ID, STEPS[i - 1]?.hold ?? ''), step.turns)).toBe(goal);
      expect(applyMoves(ID, step.startTurns)).toBe(goal);
    });
  });

  it('white after orange is two turns: left, then tip the top toward you', () => {
    expect(STEPS[4].turns).toEqual(['y', "x'"]);
    expect(STEPS[4].turn).toMatch(/turn the cube left.*then tip the top toward you/i);
  });

  it('in order a step starts from the last hold; out of order it starts from white on top, green facing you', () => {
    expect(turnFor(2, true)).toEqual({ from: 'y', turns: ['y'], words: STEPS[2].turn });
    const out = turnFor(2, false);
    expect(out).toEqual({ from: '', turns: ['y', 'y'], words: STEPS[2].startTurn });
    expect(out.words).toMatch(/^Start with white on top and green facing you\. Turn the cube left\. Then turn the cube left\./);
  });
});
