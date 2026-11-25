import { confirmDelete } from '../ui/confirm';
import { h, icon } from '../ui/dom';
import { go } from './router';
import { hasWorkToKeep } from './session';

// Exit goes Home after the child agrees. `lost` names what leaving loses, if anything. The words
// promise "Keep going" only when Home really shows it.
export function exitButton(root: HTMLElement, lost: () => string | null = () => null): HTMLButtonElement {
  const exit = () => {
    const question = ['Go back Home?', lost(), hasWorkToKeep() ? 'Your cube is saved. Tap "Keep going" on Home to come back.' : null]
      .filter(Boolean).join(' ');
    confirmDelete(root, { question, keep: 'Stay', drop: 'Go Home' }).then((drop) => { if (drop) go('home'); });
  };
  return h('button', { class: 'top-btn top-exit', onclick: exit }, icon('exit'), 'Exit');
}
