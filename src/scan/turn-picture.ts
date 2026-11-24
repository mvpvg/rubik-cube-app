import type { RGB } from '../app/session';
import { COLOR_HEX, FACE_OF_COLOR, FACES, parseMoves, type Color } from '../cube/facelets';
import { h } from '../ui/dom';
import { rgbCss } from './sample';

// Change TURN_MS together with the .turn-cube transition in scan.css.
const TURN_MS = 1300; // one turn plus a short rest before the next
const FIRST_MS = 400; // let the child see the start pose first
const REST_MS = 900; // the rest between the two plays

// The cube in the starting hold: white on top, green facing you. Built like the spinning cube on Home.
const SIDES: Array<[string, Color]> = [
  ['rotateX(90deg)', 'W'],
  ['rotateX(0deg)', 'G'],
  ['rotateY(90deg)', 'R'],
  ['rotateY(180deg)', 'B'],
  ['rotateY(-90deg)', 'O'],
  ['rotateX(-90deg)', 'Y'],
];

// Each whole-cube turn as a CSS rotation, and the arrow shown for it.
const ROTATE: Record<string, { css: string; zero: string; arrow: string }> = {
  y: { css: 'rotateY(-90deg)', zero: 'rotateY(0deg)', arrow: '←' },
  "y'": { css: 'rotateY(90deg)', zero: 'rotateY(0deg)', arrow: '→' },
  x: { css: 'rotateX(90deg)', zero: 'rotateX(0deg)', arrow: '⤴' },
  "x'": { css: 'rotateX(-90deg)', zero: 'rotateX(0deg)', arrow: '⤵' },
};

const quarters = (alg: string) => parseMoves(alg).flatMap((m) => (m.endsWith('2') ? [m[0], m[0]] : [m]));

export type TurnPicture = {
  el: HTMLElement;
  show(from: string, turns: string[], glow: Color): void;
  paint(samples: (RGB | null)[]): void;
  stop(): void;
};

// A CSS cube that shows whole-cube turns one at a time, each around its own axis.
// One straight blend from the old pose to the new one would tumble sideways, unlike the words.
// The small one rests in the final pose; the big one plays the turns twice, then rests.
export function turnPicture({ big = false, again }: { big?: boolean; again?: () => void } = {}): TurnPicture {
  const faces = SIDES.map(([turn, color]) => {
    const face = h('div', { class: 'turn-face', 'data-color': color, style: `transform:${turn} translateZ(var(--turn-half))` });
    for (let i = 0; i < 9; i++) face.append(h('div', { style: `background:${COLOR_HEX[color]}` }));
    return face;
  });
  const cube = h('div', { class: 'turn-cube' }, ...faces);
  const arrows = h('div', { class: 'turn-arrows' });
  // The words next to the picture say the same thing, so screen readers skip the picture itself.
  const el = h('div', { class: big ? 'turn-picture big' : 'turn-picture' },
    h('div', { class: 'turn-stage', 'aria-hidden': 'true' }, h('div', { class: 'turn-view' }, cube), arrows),
    again ? h('button', { class: 'link', onclick: again }, 'Show me again') : null,
  );

  let from: string[] = [];
  let turns: string[] = [];
  let timers: number[] = [];

  function stop(): void {
    timers.forEach((t) => window.clearTimeout(t));
    timers = [];
  }

  // Later turns go on the left so each one turns around the screen's axis, not the cube's.
  const set = (pose: string[]) => { cube.style.transform = pose.join(' '); };
  const light = (n: number) => [...arrows.children].forEach((a, i) => a.classList.toggle('now', i === n));
  const at = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms));

  function play(): void {
    stop();
    light(-1);
    const start = from.map((t) => ROTATE[t].css).reverse();
    cube.style.transition = 'none';
    if (!big || !turns.length || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return set([...turns.map((t) => ROTATE[t].css).reverse(), ...start]);
    }
    set(start);
    let pose = start;
    const length = FIRST_MS + turns.length * TURN_MS;
    for (const t0 of [0, length + REST_MS]) {
      if (t0) at(t0, () => { cube.style.transition = 'none'; pose = start; set(pose); });
      turns.forEach((t, i) => at(t0 + FIRST_MS + i * TURN_MS, () => {
        // Start the new rotation at 0deg so the browser blends just that one angle.
        cube.style.transition = 'none';
        set([ROTATE[t].zero, ...pose]);
        void cube.offsetWidth;
        cube.style.transition = '';
        pose = [ROTATE[t].css, ...pose];
        set(pose);
        light(i);
      }));
      at(t0 + length, () => light(-1));
    }
  }

  function show(start: string, list: string[], glow: Color): void {
    from = quarters(start);
    turns = list;
    el.querySelector('.turn-glow')?.classList.remove('turn-glow');
    faces[SIDES.findIndex(([, c]) => c === glow)].children[4].classList.add('turn-glow');
    arrows.replaceChildren(...turns.map((t) => h('span', { class: 'turn-arrow' }, ROTATE[t].arrow)));
    play();
  }

  // A taken side shows the colors the camera saw. Square i of a side is sticker i of that face, the
  // same cell the camera grid read. A side not taken yet is gray around its own center color.
  function paint(samples: (RGB | null)[]): void {
    faces.forEach((face, f) => {
      const color = SIDES[f][1];
      const start = FACES.indexOf(FACE_OF_COLOR[color]) * 9;
      const own = samples.slice(start, start + 9);
      const taken = own.every(Boolean);
      [...face.children].forEach((square, i) => {
        const blank = !taken && i !== 4;
        square.classList.toggle('turn-blank', blank);
        (square as HTMLElement).style.background = taken ? rgbCss(own[i]!) : blank ? '' : COLOR_HEX[color];
      });
    });
  }

  return { el, show, paint, stop };
}
