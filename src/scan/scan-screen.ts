import './scan.css';
import { go, goBack, type Cleanup } from '../app/router';
import { hasWorkToKeep, saveSession, session, startNewWork, type RGB } from '../app/session';
import { COLOR_HEX, COLOR_NAME } from '../cube/facelets';
import { mergeSide } from '../review/merge-side';
import { confirmDelete } from '../ui/confirm';
import { h, icon } from '../ui/dom';
import { grabCells, startCamera, stopCamera } from './camera';
import { classify } from './classify';
import { cap, ScanFlow, STEPS, turnFor } from './scan-flow';
import { turnPicture } from './turn-picture';

const PREVIEW_MS = 250;
const rgbCss = ([r, g, b]: RGB) => `rgb(${r},${g},${b})`;
const REPLACE_WORDS = { question: 'Start over with this picture? Your saved cube will be deleted.', keep: 'Keep my cube', drop: 'Delete and start over' };

let agreed = false;
// "No, scan it again" at the cube check already agrees to replace the work, so the scan does not ask again.
export function scanAgain(): void {
  agreed = true;
  go('scan');
}

export function scanScreen(root: HTMLElement, param?: string): Cleanup {
  // `#/scan/<color>` takes that one side again from the color check, and goes back there.
  const only = STEPS.findIndex((s) => s.center === param);
  const oneSide = only >= 0;
  if (oneSide && !session.colors) {
    go('home');
    return () => {};
  }
  const toCheck = () => go('review', param);
  // A scan left part-way goes on from its saved sides, so its next picture replaces nothing.
  const continuing = !oneSide && session.route === 'scan';
  let flow = new ScanFlow(oneSide || continuing ? session.samples : null);
  if (oneSide) flow.retake(only);
  let started = continuing; // opening the scan never touches saved work; the first picture does
  const noQuestion = agreed;
  agreed = false;
  const canvas = document.createElement('canvas');
  const previewCanvas = document.createElement('canvas');
  const video = h('video', { class: 'scan-video', playsinline: true, muted: true, autoplay: true });
  const chips = Array.from({ length: 9 }, () => h('span', { class: 'scan-chip' }));
  const grid = h('div', { class: 'scan-grid' }, ...chips.map((chip) => h('div', { class: 'scan-cell' }, chip)));
  const camera = h('div', { class: 'scan-camera' }, video, grid, h('div', { class: 'scan-pill' }, 'Fit the side inside the squares'));

  const sides = STEPS.map((_, i) => h('button', { class: 'scan-side', onclick: () => { flow.retake(i); show(); } }));
  const count = h('span', { class: 'muted' });
  const picture = turnPicture();
  const headline = h('h1', { class: 'h1' });
  const turn = h('p', { class: 'sub' });
  const hint = h('span');
  const problem = h('p', { class: 'note scan-problem', role: 'alert', hidden: true });
  const keepOld = h('button', { class: 'btn btn-ghost btn-wide', hidden: true, onclick: () => {
    if (oneSide) return toCheck();
    flow.keepOld();
    show();
  } }, 'Keep my old one');
  const anyway = h('button', { class: 'btn btn-ghost btn-wide', hidden: true, onclick: () => { flow.useAnyway(); next(); } }, 'Use it anyway');
  const take = h('button', { class: 'btn btn-primary btn-wide scan-take', onclick: capture }, icon('camera', 26), 'Take picture');

  root.append(
    h('section', { class: 'screen scan' },
      h('div', { class: 'fit' },
        h('div', { class: 'topbar' },
          h('button', { class: 'top-btn', 'aria-label': 'Back', onclick: () => (oneSide ? toCheck() : goBack()) }, icon('back'), 'Back'),
          oneSide ? null : count,
        ),
        // One side from the color check has one job, so nothing here leads away from it.
        oneSide ? null : h('div', { class: 'scan-sides' }, ...sides),
        h('div', { class: 'scan-camera-box' }, camera),
        h('div', { class: 'row' }, picture.el, h('div', { class: 'scan-text', 'aria-live': 'polite' }, headline, turn)),
        h('div', { class: 'scan-hint' }, hint),
        problem,
        h('div', { class: 'spacer' }),
        keepOld,
        anyway,
        take,
      ),
      oneSide ? null : h('button', { class: 'link', onclick: () => go('review', 'manual') }, 'Type in the colors instead'),
    ),
  );

  function show(): void {
    const step = flow.step;
    const name = COLOR_NAME[step.center];
    sides.forEach((side, i) => {
      const taken = flow.taken(i), now = i === flow.index;
      const color = COLOR_NAME[STEPS[i].center];
      const label = `${cap(color)} side`;
      side.style.background = taken || now ? COLOR_HEX[STEPS[i].center] : '';
      side.classList.toggle('now', now);
      side.disabled = now || !taken;
      side.setAttribute('aria-label', now ? `${label}, now` : taken ? `${label}, taken. Tap to take again` : `${label}, not taken yet`);
    });
    count.textContent = `${flow.index + 1} of ${STEPS.length}`;
    const { from, turns, words } = turnFor(flow.index, flow.inOrder);
    picture.show(from, turns, step.center);
    headline.textContent = `Show the ${name} side`;
    turn.textContent = words;
    hint.textContent = step.hint;
    problem.hidden = true;
    anyway.hidden = true;
    keepOld.hidden = !flow.retaking;
  }

  // Each accepted picture is saved. The sixth also runs the color match, in the same save, so the
  // color check only ever reads saved colors and a refresh cannot run the match twice.
  function next(): void {
    if (oneSide) {
      const face = Math.floor(STEPS[only].cells[0] / 9);
      // The other sides, and the child's fixes on them, stay as they are.
      Object.assign(session, mergeSide({ ...session, colors: session.colors! }, face, flow.samples().slice(face * 9, face * 9 + 9) as RGB[]));
      saveSession();
      return toCheck();
    }
    if (started || noQuestion || !hasWorkToKeep()) return save();
    // The picture waits here, unsaved, until the child agrees to delete the old work.
    confirmDelete(root, REPLACE_WORDS).then((drop) => {
      if (drop) return save();
      flow = new ScanFlow();
      show();
    });
  }

  function save(): void {
    const samples = flow.samples();
    const step = flow.done
      ? { samples, ...classify(samples as RGB[]), filled: [], route: 'review' }
      : { samples, route: 'scan' };
    if (started) {
      Object.assign(session, step);
      saveSession();
    } else {
      started = true;
      startNewWork(step); // the old work is replaced here, at the first picture
    }
    if (flow.done) go('review');
    else show();
  }

  function capture(): void {
    const cells = grabCells(video, canvas, 300);
    if (!cells) return;
    const result = flow.capture(cells);
    if (result.ok) return next();
    problem.textContent = result.message;
    problem.hidden = false;
    anyway.hidden = !result.canUseAnyway;
  }

  function cameraFailed(): void {
    take.disabled = true;
    camera.replaceChildren(oneSide
      ? h('div', { class: 'scan-nocam' },
        h('p', { class: 'sub' }, 'The camera is not working. Go back and fix the squares by hand.'),
        h('button', { class: 'btn btn-primary', onclick: toCheck }, icon('back'), 'Go back to the colors'),
      )
      : h('div', { class: 'scan-nocam' },
        h('p', { class: 'sub' }, 'The camera is not working here. You can type in the colors instead.'),
        h('button', { class: 'btn btn-primary', onclick: () => go('review', 'manual') }, icon('hand'), 'Type in the colors'),
      ),
    );
  }

  let stream: MediaStream | null = null;
  let stopped = false;
  startCamera(video).then(
    (s) => { if (stopped) stopCamera(s); else stream = s; },
    () => { if (!stopped) cameraFailed(); },
  );

  // Live preview: tint each cell's chip with what the camera sees.
  const timer = window.setInterval(() => {
    if (document.hidden) return;
    const cells = grabCells(video, previewCanvas, 150);
    if (cells) cells.forEach((c, i) => { chips[i].style.background = rgbCss(c); });
  }, PREVIEW_MS);

  show();

  return () => {
    stopped = true;
    picture.stop();
    window.clearInterval(timer);
    stopCamera(stream);
    video.srcObject = null;
  };
}
