import { confirmDelete } from '../ui/confirm';
import { h, icon } from '../ui/dom';
import { COLOR_HEX } from '../cube/facelets';
import { moreHelpLink } from '../ui/more-help';
import { canInstall, dismiss, install, isDismissed, isInstalled, isIPhone } from './install';
import { go, type Cleanup } from './router';
import { clearAll, hasWorkToKeep, session } from './session';

const SIDES: Array<[string, string]> = [
  ['rotateX(90deg) translateZ(80px)', COLOR_HEX.W],
  ['translateZ(80px)', COLOR_HEX.G],
  ['rotateY(90deg) translateZ(80px)', COLOR_HEX.R],
  ['rotateY(180deg) translateZ(80px)', COLOR_HEX.B],
  ['rotateY(-90deg) translateZ(80px)', COLOR_HEX.O],
  ['rotateX(-90deg) translateZ(80px)', COLOR_HEX.Y],
];

function stepName(route: string): string {
  if (route === 'solve' && session.solve) return `Solve, move ${session.solve.position + 1}`;
  if (route === 'learn' && session.learn) return `Learn, stage ${session.learn.stage + 1}`;
  if (route === 'scan') return 'Scanning your cube';
  if (route === 'review/manual') return 'Typing in the colors';
  return 'Checking the colors';
}

// Solve and Learn first ask whether the real cube still looks like the saved step.
function keepGoing(route: string): void {
  const [name, param] = route.split('/');
  go(name, name === 'solve' || name === 'learn' ? 'check' : param);
}

function welcome(route: string): HTMLElement {
  return h('div', { class: 'card welcome' },
    h('h2', { class: 'h1' }, 'Welcome back'),
    h('p', { class: 'sub' }, stepName(route)),
    h('button', { class: 'btn btn-primary btn-wide', style: 'font-size:var(--text-l)', onclick: () => keepGoing(route) }, 'Keep going'),
  );
}

// Asks first; the scan then starts fresh, since a cleared session has no half-done scan to go on from.
async function startNew(root: HTMLElement): Promise<void> {
  const words = { question: 'Start a new cube? Your saved cube will be deleted.', keep: 'Keep my cube', drop: 'Delete and start over' };
  if (!(await confirmDelete(root, words))) return;
  clearAll();
  go('scan');
}

function installHelper(slot: HTMLElement): void {
  const android = canInstall();
  if (isInstalled() || isDismissed() || !(android || isIPhone())) return;
  const words = 'margin:0;font-size:var(--text-m);color:var(--soft)';
  slot.replaceChildren(h('div', { class: 'card', style: 'gap:8px;padding:12px' },
    h('p', { style: words }, 'Add Cube Coach to your home screen'),
    android ? null : h('p', { style: words }, 'Tap Share, then Add to Home Screen'),
    h('div', { class: 'row', style: 'flex-wrap:wrap' },
      android && h('button', {
        class: 'btn btn-ghost', style: 'min-height:var(--tap);font-size:var(--text-m)',
        onclick: () => { install(); slot.replaceChildren(); },
      }, 'Add to home screen'),
      h('button', { class: 'link', onclick: () => { dismiss(); slot.replaceChildren(); } }, 'Not now'),
    ),
  ));
}

export function homeScreen(root: HTMLElement): Cleanup {
  // Finished work (a solved cube) is not offered again.
  const route = hasWorkToKeep() ? session.route ?? 'review' : null;

  const installSlot = h('div', {});
  const cube = h('div', { class: 'home-cube', role: 'img', 'aria-label': 'A spinning cube' });
  for (const [transform, color] of SIDES) {
    const face = h('div', { class: 'cube-face', style: `transform:${transform}` });
    for (let i = 0; i < 9; i++) face.append(h('div', { style: `background:${color}` }));
    cube.append(face);
  }

  root.append(
    h('section', { class: 'screen' },
      h('div', { style: 'display:flex;flex-direction:column;gap:8px;margin-top:12px' },
        h('h1', { style: 'font-size:var(--text-big)' }, 'Cube Coach'),
        h('p', { class: 'sub' }, 'Show me your cube. I will help you solve it.'),
      ),
      route ? welcome(route) : h('div', { class: 'home-hero' }, cube),
      route
        ? h('button', { class: 'btn btn-ghost btn-wide', onclick: () => startNew(root) }, icon('camera', 26), 'Start a new cube')
        : h('button', { class: 'btn btn-primary btn-wide', style: 'font-size:var(--text-l)', onclick: () => go('scan') },
          icon('camera', 26), 'Scan my cube'),
      h('button', { class: 'btn btn-ghost btn-wide', onclick: () => go('practice') }, 'Practice on a screen cube'),
      h('button', { class: 'link', onclick: () => go('review', 'manual') }, 'Type in the colors instead'),
      h('div', { class: 'row', style: 'justify-content:center;flex-wrap:wrap' },
        h('button', { class: 'link', onclick: () => go('moves') }, 'What do the move letters mean?'),
        moreHelpLink(),
      ),
      installSlot,
    ),
  );
  installHelper(installSlot);
  // The install event often comes a moment after Home is already on screen.
  const late = () => installHelper(installSlot);
  window.addEventListener('beforeinstallprompt', late);
  return () => window.removeEventListener('beforeinstallprompt', late);
}
