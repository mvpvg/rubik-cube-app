import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearAll, session, setCube, setLearn, setSolve } from '../../src/app/session';
import { homeScreen } from '../../src/app/home';
import { applyMoves, invertMoves, SOLVED } from '../../src/cube/facelets';

const SCRAMBLE = ['R', 'U', "F'"];
const CUBE = applyMoves(SOLVED, SCRAMBLE);

function mount(): HTMLElement {
  const root = document.createElement('main');
  document.body.replaceChildren(root);
  homeScreen(root);
  return root;
}
const button = (root: HTMLElement, name: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === name);

describe('home', () => {
  // jsdom has no modal dialog; the real one is proven in the browser tests.
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
  });
  beforeEach(() => {
    localStorage.clear();
    clearAll();
    location.hash = '';
  });

  it('with no saved work there is no Welcome card, and "Scan my cube" shows', () => {
    const root = mount();
    expect(root.textContent).not.toContain('Welcome back');
    expect(button(root, 'Scan my cube')).toBeDefined();
  });

  it('with saved Learn work, "Keep going" is the one big button, "Start a new cube" replaces "Scan my cube", and it opens the cube check', () => {
    setCube(CUBE);
    session.route = 'learn';
    setLearn(2, 0);
    const root = mount();
    expect(root.textContent).toContain('Welcome back');
    expect(root.textContent).toContain('Learn, stage 3');
    expect(button(root, 'Scan my cube')).toBeUndefined();
    expect(button(root, 'Start a new cube')).toBeDefined();
    const primary = [...root.querySelectorAll('.btn-primary')];
    expect(primary.map((b) => b.textContent?.trim())).toEqual(['Keep going']);
    // The Welcome card comes before the existing buttons.
    const welcome = root.querySelector('.welcome')!;
    expect(welcome.compareDocumentPosition(button(root, 'Practice on a screen cube')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    button(root, 'Keep going')!.click();
    expect(location.hash).toBe('#/learn/check');
  });

  it('"Keep going" on Solve work opens the Solve cube check, and on a scan opens the scan', () => {
    setCube(CUBE);
    session.route = 'solve';
    setSolve(invertMoves(SCRAMBLE), 1);
    button(mount(), 'Keep going')!.click();
    expect(location.hash).toBe('#/solve/check');

    clearAll();
    session.samples = Array(54).fill(null).map((_, i) => (i < 9 ? [1, 2, 3] : null));
    session.route = 'scan';
    button(mount(), 'Keep going')!.click();
    expect(location.hash).toBe('#/scan');
  });

  it('names Solve on the Welcome card when the child left before the moves were worked out', () => {
    setCube(CUBE);
    session.route = 'solve';
    const root = mount();
    expect(root.querySelector('.welcome')?.textContent).toContain('Solve');
    expect(root.querySelector('.welcome')?.textContent).not.toContain('Checking the colors');
  });

  it('finished work (Solve on its done card) shows no Welcome card', () => {
    setCube(CUBE);
    session.route = 'solve';
    setSolve(invertMoves(SCRAMBLE), 3);
    const root = mount();
    expect(root.textContent).not.toContain('Welcome back');
    expect(button(root, 'Scan my cube')).toBeDefined();
  });

  it('"Start a new cube" asks first: "Keep my cube" changes nothing, "Delete and start over" clears the work and opens the scan', async () => {
    setCube(CUBE);
    session.route = 'learn';
    setLearn(2, 0);
    const before = localStorage.getItem('cube.session');
    const root = mount();
    button(root, 'Start a new cube')!.click();
    const dialog = root.querySelector('dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('Your saved cube will be deleted.');
    button(root, 'Keep my cube')!.click();
    await Promise.resolve();
    expect(root.querySelector('dialog')).toBeNull();
    expect(location.hash).toBe('');
    expect(localStorage.getItem('cube.session')).toBe(before);

    button(root, 'Start a new cube')!.click();
    button(root, 'Delete and start over')!.click();
    await Promise.resolve();
    expect(localStorage.getItem('cube.session')).toBeNull();
    expect(session.learn).toBeNull();
    expect(location.hash).toBe('#/scan');
  });

  it('with no saved work, "Scan my cube" opens the scan with no question', () => {
    const root = mount();
    button(root, 'Scan my cube')!.click();
    expect(root.querySelector('dialog')).toBeNull();
    expect(location.hash).toBe('#/scan');
  });
});
