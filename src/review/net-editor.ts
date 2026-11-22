import './review.css';
import { go } from '../app/router';
import { session, setCube } from '../app/session';
import { CENTER_INDEX, COLOR_HEX, COLOR_NAME, FACES, COLOR_OF_FACE, fromColors, type Color } from '../cube/facelets';
import { validate } from '../cube/validate';
import { classify } from '../scan/classify';
import { h, icon } from '../ui/dom';

const COLORS: Color[] = ['W', 'Y', 'R', 'O', 'G', 'B'];
const TEXT_ON: Record<Color, string> = { W: '#1C1D22', Y: '#1C1D22', O: '#1C1D22', R: '#FFFFFF', G: '#FFFFFF', B: '#FFFFFF' };
// Where each side sits in the flat cross-shaped map: [column, row].
const NET_SPOT: Record<string, [number, number]> = { U: [2, 1], L: [1, 2], F: [2, 2], R: [3, 2], B: [4, 2], D: [2, 3] };

type Slot = Color | null;

function startingColors(param?: string): { colors: Slot[]; checkMe: Set<number> } {
  if (param === 'manual') {
    session.samples = null;
    const colors: Slot[] = new Array(54).fill(null);
    CENTER_INDEX.forEach((i, f) => { colors[i] = COLOR_OF_FACE[FACES[f]]; });
    return { colors, checkMe: new Set() };
  }
  if (session.samples) {
    const { colors, checkMe } = classify(session.samples);
    session.samples = null;
    session.colors = colors;
    return { colors, checkMe: new Set(checkMe) };
  }
  if (session.colors) return { colors: session.colors.slice(), checkMe: new Set() };
  return startingColors('manual');
}

export function reviewScreen(root: HTMLElement, param?: string): void {
  const start = startingColors(param);
  const colors = start.colors;
  const checkMe = start.checkMe;
  const manual = param === 'manual';
  let face = 2; // index into FACES; start on the green side
  let selected: number | null = null;
  let bad = new Set<number>();

  const firstFlagged = [...checkMe].sort((a, b) => a - b)[0];
  if (firstFlagged !== undefined) face = Math.floor(firstFlagged / 9);

  const net = h('div', { class: 'net' });
  const zoomTitle = h('div', { class: 'zoom-title' });
  const zoomFlags = h('div', { class: 'zoom-flags' });
  const zoom = h('div', { class: 'zoom' });
  const pickerLabel = h('div', { class: 'muted', style: 'text-align:center' });
  const picker = h('div', { class: 'picker' });
  const message = h('p', { class: 'note review-msg', role: 'status' });
  const solveBtn = h('button', { class: 'btn btn-ghost', style: 'flex:1', onclick: () => finish('solve') }, 'Solve it');
  const learnBtn = h('button', { class: 'btn btn-primary', style: 'flex:1.3', onclick: () => finish('learn') }, 'Learn it');

  root.append(
    h('section', { class: 'screen review' },
      h('div', { class: 'topbar' },
        h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => go('home') }, icon('back')),
        h('button', { class: 'icon-btn', 'aria-label': 'Scan again', onclick: () => go('scan') }, icon('rescan')),
      ),
      h('div', { style: 'display:flex;flex-direction:column;gap:4px' },
        h('h1', {}, manual ? 'Type in the colors' : 'Check the colors'),
        h('p', { class: 'sub' }, manual ? 'Tap a side, then tap each square and pick its color.' : 'Tap a side to look closer. Fix any square that looks wrong.'),
      ),
      net,
      h('div', { class: 'card' }, h('div', { class: 'zoom-head' }, zoomTitle, zoomFlags), zoom, pickerLabel, picker),
      message,
      h('div', { class: 'spacer' }),
      h('div', { class: 'row' }, solveBtn, learnBtn),
    ),
  );

  function stickerStyle(c: Slot): string {
    return c ? `background:${COLOR_HEX[c]};color:${TEXT_ON[c]}` : '';
  }

  function check(): void {
    bad = new Set();
    const missing = colors.filter((c) => c === null).length;
    let ok = false;
    if (missing > 0) {
      message.textContent = `${missing} squares still need a color.`;
    } else {
      const result = validate(fromColors(colors as Color[]));
      if (result.ok) {
        ok = true;
        message.textContent = checkMe.size > 0
          ? 'This cube works. The squares with a dashed ring were hard to see, so check them once more.'
          : 'This cube works. Pick what you want to do.';
      } else {
        message.textContent = result.message;
        bad = new Set(result.highlight);
      }
    }
    solveBtn.toggleAttribute('disabled', !ok);
    learnBtn.toggleAttribute('disabled', !ok);
  }

  function render(): void {
    check();
    net.replaceChildren(...FACES.map((f, fi) => {
      const [col, row] = NET_SPOT[f];
      const name = COLOR_NAME[COLOR_OF_FACE[f]];
      return h('button', {
        class: 'net-face', style: `grid-column:${col};grid-row:${row}`, 'aria-label': `Show the ${name} side`,
        'aria-pressed': String(fi === face), onclick: () => { face = fi; selected = null; render(); },
      }, ...Array.from({ length: 9 }, (_, k) => {
        const i = fi * 9 + k;
        const c = colors[i];
        return h('div', { class: `net-sticker${c ? '' : ' unknown'}${bad.has(i) ? ' bad' : ''}`, style: stickerStyle(c) }, c ?? '?');
      }));
    }));

    const sideName = COLOR_NAME[COLOR_OF_FACE[FACES[face]]];
    zoomTitle.textContent = `${sideName[0].toUpperCase()}${sideName.slice(1)} side`;
    const flagsHere = Array.from({ length: 9 }, (_, k) => face * 9 + k).filter((i) => checkMe.has(i)).length;
    zoomFlags.replaceChildren(...(flagsHere ? [icon('check', 16), `${flagsHere} to check`] : []));

    zoom.replaceChildren(...Array.from({ length: 9 }, (_, k) => {
      const i = face * 9 + k;
      const c = colors[i];
      const center = CENTER_INDEX.includes(i);
      const cls = ['zoom-sticker', c ? '' : 'unknown', checkMe.has(i) ? 'check' : '', bad.has(i) ? 'bad' : '', selected === i ? 'selected' : ''].filter(Boolean).join(' ');
      return h('button', {
        class: cls, style: stickerStyle(c), disabled: center,
        'aria-label': center ? `Middle square, ${COLOR_NAME[c!]}` : `Square ${k + 1}, ${c ? COLOR_NAME[c] : 'no color yet'}`,
        onclick: () => { selected = i; render(); },
      }, c ?? '?');
    }));

    if (selected === null) {
      pickerLabel.textContent = 'Tap a square to change its color.';
      picker.replaceChildren();
    } else {
      const current = colors[selected];
      pickerLabel.textContent = checkMe.has(selected) ? 'This one was hard to see. Pick its color:' : 'Pick its color:';
      picker.replaceChildren(...COLORS.map((c) => h('button', {
        class: 'swatch', style: stickerStyle(c), 'aria-label': COLOR_NAME[c], 'aria-pressed': String(current === c),
        onclick: () => choose(c),
      }, c)));
    }
  }

  function choose(c: Color): void {
    if (selected === null) return;
    colors[selected] = c;
    checkMe.delete(selected);
    // In typing mode, jump to the next empty square so filling in goes quickly.
    if (manual) {
      const next = colors.findIndex((x, i) => x === null && Math.floor(i / 9) === face);
      selected = next >= 0 ? next : null;
    } else selected = null;
    session.colors = colors.every((x) => x !== null) ? (colors as Color[]).slice() : session.colors;
    render();
  }

  function finish(where: 'solve' | 'learn'): void {
    if (colors.some((c) => c === null)) return;
    const facelets = fromColors(colors as Color[]);
    if (!validate(facelets).ok) return;
    session.colors = (colors as Color[]).slice();
    setCube(facelets);
    go(where);
  }

  render();
}
