import { beforeEach, describe, expect, it } from 'vitest';
import Cube from 'cubejs';
import { loadSession, saveSession, session, setCube, setLearn, type RGB } from '../../src/app/session';
import { applyMoves, CENTER_INDEX, COLOR_NAME, SOLVED, toColors, type Color, type Face } from '../../src/cube/facelets';
import { reviewScreen } from '../../src/review/net-editor';

function mount(param?: string): HTMLElement {
  const root = document.createElement('main');
  document.body.replaceChildren(root);
  reviewScreen(root, param);
  return root;
}

const button = (root: HTMLElement, label: string | RegExp) =>
  [...root.querySelectorAll('button')].find((b) => (typeof label === 'string' ? b.textContent === label || b.getAttribute('aria-label') === label : label.test(b.getAttribute('aria-label') ?? b.textContent ?? ''))) as HTMLButtonElement;

const openSide = (root: HTMLElement, color: Color) => button(root, `Show the ${COLOR_NAME[color]} side`).click();
const zoomSquares = (root: HTMLElement) => [...root.querySelectorAll<HTMLButtonElement>('.zoom-sticker')];

describe('review screen', () => {
  beforeEach(() => {
    localStorage.clear();
    loadSession();
  });

  it('a valid scanned cube enables both Solve it and Learn it', () => {
    session.colors = toColors(Cube.random().asString());
    const root = mount();
    expect(button(root, 'Solve it').disabled).toBe(false);
    expect(button(root, 'Learn it').disabled).toBe(false);
  });

  it('changing a square re-checks the cube and keeps both buttons off when it is wrong', () => {
    const colors = toColors(Cube.random().asString());
    session.colors = colors;
    const root = mount();
    openSide(root, 'G');
    const square = zoomSquares(root)[0];
    const was = square.textContent as Color;
    square.click();
    const other: Color = was === 'B' ? 'W' : 'B';
    button(root, COLOR_NAME[other]).click();
    expect(zoomSquares(root)[0].textContent).toBe(other);
    expect(button(root, 'Solve it').disabled).toBe(true);
    expect(button(root, 'Learn it').disabled).toBe(true);
    expect(root.querySelector('.review-msg')?.textContent).toMatch(/squares/);
  });

  it('after a reload, going back shows the saved cube instead of a blank map', () => {
    const state = Cube.random().asString();
    session.facelets = state;
    const root = mount();
    const net = [...root.querySelectorAll('.net-sticker')].map((s) => s.textContent).join('');
    expect(net).toBe(toColors(state).join(''));
    expect(button(root, 'Solve it').disabled).toBe(false);
  });

  it('middle squares cannot be changed', () => {
    session.colors = toColors(Cube.random().asString());
    const root = mount();
    openSide(root, 'G');
    expect(zoomSquares(root)[4].disabled).toBe(true);
  });

  it('every square shows its color letter', () => {
    session.colors = toColors(Cube.random().asString());
    const root = mount();
    const net = [...root.querySelectorAll('.net-sticker')].map((s) => s.textContent);
    expect(net).toHaveLength(54);
    expect(net.every((t) => /^[WYROGB]$/.test(t ?? ''))).toBe(true);
  });

  it('typing in all 48 squares of a valid cube enables both buttons', () => {
    const truth = toColors(Cube.random().asString());
    const root = mount('manual');
    expect(button(root, 'Solve it').disabled).toBe(true);
    for (const side of ['W', 'R', 'G', 'Y', 'O', 'B'] as Color[]) {
      openSide(root, side);
      const faceIndex = ['W', 'R', 'G', 'Y', 'O', 'B'].indexOf(side);
      for (let k = 0; k < 9; k++) {
        const i = faceIndex * 9 + k;
        if (CENTER_INDEX.includes(i)) continue;
        zoomSquares(root)[k].click();
        button(root, COLOR_NAME[truth[i]]).click();
      }
    }
    expect(button(root, 'Solve it').disabled).toBe(false);
    expect(button(root, 'Learn it').disabled).toBe(false);
  });

  const SIDES: Color[] = ['W', 'R', 'G', 'Y', 'O', 'B'];
  const type = (root: HTMLElement, index: number, color: Color) => {
    openSide(root, SIDES[Math.floor(index / 9)]);
    zoomSquares(root)[index % 9].click();
    button(root, COLOR_NAME[color]).click();
  };
  const netText = (root: HTMLElement) => [...root.querySelectorAll('.net-sticker')].map((s) => s.textContent).join('');
  // Camera samples of a solved cube: if the color match ran on them, every side would turn one color.
  const RGB_OF: Record<Face, RGB> = {
    U: [255, 255, 255], R: [196, 30, 58], F: [0, 158, 96], D: [255, 213, 0], L: [255, 88, 0], B: [0, 81, 186],
  };
  const solvedSamples = () => SOLVED.split('').map((f) => RGB_OF[f as Face]);

  describe('saving each step', () => {
    it('a pick is saved: after a reload the pick and the other "check me" rings are still there, and the colors are not matched again', () => {
      const colors = toColors(Cube.random().asString());
      session.samples = solvedSamples();
      session.colors = colors;
      session.checkMe = [18, 19];
      saveSession();
      let root = mount();
      const other: Color = colors[18] === 'B' ? 'W' : 'B';
      type(root, 18, other);
      loadSession();
      root = mount();
      openSide(root, 'G');
      expect(zoomSquares(root)[0].textContent).toBe(other);
      expect(zoomSquares(root)[0].classList.contains('check')).toBe(false);
      expect(zoomSquares(root)[1].classList.contains('check')).toBe(true);
      expect(netText(root)).toBe(colors.map((c, i) => (i === 18 ? other : c)).join(''));
      expect(session.route).toBe('review');
    });

    it('after a full scan, Solve it and Back keep the child\'s colors and the saved samples', () => {
      const colors = toColors(Cube.random().asString());
      session.samples = solvedSamples();
      session.colors = colors;
      saveSession();
      button(mount(), 'Solve it').click();
      loadSession();
      const root = mount();
      expect(netText(root)).toBe(colors.join(''));
      expect(session.samples).toEqual(solvedSamples());
    });

    it('opening the color check records it as the step to come back to', () => {
      session.colors = toColors(Cube.random().asString());
      session.route = 'learn';
      saveSession();
      mount();
      loadSession();
      expect(session.route).toBe('review');
    });
  });

  describe('typing colors', () => {
    it('5 typed colors come back after a reload, and the next pick adds to them', () => {
      const truth = toColors(Cube.random().asString());
      let root = mount('manual');
      const picks = [0, 1, 2, 3, 5];
      for (const i of picks) type(root, i, truth[i]);
      loadSession();
      root = mount('manual');
      openSide(root, 'W');
      expect(zoomSquares(root).map((s) => s.textContent).slice(0, 6)).toEqual([truth[0], truth[1], truth[2], truth[3], 'W', truth[5]]);
      type(root, 6, truth[6]);
      loadSession();
      expect(picks.every((i) => session.colors![i] === truth[i])).toBe(true);
      expect(session.colors![6]).toBe(truth[6]);
      expect(session.route).toBe('review/manual');
    });

    it('opening typing leaves other saved work alone until the first pick, which replaces it', () => {
      const cube = applyMoves(SOLVED, 'R U');
      session.samples = solvedSamples();
      session.colors = toColors(cube);
      setCube(cube);
      setLearn(0, 0);
      const root = mount('manual');
      loadSession();
      expect(session.facelets).toBe(cube);
      expect(netText(root).replace(/[^?]/g, '')).toHaveLength(48);
      type(root, 0, 'W');
      loadSession();
      expect(session.facelets).toBeNull();
      expect(session.learn).toBeNull();
      expect(session.samples).toBeNull();
      expect(session.colors![0]).toBe('W');
      expect(session.colors!.filter(Boolean)).toHaveLength(7);
    });
  });

  describe('smart fill while typing', () => {
    // Corner UFR is squares 8, 9, 20; type two and the third is forced.
    const corner = [8, 9, 20];

    it('picking the last unknown color of a piece fills the neighbor and marks it auto', () => {
      const truth = toColors(Cube.random().asString());
      const root = mount('manual');
      // Fill every other square so the corner is the only open piece-in-progress.
      for (let i = 0; i < 54; i++) if (!CENTER_INDEX.includes(i) && !corner.includes(i)) type(root, i, truth[i]);
      expect(root.querySelector('.auto-legend')?.hasAttribute('hidden')).toBe(true);
      type(root, 8, truth[8]);
      type(root, 9, truth[9]);
      expect(root.querySelectorAll('.net .auto-dot')).toHaveLength(1);
      expect(root.querySelector('.auto-legend')?.hasAttribute('hidden')).toBe(false);
      openSide(root, 'G');
      expect(zoomSquares(root)[2].textContent).toBe(truth[20]);
      expect(zoomSquares(root)[2].querySelector('.auto-dot')).not.toBeNull();
      expect(button(root, 'Solve it').disabled).toBe(false);
    });

    it('changing an earlier pick clears and recomputes the auto squares', () => {
      const truth = toColors(Cube.random().asString());
      const root = mount('manual');
      for (let i = 0; i < 54; i++) if (!CENTER_INDEX.includes(i) && !corner.includes(i)) type(root, i, truth[i]);
      type(root, 8, truth[8]);
      type(root, 9, truth[9]);
      expect(root.querySelectorAll('.net .auto-dot')).toHaveLength(1);
      // Re-pick square 9 as a color that no corner can use here: the fill goes away.
      const wrong: Color = (['W', 'Y'] as Color[]).find((c) => c !== truth[9] && c !== truth[8])!;
      type(root, 9, wrong);
      expect(root.querySelectorAll('.net .auto-dot')).toHaveLength(0);
      expect(root.querySelector('.auto-legend')?.hasAttribute('hidden')).toBe(true);
      openSide(root, 'G');
      expect(zoomSquares(root)[2].textContent).toBe('?');
    });

    it('a filled square keeps its dot after a reload, and changing the earlier pick still clears it', () => {
      const truth = toColors(Cube.random().asString());
      let root = mount('manual');
      for (let i = 0; i < 54; i++) if (!CENTER_INDEX.includes(i) && !corner.includes(i)) type(root, i, truth[i]);
      type(root, 8, truth[8]);
      type(root, 9, truth[9]);
      loadSession();
      root = mount('manual');
      expect(root.querySelectorAll('.net .auto-dot')).toHaveLength(1);
      const wrong: Color = (['W', 'Y'] as Color[]).find((c) => c !== truth[9] && c !== truth[8])!;
      type(root, 9, wrong);
      expect(root.querySelectorAll('.net .auto-dot')).toHaveLength(0);
      openSide(root, 'G');
      expect(zoomSquares(root)[2].textContent).toBe('?');
    });

    it('a filled square the child taps and picks is theirs', () => {
      const truth = toColors(Cube.random().asString());
      const root = mount('manual');
      for (let i = 0; i < 54; i++) if (!CENTER_INDEX.includes(i) && !corner.includes(i)) type(root, i, truth[i]);
      type(root, 8, truth[8]);
      type(root, 9, truth[9]);
      type(root, 20, truth[20]);
      expect(root.querySelectorAll('.net .auto-dot')).toHaveLength(0);
      expect(button(root, 'Solve it').disabled).toBe(false);
    });
  });

  it('shows the help line under the message when the cube is impossible', () => {
    const colors = toColors(Cube.random().asString());
    session.colors = colors;
    const root = mount();
    openSide(root, 'G');
    zoomSquares(root)[0].click();
    button(root, colors[18] === 'B' ? 'white' : 'blue').click();
    expect((root.querySelector('.review-help')?.textContent ?? '').length).toBeGreaterThan(10);
  });
});
