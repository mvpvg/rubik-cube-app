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
  const againBtn = h('button', { class: 'btn btn-ghost btn-again' }, icon('play', 20), 'Show again');
  const controls = h('div', { class: 'controls' }, againBtn, backBtn, nextBtn);

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
  let cur = 0; // the move on the card; the 3D cube rests after it
  let locked = true; // Next and Back wait until the moves are known, then while each move plays
  let unlock: ReturnType<typeof setTimeout> | undefined;

  function syncButtons(): void {
    nextBtn.toggleAttribute('disabled', locked);
    againBtn.toggleAttribute('disabled', locked);
    backBtn.toggleAttribute('disabled', locked || cur === 0);
  }
  syncButtons();

  // Making a move current plays it from the cube before it, and locks the buttons until it ends,
  // so a fast double tap cannot skip a move unseen.
  function show(k: number): void {
    cur = k;
    update();
    if (k < moves.length) {
      locked = true;
      clearTimeout(unlock);
      unlock = setTimeout(() => { locked = false; syncButtons(); }, player.playAt(k));
    }
    syncButtons();
  }

  function update(): void {
    const total = moves.length;
    if (cur >= total) {
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
      controls.replaceChildren(againBtn, backBtn, nextBtn);
    }
    const move = moves[cur];
    counter.textContent = `Move ${cur + 1} of ${total}`;
    bigMove.textContent = prettyMove(move);
    words.textContent = moveWords(move);
  }

  backBtn.addEventListener('click', () => show(cur - 1));
  nextBtn.addEventListener('click', () => show(cur + 1));
  againBtn.addEventListener('click', () => show(cur));

  let stopped = false;
  solveInWorker(state).then((solution) => {
    if (stopped) return;
    moves = solution;
    title.textContent = solution.length === 0 ? 'Already solved!' : `${solution.length} moves to solve it`;
    player.load(invertMoves(solution), solution);
    locked = false;
    show(0);
  }).catch(() => {
    if (stopped) return;
    title.textContent = 'Something went wrong';
    card.replaceChildren(h('p', { class: 'sub' }, 'The colors could not be solved. Go back and check them.'));
    controls.replaceChildren(h('button', { class: 'btn btn-primary btn-wide', onclick: () => go('review') }, 'Check the colors'));
  });

  return () => {
    stopped = true;
    clearTimeout(unlock);
    player.dispose();
  };
}
