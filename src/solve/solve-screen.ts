import { go, type Cleanup } from '../app/router';
import { session } from '../app/session';
import { COLOR_HEX, invertMoves } from '../cube/facelets';
import { h, icon } from '../ui/dom';
import { holdNote } from '../ui/hold';
import { moveWords, prettyMove } from '../ui/move-words';
import { CubePlayer } from '../ui/player';
import { solveInWorker } from './fast-solve';

export function solveScreen(root: HTMLElement): Cleanup | void {
  const state = session.facelets;
  if (!state) {
    go('home');
    return;
  }

  const title = h('h1', {}, 'Working it out…');
  const counter = h('div', { class: 'muted' }, '');
  const player = new CubePlayer('3D cube showing your moves');
  const bigMove = h('div', { class: 'move-big', 'aria-live': 'polite' }, '');
  const words = h('div', { class: 'move-words' }, '');
  const card = h('div', { class: 'card' }, counter, h('div', { class: 'move-card' }, bigMove, words));
  const backBtn = h('button', { class: 'btn btn-ghost' }, icon('back', 20), 'Back');
  const nextBtn = h('button', { class: 'btn btn-primary' }, 'Next move', icon('next', 20));
  const controls = h('div', { class: 'controls' }, backBtn, nextBtn);

  const screen = h('section', { class: 'screen' },
    h('div', { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': 'Back to checking colors', onclick: () => go('review') }, icon('back')),
      h('button', { class: 'icon-btn', 'aria-label': 'Scan again', onclick: () => go('scan') }, icon('rescan')),
    ),
    title,
    holdNote(COLOR_HEX.W, COLOR_HEX.G, 'Hold your cube with white on top and green facing you'),
    h('div', { class: 'player-box' }, player.el),
    card,
    controls,
  );
  root.append(screen);

  let moves: string[] = [];

  function update(): void {
    const done = player.position;
    const total = moves.length;
    backBtn.toggleAttribute('disabled', done === 0);
    if (done >= total) {
      card.replaceChildren(
        h('div', { class: 'h1', style: 'text-align:center' }, 'Solved!'),
        h('p', { class: 'sub', style: 'text-align:center' }, total === 0 ? 'Your cube is already solved.' : 'Every side is one color. Great job.'),
      );
      card.classList.add('done-card');
      controls.replaceChildren(
        backBtn,
        h('button', { class: 'btn btn-primary', onclick: () => go('learn') }, 'Learn to do it'),
      );
      return;
    }
    if (card.classList.contains('done-card')) {
      card.classList.remove('done-card');
      card.replaceChildren(counter, h('div', { class: 'move-card' }, bigMove, words));
      controls.replaceChildren(backBtn, nextBtn);
    }
    const move = moves[done];
    counter.textContent = `Move ${done + 1} of ${total}`;
    bigMove.textContent = prettyMove(move);
    words.textContent = moveWords(move);
  }

  backBtn.addEventListener('click', () => { player.back(); update(); });
  nextBtn.addEventListener('click', () => { player.next(); update(); });

  let stopped = false;
  solveInWorker(state).then((solution) => {
    if (stopped) return;
    moves = solution;
    title.textContent = solution.length === 0 ? 'Already solved!' : `${solution.length} moves to solve it`;
    player.load(invertMoves(solution), solution);
    update();
  }).catch(() => {
    if (stopped) return;
    title.textContent = 'Something went wrong';
    card.replaceChildren(h('p', { class: 'sub' }, 'The colors could not be solved. Go back and check them.'));
    controls.replaceChildren(h('button', { class: 'btn btn-primary btn-wide', onclick: () => go('review') }, 'Check the colors'));
  });

  return () => {
    stopped = true;
    player.dispose();
  };
}
