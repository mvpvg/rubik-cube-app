import type { Color } from '../cube/facelets';
import { load, save } from './storage';

export type RGB = [number, number, number];

// What the app knows about the child's cube right now. Screens read and write it in order:
// scan fills samples, review turns them into colors and a checked cube, solve and learn read the cube.
export const session: {
  samples: RGB[] | null; // 54 sampled colors in solver sticker order
  colors: Color[] | null; // 54 colors after classification and fixes
  facelets: string | null; // checked cube in solver order
} = {
  samples: null,
  colors: null,
  facelets: load<string>('cube.facelets'),
};

export function setCube(facelets: string): void {
  session.facelets = facelets;
  save('cube.facelets', facelets);
}
