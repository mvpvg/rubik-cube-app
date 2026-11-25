import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Cube from 'cubejs';
import { isFinished, loadSession, saveSession, session, setCube, setLearn, setSolve, type RGB } from '../../src/app/session';
import { applyMoves, CENTER_INDEX, COLOR_HEX, COLOR_NAME, invertMoves, SOLVED, toColors, type Color, type Face } from '../../src/cube/facelets';
import { reviewScreen } from '../../src/review/net-editor';
import { readCubeLink } from '../../src/app/cube-link';
import { send as relaySend } from '../../src/app/relay';

vi.mock('../../src/app/relay', async (real) => ({ ...(await real<typeof import('../../src/app/relay')>()), send: vi.fn() }));

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
// The small map shows colors with no letters, so each square's color is read back from its background.
const COLOR_OF_BACKGROUND = new Map(Object.entries(COLOR_HEX).map(([c, hex]) => {
  const probe = document.createElement('div');
  probe.style.background = hex;
  return [probe.style.background, c];
}));
const netText = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>('.net-sticker')].map((s) => COLOR_OF_BACKGROUND.get(s.style.background) ?? '?').join('');

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
    expect(netText(root)).toBe(toColors(state).join(''));
    expect(button(root, 'Solve it').disabled).toBe(false);
  });

  it('asks the child to check the dashed-ring squares once more, in words that do not blame the light', () => {
    session.colors = toColors(Cube.random().asString());
    session.checkMe = [18];
    const root = mount();
    expect(root.querySelector('.review-msg')?.textContent).toBe('This cube works. Check the squares with a dashed ring once more.');
    openSide(root, 'G');
    zoomSquares(root)[0].click();
    expect(root.textContent).toContain('Check this one once more. Pick its color:');
  });

  it('middle squares cannot be changed', () => {
    session.colors = toColors(Cube.random().asString());
    const root = mount();
    openSide(root, 'G');
    expect(zoomSquares(root)[4].disabled).toBe(true);
  });

  it('every square in the close-up card shows its color letter, and the small map shows none', () => {
    session.colors = toColors(Cube.random().asString());
    const root = mount();
    for (const side of ['W', 'R', 'G', 'Y', 'O', 'B'] as Color[]) {
      openSide(root, side);
      const letters = zoomSquares(root).map((s) => s.textContent);
      expect(letters).toHaveLength(9);
      expect(letters.every((t) => /^[WYROGB]$/.test(t ?? ''))).toBe(true);
    }
    expect(root.querySelector('.net')!.textContent).toBe('');
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

    // jsdom has no modal dialog; the real one is proven in the browser tests.
    beforeAll(() => {
      HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      HTMLDialogElement.prototype.close = function () { this.open = false; };
    });
    const savedLearnWork = () => {
      const cube = applyMoves(SOLVED, 'R U');
      session.samples = solvedSamples();
      session.colors = toColors(cube);
      setCube(cube);
      setLearn(0, 0);
      return cube;
    };

    it('opening typing leaves other saved work alone; the first pick asks, and "Delete and start over" replaces it, samples too, in one save', async () => {
      const cube = savedLearnWork();
      const root = mount('manual');
      loadSession();
      expect(session.facelets).toBe(cube);
      expect(netText(root).replace(/[^?]/g, '')).toHaveLength(48);
      type(root, 0, 'W');
      expect(root.querySelector('dialog')!.textContent).toContain('Your saved cube will be deleted.');
      loadSession();
      expect(session.facelets).toBe(cube);
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      button(root, 'Delete and start over').click();
      await Promise.resolve();
      expect(setItem).toHaveBeenCalledTimes(1);
      setItem.mockRestore();
      loadSession();
      expect(session.facelets).toBeNull();
      expect(session.learn).toBeNull();
      expect(session.samples).toBeNull();
      expect(session.colors![0]).toBe('W');
      expect(session.colors!.filter(Boolean)).toHaveLength(7);
      expect(netText(root).replace(/[^?]/g, '')).toHaveLength(47);
    });

    it('"Keep my cube" drops the pick and leaves the saved work as it was', async () => {
      savedLearnWork();
      const before = localStorage.getItem('cube.session');
      const root = mount('manual');
      type(root, 0, 'W');
      button(root, 'Keep my cube').click();
      await Promise.resolve();
      expect(root.querySelector('dialog')).toBeNull();
      expect(localStorage.getItem('cube.session')).toBe(before);
      expect(netText(root).replace(/[^?]/g, '')).toHaveLength(48);
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

  describe('taking a side again', () => {
    it('"Take this side again" on the orange side opens the one-side scan for orange', () => {
      session.colors = toColors(Cube.random().asString());
      const root = mount();
      openSide(root, 'O');
      button(root, 'Take this side again').click();
      expect(location.hash).toBe('#/scan/O');
    });

    it('opened at #/review/O, the close-up card shows the orange side', () => {
      session.colors = toColors(Cube.random().asString());
      const root = mount('O');
      expect(root.querySelector('.zoom-title')!.textContent).toBe('Orange side');
      expect(button(root, 'Show the orange side').getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('opened with nothing saved', () => {
    it('after a scan that started over, it goes back to the scan', () => {
      session.route = 'scan';
      const root = mount();
      expect(location.hash).toBe('#/scan');
      expect(root.querySelector('.net')).toBeNull();
    });

    it('with no scan, it goes Home', () => {
      const root = mount();
      expect(location.hash).toBe('#/home');
      expect(root.querySelector('.net')).toBeNull();
    });
  });

  it('opening the color check on a finished Solve leaves it finished', () => {
    const cube = applyMoves(SOLVED, 'R U');
    session.colors = toColors(cube);
    setCube(cube);
    session.route = 'solve';
    setSolve(invertMoves(['R', 'U']), 2);
    mount();
    expect(isFinished()).toBe(true);
  });

  it('#/review/constructor shows the color check on the green side, with no error', () => {
    session.colors = toColors(Cube.random().asString());
    const root = mount('constructor');
    expect(root.querySelector('.zoom-title')!.textContent).toBe('Green side');
  });

  describe('keyboard focus when the screen redraws', () => {
    it('focus square 3 and pick it: focus stays on square 3', () => {
      session.colors = toColors(Cube.random().asString());
      const root = mount();
      openSide(root, 'G');
      zoomSquares(root)[2].focus();
      zoomSquares(root)[2].click();
      expect(document.activeElement).toBe(zoomSquares(root)[2]);
    });

    it('while typing, focus the white swatch and pick it: focus stays on the white swatch', () => {
      const root = mount('manual');
      openSide(root, 'W');
      zoomSquares(root)[0].click();
      button(root, 'white').focus();
      button(root, 'white').click();
      expect(document.activeElement).toBe(button(root, 'white'));
    });

    it('pick a color for square 3: the picker closes and focus goes back to square 3', async () => {
      session.colors = toColors(Cube.random().asString());
      const root = mount();
      openSide(root, 'G');
      zoomSquares(root)[2].click();
      button(root, 'white').focus();
      button(root, 'white').click();
      await vi.waitFor(() => expect(root.querySelector('.swatch')).toBeNull());
      expect(document.activeElement).toBe(zoomSquares(root)[2]);
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

describe('send to computer', () => {
  const state = applyMoves(SOLVED, "R U F' D2");
  beforeEach(() => {
    localStorage.clear();
    loadSession();
    session.colors = toColors(state);
    saveSession();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(relaySend).mockReset();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });
  const linkText = (root: HTMLElement) => root.querySelector('.send-link')?.textContent ?? '';
  const sharing = (share?: (data: ShareData) => Promise<void>, writeText?: (s: string) => Promise<void>) =>
    vi.stubGlobal('navigator', { ...navigator, share, clipboard: writeText ? { writeText } : undefined });

  it('is off while the colors do not make a real cube, and on once they do', () => {
    const root = mount();
    expect(button(root, 'Send to computer').disabled).toBe(false);
    openSide(root, 'G');
    zoomSquares(root)[0].click();
    button(root, COLOR_NAME[zoomSquares(root)[0].textContent === 'B' ? 'W' : 'B']).click();
    expect(button(root, 'Send to computer').disabled).toBe(true);
  });

  it('opens the share sheet with the cube link, and the link opens the same cube', async () => {
    const share = vi.fn(() => Promise.resolve());
    sharing(share);
    const root = mount();
    button(root, 'Send to computer').click();
    await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const { url } = (share.mock.calls[0] as unknown as [ShareData])[0];
    expect(url).toBe(`${location.origin}${location.pathname}#/cube/${state}`);
    expect(linkText(root)).toBe(url);
    expect(readCubeLink(url!.split('#/cube/')[1])).toBe(state);
  });

  it('copies the link when there is no share sheet, and says so', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    sharing(undefined, writeText);
    const root = mount();
    button(root, 'Send to computer').click();
    await vi.waitFor(() => expect(root.textContent).toContain('Link copied'));
    expect(writeText).toHaveBeenCalledWith(`${location.origin}${location.pathname}#/cube/${state}`);
  });

  it('with no room from a QR code, shares the link and does not use the relay', async () => {
    const share = vi.fn(() => Promise.resolve());
    sharing(share);
    sessionStorage.clear();
    const root = mount();
    button(root, 'Send to computer').click();
    await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(relaySend).not.toHaveBeenCalled();
  });

  it('still shows the link when sharing and copying both fail', async () => {
    sharing(() => Promise.reject(new Error('no')), () => Promise.reject(new Error('no')));
    const root = mount();
    button(root, 'Send to computer').click();
    await Promise.resolve();
    expect(linkText(root)).toBe(`${location.origin}${location.pathname}#/cube/${state}`);
    expect(root.textContent).not.toContain('Link copied');
  });

  describe('to the computer that showed the QR code', () => {
    const ROOM = 'cube-' + '0123456789abcdef'.repeat(2);
    const LINK = `${location.origin}${location.pathname}#/cube/${state}`;
    const status = (root: HTMLElement) => root.querySelector('.send-copied')!.textContent;
    beforeEach(() => { sessionStorage.setItem('cube.room', ROOM); });

    it('sends only the 54 cube letters to the room, says so, and does not share', async () => {
      const share = vi.fn(() => Promise.resolve());
      sharing(share);
      let done = () => {};
      vi.mocked(relaySend).mockImplementation(() => new Promise<void>((r) => { done = r; }));
      const root = mount();
      button(root, 'Send to computer').click();
      expect(status(root)).toBe('Sending…');
      // A second tap while it sends does nothing.
      button(root, 'Send to computer').click();
      done();
      await vi.waitFor(() => expect(status(root)).toBe('Sent! Look at your computer.'));
      expect(relaySend).toHaveBeenCalledTimes(1);
      expect(relaySend).toHaveBeenCalledWith(ROOM, state);
      expect(share).not.toHaveBeenCalled();
      expect(button(root, 'Send to computer')).toBeDefined();
    });

    it('a room carries one send: the next tap shares the link', async () => {
      const share = vi.fn(() => Promise.resolve());
      sharing(share);
      vi.mocked(relaySend).mockResolvedValue();
      const root = mount();
      button(root, 'Send to computer').click();
      await vi.waitFor(() => expect(status(root)).toBe('Sent! Look at your computer.'));
      button(root, 'Send to computer').click();
      expect(share).toHaveBeenCalledWith({ url: LINK });
      expect(relaySend).toHaveBeenCalledTimes(1);
      expect(linkText(root)).toBe(LINK);
    });

    it('when the send fails, shows the link and says to tap again, and the next tap shares', async () => {
      const share = vi.fn(() => Promise.resolve());
      sharing(share);
      vi.mocked(relaySend).mockRejectedValue(new Error('offline'));
      const root = mount();
      button(root, 'Send to computer').click();
      await vi.waitFor(() => expect(status(root)).toBe('Could not send. Tap Send to computer again to share the link.'));
      expect(linkText(root)).toBe(LINK);
      expect(root.querySelector<HTMLElement>('.send-link')!.hidden).toBe(false);
      expect(share).not.toHaveBeenCalled();
      button(root, 'Send to computer').click();
      expect(share).toHaveBeenCalledWith({ url: LINK });
    });

    it('a color change after a send hides the old words and link', async () => {
      vi.mocked(relaySend).mockRejectedValue(new Error('offline'));
      const root = mount();
      button(root, 'Send to computer').click();
      await vi.waitFor(() => expect(linkText(root)).toBe(LINK));
      openSide(root, 'G');
      zoomSquares(root)[0].click();
      button(root, COLOR_NAME[zoomSquares(root)[0].textContent === 'B' ? 'W' : 'B']).click();
      expect(status(root)).toBe('');
      expect(root.querySelector<HTMLElement>('.send-link')!.hidden).toBe(true);
    });

    it('when sessionStorage throws, uses the link', async () => {
      const share = vi.fn(() => Promise.resolve());
      sharing(share);
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
      const root = mount();
      button(root, 'Send to computer').click();
      expect(share).toHaveBeenCalledWith({ url: LINK });
      expect(relaySend).not.toHaveBeenCalled();
    });
  });
});
