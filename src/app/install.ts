import { load, save } from './storage';

// Kept apart from the saved session, so starting a new cube does not bring the helper back.
const DISMISSED = 'install.dismissed';

type InstallEvent = Event & { prompt(): Promise<unknown> };
let waiting: InstallEvent | null = null;

// The browser fires this once, soon after load, often before Home is on screen, so it is caught at startup.
export function listenForInstall(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    waiting = e as InstallEvent;
  });
  window.addEventListener('appinstalled', () => { waiting = null; });
}

export const canInstall = (): boolean => waiting !== null;

// The browser allows one prompt per event.
export function install(): void {
  waiting?.prompt().catch(() => {});
  waiting = null;
}

export const isInstalled = (): boolean =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

// iPadOS Safari says it is a Mac; only the touch screen tells them apart.
export const isIPhone = (): boolean =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

export const isDismissed = (): boolean => load<boolean>(DISMISSED) === true;
export const dismiss = (): void => { save(DISMISSED, true); };
