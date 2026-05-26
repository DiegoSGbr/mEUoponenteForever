import * as THREE from 'three';
import { PunchType, PUNCH_CONFIGS } from '../combat/PunchType';

export type AIState = 'Approach' | 'Pressure' | 'Defend' | 'Counter' | 'Tired';

export interface AIPunch {
  type: PunchType;
  phase: 'windup' | 'active' | 'recovery' | 'idle';
  timer: number;
  damage: number;
  range: number;
}

export class OpponentAI {
  state: AIState = 'Approach';
  stateTimer = 0;
  punchCooldown = 0;
  guardActive = false;
  stamina = 100;
  readonly position = new THREE.Vector3(0, 0, -4.2);
  activePunch: AIPunch | null = null;
  aggression = 0;

  private readonly punchTypes = [
    PunchType.Jab,
    PunchType.Cross,
    PunchType.Hook,
    PunchType.Jab,
  ];

  update(
    dt: number,
    playerPos: THREE.Vector3,
    playerAggressive: boolean,
    playerStaminaLow: boolean,
  ): void {
    this.stateTimer -= dt;
    if (this.punchCooldown > 0) this.punchCooldown -= dt;

    const dist = this.position.distanceTo(playerPos);
    this.aggression = playerAggressive ? 1 : 0;

    if (this.stamina < 25) {
      this.setState('Tired', 2);
    } else if (playerStaminaLow && dist < 2.5) {
      this.setState('Pressure', 1.5);
    } else if (playerAggressive && dist < 2.2) {
      this.setState(Math.random() > 0.4 ? 'Defend' : 'Counter', 1.2);
    } else if (dist > 2.8) {
      this.setState('Approach', 1);
    } else if (dist < 2) {
      this.setState('Pressure', 1.5);
    }

    this.updateMovement(dt, playerPos, dist);
    this.updatePunch(dt, dist);
    this.updateGuard(dt);
    this.stamina = Math.min(100, this.stamina + dt * (this.state === 'Tired' ? 18 : 10));
  }

  private setState(s: AIState, duration: number): void {
    if (this.state === s && this.stateTimer > 0) return;
    this.state = s;
    this.stateTimer = duration;
  }

  private updateMovement(dt: number, playerPos: THREE.Vector3, dist: number): void {
    const dir = playerPos.clone().sub(this.position);
    dir.y = 0;
    if (dir.length() < 0.01) return;
    dir.normalize();

    let speed = 0;
    switch (this.state) {
      case 'Approach':
        speed = 1.4;
        break;
      case 'Pressure':
        speed = dist > 1.8 ? 1.8 : 0.6;
        break;
      case 'Defend':
        speed = dist < 1.5 ? -0.8 : 0.2;
        break;
      case 'Counter':
        speed = 1.2;
        break;
      case 'Tired':
        speed = 0.3;
        break;
    }

    if (this.state === 'Defend' && dist < 2) {
      this.guardActive = true;
    }

    this.position.addScaledVector(dir, speed * dt);
    this.position.x = THREE.MathUtils.clamp(this.position.x, -2.5, 2.5);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -5.5, -2);
  }

  private updateGuard(dt: number): void {
    if (this.state !== 'Defend' && this.state !== 'Tired') {
      this.guardActive = false;
    }
    if (this.guardActive && this.stamina > 0) {
      this.stamina -= dt * 8;
    }
  }

  private updatePunch(dt: number, dist: number): void {
    if (this.activePunch) {
      const p = this.activePunch;
      p.timer += dt;
      const cfg = PUNCH_CONFIGS[p.type];
      if (p.phase === 'windup' && p.timer >= cfg.windUp * 1.1) {
        p.phase = 'active';
        p.timer = 0;
      } else if (p.phase === 'active' && p.timer >= cfg.active) {
        p.phase = 'recovery';
        p.timer = 0;
      } else if (p.phase === 'recovery' && p.timer >= cfg.recovery) {
        this.activePunch = null;
      }
      return;
    }

    if (this.punchCooldown > 0 || this.guardActive) return;
    if (this.state === 'Tired' && Math.random() > 0.15) return;
    if (dist > 2.4 || dist < 1.2) return;

    const wantAttack =
      this.state === 'Pressure' ||
      this.state === 'Counter' ||
      (this.state === 'Approach' && dist < 2.2);

    if (!wantAttack || Math.random() > 0.55) return;

    const type = this.punchTypes[Math.floor(Math.random() * this.punchTypes.length)];
    const cfg = PUNCH_CONFIGS[type];
    if (this.stamina < cfg.staminaCost) return;

    this.stamina -= cfg.staminaCost;
    this.activePunch = {
      type,
      phase: 'windup',
      timer: 0,
      damage: cfg.damage * 0.85,
      range: cfg.range,
    };
    this.punchCooldown = 0.7 + Math.random() * 0.5;
  }

  isPunchActive(): boolean {
    return this.activePunch?.phase === 'active';
  }

  getPunchOrigin(): THREE.Vector3 {
    return this.position.clone().add(new THREE.Vector3(0, 1.5, 0.3));
  }

  getCurrentDamage(): number {
    return this.activePunch?.damage ?? 0;
  }

  getCurrentRange(): number {
    return this.activePunch?.range ?? 0;
  }

  isGuarding(): boolean {
    return this.guardActive;
  }
}
