export class StaminaSystem {
  value = 100;
  max = 100;
  regenRate = 22;
  regenDelay = 0.4;
  private regenTimer = 0;

  spend(amount: number): boolean {
    if (this.value < amount * 0.5) {
      this.value = Math.max(0, this.value - amount * 0.3);
      return false;
    }
    this.value = Math.max(0, this.value - amount);
    this.regenTimer = this.regenDelay;
    return true;
  }

  canAfford(amount: number): boolean {
    return this.value >= amount * 0.5;
  }

  update(dt: number, resting: boolean): void {
    if (this.regenTimer > 0) {
      this.regenTimer -= dt;
      return;
    }
    const mult = resting ? 1.4 : 0.85;
    this.value = Math.min(this.max, this.value + this.regenRate * mult * dt);
  }

  isExhausted(): boolean {
    return this.value < 20;
  }

  getPercent(): number {
    return (this.value / this.max) * 100;
  }
}
