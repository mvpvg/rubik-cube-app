// The only file that talks to the relay (ntfy by default). To use your own relay, set VITE_RELAY_URL
// to a self-hosted ntfy, or replace this file with the same calls for another relay type.
const base = () => (import.meta.env.VITE_RELAY_URL || 'https://ntfy.sh').replace(/\/+$/, '');

// 128 random bits: anyone who knows a room can read it. Never has `/` (the router splits on it).
export function newRoom(): string {
  return 'cube-' + Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

// A room comes from a link, so only this exact shape is used: anything else could add relay options.
export function isRoom(text?: string): text is string {
  return /^cube-[a-z0-9]{26,}$/.test(text ?? '');
}

// The room from the QR link, for this tab only. It carries one send: the computer stops listening
// after the first cube, so a later send would reach no one.
export function keepRoom(room: string | null): void {
  try {
    if (room) sessionStorage.setItem('cube.room', room);
    else sessionStorage.removeItem('cube.room');
  } catch {
    // Without it, the phone shares the link instead.
  }
}

export function keptRoom(): string | null {
  try {
    const room = sessionStorage.getItem('cube.room');
    return isRoom(room ?? '') ? room : null;
  } catch {
    return null;
  }
}

export async function send(room: string, text: string): Promise<void> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 8000);
  try {
    const res = await fetch(`${base()}/${room}`, { method: 'POST', body: text, signal: stop.signal });
    if (!res.ok) throw new Error(`The relay said ${res.status}`);
  } finally {
    clearTimeout(timer);
  }
}

// since=all also gives a message sent while the connection was down. Returns a stop function.
export function listen(room: string, onText: (text: string) => void): () => void {
  const source = new EventSource(`${base()}/${room}/sse?since=all`);
  source.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.event === 'message' && typeof data.message === 'string') onText(data.message);
    } catch {
      // Not a relay message.
    }
  };
  return () => source.close();
}
