import './scan.css';
import { go, type Cleanup } from '../app/router';
import { session, type RGB } from '../app/session';
import { COLOR_HEX, COLOR_NAME } from '../cube/facelets';
import { h, icon } from '../ui/dom';
import { grabCells, startCamera, stopCamera } from './camera';
import { ScanFlow, STEPS, turnFor } from './scan-flow';
import { turnPicture } from './turn-picture';

const PREVIEW_MS = 250;
const rgbCss = ([r, g, b]: RGB) => `rgb(${r},${g},${b})`;

export function scanScreen(root: HTMLElement): Cleanup {
  const flow = new ScanFlow();
  const canvas = document.createElement('canvas');
  const previewCanvas = document.createElement('canvas');
  const video = h('video', { class: 'scan-video', playsinline: true, muted: true, autoplay: true });
  const chips = Array.from({ length: 9 }, () => h('span', { class: 'scan-chip' }));
  const grid = h('div', { class: 'scan-grid' }, ...chips.map((chip) => h('div', { class: 'scan-cell' }, chip)));
  const camera = h('div', { class: 'scan-camera' }, video, grid, h('div', { class: 'scan-pill' }, 'Fit the side inside the squares'));

  const progress = STEPS.map(() => h('span', { class: 'scan-dot' }));
  const count = h('span', { class: 'muted' });
  const picture = turnPicture();
  const headline = h('h1', { class: 'h1' });
  const turn = h('p', { class: 'sub' });
  const hint = h('span');
  const problem = h('p', { class: 'note scan-problem', role: 'alert', hidden: true });
  const anyway = h('button', { class: 'btn btn-ghost btn-wide', hidden: true, onclick: () => { flow.useAnyway(); next(); } }, 'Use it anyway');
  const take = h('button', { class: 'btn btn-primary btn-wide scan-take', onclick: capture }, icon('camera', 26), 'Take picture');

  root.append(
    h('section', { class: 'screen scan' },
      h('div', { class: 'topbar' },
        h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => go('home') }, icon('back')),
        h('div', { class: 'scan-progress' }, ...progress),
        count,
      ),
      camera,
      h('div', { class: 'row' }, picture.el, h('div', { class: 'scan-text', 'aria-live': 'polite' }, headline, turn)),
      h('div', { class: 'scan-hint' }, hint),
      problem,
      h('div', { class: 'spacer' }),
      anyway,
      take,
      h('button', { class: 'link', onclick: () => go('review', 'manual') }, 'Type in the colors instead'),
    ),
  );

  function show(): void {
    const step = flow.step;
    const name = COLOR_NAME[step.center];
    progress.forEach((dot, i) => {
      dot.style.background = i <= flow.index ? COLOR_HEX[STEPS[i].center] : '';
    });
    count.textContent = `${flow.index + 1} of ${STEPS.length}`;
    // True: this side comes right after the last one taken. False starts from white on top, green facing you.
    const { from, turns, words } = turnFor(flow.index, true);
    picture.show(from, turns, step.center);
    headline.textContent = `Show the ${name} side`;
    turn.textContent = words;
    hint.textContent = step.hint;
    problem.hidden = true;
    anyway.hidden = true;
  }

  function next(): void {
    if (flow.done) {
      session.samples = flow.samples();
      go('review');
    } else show();
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
    camera.replaceChildren(
      h('div', { class: 'scan-nocam' },
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
