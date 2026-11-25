import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { exitButton } from '../../src/app/exit';
import { clearAll, session, setCube, setSolve } from '../../src/app/session';
import { applyMoves, invertMoves, SOLVED } from '../../src/cube/facelets';

const MOVES = ['R', 'U', "F'"];
const CUBE = applyMoves(SOLVED, MOVES);
const saved = () => localStorage.getItem('cube.session');

// jsdom has no modal dialog; Esc is proven in the browser tests.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});

function tapExit(lost?: () => string | null): HTMLElement {
  const root = document.createElement('main');
  document.body.replaceChildren(root);
  const exit = exitButton(root, lost);
  root.append(exit);
  expect(exit.textContent).toBe('Exit');
  exit.click();
  return root;
}
const question = (root: HTMLElement) => root.querySelector('dialog .confirm-question')!.textContent;
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('Exit', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAll();
    history.replaceState(null, '', '#/solve');
  });

  it('asks first, with Stay as the first and main button, and Stay changes nothing', async () => {
    setCube(CUBE);
    setSolve(invertMoves(MOVES), 1);
    const before = saved();
    const root = tapExit();
    const buttons = [...root.querySelectorAll('dialog button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Stay', 'Go Home']);
    expect(buttons[0].classList.contains('btn-primary')).toBe(true);
    (buttons[0] as HTMLButtonElement).click();
    await tick();
    expect(location.hash).toBe('#/solve');
    expect(saved()).toBe(before);
  });

  it('with saved work, says the cube is saved and Home has "Keep going", and Go Home keeps the work', async () => {
    setCube(CUBE);
    session.route = 'solve';
    setSolve(invertMoves(MOVES), 1);
    const before = saved();
    const root = tapExit();
    expect(question(root)).toBe('Go back Home? Your cube is saved. Tap "Keep going" on Home to come back.');
    root.querySelector<HTMLButtonElement>('dialog .btn-ghost')!.click();
    await tick();
    expect(location.hash).toBe('#/home');
    expect(saved()).toBe(before);
  });

  it('with nothing saved, or a finished cube, asks only "Go back Home?"', () => {
    expect(question(tapExit())).toBe('Go back Home?');
    setCube(CUBE);
    session.route = 'solve';
    setSolve(invertMoves(MOVES), MOVES.length);
    expect(question(tapExit())).toBe('Go back Home?');
  });

  it('names what leaving loses', () => {
    expect(question(tapExit(() => 'Your practice cube will be lost.'))).toBe('Go back Home? Your practice cube will be lost.');
  });
});
