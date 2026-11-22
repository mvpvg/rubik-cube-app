import { describe, expect, it } from 'vitest';
import { pieceMask } from '../../src/ui/piece-mask';

const FULL = 'EDGES:------------,CORNERS:--------,CENTERS:------';
const PIECES = [
  'UFR', 'UFL', 'UBL', 'UBR', 'DFR', 'DFL', 'DBL', 'DBR',
  'UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR',
];

function parse(mask: string) {
  const orbits = Object.fromEntries(mask.split(',').map((o) => o.split(':') as [string, string]));
  return { edges: orbits.EDGES, corners: orbits.CORNERS, centers: orbits.CENTERS };
}

describe('pieceMask', () => {
  it('shows the full cube when no pieces are named', () => {
    expect(pieceMask(undefined)).toBe(FULL);
    expect(pieceMask([])).toBe(FULL);
  });

  it('the white-green edge shows exactly one edge and greys every other piece', () => {
    const { edges, corners, centers } = parse(pieceMask(['UF']));
    expect(edges).toBe('-IIIIIIIIIII');
    expect(corners).toBe('IIIIIIII');
    expect(centers).toBe('------');
  });

  it('finds a piece by its colors in any order', () => {
    expect(pieceMask(['FU'])).toBe(pieceMask(['UF']));
    expect(pieceMask(['RFU'])).toBe(pieceMask(['UFR']));
    // cubing.js calls this corner URB.
    expect(parse(pieceMask(['UBR'])).corners).toBe('I-IIIIII');
    expect(parse(pieceMask(['DBR'])).corners).toBe('IIIIIII-');
    expect(parse(pieceMask(['BL'])).edges).toBe('IIIIIIIIIII-');
  });

  it('each of the 20 corner and edge pieces maps to a different position', () => {
    const seen = new Set<string>();
    for (const piece of PIECES) {
      const { edges, corners, centers } = parse(pieceMask([piece]));
      expect(edges).toHaveLength(12);
      expect(corners).toHaveLength(8);
      expect(centers).toBe('------');
      const shown = (edges + corners).split('').flatMap((c, i) => (c === '-' ? [i] : []));
      expect(shown).toHaveLength(1);
      expect((edges + corners).replace('-', '')).toMatch(/^I+$/);
      seen.add(String(shown[0]));
    }
    expect(seen.size).toBe(20);
  });

  it('shows several pieces at once', () => {
    const { edges } = parse(pieceMask(['DR', 'DF', 'DL', 'DB']));
    expect(edges).toBe('IIII----IIII');
  });
});
