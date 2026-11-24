import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STEPS, turnFor } from '../../src/scan/scan-flow';
import { applyMoves, COLOR_OF_FACE, SOLVED, type Face } from '../../src/cube/facelets';
import { turnPicture } from '../../src/scan/turn-picture';

type Vec = [number, number, number];

// Turn a CSS rotate list into a function on vectors (CSS axes: x right, y down, z toward you).
function rotation(transform: string): (v: Vec) => Vec {
  const rots = [...transform.matchAll(/rotate([XY])\((-?\d+)deg\)/g)].map(([, axis, deg]) => ({ axis, rad: (Number(deg) * Math.PI) / 180 }));
  return (v) => rots.reduceRight<Vec>(([x, y, z], { axis, rad }) => {
    const c = Math.round(Math.cos(rad)), s = Math.round(Math.sin(rad));
    return axis === 'X' ? [x, c * y - s * z, s * y + c * z] : [c * x + s * z, y, -s * x + c * z];
  }, v);
}

// Which color faces the viewer and which is on top in the picture right now.
function pose(el: HTMLElement): { front: string; top: string } {
  const turn = rotation(el.querySelector<HTMLElement>('.turn-cube')!.style.transform);
  const at = (want: Vec) => [...el.querySelectorAll<HTMLElement>('.turn-face')].find((face) => {
    const normal = turn(rotation(face.style.transform)([0, 0, 1]));
    return normal.every((n, i) => n === want[i]);
  })!.dataset.color;
  return { front: at([0, 0, 1])!, top: at([0, -1, 0])! };
}

const turnCount = (el: HTMLElement) => (el.querySelector<HTMLElement>('.turn-cube')!.style.transform.match(/rotate/g) ?? []).length;

describe('turn picture', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('ends each step with its center color in front and its top color on top', () => {
    STEPS.forEach((step, i) => {
      for (const inOrder of [true, false]) {
        const picture = turnPicture();
        const { from, turns } = turnFor(i, inOrder);
        picture.show(from, turns, step.center);
        vi.runAllTimers();
        expect(pose(picture.el)).toEqual({ front: step.center, top: step.topColor });
      }
    });
  });

  it('turns around the screen\'s axes, not the cube\'s, after an earlier turn', () => {
    const picture = turnPicture();
    picture.show('y', ["x'"], 'W');
    vi.runAllTimers();
    const real = applyMoves(SOLVED, "y x'");
    expect(pose(picture.el)).toEqual({ front: COLOR_OF_FACE[real[22] as Face], top: COLOR_OF_FACE[real[4] as Face] });
  });

  it('plays the two turns for white one at a time, with one arrow for each', () => {
    const picture = turnPicture();
    const { from, turns } = turnFor(4, true);
    picture.show(from, turns, 'W');
    const start = turnCount(picture.el);
    vi.advanceTimersToNextTimer();
    expect(turnCount(picture.el)).toBe(start + 1);
    vi.advanceTimersToNextTimer();
    expect(turnCount(picture.el)).toBe(start + 2);
    expect([...picture.el.querySelectorAll('.turn-arrow')].map((a) => a.textContent)).toEqual(['←', '⤵']);
  });

  it('starts blue from red when in order, and from green when out of order', () => {
    const picture = turnPicture();
    const inOrder = turnFor(2, true);
    picture.show(inOrder.from, inOrder.turns, 'B');
    expect(pose(picture.el)).toEqual({ front: 'R', top: 'W' });
    const outOfOrder = turnFor(2, false);
    picture.show(outOfOrder.from, outOfOrder.turns, 'B');
    expect(pose(picture.el)).toEqual({ front: 'G', top: 'W' });
  });

  it('"Show me again" puts the start pose back and plays the turns again', () => {
    const picture = turnPicture();
    const { from, turns } = turnFor(1, true);
    picture.show(from, turns, 'R');
    vi.runAllTimers();
    expect(pose(picture.el).front).toBe('R');
    picture.el.querySelector<HTMLButtonElement>('button')!.click();
    expect(pose(picture.el).front).toBe('G');
    vi.runAllTimers();
    expect(pose(picture.el).front).toBe('R');
  });

  it('makes the next side\'s center glow', () => {
    const picture = turnPicture();
    picture.show('', ['y'], 'R');
    const glow = picture.el.querySelectorAll('.turn-glow');
    expect(glow).toHaveLength(1);
    expect(glow[0].closest<HTMLElement>('.turn-face')!.dataset.color).toBe('R');
  });
});

describe('scan screen words', () => {
  it('reads the headline and turn words out when they change', async () => {
    const { scanScreen } = await import('../../src/scan/scan-screen');
    const root = document.createElement('main');
    const cleanup = scanScreen(root);
    const headline = root.querySelector('h1')!;
    expect(headline.textContent).toBe('Show the green side');
    expect(headline.closest('[aria-live]')).not.toBeNull();
    cleanup();
  });
});
