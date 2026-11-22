// Plain words for each move, for a child holding the cube with the same side on top and in front
// as the 3D cube on screen.
const BASE_WORDS: Record<string, [string, string]> = {
  // [clockwise, counter-clockwise]
  U: ['Top to the left', 'Top to the right'],
  D: ['Bottom to the right', 'Bottom to the left'],
  R: ['Right side up', 'Right side down'],
  L: ['Left side down', 'Left side up'],
  F: ['Front turns like a clock', 'Front turns back from the clock'],
  B: ['Back: top goes left', 'Back: top goes right'],
  M: ['Middle slice down', 'Middle slice up'],
  E: ['Middle row to the right', 'Middle row to the left'],
  S: ['Middle slice like a clock', 'Middle slice back from the clock'],
  x: ['Tip the whole cube away from you', 'Tip the whole cube toward you'],
  y: ['Turn the whole cube to the left', 'Turn the whole cube to the right'],
  z: ['Roll the whole cube to the right', 'Roll the whole cube to the left'],
};

const TWICE: Record<string, string> = {
  U: 'Top: turn twice',
  D: 'Bottom: turn twice',
  R: 'Right side: turn twice',
  L: 'Left side: turn twice',
  F: 'Front: turn twice',
  B: 'Back: turn twice',
  M: 'Middle slice: turn twice',
  E: 'Middle row: turn twice',
  S: 'Middle slice: turn twice',
  x: 'Flip the whole cube over, top to bottom',
  y: 'Turn the whole cube around to the back',
  z: 'Roll the whole cube over, side to side',
};

export function moveWords(move: string): string {
  const m = move.replace('′', "'");
  const base = m[0];
  const words = BASE_WORDS[base];
  if (!words) return m;
  if (m.includes('2')) return TWICE[base];
  return m.endsWith("'") ? words[1] : words[0];
}

// Notation as shown to the child: a real prime mark instead of an apostrophe.
export function prettyMove(move: string): string {
  return move.replace("'", '′');
}
