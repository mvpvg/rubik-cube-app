import './practice.css';
import { go, type Cleanup } from '../app/router';
import { h, icon } from '../ui/dom';
import { prettyMove, shortMoveWords } from '../ui/move-words';
import { CubePlayer } from '../ui/player';
import { PracticeCube } from './practice-state';

const FACE_BUTTONS = ['U', "U'", 'R', "R'", 'F', "F'", 'L', "L'", 'D', "D'", 'B', "B'"];
const TURN_BUTTONS = ['y', "y'", 'z2'];

export function practiceScreen(root: HTMLElement): Cleanup {
  const cube = new PracticeCube();
  const player = new CubePlayer('3D practice cube', { backView: true });
  const status = h('div', { class: 'practice-status', 'aria-live': 'polite' });

  const moveButton = (m: string) => h('button', {
    class: 'move-btn', 'aria-label': `${prettyMove(m)}: ${shortMoveWords(m)}`, onclick: () => turn(m),
  }, h('b', {}, m === 'z2' ? '↻' : prettyMove(m)), h('small', {}, shortMoveWords(m)));

  const undoBtn = h('button', { class: 'btn btn-ghost', onclick: () => { cube.undo(); redraw(); } }, 'Undo');
  root.append(
    h('section', { class: 'screen practice' },
      h('div', { class: 'practice-top' },
        h('div', { class: 'topbar' },
          h('button', { class: 'icon-btn', 'aria-label': 'Back to home', onclick: () => go('home') }, icon('back')),
          h('h1', { style: 'font-size:24px' }, 'Practice'),
          h('button', { class: 'link', style: 'padding:8px', onclick: () => go('moves') }, 'Moves'),
        ),
        status,
        h('div', { class: 'player-box' }, player.el),
      ),
      h('div', { class: 'move-grid' }, ...FACE_BUTTONS.map(moveButton)),
      h('div', { class: 'turn-row' }, ...TURN_BUTTONS.map(moveButton)),
      h('div', { class: 'action-row' },
        h('button', { class: 'btn btn-primary', onclick: () => { cube.scramble(); redraw(); } }, 'Scramble'),
        undoBtn,
        h('button', { class: 'btn btn-ghost reset', onclick: () => { cube.reset(); redraw(); } }, 'Reset'),
      ),
    ),
  );

  function showStatus(): void {
    undoBtn.toggleAttribute('disabled', !cube.canUndo);
    if (cube.solved && cube.moveCount > 0) {
      status.replaceChildren(h('div', { class: 'h1' }, 'Solved!'), h('span', { class: 'muted' }, `${cube.moveCount} moves`));
    } else {
      status.replaceChildren(h('span', { class: 'muted' }, cube.moveCount === 1 ? '1 move' : `${cube.moveCount} moves`));
    }
  }

  function turn(m: string): void {
    const before = cube.setup;
    cube.apply(m);
    player.load(before, [m], 0);
    player.next();
    showStatus();
  }

  function redraw(): void {
    player.load(cube.setup, [], 0);
    showStatus();
  }

  redraw();
  return () => player.dispose();
}
