import { h } from './dom';

export type ConfirmWords = { question: string; keep: string; drop: string };

// Resolves true only when the delete button is tapped. Esc, the Android back gesture, and a screen
// change (the dialog lives inside the screen, so it goes with it) all keep the work.
export function confirmDelete(root: HTMLElement, words: ConfirmWords): Promise<boolean> {
  return new Promise((resolve) => {
    const answer = (drop: boolean) => {
      dialog.close();
      dialog.remove();
      resolve(drop);
    };
    const dialog = h('dialog', { class: 'confirm', oncancel: () => answer(false) },
      h('p', { class: 'confirm-question' }, words.question),
      h('button', { class: 'btn btn-primary btn-wide', onclick: () => answer(false) }, words.keep),
      h('button', { class: 'btn btn-ghost btn-wide', onclick: () => answer(true) }, words.drop),
    );
    root.append(dialog);
    dialog.showModal();
  });
}
