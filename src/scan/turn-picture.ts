import { COLOR_HEX, parseMoves, type Color } from '../cube/facelets';
import { h } from '../ui/dom';

const TURN_MS = 900; // one turn plus a short rest before the next
const FIRST_MS = 400; // let the child see the start pose first

// The cube in the starting hold: white on top, green facing you. Built like the spinning cube on Home.
const SIDES: Array<[string, Color]> = [
  ['rotateX(90deg)', 'W'],
  ['rotateX(0deg)', 'G'],
  ['rotateY(90deg)', 'R'],
  ['rotateY(180deg)', 'B'],
  ['rotateY(-90deg)', 'O'],
  ['rotateX(-90deg)', 'Y'],
];

// Each whole-cube turn as a CSS rotation, and the arrow shown for it when motion is turned off.
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
  stop(): void;
};

// A small CSS cube that plays whole-cube turns one at a time, each around its own axis.
// One straight blend from the old pose to the new one would tumble sideways, unlike the words.
export function turnPicture(): TurnPicture {
  const faces = SIDES.map(([turn, color]) => {
    const face = h('div', { class: 'turn-face', 'data-color': color, style: `transform:${turn} translateZ(var(--turn-half))` });
    for (let i = 0; i < 9; i++) face.append(h('div', { style: `background:${COLOR_HEX[color]}` }));
    return face;
  });
  const cube = h('div', { class: 'turn-cube' }, ...faces);
  const arrows = h('div', { class: 'turn-arrows' });
  const again = h('button', { class: 'link', onclick: () => play() }, 'Show me again');
  // The words next to the picture say the same thing, so screen readers skip the picture itself.
  const el = h('div', { class: 'turn-picture' },
    h('div', { class: 'turn-stage', 'aria-hidden': 'true' }, h('div', { class: 'turn-view' }, cube), arrows),
    again,
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

  function play(): void {
    stop();
    let pose = from.map((t) => ROTATE[t].css).reverse();
    cube.style.transition = 'none';
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return set([...turns.map((t) => ROTATE[t].css).reverse(), ...pose]);
    }
    set(pose);
    turns.forEach((t, i) => {
      timers.push(window.setTimeout(() => {
        // Start the new rotation at 0deg so the browser blends just that one angle.
        cube.style.transition = 'none';
        set([ROTATE[t].zero, ...pose]);
        void cube.offsetWidth;
        cube.style.transition = '';
        pose = [ROTATE[t].css, ...pose];
        set(pose);
      }, FIRST_MS + i * TURN_MS));
    });
  }

  function show(start: string, list: string[], glow: Color): void {
    from = quarters(start);
    turns = list;
    const old = el.querySelector('.turn-glow');
    old?.classList.remove('turn-glow');
    const center = faces[SIDES.findIndex(([, c]) => c === glow)].children[4];
    center.classList.add('turn-glow');
    arrows.replaceChildren(...turns.map((t) => h('span', { class: 'turn-arrow' }, ROTATE[t].arrow)));
    play();
  }

  return { el, show, stop };
}
