import { describe, expect, it } from 'vitest';
import { qrCode } from '../../src/ui/qr';

describe('QR code', () => {
  it('draws dark squares on white with a quiet zone, a size a phone can read, and a spoken name', async () => {
    const svg = await qrCode('https://example.com/app/#/scan', 'Scan this');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Scan this');
    expect(Number(svg.getAttribute('width'))).toBeGreaterThanOrEqual(160);
    const [, , size] = svg.getAttribute('viewBox')!.split(' ').map(Number);
    const back = svg.querySelector('rect')!;
    expect(back.getAttribute('fill')).toBe('#fff');
    expect(Number(back.getAttribute('width'))).toBe(size);
    const dark = svg.querySelector('path')!;
    expect(dark.getAttribute('fill')).toBe('#000');
    const moves = dark.getAttribute('d')!.match(/M(\d+) (\d+)/g)!.map((m) => m.slice(1).split(' ').map(Number));
    expect(moves.length).toBeGreaterThan(50);
    // Four empty modules on every side.
    for (const [x, y] of moves) {
      expect(Math.min(x, y)).toBeGreaterThanOrEqual(4);
      expect(Math.max(x, y)).toBeLessThan(size - 4);
    }
  });
});
