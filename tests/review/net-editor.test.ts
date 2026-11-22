import { beforeEach, describe, expect, it } from 'vitest';
import Cube from 'cubejs';
import { session } from '../../src/app/session';
import { CENTER_INDEX, COLOR_NAME, toColors, type Color } from '../../src/cube/facelets';
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
    session.samples = null;
    session.colors = null;
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
});
