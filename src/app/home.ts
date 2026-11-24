import { confirmDelete } from '../ui/confirm';
import { h, icon } from '../ui/dom';
import { COLOR_HEX } from '../cube/facelets';
import { moreHelpLink } from '../ui/more-help';
import { go } from './router';
import { clearAll, hasWorkToKeep, session } from './session';

const SIDES: Array<[string, string]> = [
  ['rotateX(90deg) translateZ(80px)', COLOR_HEX.W],
  ['translateZ(80px)', COLOR_HEX.G],
  ['rotateY(90deg) translateZ(80px)', COLOR_HEX.R],
  ['rotateY(180deg) translateZ(80px)', COLOR_HEX.B],
  ['rotateY(-90deg) translateZ(80px)', COLOR_HEX.O],
  ['rotateX(-90deg) translateZ(80px)', COLOR_HEX.Y],
];

// Names the saved step on the Welcome card.
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
    h('button', { class: 'btn btn-primary btn-wide', style: 'min-height:68px;font-size:22px', onclick: () => keepGoing(route) }, 'Keep going'),
  );
}

// Asks first; the scan then starts fresh, since a cleared session has no half-done scan to go on from.
async function startNew(root: HTMLElement): Promise<void> {
  const words = { question: 'Start a new cube? Your saved cube will be deleted.', keep: 'Keep my cube', drop: 'Delete and start over' };
  if (!(await confirmDelete(root, words))) return;
  clearAll();
  go('scan');
}

export function homeScreen(root: HTMLElement): void {
  // Finished work (a solved cube) is not offered again.
  const route = hasWorkToKeep() ? session.route ?? 'review' : null;

  const cube = h('div', { class: 'home-cube', role: 'img', 'aria-label': 'A spinning cube' });
  for (const [transform, color] of SIDES) {
    const face = h('div', { class: 'cube-face', style: `transform:${transform}` });
    for (let i = 0; i < 9; i++) face.append(h('div', { style: `background:${color}` }));
    cube.append(face);
  }

  root.append(
    h('section', { class: 'screen' },
      h('div', { style: 'display:flex;flex-direction:column;gap:8px;margin-top:12px' },
        h('h1', { style: 'font-size:40px' }, 'Cube Coach'),
        h('p', { class: 'sub' }, 'Show me your cube. I will help you solve it.'),
      ),
      route ? welcome(route) : h('div', { class: 'home-hero' }, cube),
      route
        ? h('button', { class: 'btn btn-ghost btn-wide', onclick: () => startNew(root) }, icon('camera', 26), 'Start a new cube')
        : h('button', { class: 'btn btn-primary btn-wide', style: 'min-height:68px;font-size:22px', onclick: () => go('scan') },
          icon('camera', 26), 'Scan my cube'),
      h('button', { class: 'btn btn-ghost btn-wide', onclick: () => go('practice') }, 'Practice on a screen cube'),
      h('button', { class: 'link', onclick: () => go('review', 'manual') }, 'Type in the colors instead'),
      h('div', { class: 'row', style: 'justify-content:center;gap:4px;flex-wrap:wrap' },
        h('button', { class: 'link', onclick: () => go('moves') }, 'What do the move letters mean?'),
        moreHelpLink(),
      ),
    ),
  );
}
