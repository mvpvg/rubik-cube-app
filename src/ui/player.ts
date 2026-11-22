import type { TwistyPlayer } from 'cubing/twisty';

// The one place the app talks to the cubing.js 3D player, so its experimental settings stay
// pinned in one file.
// Piece masks use cubing.js piece order: edges UF UR UB UL DF DR DB DL FR FL BR BL,
// corners UFR URB UBL ULF DRF DFL DLB DBR, centers U L F R B D. '-' shows a piece, 'D' dims it.
export const DEFAULT_TEMPO = 1.2;
export const FULL_MASK = 'EDGES:------------,CORNERS:--------,CENTERS:------';

export class CubePlayer {
  readonly el: HTMLElement;
  private twisty: TwistyPlayer | null = null;
  private setup: string[] = [];
  private moves: string[] = [];
  private done = 0;
  private ready: Promise<void>;
  private disposed = false;
  private mask = FULL_MASK;
  private tempo = DEFAULT_TEMPO;

  constructor(label = '3D cube', options: { backView?: boolean } = {}) {
    this.el = document.createElement('div');
    this.el.className = 'cube-player';
    this.el.setAttribute('role', 'img');
    this.el.setAttribute('aria-label', label);
    this.ready = import('cubing/twisty').then(({ TwistyPlayer }) => {
      const t = new TwistyPlayer({
        puzzle: '3x3x3',
        visualization: '3D',
        controlPanel: 'none',
        background: 'none',
        hintFacelets: 'none',
        backView: options.backView ? 'top-right' : 'none',
        experimentalDragInput: 'auto',
        tempoScale: this.tempo,
        cameraLatitude: 28,
        cameraLongitude: 40,
      });
      if (this.disposed) return;
      t.style.width = '100%';
      t.style.height = '100%';
      t.experimentalStickeringMaskOrbits = this.mask;
      this.twisty = t;
      this.el.append(t);
      this.render(false);
    });
  }

  // setup: moves that take a solved cube to the starting cube. moves: what the child will do.
  load(setup: string[], moves: string[], done = 0): void {
    this.setup = setup;
    this.moves = moves;
    this.done = Math.max(0, Math.min(done, moves.length));
    void this.ready.then(() => this.render(false));
  }

  // Slower playback for "Do it for me".
  setTempo(scale: number): void {
    this.tempo = scale;
    if (this.twisty) this.twisty.tempoScale = scale;
  }

  // Dims the pieces that do not matter right now.
  highlight(mask: string = FULL_MASK): void {
    this.mask = mask;
    if (this.twisty) this.twisty.experimentalStickeringMaskOrbits = mask;
  }

  // Frees the WebGL view when the screen closes; phones allow only a few at once.
  dispose(): void {
    this.disposed = true;
    this.twisty?.remove();
    this.twisty = null;
  }

  // Shows `setup` and animates one more move on top of it, in a single redraw.
  playMove(setup: string[], move: string): void {
    this.setup = setup;
    this.moves = [move];
    this.done = 1;
    void this.ready.then(() => this.render(true));
  }

  get position(): number {
    return this.done;
  }

  get length(): number {
    return this.moves.length;
  }

  next(): void {
    if (this.done >= this.moves.length) return;
    this.done++;
    void this.ready.then(() => this.render(true));
  }

  back(): void {
    if (this.done <= 0) return;
    this.done--;
    void this.ready.then(() => this.render(false));
  }

  // Shows the cube after `done` moves; when animate is set, the last of those moves plays.
  private render(animate: boolean): void {
    const t = this.twisty;
    if (!t) return;
    if (animate && this.done > 0) {
      t.experimentalSetupAlg = [...this.setup, ...this.moves.slice(0, this.done - 1)].join(' ');
      t.alg = this.moves[this.done - 1];
      t.jumpToStart();
      t.play();
    } else {
      t.experimentalSetupAlg = [...this.setup, ...this.moves.slice(0, this.done)].join(' ');
      t.alg = '';
      t.jumpToStart();
    }
  }
}
