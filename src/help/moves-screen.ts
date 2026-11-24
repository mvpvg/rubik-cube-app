import './help.css';
import { go, goBack, type Cleanup } from '../app/router';
import { h, icon } from '../ui/dom';
import { moveWords, prettyMove } from '../ui/move-words';
import { CubePlayer } from '../ui/player';

const forms = (base: string) => [base, `${base}'`, `${base}2`];
const FACE_MOVES = ['U', 'D', 'R', 'L', 'F', 'B'].flatMap(forms);
const CUBE_TURNS = ['x', 'y', 'z'].flatMap(forms);

export function movesScreen(root: HTMLElement): Cleanup {
  const player = new CubePlayer('3D cube showing the move');
  const rows: HTMLButtonElement[] = [];

  const row = (m: string) => {
    const b = h('button', { class: 'move-row', 'aria-pressed': 'false', onclick: () => show(m, b) },
      h('b', {}, prettyMove(m)), h('span', {}, moveWords(m)));
    rows.push(b);
    return b;
  };

  root.append(
    h('section', { class: 'screen moves' },
      h('div', { class: 'moves-top' },
        h('div', { class: 'topbar' },
          h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: goBack }, icon('back')),
          h('h1', { style: 'font-size:24px' }, 'Moves'),
          h('span', { style: 'width:44px' }),
        ),
        h('p', { class: 'sub', style: 'margin:0' }, 'Hold white on top and green facing you. Tap a move to see it.'),
        h('div', { class: 'player-box' }, player.el),
      ),
      h('div', { class: 'moves-group' }, h('h2', {}, 'Turn one side'), ...FACE_MOVES.map(row)),
      h('div', { class: 'moves-group' }, h('h2', {}, 'Turn the whole cube'), ...CUBE_TURNS.map(row)),
      h('button', { class: 'btn btn-ghost btn-wide', onclick: () => go('practice') }, 'Try them in Practice'),
    ),
  );

  function show(m: string, button: HTMLButtonElement): void {
    rows.forEach((r) => r.setAttribute('aria-pressed', String(r === button)));
    player.load([], [m], 0);
    player.next();
  }

  player.load([], [], 0);
  return () => player.dispose();
}
