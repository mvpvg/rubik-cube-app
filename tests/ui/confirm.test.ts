import { beforeAll, describe, expect, it } from 'vitest';
import { confirmDelete } from '../../src/ui/confirm';

// jsdom has no modal dialog; the real one (Esc, the back gesture) is proven in the browser tests.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});

const WORDS = { question: 'Start over? Your saved cube will be deleted.', keep: 'Keep my cube', drop: 'Delete and start over' };
const button = (root: HTMLElement, name: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent === name)!;

function ask(): { root: HTMLElement; answer: Promise<boolean> } {
  const root = document.createElement('main');
  document.body.replaceChildren(root);
  return { root, answer: confirmDelete(root, WORDS) };
}

describe('confirmDelete', () => {
  it('opens inside the screen with the question, the keep button first and primary, and the delete button in words', () => {
    const { root } = ask();
    const dialog = root.querySelector('dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain(WORDS.question);
    const buttons = [...dialog.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Keep my cube', 'Delete and start over']);
    expect(buttons[0].classList.contains('btn-primary')).toBe(true);
    expect(buttons[1].classList.contains('btn-ghost')).toBe(true);
  });

  it('"Keep my cube" answers keep and removes the dialog', async () => {
    const { root, answer } = ask();
    button(root, 'Keep my cube').click();
    expect(await answer).toBe(false);
    expect(root.querySelector('dialog')).toBeNull();
  });

  it('"Delete and start over" answers delete', async () => {
    const { root, answer } = ask();
    button(root, 'Delete and start over').click();
    expect(await answer).toBe(true);
    expect(root.querySelector('dialog')).toBeNull();
  });

  it('Esc or the back gesture (the dialog\'s cancel) answers keep', async () => {
    const { root, answer } = ask();
    root.querySelector('dialog')!.dispatchEvent(new Event('cancel'));
    expect(await answer).toBe(false);
    expect(root.querySelector('dialog')).toBeNull();
  });

  it('a screen change removes the dialog, and it never answers delete later', async () => {
    const { root, answer } = ask();
    let answered: boolean | null = null;
    answer.then((a) => { answered = a; });
    root.replaceChildren();
    await new Promise((r) => setTimeout(r));
    expect(root.querySelector('dialog')).toBeNull();
    expect(answered).toBeNull();
  });
});
