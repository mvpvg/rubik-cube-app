import type { RGB } from '../app/session';
import { COLOR_HEX, type Color } from '../cube/facelets';

// Reads a square picture of one cube side as a 3x3 grid. Each cell's color is the per-channel
// median of its inner half, so black plastic edges and a small glare spot do not count.
export function sampleGrid(data: Uint8ClampedArray, width: number, height: number): RGB[] {
  const cells: RGB[] = [];
  const cw = width / 3, ch = height / 3;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x0 = Math.floor(col * cw + cw / 4), x1 = Math.ceil(col * cw + (cw * 3) / 4);
      const y0 = Math.floor(row * ch + ch / 4), y1 = Math.ceil(row * ch + (ch * 3) / 4);
      const r: number[] = [], g: number[] = [], b: number[] = [];
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          r.push(data[i]); g.push(data[i + 1]); b.push(data[i + 2]);
        }
      }
      cells.push([median(r), median(g), median(b)]);
    }
  }
  return cells;
}

function median(values: number[]): number {
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
}

export const rgbCss = ([r, g, b]: RGB) => `rgb(${r},${g},${b})`;

export type Lab = [number, number, number];

export function toLab([r, g, b]: RGB): Lab {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r), G = lin(g), B = lin(b);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

const NOMINAL = (Object.keys(COLOR_HEX) as Color[]).map((color) => {
  const n = parseInt(COLOR_HEX[color].slice(1), 16);
  return { color, lab: toLab([(n >> 16) & 255, (n >> 8) & 255, n & 255]) };
});

const NOMINAL_LAB = Object.fromEntries(NOMINAL.map((n) => [n.color, n.lab])) as Record<Color, Lab>;
export const nominalLab = (color: Color) => NOMINAL_LAB[color];
const hueOf = (lab: Lab) => (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
const NOMINAL_HUE = (color: Color) => hueOf(nominalLab(color));
// Halfway between the red and orange sticker hues.
const RED_ORANGE_SPLIT = (NOMINAL_HUE('R') + NOMINAL_HUE('O')) / 2;

// The nominal sticker color closest to a sample in CIELAB. Lightness counts for half, because room
// light mostly changes how bright a sticker looks. Red and orange sit close together and a dim
// orange loses saturation, so between those two the hue angle alone decides.
// Lightness counts for half, because room light mostly changes how bright a sticker looks.
export const labDist = (p: Lab, q: Lab) => (0.5 * (p[0] - q[0])) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;

export function nearestColor(rgb: RGB): Color {
  const sample = toLab(rgb);
  let best = NOMINAL[0].color, bestDist = Infinity;
  for (const { color, lab } of NOMINAL) {
    const d = labDist(sample, lab);
    if (d < bestDist) { bestDist = d; best = color; }
  }
  if (best === 'R' || best === 'O') return hueOf(sample) < RED_ORANGE_SPLIT ? 'R' : 'O';
  return best;
}
