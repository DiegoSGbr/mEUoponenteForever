import * as THREE from 'three';
import { PunchType, PUNCH_CONFIGS } from '../combat/PunchType';

export type PunchPhase = 'idle' | 'windup' | 'active' | 'recovery';

export interface ActivePunch {
  type: PunchType;
  phase: PunchPhase;
  timer: number;
  weak: boolean;
  hitConsumed: boolean;
}

const YAW_LIMIT = Math.PI / 3;
const PITCH_LIMIT = Math.PI / 5;

export class FirstPersonRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly root: THREE.Group;
  private readonly leftGlove: THREE.Mesh;
  private readonly rightGlove: THREE.Mesh;
  private yaw = 0;
  private pitch = 0;
  activePunch: ActivePunch | null = null;

  constructor(aspect: number) {
    this.root = new THREE.Group();

    this.camera = new THREE.PerspectiveCamera(72, aspect, 0.1, 50);
    this.camera.position.set(0, 1.65, 0);
    this.root.add(this.camera);

    const gloveMat = new THREE.MeshStandardMaterial({
      color: 0xaa1111,
      roughness: 0.45,
      emissive: 0x220000,
    });

    this.leftGlove = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.22), gloveMat);
    this.leftGlove.position.set(-0.35, -0.45, -0.55);
    this.camera.add(this.leftGlove);

    this.rightGlove = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.22), gloveMat);
    this.rightGlove.position.set(0.35, -0.45, -0.55);
    this.camera.add(this.rightGlove);
  }

  get position(): THREE.Vector3 {
    return this.root.position;
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  applyLookDelta(dx: number, dy: number): void {
    this.yaw -= dx * 0.002;
    this.pitch -= dy * 0.002;
    this.yaw = THREE.MathUtils.clamp(this.yaw, -YAW_LIMIT, YAW_LIMIT);
    this.pitch = THREE.MathUtils.clamp(this.pitch, -PITCH_LIMIT, PITCH_LIMIT);
    this.root.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  startPunch(type: PunchType, weak: boolean): boolean {
    if (this.activePunch && this.activePunch.phase !== 'idle') return false;
    this.activePunch = {
      type,
      phase: 'windup',
      timer: 0,
      weak,
      hitConsumed: false,
    };
    return true;
  }

  updatePunch(dt: number): PunchPhase {
    if (!this.activePunch) return 'idle';
    const cfg = PUNCH_CONFIGS[this.activePunch.type];
    const p = this.activePunch;
    p.timer += dt;

    if (p.phase === 'windup' && p.timer >= cfg.windUp) {
      p.phase = 'active';
      p.timer = 0;
    } else if (p.phase === 'active' && p.timer >= cfg.active) {
      p.phase = 'recovery';
      p.timer = 0;
    } else if (p.phase === 'recovery' && p.timer >= cfg.recovery) {
      this.activePunch = null;
      return 'idle';
    }

    this.animateGloves(dt);
    return p.phase;
  }

  private animateGloves(_dt: number): void {
    const idleL = new THREE.Vector3(-0.35, -0.45, -0.55);
    const idleR = new THREE.Vector3(0.35, -0.45, -0.55);

    if (!this.activePunch) {
      this.leftGlove.position.copy(idleL);
      this.rightGlove.position.copy(idleR);
      return;
    }

    const cfg = PUNCH_CONFIGS[this.activePunch.type];
    const hand = cfg.hand === 'left' ? this.leftGlove : this.rightGlove;
    const other = cfg.hand === 'left' ? this.rightGlove : this.leftGlove;
    const idle = cfg.hand === 'left' ? idleL : idleR;
    const otherIdle = cfg.hand === 'left' ? idleR : idleL;

    other.position.copy(otherIdle);

    const t = this.activePunch.timer;
    const phase = this.activePunch.phase;
    const wind = cfg.windUp;
    const act = cfg.active;

    let progress = 0;
    if (phase === 'windup') {
      progress = t / wind;
      hand.position.lerpVectors(idle, this.punchTarget(cfg.type, cfg.hand), progress * 0.5);
    } else if (phase === 'active') {
      progress = t / act;
      hand.position.copy(this.punchTarget(cfg.type, cfg.hand));
      hand.position.z -= progress * 0.15 * (this.activePunch.weak ? 0.6 : 1);
    } else {
      progress = Math.min(1, t / cfg.recovery);
      hand.position.lerpVectors(this.punchTarget(cfg.type, cfg.hand), idle, progress);
    }
  }

  setGuardPose(guarding: boolean): void {
    if (this.activePunch) return;
    if (guarding) {
      this.leftGlove.position.set(-0.28, -0.32, -0.42);
      this.rightGlove.position.set(0.28, -0.32, -0.42);
    } else {
      this.leftGlove.position.set(-0.35, -0.45, -0.55);
      this.rightGlove.position.set(0.35, -0.45, -0.55);
    }
  }

  private punchTarget(type: PunchType, hand: 'left' | 'right'): THREE.Vector3 {
    const side = hand === 'left' ? -1 : 1;
    switch (type) {
      case PunchType.Jab:
        return new THREE.Vector3(side * 0.32, -0.38, -0.95);
      case PunchType.Cross:
        return new THREE.Vector3(side * 0.38, -0.4, -1.05);
      case PunchType.Hook:
        return new THREE.Vector3(side * 0.55, -0.35, -0.75);
      case PunchType.Uppercut:
        return new THREE.Vector3(side * 0.3, -0.2, -0.85);
      default:
        return new THREE.Vector3(side * 0.35, -0.45, -0.55);
    }
  }

  getPunchWorldPosition(): THREE.Vector3 {
    if (!this.activePunch) return this.root.position.clone();
    const cfg = PUNCH_CONFIGS[this.activePunch.type];
    const glove = cfg.hand === 'left' ? this.leftGlove : this.rightGlove;
    const v = new THREE.Vector3();
    glove.getWorldPosition(v);
    return v;
  }

  isPunchActive(): boolean {
    return this.activePunch?.phase === 'active';
  }

  getCurrentPunchType(): PunchType | null {
    return this.activePunch?.type ?? null;
  }

  consumeHit(): void {
    if (this.activePunch) this.activePunch.hitConsumed = true;
  }

  wasHitConsumed(): boolean {
    return this.activePunch?.hitConsumed ?? true;
  }
}
