import { h, icon } from '../ui/dom';
import { go } from './router';

const SIDES: Array<[string, string]> = [
  ['rotateX(90deg) translateZ(80px)', '#FFFFFF'],
  ['translateZ(80px)', '#009E60'],
  ['rotateY(90deg) translateZ(80px)', '#C41E3A'],
  ['rotateY(180deg) translateZ(80px)', '#0051BA'],
  ['rotateY(-90deg) translateZ(80px)', '#FF5800'],
  ['rotateX(-90deg) translateZ(80px)', '#FFD500'],
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
      h('button', { class: 'link', onclick: () => go('review', 'manual') }, 'Type in the colors instead'),
    ),
  );
}
