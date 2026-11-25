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

// Takes a picture and, if the side check passes, accepts it, as the child does by tapping Next.
function take(flow: ScanFlow, cells: RGB[]) {
  const result = flow.capture(cells);
  if (result.ok) flow.accept(result.cells);
  return result;
}

describe('scan flow', () => {
  it('asks for green, red, blue, orange, white, yellow in order, then is done with 54 samples', () => {
    const flow = new ScanFlow();
    const seen: string[] = [];
    for (const face of ['F', 'R', 'B', 'L', 'U', 'D'] as Face[]) {
      expect(flow.done).toBe(false);
      seen.push(flow.step.center);
      expect(take(flow, solidFace(face)).ok).toBe(true);
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
    take(flow, solidFace('F'));
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
    flow.accept(flow.useAnyway()!);
    expect(flow.step.center).toBe('R');
  });

  it('turns six held-face pictures of a scrambled cube into its 54 stickers in solver order', () => {
    const cube = applyMoves(SOLVED, "R U2 F' L D B2 R' U F2 D' L2 B U' R2");
    const flow = new ScanFlow();
    for (const hold of HOLDS) {
      expect(take(flow, sampleGrid(faceImage(cube, hold), 300, 300)).ok).toBe(true);
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

  describe('taking a side again', () => {
    const order: Face[] = ['F', 'R', 'B', 'L', 'U', 'D'];
    const onSideFive = () => {
      const flow = new ScanFlow();
      order.slice(0, 4).forEach((f) => take(flow, solidFace(f)));
      return flow;
    };
    const redAgain: RGB[] = Array(9).fill([190, 35, 60]);

    it('mid-scan on side 5, side 2 taken again: the flow is back on side 5 and sides 1 to 4 keep their pictures', () => {
      const flow = onSideFive();
      const before = flow.samples();
      flow.retake(1);
      expect(flow.step.center).toBe('R');
      expect(take(flow, redAgain).ok).toBe(true);
      expect(flow.index).toBe(4);
      const after = flow.samples();
      expect(after.slice(9, 18)).toEqual(redAgain);
      expect(after.filter((_, i) => i < 9 || i >= 18)).toEqual(before.filter((_, i) => i < 9 || i >= 18));
      expect(flow.inOrder).toBe(false); // the child is holding the red side now, so the picture starts from the starting hold
    });

    it('"Keep my old one" goes back to side 5 and side 2 keeps its old picture', () => {
      const flow = onSideFive();
      const before = flow.samples();
      flow.retake(1);
      flow.keepOld();
      expect(flow.index).toBe(4);
      expect(flow.retaking).toBe(false);
      expect(flow.samples()).toEqual(before);
    });

    it('a side taken again never offers "use it anyway"', () => {
      const flow = onSideFive();
      flow.retake(1);
      flow.capture(solidFace('L'));
      const second = flow.capture(solidFace('L'));
      expect(!second.ok && second.canUseAnyway).toBe(false);
    });

    it('a flow built from saved samples with 3 sides taken asks for side 4, starting from the starting hold', () => {
      const firstThree = STEPS.slice(0, 3).flatMap((s) => s.cells);
      const flow = new ScanFlow(onSideFive().samples().map((x, i) => (firstThree.includes(i) ? x : null)));
      expect(flow.taken(0) && flow.taken(1) && flow.taken(2)).toBe(true);
      expect(flow.taken(3)).toBe(false);
      expect(flow.index).toBe(3);
      expect(flow.inOrder).toBe(false);
    });
  });
});

describe('checking a picture before it counts', () => {
  const afterGreen = () => {
    const flow = new ScanFlow();
    take(flow, solidFace('F'));
    return flow;
  };
  const state = (flow: ScanFlow) => ({
    index: flow.index, inOrder: flow.inOrder, retaking: flow.retaking,
    taken: STEPS.map((_, i) => flow.taken(i)), samples: flow.samples(),
  });

  it('retaking blue mid-scan, a good picture dropped, then "Keep my old one": the old blue picture stays and the scan goes back', () => {
    const flow = new ScanFlow();
    (['F', 'R', 'B', 'L'] as Face[]).forEach((f) => take(flow, solidFace(f)));
    const before = flow.samples();
    flow.retake(2);
    expect(flow.capture(Array(9).fill([5, 85, 180])).ok).toBe(true);
    flow.keepOld(); // the new picture is dropped, never accepted
    expect(flow.index).toBe(4);
    expect(flow.retaking).toBe(false);
    expect(flow.samples()).toEqual(before);
  });

  it('a good picture that is dropped changes nothing', () => {
    const flow = afterGreen();
    const before = state(flow);
    const result = flow.capture(solidFace('R'));
    expect(result.ok && result.cells).toEqual(solidFace('R'));
    expect(state(flow)).toEqual(before);
  });

  it('a good picture that is accepted writes its stickers, moves on, and ends the retake', () => {
    const flow = afterGreen();
    take(flow, solidFace('R'));
    flow.retake(0);
    const green: RGB[] = Array(9).fill([10, 150, 100]);
    take(flow, green);
    expect(flow.samples().slice(18, 27)).toEqual(green);
    expect(flow.index).toBe(2); // back to the side it came from
    expect(flow.retaking).toBe(false);
  });

  it('"Use it anyway" hands back the rejected picture unsaved, and accepting it stores it', () => {
    const flow = new ScanFlow();
    flow.capture(solidFace('B'));
    flow.capture(solidFace('B'));
    const before = state(flow);
    const cells = flow.useAnyway();
    expect(cells).toEqual(solidFace('B'));
    expect(state(flow)).toEqual(before);
    flow.accept(cells!);
    expect(flow.samples().slice(18, 27)).toEqual(solidFace('B'));
    expect(flow.step.center).toBe('R');
  });

  it('"Use it anyway" hands back nothing while a side is taken again', () => {
    const flow = afterGreen();
    flow.retake(0);
    flow.capture(solidFace('B'));
    flow.capture(solidFace('B'));
    expect(flow.useAnyway()).toBeNull();
  });
});

describe('live side check', () => {
  // A flow that asks for side `index`: every side before it is taken.
  const flowAt = (index: number) => new ScanFlow(SOLVED.split('').map((f, i) =>
    STEPS.slice(0, index).some((s) => s.cells.includes(i)) ? RGB_OF[f as Face] : null));
  const middle = (rgb: RGB) => Array(9).fill([0, 0, 0]).map((c, i) => (i === 4 ? rgb : c));
  const FACE_OF: Record<string, Face> = { W: 'U', R: 'R', G: 'F', Y: 'D', O: 'L', B: 'B' };

  it('says "matches" when the middle is the asked side\'s color, for each side', () => {
    STEPS.forEach((step, i) => {
      const flow = flowAt(i);
      expect(flow.index).toBe(i);
      expect(flow.look(middle(RGB_OF[FACE_OF[step.center]]))).toBe('match');
    });
  });

  it('names another side when the middle is clearly that side\'s color', () => {
    expect(flowAt(0).look(middle(RGB_OF.R))).toBe('R');
    expect(flowAt(4).look(middle(RGB_OF.D))).toBe('Y');
  });

  it('names no side when the middle is far from every sticker color, like a gray table or brown wood', () => {
    expect(flowAt(0).look(middle([128, 128, 128]))).toBeNull();
    expect(flowAt(0).look(middle([110, 70, 40]))).toBeNull();
  });
});
