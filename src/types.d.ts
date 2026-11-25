interface ImportMetaEnv {
  readonly VITE_RELAY_URL?: string;
}

declare module 'cubejs' {
  export default class Cube {
    constructor(state?: unknown);
    static fromString(str: string): Cube;
    static random(): Cube;
    static initSolver(): void;
    static inverse(alg: string): string;
    move(alg: string): Cube;
    asString(): string;
    solve(maxDepth?: number): string;
    isSolved(): boolean;
  }
}
