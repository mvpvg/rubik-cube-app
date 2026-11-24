import { afterEach, describe, expect, it, vi } from 'vitest';
import { load, remove, save } from '../../src/app/storage';

describe('storage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('round-trips a value and reports the write worked', () => {
    expect(save('k', { stage: 2 })).toBe(true);
    expect(load<{ stage: number }>('k')).toEqual({ stage: 2 });
  });

  it('removes keys', () => {
    save('a', 1);
    save('b', 2);
    remove('a', 'b');
    expect(load('a')).toBeNull();
    expect(load('b')).toBeNull();
  });

  it('keeps working when localStorage throws, and reports the write failed', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(save('k', 1)).toBe(false);
    expect(load('k')).toBeNull();
    expect(() => remove('k')).not.toThrow();
  });
});
