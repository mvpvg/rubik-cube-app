// The only file that talks to the relay. VITE_RELAY picks the kind: ntfy (the default) or a piping
// server. VITE_RELAY_URL points it at your own server. Another kind means new versions of send and listen.
const piping = () => import.meta.env.VITE_RELAY === 'piping';
const base = () => (import.meta.env.VITE_RELAY_URL || (piping() ? 'https://ppng.io' : 'https://ntfy.sh')).replace(/\/+$/, '');

// 128 random bits: anyone who knows a room can read it. Never has `/` (the router splits on it).
export function newRoom(): string {
  return 'cube-' + Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

// A room comes from a link, so only this exact shape is used: anything else could add relay options.
export function isRoom(text?: string | null): text is string {
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
    return isRoom(room) ? room : null;
  } catch {
    return null;
  }
}

// Both kinds take the text as a POST to the room. A piping server answers OK at once, then ends its
// reply only after the computer took the text, so the send waits for that end, or the timeout.
export async function send(room: string, text: string): Promise<void> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 8000);
  try {
    const res = await fetch(`${base()}/${room}`, { method: 'POST', body: text, signal: stop.signal });
    if (!res.ok) throw new Error(`The relay said ${res.status}`);
    if (piping()) await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Returns a stop function.
export function listen(room: string, onText: (text: string) => void): () => void {
  return piping() ? listenPiping(room, onText) : listenNtfy(room, onText);
}

// A piping server keeps nothing: a GET waits for the next POST. So the computer always keeps one GET
// waiting, and opens a new one after each text or error.
function listenPiping(room: string, onText: (text: string) => void): () => void {
  const stop = new AbortController();
  (async () => {
    while (!stop.signal.aborted) {
      try {
        const res = await fetch(`${base()}/${room}`, { signal: stop.signal });
        if (!res.ok) throw new Error(`The relay said ${res.status}`);
        onText(await res.text());
      } catch {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  })();
  return () => stop.abort();
}

// since=all also gives a message sent while the connection was down.
function listenNtfy(room: string, onText: (text: string) => void): () => void {
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
