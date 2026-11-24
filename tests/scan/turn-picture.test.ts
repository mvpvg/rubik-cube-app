import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STEPS, turnFor } from '../../src/scan/scan-flow';
import { applyMoves, COLOR_HEX, COLOR_OF_FACE, SOLVED, type Color, type Face } from '../../src/cube/facelets';
import type { RGB } from '../../src/app/session';
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

const RGB_HEX = (color: Color): RGB => {
  const n = parseInt(COLOR_HEX[color].slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const turnCount = (el: HTMLElement) => (el.querySelector<HTMLElement>('.turn-cube')!.style.transform.match(/rotate/g) ?? []).length;

describe('turn picture', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('ends each step with its center color in front and its top color on top', () => {
    STEPS.forEach((step, i) => {
      for (const [inOrder, big] of [[true, false], [false, false], [true, true], [false, true]]) {
        const picture = turnPicture({ big });
        const { from, turns } = turnFor(i, inOrder);
        picture.show(from, turns, step.center);
        vi.runAllTimers();
        expect(pose(picture.el)).toEqual({ front: step.center, top: step.topColor });
      }
    });
  });

  it('turns around the screen\'s axes, not the cube\'s, after an earlier turn', () => {
    const picture = turnPicture({ big: true });
    picture.show('y', ["x'"], 'W');
    vi.runAllTimers();
    const real = applyMoves(SOLVED, "y x'");
    expect(pose(picture.el)).toEqual({ front: COLOR_OF_FACE[real[22] as Face], top: COLOR_OF_FACE[real[4] as Face] });
  });

  it('plays the two turns for white one at a time, with one arrow for each', () => {
    const picture = turnPicture({ big: true });
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
    const picture = turnPicture({ big: true });
    const inOrder = turnFor(2, true);
    picture.show(inOrder.from, inOrder.turns, 'B');
    expect(pose(picture.el)).toEqual({ front: 'R', top: 'W' });
    const outOfOrder = turnFor(2, false);
    picture.show(outOfOrder.from, outOfOrder.turns, 'B');
    expect(pose(picture.el)).toEqual({ front: 'G', top: 'W' });
  });

  it('makes the next side\'s center glow', () => {
    const picture = turnPicture();
    picture.show('', ['y'], 'R');
    const glow = picture.el.querySelectorAll('.turn-glow');
    expect(glow).toHaveLength(1);
    expect(glow[0].closest<HTMLElement>('.turn-face')!.dataset.color).toBe('R');
  });
});

const css = ([r, g, b]: RGB) => `rgb(${r}, ${g}, ${b})`;
const face = (el: HTMLElement, color: Color) => el.querySelector<HTMLElement>(`.turn-face[data-color="${color}"]`)!;
const squares = (el: HTMLElement, color: Color) => [...face(el, color).children] as HTMLElement[];
// Every sticker gets its own color, so a square painted from the wrong sample shows up.
const ALL: RGB[] = Array.from({ length: 54 }, (_, i) => [i * 4, 255 - i * 4, (i * 37) % 256]);
const only = (taken: number[]) => ALL.map((rgb, i) => (taken.some((s) => STEPS[s].cells.includes(i)) ? rgb : null));

describe('turn picture colors', () => {
  it('paints each side\'s squares with the colors the camera saw in the same grid cells', () => {
    const picture = turnPicture();
    picture.paint(ALL);
    STEPS.forEach((step) => {
      expect(squares(picture.el, step.center).map((s) => s.style.background)).toEqual(step.cells.map((i) => css(ALL[i])));
    });
  });

  it('shows a side not taken yet as gray squares around its own center color', () => {
    const picture = turnPicture();
    picture.paint(only([0]));
    expect(squares(picture.el, 'G').map((s) => s.style.background)).toEqual(STEPS[0].cells.map((i) => css(ALL[i])));
    for (const color of ['W', 'R', 'B', 'O', 'Y'] as Color[]) {
      const sq = squares(picture.el, color);
      expect(sq.filter((s) => s.classList.contains('turn-blank'))).toHaveLength(8);
      expect(sq[4].classList.contains('turn-blank')).toBe(false);
      expect(sq[4].style.background).toBe(css(RGB_HEX(color)));
    }
  });

  it('turns a side back to gray when it is painted again without it', () => {
    const picture = turnPicture();
    picture.paint(only([0, 1]));
    picture.paint(only([0]));
    expect(squares(picture.el, 'R').filter((s) => s.classList.contains('turn-blank'))).toHaveLength(8);
    expect(squares(picture.el, 'G').some((s) => s.classList.contains('turn-blank'))).toBe(false);
  });

  it('keeps the glow, the side colors, and the face turns when painted', () => {
    const picture = turnPicture();
    picture.show('', ['y'], 'R');
    const before = [...picture.el.querySelectorAll<HTMLElement>('.turn-face')].map((f) => [f.dataset.color, f.style.transform]);
    picture.paint(only([0]));
    expect(squares(picture.el, 'R')[4].classList.contains('turn-glow')).toBe(true);
    expect([...picture.el.querySelectorAll<HTMLElement>('.turn-face')].map((f) => [f.dataset.color, f.style.transform])).toEqual(before);
  });
});

describe('small turn picture', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('rests in the final pose with an arrow for each turn, and starts no timers', () => {
    const picture = turnPicture();
    const { from, turns } = turnFor(4, true);
    picture.show(from, turns, 'W');
    expect(pose(picture.el)).toEqual({ front: 'W', top: 'B' });
    expect(vi.getTimerCount()).toBe(0);
    expect([...picture.el.querySelectorAll('.turn-arrow')].map((a) => a.textContent)).toEqual(['←', '⤵']);
  });

  it('"Show me again" asks the screen to show the turns', () => {
    const again = vi.fn();
    const picture = turnPicture({ again });
    picture.el.querySelector<HTMLButtonElement>('button')!.click();
    expect(again).toHaveBeenCalledTimes(1);
  });
});

describe('big turn picture', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  // The side in front every 100 ms until the motion ends, with repeats dropped.
  function fronts(el: HTMLElement): string[] {
    const seen = [pose(el).front];
    for (let ms = 0; vi.getTimerCount() && ms < 20000; ms += 100) {
      vi.advanceTimersByTime(100);
      const transform = el.querySelector<HTMLElement>('.turn-cube')!.style.transform;
      expect(transform).toMatch(/^(rotate[XY]\(-?\d+deg\) ?)*$/);
      if (pose(el).front !== seen.at(-1)) seen.push(pose(el).front);
    }
    return seen;
  }

  it('plays the turn, rests, plays it again, then stops in the final pose', () => {
    const picture = turnPicture({ big: true });
    const { from, turns } = turnFor(1, true);
    picture.show(from, turns, 'R');
    expect(fronts(picture.el)).toEqual(['G', 'R', 'G', 'R']);
    expect(vi.getTimerCount()).toBe(0);
    expect(pose(picture.el)).toEqual({ front: 'R', top: 'W' });
  });

  it('lights only the arrow of the turn that is playing', () => {
    const picture = turnPicture({ big: true });
    const { from, turns } = turnFor(4, true);
    picture.show(from, turns, 'W');
    const lit = () => [...picture.el.querySelectorAll('.turn-arrow')].map((a) => a.classList.contains('now'));
    expect(lit()).toEqual([false, false]);
    vi.advanceTimersToNextTimer();
    expect(lit()).toEqual([true, false]);
    vi.advanceTimersToNextTimer();
    expect(lit()).toEqual([false, true]);
  });

  it('with motion turned off, shows the final pose and every arrow at once, with no timers', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const picture = turnPicture({ big: true });
    const { from, turns } = turnFor(4, true);
    picture.show(from, turns, 'W');
    expect(pose(picture.el)).toEqual({ front: 'W', top: 'B' });
    expect(vi.getTimerCount()).toBe(0);
    expect(picture.el.querySelectorAll('.turn-arrow')).toHaveLength(2);
  });

  it('stop() ends the second play, so no turn runs after the screen closes', () => {
    const picture = turnPicture({ big: true });
    const { from, turns } = turnFor(1, true);
    picture.show(from, turns, 'R');
    vi.advanceTimersToNextTimer();
    picture.stop();
    expect(vi.getTimerCount()).toBe(0);
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
