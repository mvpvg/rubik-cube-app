import { describe, expect, it } from 'vitest';
import type { RGB } from '../../src/app/session';
import { applyMoves, CENTER_INDEX, FACE_OF_COLOR, FACES, SOLVED, toColors, type Color } from '../../src/cube/facelets';
import { mergeSide } from '../../src/review/merge-side';

const RGB_OF: Record<Color, RGB> = {
  W: [255, 255, 255], R: [196, 30, 58], G: [0, 158, 96], Y: [255, 213, 0], O: [255, 88, 0], B: [0, 81, 186],
};
const CUBE = toColors(applyMoves(SOLVED, "R U2 F' L D B2 R' U F2 D' L2 B U' R2"));
const face = (c: Color) => FACES.indexOf(FACE_OF_COLOR[c]);
const squares = (c: Color) => Array.from({ length: 9 }, (_, k) => face(c) * 9 + k);
const RED = squares('R');
const BLUE = squares('B');
const photo = (colors: Color[]) => colors.map((c) => RGB_OF[c]);
const sideOf = (colors: Color[], c: Color) => squares(c).map((i) => colors[i]);
const others = (c: Color) => Array.from({ length: 54 }, (_, i) => i).filter((i) => !squares(c).includes(i));

describe('mergeSide', () => {
  it('a red side taken again changes only the 9 red squares, and the fixes and flags on the blue side stay', () => {
    // The camera misread two blue squares and the child fixed them; the old red side was read wrong and flagged.
    const samples = photo(CUBE);
    samples[BLUE[1]] = RGB_OF[CUBE[BLUE[1]] === 'Y' ? 'W' : 'Y'];
    samples[BLUE[2]] = RGB_OF[CUBE[BLUE[2]] === 'Y' ? 'W' : 'Y'];
    const colors: Color[] = CUBE.slice();
    colors[RED[0]] = colors[RED[0]] === 'W' ? 'Y' : 'W';
    const work = { samples, colors, checkMe: [BLUE[1], RED[0], RED[2]], filled: [BLUE[3], RED[5]] };
    const merged = mergeSide(work, face('R'), sideOf(CUBE, 'R').map((c) => RGB_OF[c]));
    expect(sideOf(merged.colors as Color[], 'R')).toEqual(sideOf(CUBE, 'R'));
    expect(others('R').every((i) => merged.colors[i] === colors[i])).toBe(true);
    expect(merged.checkMe).toEqual([BLUE[1]]);
    expect(merged.filled).toEqual([BLUE[3]]);
    expect(others('R').every((i) => merged.samples[i] === work.samples[i])).toBe(true);
    expect(work.colors).toEqual(colors); // the saved work is not changed in place
  });

  it('counts the child\'s fixes, not the camera: a truly green red-side square still gets green', () => {
    const greenOnRed = RED.filter((i) => CUBE[i] === 'G');
    expect(greenOnRed.length).toBeGreaterThan(0);
    // The camera read one blue-side square as green, and the child fixed it.
    const misread = BLUE.find((i) => CUBE[i] !== 'G' && !CENTER_INDEX.includes(i))!;
    const samples = photo(CUBE);
    samples[misread] = RGB_OF.G;
    const merged = mergeSide({ samples, colors: CUBE.slice(), checkMe: [], filled: [] }, face('R'), sideOf(CUBE, 'R').map((c) => RGB_OF[c]));
    expect(sideOf(merged.colors as Color[], 'R')).toEqual(sideOf(CUBE, 'R'));
    expect(merged.checkMe).toEqual([]);
  });

  it('a color already at 8 on the other sides takes only one more: the other square gets its next color and is flagged', () => {
    const colors = toColors(SOLVED);
    colors[0] = 'Y'; // white is now at 8 on the other sides
    const cells = sideOf(toColors(SOLVED), 'R').map((c) => RGB_OF[c]);
    cells[0] = RGB_OF.W;
    cells[1] = RGB_OF.W;
    const merged = mergeSide({ samples: photo(toColors(SOLVED)), colors, checkMe: [], filled: [] }, face('R'), cells);
    const two = [merged.colors[RED[0]], merged.colors[RED[1]]];
    expect(two.filter((c) => c === 'W')).toHaveLength(1);
    const pushed = two[0] === 'W' ? RED[1] : RED[0];
    expect(merged.checkMe).toContain(pushed);
  });

  it('a square that is a close call between two middle colors is flagged, and the side\'s old flags and dots are gone', () => {
    const solved = toColors(SOLVED);
    const cells = sideOf(solved, 'R').map((c) => RGB_OF[c]);
    const [r, o] = [RGB_OF.R, RGB_OF.O];
    cells[3] = r.map((v, j) => Math.round((v + o[j]) / 2)) as RGB;
    const merged = mergeSide({ samples: photo(solved), colors: solved.slice(), checkMe: [RED[1], RED[7]], filled: [RED[2]] }, face('R'), cells);
    expect(merged.checkMe).toEqual([RED[3]]);
    expect(merged.filled).toEqual([]);
  });

  it('typed colors (no samples): the red side gets a single-color guess, all 8 squares around the middle are flagged, the rest is unchanged', () => {
    const merged = mergeSide({ samples: null, colors: CUBE.slice(), checkMe: [BLUE[0]], filled: [] }, face('R'), sideOf(CUBE, 'R').map((c) => RGB_OF[c]));
    expect(sideOf(merged.colors as Color[], 'R')).toEqual(sideOf(CUBE, 'R'));
    expect(merged.checkMe.sort((a, b) => a - b)).toEqual([BLUE[0], ...RED.filter((i) => !CENTER_INDEX.includes(i))].sort((a, b) => a - b));
    expect(others('R').every((i) => merged.colors[i] === CUBE[i])).toBe(true);
    expect(merged.samples.filter(Boolean)).toHaveLength(9);
  });

  it('typed colors taken again a second time (red earlier, now blue) still guess one color at a time, with all 8 flagged', () => {
    const first = mergeSide({ samples: null, colors: CUBE.slice(), checkMe: [], filled: [] }, face('R'), sideOf(CUBE, 'R').map((c) => RGB_OF[c]));
    const second = mergeSide(first, face('B'), sideOf(CUBE, 'B').map((c) => RGB_OF[c]));
    expect(sideOf(second.colors as Color[], 'B')).toEqual(sideOf(CUBE, 'B'));
    expect(BLUE.filter((i) => !CENTER_INDEX.includes(i)).every((i) => second.checkMe.includes(i))).toBe(true);
    expect(second.samples.filter(Boolean)).toHaveLength(18);
  });
});
