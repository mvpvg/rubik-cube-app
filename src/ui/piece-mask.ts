// Builds a cubing.js stickering mask that shows only the named pieces and greys out the rest.
// Pieces are named by their home colors as face letters, in any order ('UF' and 'FU' are both
// the white-green edge). cubing.js masks follow each piece wherever the moves take it.
// cubing.js piece order: edges UF UR UB UL DF DR DB DL FR FL BR BL, corners UFR URB UBL ULF
// DRF DFL DLB DBR, centers U L F R B D. '-' shows a piece, 'I' greys it.

const EDGES = ['UF', 'UR', 'UB', 'UL', 'DF', 'DR', 'DB', 'DL', 'FR', 'FL', 'BR', 'BL'];
const CORNERS = ['UFR', 'URB', 'UBL', 'ULF', 'DRF', 'DFL', 'DLB', 'DBR'];
const CENTERS = '------';

const key = (name: string) => name.split('').sort().join('');

function orbit(names: string[], shown: Set<string>): string {
  return names.map((n) => (shown.has(key(n)) ? '-' : 'I')).join('');
}

export function pieceMask(pieces: string[] | undefined): string {
  if (!pieces?.length) return `EDGES:${'-'.repeat(12)},CORNERS:${'-'.repeat(8)},CENTERS:${CENTERS}`;
  const shown = new Set(pieces.map(key));
  return `EDGES:${orbit(EDGES, shown)},CORNERS:${orbit(CORNERS, shown)},CENTERS:${CENTERS}`;
}
