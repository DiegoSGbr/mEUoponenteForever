export type GameState =
  | 'menu'
  | 'playing'
  | 'paused'
  | 'tutorial'
  | 'result'
  | 'settings'
  | 'credits';

export class StateMachine {
  state: GameState = 'menu';
  private listeners: Array<(s: GameState, prev: GameState) => void> = [];

  onChange(fn: (s: GameState, prev: GameState) => void): void {
    this.listeners.push(fn);
  }

  transition(next: GameState): void {
    if (this.state === next) return;
    const prev = this.state;
    this.state = next;
    for (const fn of this.listeners) fn(next, prev);
  }

  isPlaying(): boolean {
    return this.state === 'playing' || this.state === 'tutorial';
  }

  needsPointerLock(): boolean {
    return this.state === 'playing' || this.state === 'tutorial';
  }
}
