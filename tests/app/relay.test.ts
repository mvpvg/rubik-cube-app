import { afterEach, describe, expect, it, vi } from 'vitest';
import { isRoom, listen, newRoom, send } from '../../src/app/relay';

const CUBE = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

class FakeSource {
  static last: FakeSource;
  onmessage: ((e: { data: string }) => void) | null = null;
  closed = false;
  constructor(public url: string) { FakeSource.last = this; }
  close() { this.closed = true; }
  // A closed EventSource fires nothing, as in a browser.
  fire(data: string) { if (!this.closed) this.onmessage?.({ data }); }
}

describe('relay', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('sends the text to the room on ntfy.sh', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetch);
    await send('cube-abc', CUBE);
    expect(fetch).toHaveBeenCalledWith('https://ntfy.sh/cube-abc', expect.objectContaining({ method: 'POST', body: CUBE }));
  });

  it('uses VITE_RELAY_URL when it is set', async () => {
    vi.stubEnv('VITE_RELAY_URL', 'https://relay.example/');
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('EventSource', FakeSource);
    await send('cube-abc', CUBE);
    listen('cube-abc', () => {});
    expect(fetch.mock.calls[0][0]).toBe('https://relay.example/cube-abc');
    expect(FakeSource.last.url).toBe('https://relay.example/cube-abc/sse?since=all');
  });

  it('fails when the network fails or the relay says no', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(send('cube-abc', CUBE)).rejects.toThrow();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(send('cube-abc', CUBE)).rejects.toThrow();
  });

  it('fails when the relay does not answer in 8 seconds', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })));
    const sent = send('cube-abc', CUBE);
    const check = expect(sent).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(7999);
    let settled = false;
    sent.catch(() => {}).finally(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await check;
  });

  it('listens to the room, including messages sent before it started', () => {
    vi.stubGlobal('EventSource', FakeSource);
    const got = vi.fn();
    listen('cube-abc', got);
    expect(FakeSource.last.url).toBe('https://ntfy.sh/cube-abc/sse?since=all');
    FakeSource.last.fire(JSON.stringify({ event: 'message', message: 'X' }));
    expect(got).toHaveBeenCalledWith('X');
  });

  it('ignores events that are not messages, and data that is not JSON', () => {
    vi.stubGlobal('EventSource', FakeSource);
    const got = vi.fn();
    listen('cube-abc', got);
    FakeSource.last.fire(JSON.stringify({ event: 'open' }));
    FakeSource.last.fire(JSON.stringify({ event: 'keepalive' }));
    FakeSource.last.fire('not json');
    expect(got).not.toHaveBeenCalled();
  });

  it('stops listening', () => {
    vi.stubGlobal('EventSource', FakeSource);
    const got = vi.fn();
    const stop = listen('cube-abc', got);
    stop();
    expect(FakeSource.last.closed).toBe(true);
    FakeSource.last.fire(JSON.stringify({ event: 'message', message: 'X' }));
    expect(got).not.toHaveBeenCalled();
  });

  it('makes room codes that cannot be guessed and cannot look like a side color', () => {
    const a = newRoom();
    const b = newRoom();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^cube-[a-z0-9]{26,}$/);
    expect(a).not.toContain('/');
    expect(/^[URFDLB]$/.test(a)).toBe(false);
    expect(isRoom(a)).toBe(true);
  });

  it('accepts only the room shape, so a link cannot add relay options', () => {
    expect(isRoom('cube-' + 'a'.repeat(26))).toBe(true);
    expect(isRoom('cube-' + 'a'.repeat(25))).toBe(false);
    expect(isRoom('x?email=a@b.c')).toBe(false);
    expect(isRoom('cube-' + 'a'.repeat(26) + '?email=a@b.c')).toBe(false);
    expect(isRoom('G')).toBe(false);
    expect(isRoom(undefined)).toBe(false);
  });
});
