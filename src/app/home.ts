import { h, icon } from '../ui/dom';
import { COLOR_HEX } from '../cube/facelets';
import { moreHelpLink } from '../ui/more-help';
import { go } from './router';

const SIDES: Array<[string, string]> = [
  ['rotateX(90deg) translateZ(80px)', COLOR_HEX.W],
  ['translateZ(80px)', COLOR_HEX.G],
  ['rotateY(90deg) translateZ(80px)', COLOR_HEX.R],
  ['rotateY(180deg) translateZ(80px)', COLOR_HEX.B],
  ['rotateY(-90deg) translateZ(80px)', COLOR_HEX.O],
  ['rotateX(-90deg) translateZ(80px)', COLOR_HEX.Y],
];

export function homeScreen(root: HTMLElement): void {
  const cube = h('div', { class: 'home-cube', role: 'img', 'aria-label': 'A spinning cube' });
  for (const [transform, color] of SIDES) {
    const face = h('div', { class: 'cube-face', style: `transform:${transform}` });
    for (let i = 0; i < 9; i++) face.append(h('div', { style: `background:${color}` }));
    cube.append(face);
  }

  root.append(
    h('section', { class: 'screen' },
      h('div', { style: 'display:flex;flex-direction:column;gap:8px;margin-top:12px' },
        h('h1', { style: 'font-size:40px' }, 'Cube Coach'),
        h('p', { class: 'sub' }, 'Show me your cube. I will help you solve it.'),
      ),
      h('div', { class: 'home-hero' }, cube),
      h('button', { class: 'btn btn-primary btn-wide', style: 'min-height:68px;font-size:22px', onclick: () => go('scan') },
        icon('camera', 26), 'Scan my cube'),
      h('button', { class: 'btn btn-ghost btn-wide', onclick: () => go('practice') }, 'Practice on a screen cube'),
      h('button', { class: 'link', onclick: () => go('review', 'manual') }, 'Type in the colors instead'),
      h('div', { class: 'row', style: 'justify-content:center;gap:4px;flex-wrap:wrap' },
        h('button', { class: 'link', onclick: () => go('moves') }, 'What do the move letters mean?'),
        moreHelpLink(),
      ),
    ),
  );
}
