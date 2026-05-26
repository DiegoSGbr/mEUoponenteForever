import { PunchType } from './PunchType';

export interface ComboState {
  name: string;
  bonus: number;
  display: string;
}

const COMBO_SEQUENCE: PunchType[] = [PunchType.Jab, PunchType.Jab, PunchType.Cross];
const COMBO_WINDOW = 2.8;
const COMBO_BONUS = 0.25;

export class ComboDetector {
  private sequence: PunchType[] = [];
  private lastHitTime = 0;
  lastCombo: ComboState | null = null;

  registerPunch(type: PunchType, now: number, landed: boolean): ComboState | null {
    if (!landed) return null;

    if (now - this.lastHitTime > COMBO_WINDOW) {
      this.sequence = [];
    }
    this.lastHitTime = now;
    this.sequence.push(type);

    if (this.sequence.length > COMBO_SEQUENCE.length) {
      this.sequence.shift();
    }

    if (this.matchesCombo()) {
      this.lastCombo = {
        name: 'jab-jab-cross',
        bonus: COMBO_BONUS,
        display: 'COMBO! Jab → Jab → Cross',
      };
      this.sequence = [];
      return this.lastCombo;
    }

    if (this.sequence.length >= 2) {
      return {
        name: 'partial',
        bonus: 0,
        display: `${this.sequence.map((p) => p).join(' → ')}...`,
      };
    }

    return null;
  }

  getComboBonus(): number {
    return this.lastCombo?.bonus ?? 0;
  }

  clearComboDisplay(): void {
    if (this.lastCombo && this.lastCombo.name !== 'jab-jab-cross') {
      this.lastCombo = null;
    }
  }

  private matchesCombo(): boolean {
    if (this.sequence.length !== COMBO_SEQUENCE.length) return false;
    return this.sequence.every((p, i) => p === COMBO_SEQUENCE[i]);
  }
}
