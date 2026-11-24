// localStorage can throw (private mode, blocked site data). The app must keep working without it.
export function load<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

// Returns false when the write did not happen, so a caller can keep data it would otherwise remove.
export function save(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(...keys: string[]): void {
  try {
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    // Nothing to keep working around.
  }
}
