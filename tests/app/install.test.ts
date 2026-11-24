import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll, session, setCube } from '../../src/app/session';
import { homeScreen } from '../../src/app/home';
import { listenForInstall } from '../../src/app/install';
import { applyMoves, SOLVED } from '../../src/cube/facelets';

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';

function mount(): HTMLElement {
  const root = document.createElement('main');
  document.body.replaceChildren(root);
  homeScreen(root);
  return root;
}
const button = (root: HTMLElement, name: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === name);

// The browser's install event: it is cancelled so the browser waits, and prompt() opens the install box later.
function fireInstallEvent(): { prompt: ReturnType<typeof vi.fn>; defaultPrevented: () => boolean } {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: vi.fn(async () => {}) });
  window.dispatchEvent(event);
  return { prompt: event.prompt, defaultPrevented: () => event.defaultPrevented };
}

describe('install helper on Home', () => {
  beforeAll(() => {
    listenForInstall();
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
  });
  beforeEach(() => {
    localStorage.clear();
    clearAll();
    location.hash = '';
    window.dispatchEvent(new Event('appinstalled')); // forget an install event from an earlier test
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ANDROID);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it('with an install event, shows "Add to home screen" below the buttons, and tapping it opens the install box', () => {
    const event = fireInstallEvent();
    expect(event.defaultPrevented()).toBe(true);
    const root = mount();
    expect(root.textContent).toContain('Add Cube Coach to your home screen');
    const add = button(root, 'Add to home screen')!;
    expect(button(root, 'Practice on a screen cube')!.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    add.click();
    expect(event.prompt).toHaveBeenCalledOnce();
  });

  it('keeps an install event that came while another screen was open, for Home later', () => {
    location.hash = '#/solve';
    fireInstallEvent();
    location.hash = '#/home';
    expect(button(mount(), 'Add to home screen')).toBeDefined();
  });

  it('shows the button when the install event comes after Home is already on screen', () => {
    const root = mount();
    expect(button(root, 'Add to home screen')).toBeUndefined();
    fireInstallEvent();
    expect(button(root, 'Add to home screen')).toBeDefined();
  });

  it('shows no helper when the app already runs from the home screen', () => {
    window.matchMedia = ((query: string) => ({ matches: query === '(display-mode: standalone)' })) as unknown as typeof window.matchMedia;
    fireInstallEvent();
    const root = mount();
    expect(root.textContent).not.toContain('home screen');
  });

  it('on an iPhone with no install event, shows the Share steps', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE);
    const root = mount();
    expect(root.textContent).toContain('Tap Share, then Add to Home Screen');
    expect(button(root, 'Add to home screen')).toBeUndefined();
    expect(button(root, 'Not now')).toBeDefined();
  });

  it('on an iPad that says it is a Mac, shows the Share steps', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15');
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
    expect(mount().textContent).toContain('Tap Share, then Add to Home Screen');
    delete (navigator as { maxTouchPoints?: number }).maxTouchPoints;
  });

  it('after "Not now", stays hidden after Home opens again and after "Start a new cube"', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE);
    const root = mount();
    button(root, 'Not now')!.click();
    expect(root.textContent).not.toContain('Tap Share');
    expect(mount().textContent).not.toContain('Tap Share');

    setCube(applyMoves(SOLVED, ['R', 'U']));
    session.route = 'review';
    const withWork = mount();
    button(withWork, 'Start a new cube')!.click();
    await Promise.resolve();
    button(withWork, 'Delete and start over')!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(location.hash).toBe('#/scan');
    expect(mount().textContent).not.toContain('Tap Share');
  });
});
