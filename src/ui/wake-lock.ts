// Keeps the phone from dimming while a screen is open. Returns the function that lets it dim again.
// The browser drops the lock when the page is hidden, so it is asked for again on coming back.
// Every failure is ignored: the screen works the same, it may just dim.
export function keepScreenOn(): () => void {
  let lock: WakeLockSentinel | null = null;
  let on = true;
  const ask = () => {
    Promise.resolve()
      .then(() => navigator.wakeLock?.request('screen'))
      .then((got) => {
        if (on) lock = got ?? null;
        else got?.release().catch(() => {});
      })
      .catch(() => {});
  };
  const onVisible = () => { if (document.visibilityState === 'visible') ask(); };
  ask();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    on = false;
    document.removeEventListener('visibilitychange', onVisible);
    lock?.release().catch(() => {});
  };
}
