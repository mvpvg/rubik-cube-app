import './review.css';
import { exitButton } from '../app/exit';
import { keepRoom, keptRoom, send as sendToRoom } from '../app/relay';
import { go } from '../app/router';
import { hasWorkToKeep, isFinished, saveSession, session, setCube, startNewWork } from '../app/session';
import { CENTER_INDEX, COLOR_HEX, COLOR_NAME, FACES, COLOR_OF_FACE, FACE_OF_COLOR, faceOf, fromColors, TEXT_ON, toColors, type Color, type Face } from '../cube/facelets';
import { validate } from '../cube/validate';
import { confirmDelete } from '../ui/confirm';
import { h, icon } from '../ui/dom';
import { smartFill } from './smart-fill';

const COLORS: Color[] = ['W', 'Y', 'R', 'O', 'G', 'B'];
// Where each side sits in the flat cross-shaped map: [column, row].
const REPLACE_WORDS = { question: 'Start over with new colors? Your saved cube will be deleted.', keep: 'Keep my cube', drop: 'Delete and start over' };
const NET_SPOT: Record<Face, [number, number]> = { U: [2, 1], L: [1, 2], F: [2, 2], R: [3, 2], B: [4, 2], D: [2, 3] };

type Slot = Color | null;
type Side = (face: number, place: string, stickers: HTMLElement[]) => HTMLElement;

function stickerStyle(c: Slot): string {
  return c ? `background:${COLOR_HEX[c]};color:${TEXT_ON[c]}` : '';
}

// The sides of the flat cross-shaped map. `side` wraps each side's 9 squares; `mark` adds a class and a dot to a square.
// The map is a picture with no letters; each side's spoken label names it, and the close-up card shows the letters.
function netSides(colors: Slot[], side: Side, mark: (i: number) => [string, Node | null] = () => ['', null]): HTMLElement[] {
  return FACES.map((f, fi) => {
    const [col, row] = NET_SPOT[f];
    return side(fi, `grid-column:${col};grid-row:${row}`, Array.from({ length: 9 }, (_, k) => {
      const i = fi * 9 + k;
      const c = colors[i];
      const [cls, dot] = mark(i);
      return h('div', { class: `net-sticker${c ? '' : ' unknown'}${cls}`, style: stickerStyle(c) }, dot);
    }));
  });
}

// A picture of the cube as a flat map, for screens that cannot show the 3D cube.
export function netMap(colors: Slot[], label: string): HTMLElement {
  return h('div', { class: 'net', role: 'img', 'aria-label': label },
    ...netSides(colors, (_, place, stickers) => h('div', { class: 'net-face', style: place }, ...stickers)));
}

function blank(): Slot[] {
  const colors: Slot[] = new Array(54).fill(null);
  CENTER_INDEX.forEach((i, f) => { colors[i] = COLOR_OF_FACE[FACES[f]]; });
  return colors;
}

// The color check always starts from the saved colors; the color match already ran in the scan.
// Typing goes on from saved typed colors (colors with no pictures and no checked cube), and otherwise starts blank.
function startingColors(manual: boolean): { colors: Slot[]; checkMe: number[]; filled: number[]; saved: boolean } {
  const typed = session.colors !== null && !session.samples?.some(Boolean) && session.facelets === null;
  if (session.colors && (typed || !manual)) return { colors: session.colors.slice(), checkMe: session.checkMe, filled: session.filled, saved: true };
  if (session.facelets && !manual) return { colors: toColors(session.facelets), checkMe: [], filled: [], saved: true };
  return { colors: blank(), checkMe: [], filled: [], saved: false };
}

export function reviewScreen(root: HTMLElement, param?: string): void {
  const manual = param === 'manual';
  const start = startingColors(manual);
  // Nothing to check: a scan that started over goes on, anything else goes Home.
  // Replaced, so Back does not come here and bounce away again.
  if (!manual && !start.saved) {
    go(session.route === 'scan' ? 'scan' : 'home', undefined, { replace: true });
    return;
  }
  const colors = start.colors;
  const checkMe = new Set(start.checkMe);
  const auto = new Set(start.filled);
  // Typing from the start replaces the old work, but only at the first pick: opening it changes nothing.
  let fresh = manual && !start.saved;
  let face = 2; // index into FACES; start on the green side
  let selected: number | null = null;
  let bad = new Set<number>();

  const firstFlagged = [...checkMe].sort((a, b) => a - b)[0];
  if (firstFlagged !== undefined) face = faceOf(firstFlagged);
  // Coming back from taking one side again, that side is the one to look at.
  if (param && Object.hasOwn(FACE_OF_COLOR, param)) face = FACES.indexOf(FACE_OF_COLOR[param as Color]);

  const net = h('div', { class: 'net' });
  const zoomTitle = h('div', { class: 'zoom-title' });
  const zoomFlags = h('div', { class: 'zoom-flags' });
  const zoom = h('div', { class: 'zoom' });
  const pickerLabel = h('div', { class: 'muted', style: 'text-align:center' });
  const picker = h('div', { class: 'picker' });
  const autoDot = () => h('span', { class: 'auto-dot', 'aria-hidden': 'true' });
  const autoLegend = h('p', { class: 'auto-legend' }, autoDot(), 'This dot means the square could only be one color, so it was filled in for you. Tap it to check.');
  const message = h('p', { class: 'note review-msg', role: 'status' });
  const help = h('p', { class: 'review-help' });
  const solveBtn = h('button', { class: 'btn btn-ghost', style: 'flex:1', onclick: () => finish('solve') }, 'Solve it');
  const retake = h('button', { class: 'btn btn-ghost', onclick: () => go('scan', COLOR_OF_FACE[FACES[face]]) }, icon('camera'), 'Take this side again');
  const learnBtn = h('button', { class: 'btn btn-primary', style: 'flex:1.3', onclick: () => finish('learn') }, 'Learn it');
  const sendBtn = h('button', { class: 'btn btn-ghost btn-wide', onclick: send }, 'Send to computer');
  const copied = h('p', { class: 'muted send-copied', role: 'status' });
  const linkText = h('p', { class: 'note send-link', hidden: true });

  root.append(
    h('section', { class: 'screen review' },
      h('div', { class: 'topbar' },
        h('button', { class: 'top-btn', 'aria-label': 'Back', onclick: () => go('home') }, icon('back'), 'Back'),
        h('button', { class: 'top-btn', 'aria-label': 'Scan again', onclick: () => go('scan') }, icon('camera'), 'Scan again'),
        exitButton(root),
      ),
      h('div', { style: 'display:flex;flex-direction:column;gap:4px' },
        h('h1', {}, manual ? 'Type in the colors' : 'Check the colors'),
        h('p', { class: 'sub' }, manual ? 'Tap a side, then tap each square and pick its color.' : 'Tap a side to look closer. Fix any square that looks wrong.'),
      ),
      net,
      autoLegend,
      h('div', { class: 'card' }, h('div', { class: 'zoom-head' }, zoomTitle, zoomFlags), zoom, pickerLabel, picker, manual ? null : retake),
      message,
      help,
      h('div', { class: 'spacer' }),
      h('div', { class: 'row' }, solveBtn, learnBtn),
      sendBtn,
      copied,
      linkText,
    ),
  );

  function check(): void {
    bad = new Set();
    help.textContent = '';
    const missing = colors.filter((c) => c === null).length;
    let ok = false;
    if (missing > 0) {
      message.textContent = `${missing} squares still need a color.`;
    } else {
      const result = validate(fromColors(colors as Color[]));
      if (result.ok) {
        ok = true;
        message.textContent = checkMe.size > 0
          ? 'This cube works. Check the squares with a dashed ring once more.'
          : 'This cube works. Pick what you want to do.';
      } else {
        message.textContent = result.message;
        help.textContent = result.help;
        bad = new Set(result.highlight);
      }
    }
    solveBtn.toggleAttribute('disabled', !ok);
    learnBtn.toggleAttribute('disabled', !ok);
    sendBtn.toggleAttribute('disabled', !ok);
  }

  function render(): void {
    // The redraw replaces every button, so focus moves to the new one with the same spoken name.
    const focused = root.contains(document.activeElement) ? document.activeElement!.getAttribute('aria-label') : null;
    check();
    autoLegend.hidden = auto.size === 0;
    net.replaceChildren(...netSides(colors, (fi, place, stickers) => h('button', {
      class: 'net-face', style: place, 'aria-label': `Show the ${COLOR_NAME[COLOR_OF_FACE[FACES[fi]]]} side`,
      'aria-pressed': String(fi === face), onclick: () => { face = fi; selected = null; render(); },
    }, ...stickers), (i) => [bad.has(i) ? ' bad' : '', auto.has(i) ? autoDot() : null]));

    const sideName = COLOR_NAME[COLOR_OF_FACE[FACES[face]]];
    zoomTitle.textContent = `${sideName[0].toUpperCase()}${sideName.slice(1)} side`;
    const flagsHere = Array.from({ length: 9 }, (_, k) => face * 9 + k).filter((i) => checkMe.has(i)).length;
    zoomFlags.replaceChildren(...(flagsHere ? [icon('check', 16), `${flagsHere} to check`] : []));

    zoom.replaceChildren(...Array.from({ length: 9 }, (_, k) => {
      const i = face * 9 + k;
      const c = colors[i];
      const center = CENTER_INDEX.includes(i);
      const cls = ['zoom-sticker', c ? '' : 'unknown', checkMe.has(i) ? 'check' : '', auto.has(i) ? 'auto' : '', bad.has(i) ? 'bad' : '', selected === i ? 'selected' : ''].filter(Boolean).join(' ');
      return h('button', {
        class: cls, style: stickerStyle(c), disabled: center,
        'aria-label': center ? `Middle square, ${COLOR_NAME[c!]}` : `Square ${k + 1}, ${c ? COLOR_NAME[c] : 'no color yet'}${auto.has(i) ? ', filled in for you' : ''}`,
        onclick: () => { selected = i; render(); },
      }, c ?? '?', auto.has(i) ? autoDot() : null);
    }));

    if (selected === null) {
      pickerLabel.textContent = 'Tap a square to change its color.';
      picker.replaceChildren();
    } else {
      const current = colors[selected];
      pickerLabel.textContent = checkMe.has(selected) ? 'Check this one once more. Pick its color:' : 'Pick its color:';
      picker.replaceChildren(...COLORS.map((c) => h('button', {
        class: 'swatch', style: stickerStyle(c), 'aria-label': COLOR_NAME[c], 'aria-pressed': String(current === c),
        onclick: () => choose(c),
      }, c)));
    }
    if (focused) [...root.querySelectorAll<HTMLElement>('[aria-label]')].find((el) => el.getAttribute('aria-label') === focused)?.focus();
  }

  async function choose(c: Color): Promise<void> {
    if (selected === null) return;
    // The pick waits here, unsaved, until the child agrees to delete the old work.
    if (fresh && hasWorkToKeep() && !(await confirmDelete(root, REPLACE_WORDS))) return;
    const picked = selected;
    // Fills never outlive the pick they came from: clear them, set the pick, work them out again.
    for (const i of auto) colors[i] = null;
    auto.clear();
    colors[selected] = c;
    checkMe.delete(selected);
    // A link already shown holds the old colors.
    linkText.hidden = true;
    copied.textContent = '';
    for (const f of smartFill(colors)) { colors[f.index] = f.color; auto.add(f.index); }
    // In typing mode, jump to the next empty square so filling in goes quickly.
    if (manual) {
      const next = colors.findIndex((x, i) => x === null && faceOf(i) === face);
      selected = next >= 0 ? next : null;
    } else selected = null;
    keep();
    render();
    // The picker closed with the pressed swatch in it, so focus goes back to the square it changed.
    if (!root.contains(document.activeElement)) (zoom.children[picked - face * 9] as HTMLElement | undefined)?.focus();
  }

  // Every pick is saved, with the "check me" rings and the "filled in for you" dots.
  function keep(): void {
    const step = { colors: colors.slice(), checkMe: [...checkMe], filled: [...auto], route: manual ? 'review/manual' : 'review' };
    if (fresh) {
      fresh = false;
      startNewWork(step); // the old work is replaced here, at the first pick
    } else {
      Object.assign(session, step);
      saveSession();
    }
  }

  function finish(where: 'solve' | 'learn'): void {
    if (colors.some((c) => c === null)) return;
    const facelets = fromColors(colors as Color[]);
    if (!validate(facelets).ok) return;
    session.colors = (colors as Color[]).slice();
    setCube(facelets);
    go(where);
  }

  // A phone opened from the QR code sends the cube to the computer through the relay. Otherwise the
  // cube goes as a link, which always shows, so it can be typed if all else fails.
  let sending = false;
  async function send(): Promise<void> {
    if (sending) return;
    const cube = fromColors(colors as Color[]);
    const url = `${location.origin}${location.pathname}#/cube/${cube}`;
    const showLink = () => {
      linkText.textContent = url;
      linkText.hidden = false;
    };
    const room = keptRoom();
    if (room) {
      keepRoom(null);
      sending = true;
      copied.textContent = 'Sending…';
      const sent = await sendToRoom(room, cube).then(() => true, () => false);
      sending = false;
      // A color picked while it sent cleared these words: the result is about the old colors.
      if (copied.textContent !== 'Sending…') return;
      if (sent) copied.textContent = 'Sent! Look at your computer.';
      else {
        // Share and copy need a fresh tap on a phone, so they wait for the next one.
        showLink();
        copied.textContent = 'Could not send. Tap Send to computer again to share the link.';
      }
      return;
    }
    showLink();
    copied.textContent = '';
    if (navigator.share) navigator.share({ url }).catch(() => {});
    else navigator.clipboard?.writeText(url).then(() => { copied.textContent = 'Link copied'; }, () => {});
  }

  // Opening the color check on saved colors makes it the step "Keep going" comes back to,
  // unless the work is finished: looking at its colors does not bring it back.
  if (!manual && !isFinished()) {
    session.route = 'review';
    saveSession();
  }
  render();
}
