import { CENTER_INDEX, FACES, toColors } from '../cube/facelets';
import { validate } from '../cube/validate';
import { confirmDelete } from '../ui/confirm';
import { h } from '../ui/dom';
import { go } from './router';
import { hasWorkToKeep, saveSession, session, startNewWork } from './session';

const REPLACE_WORDS = { question: 'Open the cube from this link? Your saved cube will be deleted.', keep: 'Keep my cube', drop: 'Delete and open it' };

// A link is `#/cube/<54 solver letters>`. Returns the cube, or null when the link cannot be used.
// Messengers may add text after the cube, so only the first 54 characters count.
export function readCubeLink(payload = ''): string | null {
  const cube = payload.slice(0, 54).toUpperCase();
  if (!/^[URFDLB]{54}$/.test(cube)) return null;
  // Saved work with moved centers is thrown away on load, so such a cube must never be saved.
  if (!CENTER_INDEX.every((i, f) => cube[i] === FACES[f])) return null;
  return validate(cube).ok ? cube : null;
}

// Every change waits until the whole link is checked. Moving on replaces the address, so the cube
// leaves it and a refresh cannot import it again.
export function cubeLinkScreen(root: HTMLElement, param?: string): void {
  const cube = readCubeLink(param);
  if (!cube) {
    root.append(h('section', { class: 'screen' },
      h('p', { class: 'sub', role: 'alert' }, 'This link does not hold a cube we can use'),
      h('button', { class: 'btn btn-primary', onclick: () => go('home', undefined, { replace: true }) }, 'Home'),
    ));
    return;
  }
  const open = () => go('review', undefined, { replace: true });
  if (session.facelets === cube) {
    // The same cube: keep its Solve and Learn progress, and show the link's colors.
    Object.assign(session, { colors: toColors(cube), checkMe: [], filled: [] });
    saveSession();
    return open();
  }
  const replace = () => {
    startNewWork({ colors: toColors(cube), facelets: cube, route: 'review' });
    open();
  };
  if (!hasWorkToKeep()) return replace();
  confirmDelete(root, REPLACE_WORDS).then((drop) => (drop ? replace() : go('home', undefined, { replace: true })));
}
