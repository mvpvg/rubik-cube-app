import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { register, start } from '../../src/app/router';
import { clearAll, loadSession, saveSession, session, setCube, setSolve } from '../../src/app/session';
import { cubeLinkScreen } from '../../src/app/cube-link';
import { applyMoves, CENTER_INDEX, CORNER_SLOTS, invertMoves, SOLVED, toColors } from '../../src/cube/facelets';
import { validate } from '../../src/cube/validate';

const SCRAMBLE = ['R', 'U', "F'", 'L2', 'D'];
const CUBE = applyMoves(SOLVED, SCRAMBLE);
const OTHER = applyMoves(SOLVED, ['B', 'U2', 'R']);
const BROKEN = 'This link does not hold a cube we can use';

const app = () => document.getElementById('app')!;
const button = (name: string) => [...app().querySelectorAll('button')].find((b) => b.textContent?.trim() === name);
const saved = () => localStorage.getItem('cube.session');
// The cube screen answers at once, or after the question, so each check waits a tick.
const tick = () => new Promise((r) => setTimeout(r, 0));

async function open(payload: string): Promise<void> {
  location.hash = `#/cube/${payload}`;
  await tick();
}

function withSavedWork(): string {
  setCube(OTHER);
  session.route = 'solve';
  setSolve(invertMoves(['B', 'U2', 'R']), 1);
  return saved()!;
}

describe('cube link', () => {
  beforeAll(() => {
    // jsdom has no modal dialog; the real one is proven in the browser tests.
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    document.body.replaceChildren(Object.assign(document.createElement('main'), { id: 'app' }));
    register('home', (root) => { root.textContent = 'home'; });
    register('review', (root) => { root.textContent = 'review'; });
    register('cube', cubeLinkScreen);
    start();
  });
  beforeEach(async () => {
    localStorage.clear();
    clearAll();
    location.hash = '#/home';
    await tick();
  });

  it('a valid link with no saved work opens the color check with the cube, and the address becomes #/review', async () => {
    await open(CUBE);
    expect(location.hash).toBe('#/review');
    expect(app().textContent).toBe('review');
    expect(session.facelets).toBe(CUBE);
    expect(session.colors).toEqual(toColors(CUBE));
    loadSession();
    expect(session.facelets).toBe(CUBE);
  });

  it('accepts lower-case letters', async () => {
    await open(CUBE.toLowerCase());
    expect(location.hash).toBe('#/review');
    expect(session.facelets).toBe(CUBE);
  });

  it('accepts a link with text added after the cube', async () => {
    await open(`${CUBE}?fbclid=abc`);
    expect(location.hash).toBe('#/review');
    expect(session.facelets).toBe(CUBE);
  });

  it.each([
    ['53 letters', CUBE.slice(0, 53)],
    ['a letter that is not a side', `X${CUBE.slice(1)}`],
    ['nothing', ''],
  ])('%s shows the broken-link message and a way Home, and nothing saved changes', async (_, payload) => {
    const before = withSavedWork();
    await open(payload);
    expect(app().textContent).toContain(BROKEN);
    expect(app().textContent).not.toContain(CUBE.slice(0, 20));
    expect(saved()).toBe(before);
    button('Home')!.click();
    expect(location.hash).toBe('#/home');
  });

  it('centers in the wrong places show the broken-link message, and the saved work stays', async () => {
    const before = withSavedWork();
    // Swapping two centers fools validate(), which reads pieces by their letters.
    const moved = CUBE.split('');
    [moved[CENTER_INDEX[0]], moved[CENTER_INDEX[1]]] = [CUBE[CENTER_INDEX[1]], CUBE[CENTER_INDEX[0]]];
    expect(validate(moved.join('')).ok).toBe(true);
    await open(moved.join(''));
    expect(app().textContent).toContain(BROKEN);
    expect(app().querySelector('dialog')).toBeNull();
    expect(saved()).toBe(before);
  });

  it('a twisted corner shows the broken-link message', async () => {
    const [a, b, c] = CORNER_SLOTS[0];
    const twisted = CUBE.split('');
    [twisted[a], twisted[b], twisted[c]] = [CUBE[b], CUBE[c], CUBE[a]];
    await open(twisted.join(''));
    expect(app().textContent).toContain(BROKEN);
    expect(saved()).toBeNull();
  });

  it('with saved work it asks first, and "Keep my cube" goes Home with the work unchanged and the cube gone from the address', async () => {
    const before = withSavedWork();
    await open(CUBE);
    expect(app().querySelector('dialog')?.textContent).toContain('Your saved cube will be deleted.');
    button('Keep my cube')!.click();
    await tick();
    expect(location.hash).toBe('#/home');
    expect(saved()).toBe(before);
  });

  it('Esc on the question also keeps the work and clears the address', async () => {
    const before = withSavedWork();
    await open(CUBE);
    app().querySelector('dialog')!.dispatchEvent(new Event('cancel'));
    await tick();
    expect(location.hash).toBe('#/home');
    expect(saved()).toBe(before);
  });

  it('with saved work, "Delete and open it" replaces the work with the cube', async () => {
    withSavedWork();
    await open(CUBE);
    button('Delete and open it')!.click();
    await tick();
    expect(location.hash).toBe('#/review');
    expect(session.facelets).toBe(CUBE);
    expect(session.solve).toBeNull();
  });

  it('the same cube as the saved one opens with no question, and Solve progress is kept', async () => {
    setCube(CUBE);
    session.route = 'solve';
    setSolve(invertMoves(SCRAMBLE), 2);
    await open(CUBE);
    expect(location.hash).toBe('#/review');
    expect(session.solve).toEqual({ cube: CUBE, moves: invertMoves(SCRAMBLE), position: 2 });
    loadSession();
    expect(session.solve?.position).toBe(2);
  });

  it('the same cube with squares fixed since asks first, and "Keep my cube" keeps the fixes', async () => {
    setCube(CUBE);
    const fixed = toColors(CUBE);
    fixed[0] = fixed[0] === 'W' ? 'Y' : 'W';
    session.colors = fixed;
    session.route = 'review';
    saveSession();
    const before = saved();
    await open(CUBE);
    expect(app().querySelector('dialog')?.textContent).toContain('Your saved cube will be deleted.');
    button('Keep my cube')!.click();
    await tick();
    expect(saved()).toBe(before);
  });

  it('a refresh after the import does not ask or import again', async () => {
    withSavedWork();
    await open(CUBE);
    button('Delete and open it')!.click();
    await tick();
    expect(location.href).not.toContain(CUBE);
    const after = saved();
    window.dispatchEvent(new HashChangeEvent('hashchange')); // the router draws the address again, as a refresh does
    await tick();
    expect(app().textContent).toBe('review');
    expect(app().querySelector('dialog')).toBeNull();
    expect(saved()).toBe(after);
  });
});
