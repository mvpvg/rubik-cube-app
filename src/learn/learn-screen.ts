import './learn.css';
import { go, type Cleanup } from '../app/router';
import { session } from '../app/session';
import { load, save } from '../app/storage';
import { COLOR_HEX, COLOR_OF_FACE, invertMoves, type Face } from '../cube/facelets';
import { solveInWorker } from '../solve/fast-solve';
import { h, icon } from '../ui/dom';
import { holdNote } from '../ui/hold';
import { moveWords, prettyMove } from '../ui/move-words';
import { moreHelpLink } from '../ui/more-help';
import { CubePlayer, FULL_MASK } from '../ui/player';
import { firstUnfinishedStage, solveBeginner, STAGES, type StageId, type StagePlan } from './beginner-solver';

type Progress = { cube: string; stage: number; move: number };
const KEY = 'learn.progress';

interface FlatMove { move: string; sub: number; inSub: number }

function flatten(plan: StagePlan): FlatMove[] {
  return plan.subSteps.flatMap((s, sub) => s.moves.map((move, inSub) => ({ move, sub, inSub })));
}

// Which pieces each early stage is about; the rest are dimmed. Later stages use the whole cube.
const STAGE_MASKS: Partial<Record<StageId, string>> = {
  'white-cross': 'EDGES:----DDDDDDDD,CORNERS:DDDDDDDD,CENTERS:------',
  'white-corners': 'EDGES:----DDDDDDDD,CORNERS:----DDDD,CENTERS:------',
  'middle-layer': 'EDGES:----DDDD----,CORNERS:----DDDD,CENTERS:------',
};

const colorAt = (state: string, i: number) => COLOR_HEX[COLOR_OF_FACE[state[i] as Face]];

export function learnScreen(root: HTMLElement): Cleanup | void {
  const scanned = session.facelets;
  if (!scanned) {
    go('home');
    return;
  }
  const cube: string = scanned;

  let plans: StagePlan[];
  try {
    plans = solveBeginner(cube);
  } catch {
    root.append(h('section', { class: 'screen' },
      h('h1', {}, 'Let’s check the colors'),
      h('p', { class: 'sub' }, 'These colors do not make a real cube. One square is probably wrong.'),
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn btn-primary btn-wide', onclick: () => go('review') }, 'Check the colors'),
    ));
    return;
  }
  const saved = load<Progress>(KEY);
  // Progress belongs to this cube. A new scan starts at the first stage it has not finished.
  let stage: number;
  let pos: number;
  if (saved && saved.cube === cube) {
    stage = saved.stage;
    pos = saved.move;
  } else {
    const first = firstUnfinishedStage(cube);
    stage = first === null ? STAGES.length : STAGES.findIndex((s) => s.id === first);
    pos = 0;
  }

  const bar = h('div', { class: 'stage-bar', role: 'img' });
  const stageLabel = h('div', { class: 'muted' });
  const title = h('h1', {});
  const goal = h('p', { class: 'sub' });
  const hold = h('div', {});
  const player = new CubePlayer('3D cube showing this stage');
  const card = h('div', { class: 'card' });
  const controls = h('div', { class: 'controls' });

  root.append(
    h('section', { class: 'screen learn' },
      h('div', { class: 'topbar' },
        h('button', { class: 'icon-btn', 'aria-label': 'Back to checking colors', onclick: () => go('review') }, icon('back')),
        bar,
        h('button', { class: 'link', style: 'padding:8px', onclick: () => go('moves') }, 'Moves'),
        h('button', { class: 'icon-btn', 'aria-label': 'My cube looks different. Scan again', onclick: () => go('scan') }, icon('rescan')),
      ),
      h('div', { style: 'display:flex;flex-direction:column;gap:6px' }, stageLabel, title, goal),
      hold,
      h('div', { class: 'player-box' }, player.el),
      card,
      controls,
    ),
  );

  let base: string[] | null = null; // moves from solved to the scanned cube, for the 3D player

  function priorMoves(upTo: number): string[] {
    return plans.slice(0, upTo).flatMap((p) => p.subSteps.flatMap((s) => s.moves));
  }

  function keep(): void {
    save(KEY, { cube, stage, move: pos } satisfies Progress);
  }

  function loadPlayer(): void {
    if (!base || stage >= plans.length) return;
    player.load([...base, ...priorMoves(stage)], flatten(plans[stage]).map((f) => f.move), pos);
    player.highlight(STAGE_MASKS[plans[stage].id] ?? FULL_MASK);
  }

  function render(): void {
    bar.setAttribute('aria-label', `Stage ${Math.min(stage + 1, STAGES.length)} of ${STAGES.length}`);
    bar.replaceChildren(...STAGES.map((_, i) => h('span', { class: i < stage ? 'done' : i === stage ? 'now' : '' })));

    if (stage >= plans.length) {
      stageLabel.textContent = `All ${STAGES.length} stages`;
      title.textContent = 'You solved it!';
      goal.textContent = 'Every side is one color. Scramble it and try again without the app.';
      hold.replaceChildren();
      card.className = 'card cheer';
      card.replaceChildren(h('div', { class: 'h1' }, 'Great job!'));
      controls.replaceChildren(h('div', { style: 'display:flex;flex-direction:column;gap:8px;width:100%' },
        h('button', { class: 'btn btn-primary btn-wide', onclick: () => go('scan') }, icon('camera'), 'Scan a new cube'),
        moreHelpLink(),
      ));
      return;
    }

    const plan = plans[stage];
    const flat = flatten(plan);
    stageLabel.textContent = `Stage ${stage + 1} of ${STAGES.length}`;
    title.textContent = plan.title;
    goal.textContent = plan.goal;
    hold.replaceChildren(holdNote(colorAt(plan.startState, 4), colorAt(plan.startState, 22), plan.hold));
    card.className = 'card';

    const backBtn = h('button', { class: 'btn btn-ghost', onclick: back, disabled: pos === 0 && stage === 0 }, icon('back', 20), 'Back');

    if (flat.length === 0 || pos >= flat.length) {
      card.replaceChildren(
        h('div', { class: 'h1', style: 'text-align:center;font-size:26px' }, flat.length === 0 ? plan.note : 'Stage done!'),
        h('p', { class: 'sub', style: 'text-align:center' }, 'Does your cube look like the one on screen?'),
      );
      card.className = 'card cheer';
      controls.replaceChildren(backBtn, h('button', { class: 'btn btn-primary', onclick: nextStage }, icon('check', 20), 'I did it!'));
      return;
    }

    const cur = flat[pos];
    const sub = plan.subSteps[cur.sub];
    card.replaceChildren(
      ...(pos === 0 && plan.note ? [h('p', { class: 'sub' }, plan.note)] : []),
      h('div', { class: 'muted' }, `Step ${cur.sub + 1} of ${plan.subSteps.length}`),
      h('p', { class: 'step-note' }, sub.note),
      h('div', { class: 'chips' }, ...sub.moves.map((m, k) => h('div', {
        class: `chip${k < cur.inSub ? ' past' : k === cur.inSub ? ' now' : ''}`,
      }, h('b', {}, prettyMove(m)), h('small', {}, moveWords(m))))),
    );
    controls.replaceChildren(backBtn, h('button', { class: 'btn btn-primary', onclick: next }, 'Next move', icon('next', 20)));
  }

  function next(): void {
    const flat = flatten(plans[stage]);
    if (pos >= flat.length) return;
    pos++;
    player.next();
    keep();
    render();
  }

  function back(): void {
    if (pos > 0) {
      pos--;
      player.back();
    } else if (stage > 0) {
      stage--;
      pos = flatten(plans[stage]).length;
      loadPlayer();
    }
    keep();
    render();
  }

  function nextStage(): void {
    stage++;
    pos = 0;
    keep();
    loadPlayer();
    render();
  }

  render();
  let stopped = false;
  solveInWorker(cube).then((solution) => {
    if (stopped) return;
    base = invertMoves(solution);
    loadPlayer();
  }).catch(() => undefined);

  return () => {
    stopped = true;
    player.dispose();
  };
}
