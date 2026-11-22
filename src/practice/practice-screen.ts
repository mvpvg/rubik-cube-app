import './practice.css';
import { go, type Cleanup } from '../app/router';
import { applyMoves, SOLVED } from '../cube/facelets';
import { createHinter, type HintStep } from '../learn/hint';
import { solveBeginner, stageDone, STAGES } from '../learn/beginner-solver';
import { h, icon } from '../ui/dom';
import { holdNoteFor } from '../ui/hold';
import { prettyMove, shortMoveWords } from '../ui/move-words';
import { pieceMask } from '../ui/piece-mask';
import { CubePlayer, DEFAULT_TEMPO, FULL_MASK } from '../ui/player';
import { PracticeCube, randomScramble } from './practice-state';
import { makeStageCube } from './stage-practice';

const FACE_BUTTONS = ['U', "U'", 'R', "R'", 'F', "F'", 'L', "L'", 'D', "D'", 'B', "B'"];
const TURN_BUTTONS = ['y', "y'", 'z2'];
const SLOW_TEMPO = 0.6;
// cubing.js plays a quarter turn in 1 s and a half turn in 1.5 s at normal speed; wait for the
// whole slowed turn plus a short pause, or the next move cuts it off.
const slowMoveMs = (move: string) => (move.includes('2') ? 1500 : 1000) / SLOW_TEMPO + 200;

export function practiceScreen(root: HTMLElement, param?: string): Cleanup {
  const stageIndex = STAGES.findIndex((s) => s.id === param);
  const stage = stageIndex >= 0 ? STAGES[stageIndex] : null;
  const hinter = createHinter();
  const player = new CubePlayer('3D practice cube', { backView: true });
  const status = h('div', { class: 'practice-status', 'aria-live': 'polite' });
  const holdSlot = h('div', {});
  let cube: PracticeCube;
  let playing = false;
  let stopped = false;
  let hintOpen = false;

  const controls: HTMLButtonElement[] = [];
  const moveButton = (m: string) => {
    const b = h('button', { class: 'move-btn', 'aria-label': `${prettyMove(m)}: ${shortMoveWords(m)}`, onclick: () => turn(m) },
      h('b', {}, m === 'z2' ? '↻' : prettyMove(m)), h('small', {}, shortMoveWords(m)));
    controls.push(b);
    return b;
  };
  const action = (label: string, cls: string, run: () => void) => {
    const b = h('button', { class: `btn ${cls}`, onclick: () => { closeHint(); run(); redraw(); } }, label);
    controls.push(b);
    return b;
  };

  const undoBtn = action('Undo', 'btn-ghost', () => cube.undo());
  const newBtn = action(stage ? 'New cube' : 'Scramble', 'btn-primary', () => newCube(true));
  const resetBtn = action('Reset', 'btn-ghost reset', () => cube.reset());
  const hintBtn = h('button', { class: 'btn btn-ghost', onclick: showHint }, 'Hint');
  controls.push(hintBtn);

  root.append(
    h('section', { class: 'screen practice' },
      h('div', { class: 'practice-top' },
        h('div', { class: 'topbar' },
          h('button', { class: 'icon-btn', 'aria-label': stage ? 'Back to Learn' : 'Back to home', onclick: () => go(stage ? 'learn' : 'home') }, icon('back')),
          h('h1', { style: 'font-size:22px;text-align:center' }, stage ? `Practice: ${stage.title}` : 'Practice'),
          h('button', { class: 'link', style: 'padding:8px', onclick: () => go('moves') }, 'Moves'),
        ),
        status,
        h('div', { class: 'player-box' }, player.el),
      ),
      stage ? h('div', { class: 'stage-info' }, h('p', { class: 'sub', style: 'margin:0;font-size:15px' }, stage.goal), holdSlot) : null,
      h('div', { class: 'move-grid' }, ...FACE_BUTTONS.map(moveButton)),
      h('div', { class: 'turn-row' }, ...TURN_BUTTONS.map(moveButton)),
      h('div', { class: 'action-row' }, newBtn, undoBtn, hintBtn, resetBtn),
    ),
  );

  function newCube(undoable: boolean): void {
    if (stage) {
      const made = makeStageCube(stage.id);
      holdSlot.replaceChildren(holdNoteFor(applyMoves(SOLVED, made.setup), made.hold));
      if (undoable) cube.replace(made.setup);
      else cube = new PracticeCube(made.setup);
    } else if (undoable) cube.scramble();
    else cube = new PracticeCube();
  }

  function showStatus(): void {
    if (hintOpen) return;
    undoBtn.toggleAttribute('disabled', playing || !cube.canUndo);
    const count = cube.moveCount === 1 ? '1 move' : `${cube.moveCount} moves`;
    if (stage && cube.moveCount > 0 && stageDone(stage.id, cube.state)) {
      const next = STAGES[stageIndex + 1];
      status.replaceChildren(h('div', { class: 'hint-card' },
        h('div', { class: 'h1' }, 'Stage done!'),
        h('div', { class: 'row', style: 'flex-wrap:wrap;gap:8px' },
          h('button', { class: 'btn btn-primary', onclick: () => { newCube(true); redraw(); } }, 'New cube'),
          next ? h('button', { class: 'btn btn-ghost', onclick: () => go('practice', next.id) }, 'Next stage') : null,
          h('button', { class: 'btn btn-ghost', onclick: () => go('learn') }, 'Back to Learn'),
        )));
    } else if (cube.solved && cube.moveCount > 0) {
      status.replaceChildren(h('div', { class: 'h1' }, 'Solved!'), h('span', { class: 'muted' }, count));
    } else {
      status.replaceChildren(h('span', { class: 'muted' }, count));
    }
  }

  function turn(m: string): void {
    closeHint();
    playMove(m);
    showStatus();
  }

  function playMove(m: string): void {
    const before = cube.setup;
    cube.apply(m);
    player.playMove(before, m);
  }

  function redraw(): void {
    player.load(cube.setup, [], 0);
    showStatus();
  }

  function closeHint(): void {
    if (!hintOpen) return;
    hintOpen = false;
    player.highlight(FULL_MASK);
  }

  function showHint(): void {
    if (playing) return;
    const hint = hinter.next(cube.state);
    hintOpen = true;
    if (hint.kind === 'solved') {
      player.highlight(FULL_MASK);
      status.replaceChildren(h('div', { class: 'hint-card' }, h('strong', {}, 'Already solved!'), h('span', { class: 'muted' }, 'Tap Scramble for a new cube.')));
      return;
    }
    player.highlight(pieceMask(hint.pieces));
    renderHint(hint, false);
  }

  function renderHint(hint: HintStep, isPlaying: boolean): void {
    status.replaceChildren(h('div', { class: 'hint-card' },
      h('strong', {}, `Stage ${hint.stageIndex + 1} of ${STAGES.length}: ${hint.title}`),
      h('span', {}, hint.note),
      h('div', { class: 'chips' }, ...hint.moves.map((m) => h('div', { class: 'chip' }, h('b', {}, prettyMove(m)), h('small', {}, shortMoveWords(m))))),
      isPlaying
        ? h('span', { class: 'muted' }, 'Playing...')
        : h('button', { class: 'btn btn-primary', onclick: () => void doItForMe(hint) }, 'Do it for me'),
    ));
  }

  async function doItForMe(hint: HintStep): Promise<void> {
    playing = true;
    controls.forEach((b) => b.setAttribute('disabled', ''));
    renderHint(hint, true);
    player.setTempo(SLOW_TEMPO);
    for (const m of hint.moves) {
      if (stopped) return;
      playMove(m);
      await new Promise((r) => setTimeout(r, slowMoveMs(m)));
    }
    if (stopped) return;
    player.setTempo(DEFAULT_TEMPO);
    player.highlight(FULL_MASK);
    playing = false;
    controls.forEach((b) => b.removeAttribute('disabled'));
    hintOpen = false;
    showStatus();
    if (!(stage && stageDone(stage.id, cube.state)) && !cube.solved) {
      status.prepend(h('span', {}, 'Done! Tap Hint for the next step.'));
    }
  }

  newCube(false);
  redraw();
  // The beginner solver builds small tables on first use; do it now, not on the first Hint tap.
  // A stage cube was already solved once to make it, so only free practice needs this.
  const warm = stage ? undefined : setTimeout(() => { if (!stopped) solveBeginner(applyMoves(SOLVED, randomScramble())); }, 300);
  return () => {
    stopped = true;
    clearTimeout(warm);
    player.dispose();
  };
}
