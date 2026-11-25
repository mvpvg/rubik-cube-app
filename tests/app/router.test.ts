import { describe, expect, it } from 'vitest';
import { go, register, start } from '../../src/app/router';

const hashChanged = () => new Promise((r) => window.addEventListener('hashchange', r, { once: true }));

describe('router', () => {
  it('a step moved to with replace takes the place of the one before it, so Back skips it', async () => {
    document.body.replaceChildren(Object.assign(document.createElement('main'), { id: 'app' }));
    const shown: string[] = [];
    for (const name of ['home', 'scan', 'review']) register(name, (root) => { shown.push(name); root.textContent = name; });
    start();
    go('home');
    await hashChanged();
    go('scan');
    await hashChanged();
    const entries = history.length;
    go('review', undefined, { replace: true });
    expect(location.hash).toBe('#/review');
    expect(document.getElementById('app')!.textContent).toBe('review');
    expect(history.length).toBe(entries);
    history.back();
    await hashChanged();
    expect(location.hash).toBe('#/home');
    expect(shown.at(-1)).toBe('home');
  });
});
