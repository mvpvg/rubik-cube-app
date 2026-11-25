import './scan.css';
import { go, goBack, type Cleanup } from '../app/router';
import { hasWorkToKeep, saveSession, session, startNewWork, type RGB } from '../app/session';
import { COLOR_HEX, COLOR_NAME, type Color } from '../cube/facelets';
import { mergeSide } from '../review/merge-side';
import { confirmDelete } from '../ui/confirm';
import { h, icon } from '../ui/dom';
import { keepScreenOn } from '../ui/wake-lock';
import { grabCells, startCamera, stopCamera } from './camera';
import { classify } from './classify';
import { cap, ScanFlow, STEPS, turnFor } from './scan-flow';
import { rgbCss } from './sample';
import { turnPicture } from './turn-picture';

const PREVIEW_MS = 250;
const BEAT_MS = 1000; // how long "Got it!" shows after a picture
const LOCK_MS = 600; // "Take picture" waits this long after "I turned it", so a double tap takes no picture
// Equal preview ticks in a row before the camera box changes what it says.
const TICKS = { ready: 2, none: 2, other: 3 };
const PLAIN = 'Fit the side in the squares';
// Pairs the camera can mix up in poor light, so the words say "may be".
const MIX: Partial<Record<Color, Color>> = { W: 'Y', Y: 'W', R: 'O', O: 'R' };
type Live = 'ready' | 'none' | Color;
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
  // The band shows which color goes on top. The hint says it in words, so screen readers skip it.
  const band = h('div', { class: 'scan-band', 'aria-hidden': 'true' });
  // "Side found" in the camera: a thick border and this check mark, not color alone.
  const found = h('span', { class: 'scan-found', 'aria-hidden': 'true' }, icon('check', 20));
  const camera = h('div', { class: 'scan-camera' }, video, band, grid, found, guide);

  const sides = STEPS.map((_, i) => h('button', { class: 'scan-side', onclick: () => { flow.retake(i); show(); } }));
  const count = h('span', { class: 'muted' });
  const picture = turnPicture({ again: () => { if (badge.hidden) openGuide(); } });
  const headline = h('h1', { class: 'h1', 'aria-live': 'polite' });
  const turn = h('p', { class: 'sub' });
  const hint = h('span');
  const swatch = h('span', { class: 'scan-swatch', 'aria-hidden': 'true' });
  // The live words sit under the camera, so they never cover a square. They are not a live region:
  // they change four times a second. A problem message takes their place while it shows.
  const line = h('p', { class: 'scan-live' }, PLAIN);
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
        headline,
        h('div', { class: 'scan-camera-box' }, camera),
        line,
        problem,
        take,
        ready,
        turned,
        // On a short phone everything from here may sit below the fold, so the camera keeps its size.
        h('div', { class: 'row' }, picture.el, h('div', { class: 'scan-text', 'aria-live': 'polite' }, turn)),
        h('div', { class: 'scan-hint' }, swatch, hint),
        keepOld,
        anyway,
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
    say(null);
    anyway.hidden = true;
    keepOld.hidden = !flow.retaking;
    if (flow.index !== shown) {
      shown = flow.index;
      openGuide();
    }
  }

  function say(message: string | null): void {
    problem.textContent = message;
    problem.hidden = !message;
    line.hidden = !!message;
  }

  // The three main buttons share one place, so one shows at a time, and focus moves with it.
  // A button that waits is turned off with aria-disabled, not disabled, so it keeps focus: a disabled
  // button drops focus to the page.
  function mainButton(which: HTMLButtonElement, off = false): void {
    const main = [take, ready, turned];
    const focused = main.includes(document.activeElement as HTMLButtonElement);
    for (const button of main) button.hidden = button !== which;
    which.setAttribute('aria-disabled', String(off));
    if (focused) which.focus();
  }

  function openGuide(): void {
    if (noCamera) return;
    const { from, turns } = turnFor(flow.index, flow.inOrder);
    big.show(from, turns, flow.step.center);
    guide.hidden = false;
    setLive('none');
    window.clearTimeout(lock);
    mainButton(turns.length ? turned : ready);
  }

  function closeGuide(): void {
    guide.hidden = true;
    big.stop();
    setLive('none');
    mainButton(take, true);
    lock = window.setTimeout(() => mainButton(take), LOCK_MS);
  }

  // The big cube shows the side just taken, in its colors, for a second; then the scan moves on.
  function gotIt(then: () => void): void {
    window.clearTimeout(lock);
    // A side tap would cancel the move on; show() turns the taken sides back on.
    sides.forEach((side) => { side.disabled = true; });
    const step = STEPS[shown];
    picture.paint(flow.samples());
    big.paint(flow.samples());
    big.show(step.hold, [], step.center);
    guide.hidden = false;
    setLive('none');
    badge.hidden = false;
    turn.textContent = 'Got it.';
    // A second tap on "Use it anyway" would save the picture again.
    say(null);
    anyway.hidden = keepOld.hidden = true;
    mainButton(take, true);
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
      // In place of the scan, so Back from the color check does not reopen the camera.
      return gotIt(() => go('review', param, { replace: true }));
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
    gotIt(flow.done ? () => go('review', undefined, { replace: true }) : show);
  }

  function capture(): void {
    if (take.getAttribute('aria-disabled') === 'true') return;
    const cells = grabCells(video, canvas, 300);
    if (!cells) return say('The camera is starting. Try again in a moment.');
    const result = flow.capture(cells);
    if (result.ok) return next();
    say(result.message);
    anyway.hidden = !result.canUseAnyway;
  }

  function cameraFailed(): void {
    noCamera = true;
    setLive('none');
    say(null);
    window.clearTimeout(lock);
    big.stop();
    mainButton(take, true);
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
    (s) => {
      if (stopped) return stopCamera(s);
      stream = s;
      // Permission taken back, or another app took the camera. The saved sides stay saved.
      s.getVideoTracks()[0]?.addEventListener('ended', cameraFailed);
    },
    () => { if (!stopped) cameraFailed(); },
  );

  // What the camera box says about the side it sees. It changes only after a short run of equal
  // ticks, so one odd frame does not make the words flicker.
  let live: Live = 'none'; // what the camera box says now
  let last: Live = 'none'; // what the last tick saw
  let streak = 0; // how many ticks in a row saw `last`
  function setLive(state: Live): void {
    live = state;
    streak = 0;
    camera.classList.toggle('ready', state === 'ready');
    if (state === 'ready') {
      line.textContent = `${cap(COLOR_NAME[flow.step.center])} side found`;
      say(null);
    // Under the big cube, or with no camera, there are no squares to fit.
    } else if (state === 'none') line.textContent = guide.hidden && !noCamera ? PLAIN : '';
    else line.textContent = `That ${MIX[state] === flow.step.center ? 'may be' : 'looks like'} ${COLOR_NAME[state]}`;
  }
  function check(cells: RGB[]): void {
    const look = flow.look(cells);
    const now: Live = look === 'match' ? 'ready' : look ?? 'none';
    streak = now === last ? streak + 1 : 1;
    last = now;
    if (now !== live && streak >= TICKS[now === 'ready' || now === 'none' ? now : 'other']) setLive(now);
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
  const letScreenDim = keepScreenOn();

  return () => {
    stopped = true;
    letScreenDim();
    window.clearTimeout(beat);
    window.clearTimeout(lock);
    picture.stop();
    big.stop();
    window.clearInterval(timer);
    stopCamera(stream);
    video.srcObject = null;
  };
}
