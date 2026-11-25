import './scan.css';
import { go, goBack, type Cleanup } from '../app/router';
import { hasWorkToKeep, saveSession, session, startNewWork, type RGB } from '../app/session';
import { COLOR_HEX, COLOR_NAME, type Color } from '../cube/facelets';
import { mergeSide } from '../review/merge-side';
import { confirmDelete } from '../ui/confirm';
import { h, icon } from '../ui/dom';
import { grabCells, startCamera, stopCamera } from './camera';
import { classify } from './classify';
import { cap, ScanFlow, STEPS, turnFor } from './scan-flow';
import { rgbCss } from './sample';
import { turnPicture } from './turn-picture';

const PREVIEW_MS = 250;
const BEAT_MS = 1000; // how long "Got it!" shows after a picture
const LOCK_MS = 600;
// Equal preview ticks in a row before the camera box changes what it says.
const TICKS = { ready: 2, none: 2, other: 3 };
const PLAIN = 'Fit the side inside the squares';
// Pairs the camera can mix up in poor light, so the words say "may be".
const MIX: Partial<Record<Color, Color>> = { W: 'Y', Y: 'W', R: 'O', O: 'R' };
type Live = 'ready' | 'none' | Color; // "Take picture" waits this long after "I turned it", so a double tap takes no picture
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
  // The big cube covers the camera between sides. The camera keeps running under it.
  const big = turnPicture({ big: true });
  const badge = h('div', { class: 'scan-gotit', hidden: true }, icon('check', 28), 'Got it!');
  // The words beside the small cube say the same thing, so screen readers skip the big cube.
  const guide = h('div', { class: 'scan-guide', 'aria-hidden': 'true', hidden: true }, badge, big.el);
  // The pill is not a live region: its words change four times a second.
  const pill = h('div', { class: 'scan-pill' }, PLAIN);
  // The band shows which color goes on top. The hint says it in words, so screen readers skip it.
  const band = h('div', { class: 'scan-band', 'aria-hidden': 'true' });
  const camera = h('div', { class: 'scan-camera' }, video, band, grid, pill, guide);

  const sides = STEPS.map((_, i) => h('button', { class: 'scan-side', onclick: () => { flow.retake(i); show(); } }));
  const count = h('span', { class: 'muted' });
  const picture = turnPicture({ again: () => { if (badge.hidden) openGuide(); } });
  const headline = h('h1', { class: 'h1' });
  const turn = h('p', { class: 'sub' });
  const hint = h('span');
  const swatch = h('span', { class: 'scan-swatch', 'aria-hidden': 'true' });
  const problem = h('p', { class: 'note scan-problem', role: 'alert', hidden: true });
  const keepOld = h('button', { class: 'btn btn-ghost btn-wide', hidden: true, onclick: () => {
    if (oneSide) return toCheck();
    flow.keepOld();
    show();
  } }, 'Keep my old one');
  const anyway = h('button', { class: 'btn btn-ghost btn-wide', hidden: true, onclick: () => { flow.useAnyway(); next(); } }, 'Use it anyway');
  const take = h('button', { class: 'btn btn-primary btn-wide scan-take', onclick: capture }, icon('camera', 26), 'Take picture');
  // Two buttons, not one with new words, so each keeps its own name.
  const ready = h('button', { class: 'btn btn-primary btn-wide scan-take', hidden: true, onclick: closeGuide }, "I'm ready");
  const turned = h('button', { class: 'btn btn-primary btn-wide scan-take', hidden: true, onclick: closeGuide }, 'I turned it');

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
        h('div', { class: 'scan-hint' }, swatch, hint),
        problem,
        h('div', { class: 'spacer' }),
        keepOld,
        anyway,
        take,
        ready,
        turned,
      ),
      oneSide ? null : h('button', { class: 'link', onclick: () => go('review', 'manual') }, 'Type in the colors instead'),
    ),
  );

  let shown = -1; // the side the screen asked for last
  let beat = 0;
  let lock = 0;
  let noCamera = false;

  function show(): void {
    window.clearTimeout(beat);
    badge.hidden = true;
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
    picture.paint(flow.samples());
    big.paint(flow.samples());
    picture.show(from, turns, step.center);
    headline.textContent = `Show the ${name} side`;
    turn.textContent = words;
    hint.textContent = step.hint;
    band.style.background = swatch.style.background = COLOR_HEX[step.topColor];
    problem.hidden = true;
    anyway.hidden = true;
    keepOld.hidden = !flow.retaking;
    if (flow.index !== shown) {
      shown = flow.index;
      openGuide();
    }
  }

  // The big cube plays the turns to this side and waits for the child to say the turn is done.
  function openGuide(): void {
    if (noCamera) return;
    const { from, turns } = turnFor(flow.index, flow.inOrder);
    big.show(from, turns, flow.step.center);
    guide.hidden = false;
    setLive('none');
    window.clearTimeout(lock);
    take.hidden = true;
    ready.hidden = turns.length > 0;
    turned.hidden = !ready.hidden;
  }

  function closeGuide(): void {
    const focused = document.activeElement === ready || document.activeElement === turned;
    guide.hidden = true;
    big.stop();
    ready.hidden = turned.hidden = true;
    take.hidden = false;
    take.disabled = true;
    lock = window.setTimeout(() => {
      take.disabled = false;
      if (focused) take.focus();
    }, LOCK_MS);
  }

  // The big cube shows the side just taken, in its colors, for a second; then the scan moves on.
  function gotIt(then: () => void): void {
    const step = STEPS[shown];
    picture.paint(flow.samples());
    big.paint(flow.samples());
    big.show(step.hold, [], step.center);
    guide.hidden = false;
    setLive('none');
    badge.hidden = false;
    turn.textContent = 'Got it.';
    // A second tap on "Use it anyway" would save the picture again.
    problem.hidden = anyway.hidden = keepOld.hidden = true;
    ready.hidden = turned.hidden = true;
    take.hidden = false;
    take.disabled = true;
    beat = window.setTimeout(then, BEAT_MS);
  }

  // Each accepted picture is saved. The sixth also runs the color match, in the same save, so the
  // color check only ever reads saved colors and a refresh cannot run the match twice.
  function next(): void {
    if (oneSide) {
      const face = Math.floor(STEPS[only].cells[0] / 9);
      // The other sides, and the child's fixes on them, stay as they are.
      Object.assign(session, mergeSide({ ...session, colors: session.colors! }, face, flow.samples().slice(face * 9, face * 9 + 9) as RGB[]));
      saveSession();
      return gotIt(toCheck);
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
    gotIt(flow.done ? () => go('review') : show);
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
    noCamera = true;
    window.clearTimeout(lock);
    big.stop();
    ready.hidden = turned.hidden = true;
    take.hidden = false;
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

  // What the camera box says about the side it sees. It changes only after a short run of equal
  // ticks, so one odd frame does not make the words flicker.
  let seen: Live = 'none';
  let streak = 0;
  function setLive(state: Live): void {
    seen = state;
    streak = 0;
    const asked = COLOR_NAME[flow.step.center];
    camera.classList.toggle('ready', state === 'ready');
    if (state === 'ready') {
      pill.replaceChildren(icon('check', 20), `${cap(asked)} side found. Take the picture.`);
      problem.hidden = anyway.hidden = true; // the last wrong picture no longer matters
    } else if (state === 'none') pill.textContent = PLAIN;
    else pill.textContent = `This ${MIX[state] === flow.step.center ? 'may be' : 'is'} the ${COLOR_NAME[state]} side. Show the ${asked} side.`;
  }
  let last: Live = 'none';
  function check(cells: RGB[]): void {
    const look = flow.look(cells);
    const now: Live = look === 'match' ? 'ready' : look ?? 'none';
    streak = now === last ? streak + 1 : 1;
    last = now;
    if (now !== seen && streak >= TICKS[now === 'ready' || now === 'none' ? now : 'other']) setLive(now);
  }

  // Live preview: tint each cell's chip with what the camera sees, and check the side while aiming.
  const timer = window.setInterval(() => {
    if (document.hidden) return;
    const cells = grabCells(video, previewCanvas, 150);
    if (!cells) return;
    cells.forEach((c, i) => { chips[i].style.background = rgbCss(c); });
    if (guide.hidden && !noCamera) check(cells);
  }, PREVIEW_MS);

  show();

  return () => {
    stopped = true;
    window.clearTimeout(beat);
    window.clearTimeout(lock);
    picture.stop();
    big.stop();
    window.clearInterval(timer);
    stopCamera(stream);
    video.srcObject = null;
  };
}
