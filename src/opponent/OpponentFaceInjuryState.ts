import * as THREE from 'three';
import {
  INJURY_CHANNEL,
  INJURY_FULL_THRESHOLD,
  INJURY_LERP_SPEED,
  type InjuryRegion,
} from './OpponentFaceInjuryConfig';

/**
 * Intensidades alvo vs atuais (GPU lê só as atuais via uniform vec4).
 * Suavização: exponential lerp estável em framerate variável.
 */
export class OpponentFaceInjuryState {
  /** Valores enviados ao shader (0–1 por canal). */
  readonly current = new THREE.Vector4(0, 0, 0, 0);
  /** Alvos acumulados por `registrarSoco`. */
  readonly target = new THREE.Vector4(0, 0, 0, 0);

  reset(): void {
    this.current.set(0, 0, 0, 0);
    this.target.set(0, 0, 0, 0);
  }

  get hasDamage(): boolean {
    return this.target.x + this.target.y + this.target.z + this.target.w > 0.001;
  }

  /**
   * Acumula ferimento numa região. Sangramento cruzado leve para realismo.
   */
  registrarSoco(region: InjuryRegion, damage: number): void {
    const amount = Math.max(0.04, damage / INJURY_FULL_THRESHOLD);
    const i = INJURY_CHANNEL[region];
    this.addChannel(i, amount);

    // Sangramento cruzado: hits no olho também ativam nariz/bochecha cedo.
    if (region === 'leftEye' || region === 'rightEye') {
      this.addChannel(INJURY_CHANNEL.cheeks, amount * 0.35);
      this.addChannel(INJURY_CHANNEL.noseMouth, amount * 0.35);
    } else if (region === 'noseMouth') {
      this.addChannel(INJURY_CHANNEL.cheeks, amount * 0.2);
      // Leve bilaterização para o sangue do nariz “pegar” visualmente
      this.addChannel(INJURY_CHANNEL.leftEye, amount * 0.08);
      this.addChannel(INJURY_CHANNEL.rightEye, amount * 0.08);
    } else if (region === 'cheeks') {
      this.addChannel(INJURY_CHANNEL.noseMouth, amount * 0.2);
    }
  }

  /** Aproxima `current` → `target` (chamar no loop com dt). */
  update(dt: number): void {
    const t = 1 - Math.exp(-INJURY_LERP_SPEED * Math.max(0, dt));
    this.current.x = THREE.MathUtils.lerp(this.current.x, this.target.x, t);
    this.current.y = THREE.MathUtils.lerp(this.current.y, this.target.y, t);
    this.current.z = THREE.MathUtils.lerp(this.current.z, this.target.z, t);
    this.current.w = THREE.MathUtils.lerp(this.current.w, this.target.w, t);
  }

  private addChannel(index: 0 | 1 | 2 | 3, amount: number): void {
    const v = this.target;
    if (index === 0) v.x = Math.min(1, v.x + amount);
    else if (index === 1) v.y = Math.min(1, v.y + amount);
    else if (index === 2) v.z = Math.min(1, v.z + amount);
    else v.w = Math.min(1, v.w + amount);
  }
}
