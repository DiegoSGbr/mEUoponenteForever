export type TutorialStep =
  | 'look'
  | 'move'
  | 'punch'
  | 'guard'
  | 'dodge'
  | 'combo'
  | 'done';

export interface TutorialProgress {
  looked: boolean;
  moved: boolean;
  jabDone: boolean;
  crossDone: boolean;
  guardDone: boolean;
  dodgeDone: boolean;
  comboDone: boolean;
}

export class Tutorial {
  step: TutorialStep = 'look';
  progress: TutorialProgress = {
    looked: false,
    moved: false,
    jabDone: false,
    crossDone: false,
    guardDone: false,
    dodgeDone: false,
    comboDone: false,
  };
  overlay: HTMLElement | null = null;
  private lookAccum = 0;
  private moveAccum = 0;

  mount(root: HTMLElement): void {
    const el = document.createElement('div');
    el.id = 'tutorial-overlay';
    el.className = 'tutorial-overlay hidden';
    root.appendChild(el);
    this.overlay = el;
    this.refreshText();
  }

  show(): void {
    this.overlay?.classList.remove('hidden');
  }

  hide(): void {
    this.overlay?.classList.add('hidden');
  }

  reset(): void {
    this.step = 'look';
    this.progress = {
      looked: false,
      moved: false,
      jabDone: false,
      crossDone: false,
      guardDone: false,
      dodgeDone: false,
      comboDone: false,
    };
    this.lookAccum = 0;
    this.moveAccum = 0;
    this.refreshText();
  }

  onLookDelta(dx: number, dy: number): void {
    if (this.step !== 'look') return;
    this.lookAccum += Math.abs(dx) + Math.abs(dy);
    if (this.lookAccum > 80) {
      this.progress.looked = true;
      this.advance();
    }
  }

  onMove(dist: number): void {
    if (this.step !== 'move') return;
    this.moveAccum += dist;
    if (this.moveAccum > 1.5) {
      this.progress.moved = true;
      this.advance();
    }
  }

  onPunch(type: string): void {
    if (this.step === 'punch') {
      if (type === 'jab') this.progress.jabDone = true;
      if (type === 'cross') this.progress.crossDone = true;
      if (this.progress.jabDone && this.progress.crossDone) this.advance();
    }
  }

  onGuard(): void {
    if (this.step === 'guard') {
      this.progress.guardDone = true;
      this.advance();
    }
  }

  onDodge(): void {
    if (this.step === 'dodge') {
      this.progress.dodgeDone = true;
      this.advance();
    }
  }

  onCombo(): void {
    if (this.step === 'combo') {
      this.progress.comboDone = true;
      this.advance();
    }
  }

  isComplete(): boolean {
    return this.step === 'done';
  }

  isActive(): boolean {
    return !!this.overlay && !this.overlay.classList.contains('hidden');
  }

  private advance(): void {
    const order: TutorialStep[] = ['look', 'move', 'punch', 'guard', 'dodge', 'combo', 'done'];
    const idx = order.indexOf(this.step);
    if (idx < order.length - 1) {
      this.step = order[idx + 1];
    }
    this.refreshText();
  }

  private refreshText(): void {
    if (!this.overlay) return;
    const texts: Record<TutorialStep, string> = {
      look: '<strong>Passo 1:</strong> Mova o mouse para olhar ao redor.',
      move: '<strong>Passo 2:</strong> Use WASD para se mover no ringue.',
      punch: '<strong>Passo 3:</strong> Dê um Jab (Q) e um Cross (E).',
      guard: '<strong>Passo 4:</strong> Segure Shift para guarda alta.',
      dodge: '<strong>Passo 5:</strong> Pressione Espaço para esquivar lateralmente.',
      combo: '<strong>Passo 6:</strong> Acerte o combo Jab → Jab → Cross.',
      done: '<strong>Tutorial completo!</strong> Continue lutando.',
    };
    this.overlay.innerHTML = texts[this.step];
  }
}
