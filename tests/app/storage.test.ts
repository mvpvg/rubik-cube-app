import { afterEach, describe, expect, it, vi } from 'vitest';
import { load, save } from '../../src/app/storage';

describe('storage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('round-trips a value', () => {
    save('k', { stage: 2 });
    expect(load<{ stage: number }>('k')).toEqual({ stage: 2 });
  });

  it('keeps working when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => save('k', 1)).not.toThrow();
    expect(load('k')).toBeNull();
  });
});
