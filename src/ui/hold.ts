import { COLOR_HEX, COLOR_OF_FACE, type Face } from '../cube/facelets';
import { h } from './dom';

// The hold picture for a cube string: its top and front middle colors.
export function holdNoteFor(state: string, words: string): HTMLElement {
  const color = (i: number) => COLOR_HEX[COLOR_OF_FACE[state[i] as Face]];
  return holdNote(color(4), color(22), words);
}

// Little cube picture plus the words for how to hold the real cube.
export function holdNote(top: string, front: string, words: string): HTMLElement {
  const cube = h('div', { class: 'mini-cube', role: 'img', 'aria-label': words },
    h('div', { class: 'mini-face', style: `background:${top};transform:rotateX(90deg) translateZ(14px)` }),
    h('div', { class: 'mini-face', style: `background:${front};transform:translateZ(14px)` }),
  );
  return h('div', { class: 'note' }, h('div', { class: 'mini-wrap' }, cube), h('span', {}, words));
}
