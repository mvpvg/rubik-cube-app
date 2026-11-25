export type Cleanup = () => void;
export type Screen = (root: HTMLElement, param?: string) => Cleanup | void;

const routes = new Map<string, Screen>();
let cleanup: Cleanup | void;
let shown = false; // a screen of this app was already shown in this page

export function register(name: string, screen: Screen): void {
  routes.set(name, screen);
}

// `replace` swaps the current history entry for this screen, for a step Back should skip.
// It keeps the entry's state, so goBack still knows whether an app screen came before it.
export function go(name: string, param?: string, { replace = false } = {}): void {
  const hash = param ? `#/${name}/${param}` : `#/${name}`;
  if (replace) {
    history.replaceState(history.state, '', hash);
    render();
  } else if (window.location.hash === hash) render();
  else window.location.hash = hash;
}

// Back to the screen the child came from, or Home when the app was opened on this screen,
// so Back never leaves the app.
export function goBack(): void {
  if (history.state?.cameFromApp) history.back();
  else go('home');
}

function parse(): { name: string; param?: string } {
  const [, name = 'home', param] = window.location.hash.replace(/^#/, '').split('/');
  return { name: name || 'home', param };
}

function render(): void {
  const root = document.getElementById('app');
  if (!root) return;
  // Each history entry remembers once whether an earlier entry is a screen of this app. A refresh keeps it.
  if (!history.state) history.replaceState({ cameFromApp: shown }, '');
  shown = true;
  if (cleanup) cleanup();
  cleanup = undefined;
  const { name, param } = parse();
  const screen = routes.get(name) ?? routes.get('home');
  root.replaceChildren();
  root.scrollTop = 0;
  window.scrollTo(0, 0);
  if (screen) cleanup = screen(root, param);
}

export function start(): void {
  window.addEventListener('hashchange', render);
  render();
}
