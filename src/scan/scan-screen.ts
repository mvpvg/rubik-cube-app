import './scan.css';
import { readCubeLink } from '../app/cube-link';
import { isRoom, keepRoom, listen, newRoom } from '../app/relay';
import { go, goBack, type Cleanup } from '../app/router';
import { hasWorkToKeep, saveSession, session, startNewWork, type RGB } from '../app/session';
import { COLOR_HEX, COLOR_NAME, faceOf, TEXT_ON, type Color } from '../cube/facelets';
import { mergeSide } from '../review/merge-side';
import { confirmDelete } from '../ui/confirm';
import { h, icon } from '../ui/dom';
import { qrCode } from '../ui/qr';
import { keepScreenOn } from '../ui/wake-lock';
import { grabCells, startCamera, stopCamera } from './camera';
import { classify, sideColors } from './classify';
import { cap, ScanFlow, STEPS, turnFor } from './scan-flow';
import { nearestColor, rgbCss } from './sample';
import { turnPicture } from './turn-picture';

const PREVIEW_MS = 250;
// "Take picture" waits this long after "I turned it", and Next after a picture, so a double tap does nothing.
const LOCK_MS = 600;
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
  // `#/scan/<room>` is a phone opened from the QR code. Any other full scan is a fresh start, so an
  // old room is dropped: its computer may have stopped listening.
  if (!oneSide) keepRoom(isRoom(param) ? param : null);
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
  // The words beside the small cube say the same thing, so screen readers skip the big cube.
  const guide = h('div', { class: 'scan-guide', 'aria-hidden': 'true', hidden: true }, big.el);
  // The colors the app read from a picture, for the child to check before it is saved.
  const panel = h('div', { class: 'scan-check', hidden: true });
  // The band shows which color goes on top. The hint says it in words, so screen readers skip it.
  const band = h('div', { class: 'scan-band', 'aria-hidden': 'true' });
  // "Side found" in the camera: a thick border and this check mark, not color alone.
  const found = h('span', { class: 'scan-found', 'aria-hidden': 'true' }, icon('check', 20));
  const camera = h('div', { class: 'scan-camera' }, video, band, grid, found, guide, panel);

  const sides = STEPS.map((_, i) => h('button', { class: 'scan-side', onclick: () => { flow.retake(i); show(); } }));
  const count = h('span', { class: 'muted' });
  const picture = turnPicture({ again: () => { if (panel.hidden) openGuide(); } });
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
  const anyway = h('button', { class: 'btn btn-ghost btn-wide', hidden: true, onclick: () => showCheck(flow.useAnyway()!, true) }, 'Use it anyway');
  const take = h('button', { class: 'btn btn-primary btn-wide scan-take', onclick: capture }, icon('camera', 26), 'Take picture');
  // Two buttons, not one with new words, so each keeps its own name.
  const ready = h('button', { class: 'btn btn-primary btn-wide scan-take', hidden: true, onclick: closeGuide }, "I'm ready");
  const turned = h('button', { class: 'btn btn-primary btn-wide scan-take', hidden: true, onclick: closeGuide }, 'I turned it');
  const retry = h('button', { class: 'btn btn-ghost', hidden: true, onclick: show }, 'Take it again');
  const nextButton = h('button', { class: 'btn btn-primary', hidden: true, onclick: confirmCheck }, 'Next');
  // A phone has its own camera, so this shows only with a mouse, or when the camera fails.
  const phone = h('button', { class: 'link', hidden: window.matchMedia?.('(any-pointer: coarse)').matches, onclick: openPhone }, 'Scan with your phone');

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
        h('div', { class: 'scan-main' }, take, ready, turned, retry, nextButton),
        // On a short phone everything from here may sit below the fold, so the camera keeps its size.
        h('div', { class: 'row' }, picture.el, h('div', { class: 'scan-text', 'aria-live': 'polite' }, turn)),
        h('div', { class: 'scan-hint' }, swatch, hint),
        keepOld,
        anyway,
      ),
      oneSide ? null : h('button', { class: 'link', onclick: () => go('review', 'manual') }, 'Type in the colors instead'),
      oneSide ? null : phone,
    ),
  );

  let shown = -1; // the side the screen asked for last
  let lock = 0;
  let noCamera = false;
  let pending: RGB[] | null = null; // the picture on the check, not saved yet
  let merged: ReturnType<typeof mergeSide> | null = null; // what Next saves for one side from the color check
  // Leaving the screen removes the phone window without its close event, so the cleanup also stops this.
  let stopWaiting = () => {};

  // Also Take it again: the flow never saw the picture on the check, so showing its state drops it.
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
    } else if (!panel.hidden) closeGuide();
  }

  function say(message: string | null): void {
    problem.textContent = message;
    problem.hidden = !message;
    line.hidden = !!message;
  }

  // The main buttons share one place, so one shows at a time (Next with Take it again beside it), and
  // focus moves with it. A button that waits is turned off with aria-disabled, not disabled, so it keeps
  // focus: a disabled button drops focus to the page.
  function mainButton(which: HTMLButtonElement, off = false): void {
    const main = [take, ready, turned, retry, nextButton];
    const focused = main.includes(document.activeElement as HTMLButtonElement);
    for (const button of main) button.hidden = button !== which && !(which === nextButton && button === retry);
    which.setAttribute('aria-disabled', String(off));
    if (focused) which.focus();
  }

  function openGuide(): void {
    if (noCamera) return closeGuide();
    const { from, turns } = turnFor(flow.index, flow.inOrder);
    big.show(from, turns, flow.step.center);
    guide.hidden = false;
    panel.hidden = true;
    setLive('none');
    window.clearTimeout(lock);
    mainButton(turns.length ? turned : ready);
  }

  // Back to aiming, with nothing from the check left over.
  function closeGuide(): void {
    guide.hidden = panel.hidden = true;
    pending = merged = null;
    big.stop();
    setLive('none');
    mainButton(take, true);
    window.clearTimeout(lock);
    if (!noCamera) lock = window.setTimeout(() => mainButton(take), LOCK_MS);
  }

  // The 9 colors the app read, in the order the camera shows them. Nothing is saved until Next.
  function showCheck(cells: RGB[], anyhow: boolean): void {
    pending = cells;
    let colors = sideColors(cells, flow.step.center, anyhow);
    if (oneSide) {
      // Taken again from the color check: show the colors the merge will save, counted with the other sides.
      const face = faceOf(STEPS[only].cells[0]);
      const own: RGB[] = [];
      STEPS[only].cells.forEach((sticker, i) => { own[sticker - face * 9] = cells[i]; });
      // The other sides, and the child's fixes on them, stay as they are.
      merged = mergeSide({ ...session, colors: session.colors! }, face, own);
      colors = STEPS[only].cells.map((sticker) => merged!.colors[sticker]!);
    }
    panel.replaceChildren(...colors.map((c, i) => h('div', {
      class: 'scan-check-square', role: 'img', 'aria-label': `Square ${i + 1}, ${COLOR_NAME[c]}`,
      style: `background:${COLOR_HEX[c]};color:${TEXT_ON[c]}`,
    }, cap(COLOR_NAME[c]))));
    panel.hidden = false;
    // A side tap would drop the picture unseen; show() turns the taken sides back on.
    sides.forEach((side) => { side.disabled = true; });
    // A second tap on "Use it anyway" would check the picture again.
    say(null);
    anyway.hidden = keepOld.hidden = true;
    setLive('none');
    turn.textContent = 'Check the colors.';
    window.clearTimeout(lock);
    mainButton(nextButton, true);
    lock = window.setTimeout(() => mainButton(nextButton), LOCK_MS);
  }

  function confirmCheck(): void {
    if (nextButton.getAttribute('aria-disabled') === 'true' || !pending) return;
    flow.accept(pending);
    pending = null;
    if (noCamera) showNoCamera();
    next();
  }

  // Each checked picture is saved. The sixth also runs the color match, in the same save, so the
  // color check only ever reads saved colors and a refresh cannot run the match twice.
  function next(): void {
    if (oneSide) {
      Object.assign(session, merged);
      saveSession();
      // In place of the scan, so Back from the color check does not reopen the camera.
      return go('review', param, { replace: true });
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
      ? { samples, ...matchAll(samples as RGB[]), filled: [], route: 'review' }
      : { samples, route: 'scan' };
    if (started) {
      Object.assign(session, step);
      saveSession();
    } else {
      started = true;
      startNewWork(step); // the old work is replaced here, at the first picture
    }
    if (flow.done) go('review', undefined, { replace: true });
    else show();
  }

  // The final match over all 54 samples. A square it reads differently from that side's check is flagged.
  function matchAll(samples: RGB[]): ReturnType<typeof classify> {
    const { colors, checkMe } = classify(samples);
    STEPS.forEach((step) => {
      const grid = step.cells.map((s) => samples[s]);
      const seen = sideColors(grid, step.center, nearestColor(grid[4]) !== step.center);
      step.cells.forEach((s, k) => { if (colors[s] !== seen[k] && !checkMe.includes(s)) checkMe.push(s); });
    });
    return { colors, checkMe };
  }

  function capture(): void {
    if (take.getAttribute('aria-disabled') === 'true') return;
    const cells = grabCells(video, canvas, 300);
    if (!cells) return say('The camera is starting. Try again in a moment.');
    const result = flow.capture(cells);
    if (result.ok) return showCheck(result.cells, false);
    say(result.message);
    anyway.hidden = !result.canUseAnyway;
  }

  // The QR code opens this app's scan on a phone, in a new room. The phone sends the cube to that room,
  // and this window opens it. The site lives under a folder, so the path is kept.
  function openPhone(): void {
    const room = newRoom();
    const link = `${location.origin}${location.pathname}#/scan/${room}`;
    const code = h('div', { class: 'phone-qr' });
    const close = h('button', { class: 'btn btn-primary btn-wide', onclick: () => dialog.close() }, 'Close');
    // Esc closes it too. Focus goes back to the button that opened it.
    const dialog = h('dialog', { class: 'confirm', 'aria-labelledby': 'phone-title', onclose: () => { stopWaiting(); dialog.remove(); phone.focus(); } },
      h('h2', { id: 'phone-title', class: 'confirm-question' }, 'Scan with your phone'),
      h('p', { class: 'sub' }, 'Point your phone camera at this code.'),
      code,
      h('p', { class: 'phone-link' }, link),
      h('p', { class: 'sub', role: 'status' }, 'Waiting for your phone…'),
      close,
    );
    // Anything that is not a usable cube is ignored, and the window keeps waiting.
    stopWaiting = listen(room, (text) => {
      const cube = readCubeLink(text);
      if (!cube) return;
      dialog.close();
      go('cube', cube);
    });
    root.append(dialog);
    dialog.showModal();
    close.focus();
    // If the code cannot load, the link still shows as text.
    qrCode(link, 'QR code that opens the scan on a phone').then((svg) => code.append(svg), () => {});
  }

  function cameraFailed(): void {
    noCamera = true;
    phone.hidden = false;
    setLive('none');
    say(null);
    window.clearTimeout(lock);
    big.stop();
    // A picture on the check stays in view, so the child still sees what Next saves. Taking it
    // again needs the camera, so only Next is left; the camera box changes once Next is tapped.
    if (pending) {
      mainButton(nextButton);
      retry.hidden = true;
      return;
    }
    mainButton(take, true);
    showNoCamera();
  }

  function showNoCamera(): void {
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
  const aiming = () => guide.hidden && panel.hidden && !noCamera;
  function setLive(state: Live): void {
    live = state;
    streak = 0;
    camera.classList.toggle('ready', state === 'ready');
    if (state === 'ready') {
      line.textContent = `${cap(COLOR_NAME[flow.step.center])} side found`;
      say(null);
    // Under the big cube or the check, or with no camera, there are no squares to fit.
    } else if (state === 'none') line.textContent = aiming() ? PLAIN : '';
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
    if (aiming()) check(cells);
  }, PREVIEW_MS);

  show();
  const letScreenDim = keepScreenOn();

  return () => {
    stopped = true;
    stopWaiting();
    letScreenDim();
    window.clearTimeout(lock);
    picture.stop();
    big.stop();
    window.clearInterval(timer);
    stopCamera(stream);
    video.srcObject = null;
  };
}
