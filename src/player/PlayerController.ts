import * as THREE from 'three';
import { RING_HALF } from '../scene/RingScene';

const MOVE_SPEED = 2.2;
const DODGE_SPEED = 4.5;
const DODGE_DURATION = 0.35;
const DODGE_COOLDOWN = 1.1;
const DODGE_STAMINA = 18;

export class PlayerController {
  readonly keys = new Set<string>();
  position = new THREE.Vector3(0, 0, 0);
  dodgeCooldown = 0;
  dodgeTimer = 0;
  dodgeDirection = 0;
  isDodging = false;

  constructor() {}

  update(dt: number, rigPosition: THREE.Vector3): void {
    if (this.dodgeCooldown > 0) this.dodgeCooldown -= dt;

    if (this.isDodging) {
      this.dodgeTimer -= dt;
      this.position.x += this.dodgeDirection * DODGE_SPEED * dt;
      this.clampToRing();
      rigPosition.copy(this.position);
      if (this.dodgeTimer <= 0) this.isDodging = false;
      return;
    }

    let dx = 0;
    let dz = 0;
    if (this.keys.has('w')) dz -= 1;
    if (this.keys.has('s')) dz += 1;
    if (this.keys.has('a')) dx -= 1;
    if (this.keys.has('d')) dx += 1;

    if (dx !== 0 || dz !== 0) {
      const len = Math.hypot(dx, dz);
      dx /= len;
      dz /= len;
      this.position.x += dx * MOVE_SPEED * dt;
      this.position.z += dz * MOVE_SPEED * dt;
      this.clampToRing();
    }

    rigPosition.copy(this.position);
  }

  tryDodge(staminaOk: boolean, spendStamina: () => boolean): boolean {
    if (this.isDodging || this.dodgeCooldown > 0) return false;
    if (!staminaOk || !spendStamina()) return false;
    const left = this.keys.has('a');
    const right = this.keys.has('d');
    this.dodgeDirection = left && !right ? -1 : right && !left ? 1 : 1;
    this.isDodging = true;
    this.dodgeTimer = DODGE_DURATION;
    this.dodgeCooldown = DODGE_COOLDOWN;
    return true;
  }

  static dodgeStaminaCost(): number {
    return DODGE_STAMINA;
  }

  private clampToRing(): void {
    const margin = 0.6;
    const limit = RING_HALF - margin;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -limit, limit);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -limit, limit);
  }
}
