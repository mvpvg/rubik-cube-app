import { describe, expect, it } from 'vitest';
import { nearestColor, sampleGrid } from '../../src/scan/sample';
import type { RGB } from '../../src/app/session';

const SIZE = 300;

function paint(cells: RGB[], extra?: (data: Uint8ClampedArray, set: (x: number, y: number, c: RGB) => void) => void): Uint8ClampedArray {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  const set = (x: number, y: number, c: RGB) => {
    const i = (y * SIZE + x) * 4;
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
  };
  const cell = SIZE / 3;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) set(x, y, cells[Math.floor(y / cell) * 3 + Math.floor(x / cell)]);
  }
  extra?.(data, set);
  return data;
}

const NINE: RGB[] = [
  [255, 255, 255], [255, 213, 0], [196, 30, 58],
  [255, 88, 0], [0, 158, 96], [0, 81, 186],
  [10, 20, 30], [120, 60, 200], [90, 90, 90],
];

describe('sampleGrid', () => {
  it('returns the nine solid colors of a 3x3 image', () => {
    expect(sampleGrid(paint(NINE), SIZE, SIZE)).toEqual(NINE);
  });

  it('ignores black plastic borders and a small white glare spot', () => {
    const green: RGB = [0, 158, 96];
    const data = paint(Array(9).fill(green), (_d, set) => {
      // 12px black borders around every cell
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const cx = x % 100, cy = y % 100;
          if (cx < 12 || cx >= 88 || cy < 12 || cy >= 88) set(x, y, [0, 0, 0]);
        }
      }
      // glare: 14x14 white patch inside the center cell's sampled area
      for (let y = 130; y < 144; y++) for (let x = 130; x < 144; x++) set(x, y, [255, 255, 255]);
    });
    expect(sampleGrid(data, SIZE, SIZE)).toEqual(Array(9).fill(green));
  });
});

describe('nearestColor', () => {
  it('names the nominal sticker colors, keeping red and orange apart', () => {
    expect(nearestColor([255, 255, 255])).toBe('W');
    expect(nearestColor([196, 30, 58])).toBe('R');
    expect(nearestColor([255, 88, 0])).toBe('O');
    expect(nearestColor([0, 158, 96])).toBe('G');
    expect(nearestColor([0, 81, 186])).toBe('B');
    expect(nearestColor([255, 213, 0])).toBe('Y');
  });

  it('tolerates a darker, dimly lit sticker', () => {
    expect(nearestColor([120, 20, 30])).toBe('R');
    expect(nearestColor([170, 60, 10])).toBe('O');
    expect(nearestColor([160, 160, 150])).toBe('W');
  });
});
