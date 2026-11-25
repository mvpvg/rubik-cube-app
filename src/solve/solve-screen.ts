import { go, type Cleanup } from '../app/router';
import { saveSession, session, setSolve } from '../app/session';
import { applyMoves, COLOR_HEX, invertMoves, toColors } from '../cube/facelets';
import { netMap } from '../review/net-editor';
import { scanAgain } from '../scan/scan-screen';
import { h, icon } from '../ui/dom';
import { holdNote } from '../ui/hold';
import { moveWords, prettyMove } from '../ui/move-words';
import { CubePlayer } from '../ui/player';
import { keepScreenOn } from '../ui/wake-lock';
import { solveInWorker } from './fast-solve';

export function solveScreen(root: HTMLElement, param?: string): Cleanup | void {
  const scanned = session.facelets;
  if (!scanned) {
    go('home');
    return;
  }
  const state: string = scanned;
  session.route = 'solve';
  saveSession();
  // A saved move list for this cube is used as it is, so "move k" means the same move after a reload.
  const saved = session.solve?.cube === state ? session.solve : null;
  // "Keep going" opens the cube check first: does the real cube still look like the saved step?
  let asking = param === 'check' && saved !== null && saved.position < saved.moves.length;

  const title = h('h1', {}, 'Working it out…');
  const counter = h('div', { class: 'muted' }, '');
  const player = new CubePlayer('3D cube showing your moves');
  const bigMove = h('div', { class: 'move-big', 'aria-live': 'polite' }, '');
  const words = h('div', { class: 'move-words' }, '');
  const moveCard = h('div', { class: 'move-card' }, bigMove, words);
  const card = h('div', { class: 'card' }, counter, moveCard);
  const backBtn = h('button', { class: 'btn btn-ghost' }, icon('back', 20), 'Back');
  const nextBtn = h('button', { class: 'btn btn-primary' }, 'Next move', icon('next', 20));
  const againBtn = h('button', { class: 'btn btn-ghost btn-again' }, icon('play', 20), 'Show again');
  const controls = h('div', { class: 'controls' }, againBtn, backBtn, nextBtn);

  const screen = h('section', { class: 'screen' },
    h('div', { class: 'topbar' },
      h('button', { class: 'top-btn', 'aria-label': 'Back to checking colors', onclick: () => go('review') }, icon('back'), 'Back'),
      h('button', { class: 'top-btn', 'aria-label': 'Scan again', onclick: () => go('scan') }, icon('camera'), 'Scan again'),
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
    // Taken before the redraw: the button the child pressed gets focus back when it unlocks.
    const pressed = controls.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
    cur = k;
    setSolve(moves, k);
    update();
    if (k < moves.length) {
      locked = true;
      clearTimeout(unlock);
      void player.playAt(k).then((ms) => { unlock = setTimeout(() => { locked = false; syncButtons(); pressed?.focus(); }, ms); });
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
    card.classList.remove('done-card');
    card.replaceChildren(counter, moveCard);
    // Putting the same buttons back would drop the keyboard focus.
    if ([againBtn, backBtn, nextBtn].some((b, i) => controls.children[i] !== b) || controls.children.length !== 3) {
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

  let looked = false; // the second look: the current move has been played once
  let noView = false; // the 3D cube could not load, so the check shows a flat map instead

  // The cube check rests after the moves done so far. "No, it looks different" plays the current
  // move and asks once more, because the child may have done that move before leaving.
  function ask(): void {
    const done = cur + (looked ? 1 : 0);
    card.classList.remove('done-card');
    card.replaceChildren(
      ...(noView ? [netMap(toColors(applyMoves(state, moves.slice(0, done))), 'Your cube as a flat map')] : []),
      h('div', { class: 'h1', style: 'text-align:center' }, 'Does your cube look like this?'),
    );
    controls.replaceChildren(
      looked
        ? h('button', { class: 'btn btn-ghost', onclick: scanAgain }, 'No, scan it again')
        : h('button', { class: 'btn btn-ghost', onclick: lookAgain }, 'No, it looks different'),
      h('button', { class: 'btn btn-primary', onclick: () => keepGoing(done) }, 'Yes, keep going'),
    );
  }

  function lookAgain(): void {
    const playing = player.playAt(cur);
    looked = true;
    ask();
    // Both answers wait until the move has played, so a double tap cannot skip it.
    const answers = [...controls.querySelectorAll('button')];
    answers.forEach((b) => { b.disabled = true; });
    clearTimeout(unlock);
    void playing.then((ms) => { unlock = setTimeout(() => answers.forEach((b) => { b.disabled = false; }), ms); });
  }

  function keepGoing(k: number): void {
    asking = false;
    // A refresh from here on shows the move without asking again.
    history.replaceState(null, '', '#/solve');
    show(k);
  }

  player.ready.catch(() => {
    noView = true;
    if (asking) ask();
  });

  function begin(solution: string[], at: number): void {
    moves = solution;
    title.textContent = solution.length === 0 ? 'Already solved!' : `${solution.length} moves to solve it`;
    player.load(invertMoves(solution), solution, at);
    locked = false;
    cur = at;
    if (asking) ask();
    else show(at);
  }

  const letScreenDim = keepScreenOn();
  let stopped = false;
  if (saved) begin(saved.moves, saved.position);
  else solveInWorker(state).then((solution) => {
    if (stopped) return;
    begin(solution, 0);
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
    letScreenDim();
  };
}
