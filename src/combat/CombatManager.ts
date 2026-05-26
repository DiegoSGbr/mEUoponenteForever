import { HitResolver } from './HitResolver';
import { ComboDetector } from './ComboDetector';
import { PunchType, PUNCH_CONFIGS } from './PunchType';
import { StaminaSystem } from '../player/StaminaSystem';

export interface FighterStats {
  health: number;
  maxHealth: number;
  knockdowns: number;
  punchesThrown: number;
  punchesLanded: number;
  guardTime: number;
  guardTotal: number;
}

export class CombatManager {
  readonly hitResolver = new HitResolver();
  readonly comboDetector = new ComboDetector();
  readonly player: FighterStats;
  readonly opponent: FighterStats;
  staggerTimer = 0;

  constructor() {
    this.player = this.createFighter();
    this.opponent = this.createFighter();
  }

  private createFighter(): FighterStats {
    return {
      health: 100,
      maxHealth: 100,
      knockdowns: 0,
      punchesThrown: 0,
      punchesLanded: 0,
      guardTime: 0,
      guardTotal: 0,
    };
  }

  reset(): void {
    Object.assign(this.player, this.createFighter());
    Object.assign(this.opponent, this.createFighter());
    this.staggerTimer = 0;
    this.comboDetector.lastCombo = null;
  }

  applyDamageToOpponent(damage: number): boolean {
    this.opponent.health = Math.max(0, this.opponent.health - damage);
    this.player.punchesLanded += 1;
    if (this.opponent.health <= 0) return true;
    if (damage >= 15) {
      this.opponent.knockdowns += 1;
      this.opponent.health = Math.max(0, this.opponent.health - 5);
    }
    return this.opponent.health <= 0;
  }

  applyDamageToPlayer(damage: number): boolean {
    this.player.health = Math.max(0, this.player.health - damage);
    if (damage >= 12) {
      this.player.knockdowns += 1;
    }
    return this.player.health <= 0;
  }

  tryPlayerPunch(
    type: PunchType,
    stamina: StaminaSystem,
    rigCanPunch: boolean,
    startPunch: (type: PunchType, weak: boolean) => boolean,
  ): boolean {
    if (!rigCanPunch || this.staggerTimer > 0) return false;
    const cfg = PUNCH_CONFIGS[type];
    this.player.punchesThrown += 1;
    const canAfford = stamina.canAfford(cfg.staminaCost);
    const weak = !canAfford;
    if (!weak && !stamina.spend(cfg.staminaCost)) return false;
    if (weak) stamina.spend(cfg.staminaCost * 0.5);
    return startPunch(type, weak);
  }

  update(dt: number): void {
    if (this.staggerTimer > 0) this.staggerTimer -= dt;
  }

  triggerStagger(duration = 0.35): void {
    this.staggerTimer = duration;
  }
}
