import * as THREE from 'three';
import { PunchType, PUNCH_CONFIGS } from '../combat/PunchType';
import { createBoxingGlove } from './BoxingGloveFactory';
import { instantiateBoxingGlove } from './BoxingGloveAssets';

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

const IDLE_L = new THREE.Vector3(-0.34, -0.42, -0.52);
const IDLE_R = new THREE.Vector3(0.34, -0.42, -0.52);
const GUARD_L = new THREE.Vector3(-0.26, -0.28, -0.4);
const GUARD_R = new THREE.Vector3(0.26, -0.28, -0.4);

/** Pose de descanso: punhos levemente fechados na guarda baixa. */
const IDLE_ROT_L = new THREE.Euler(0.15, 0.2, 0.25);
const IDLE_ROT_R = new THREE.Euler(0.15, -0.2, -0.25);

const FP_GLOVE_LENGTH = 0.283; // metros — visão FP (ajustado empiricamente)

export class FirstPersonRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly root: THREE.Group;
  /** Grupo de pose (posição/rotação dos socos). */
  private readonly leftGlove: THREE.Group;
  private readonly rightGlove: THREE.Group;
  private yaw = 0;
  private pitch = 0;
  private guarding = false;
  activePunch: ActivePunch | null = null;

  constructor(aspect: number) {
    this.root = new THREE.Group();

    this.camera = new THREE.PerspectiveCamera(72, aspect, 0.1, 50);
    this.camera.position.set(0, 1.65, 0);
    this.root.add(this.camera);

    this.leftGlove = new THREE.Group();
    this.leftGlove.name = 'FpLeftGlovePose';
    this.leftGlove.position.copy(IDLE_L);
    this.leftGlove.rotation.copy(IDLE_ROT_L);
    this.leftGlove.add(createBoxingGlove({ scale: 1.0, mirrored: true, castShadow: false }));
    this.camera.add(this.leftGlove);

    this.rightGlove = new THREE.Group();
    this.rightGlove.name = 'FpRightGlovePose';
    this.rightGlove.position.copy(IDLE_R);
    this.rightGlove.rotation.copy(IDLE_ROT_R);
    this.rightGlove.add(createBoxingGlove({ scale: 1.0, mirrored: false, castShadow: false }));
    this.camera.add(this.rightGlove);
  }

  /** Troca o visual procedural pelo GLB RenderCrate (se carregou). */
  applyGloveTemplate(template: THREE.Object3D | null): void {
    if (!template) return;

    this.replaceGloveVisual(
      this.leftGlove,
      instantiateBoxingGlove(template, {
        mirrored: true,
        targetLength: FP_GLOVE_LENGTH,
        castShadow: false,
      }),
    );
    this.replaceGloveVisual(
      this.rightGlove,
      instantiateBoxingGlove(template, {
        mirrored: false,
        targetLength: FP_GLOVE_LENGTH,
        castShadow: false,
      }),
    );
  }

  private replaceGloveVisual(pose: THREE.Group, visual: THREE.Object3D): void {
    while (pose.children.length > 0) {
      pose.remove(pose.children[0]);
    }
    pose.add(visual);
  }

  get position(): THREE.Vector3 {
    return this.root.position;
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  resetLook(): void {
    this.yaw = 0;
    this.pitch = 0;
    this.root.rotation.y = 0;
    this.camera.rotation.x = 0;
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
      this.applyIdleOrGuardPose();
      return 'idle';
    }

    this.animateGloves();
    return p.phase;
  }

  private animateGloves(): void {
    if (!this.activePunch) {
      this.applyIdleOrGuardPose();
      return;
    }

    const cfg = PUNCH_CONFIGS[this.activePunch.type];
    const hand = cfg.hand === 'left' ? this.leftGlove : this.rightGlove;
    const other = cfg.hand === 'left' ? this.rightGlove : this.leftGlove;
    const idle = cfg.hand === 'left' ? IDLE_L : IDLE_R;
    const otherIdle = cfg.hand === 'left' ? IDLE_R : IDLE_L;
    const idleRot = cfg.hand === 'left' ? IDLE_ROT_L : IDLE_ROT_R;
    const otherIdleRot = cfg.hand === 'left' ? IDLE_ROT_R : IDLE_ROT_L;

    // Mão de apoio fica na guarda alta enquanto o outro golpeia.
    other.position.copy(this.guarding ? (cfg.hand === 'left' ? GUARD_R : GUARD_L) : otherIdle);
    other.rotation.copy(otherIdleRot);

    const t = this.activePunch.timer;
    const phase = this.activePunch.phase;
    const target = this.punchTarget(cfg.type, cfg.hand);
    const impactRot = this.punchRotation(cfg.type, cfg.hand);

    let posProgress = 0;
    let rotProgress = 0;
    if (phase === 'windup') {
      posProgress = (t / cfg.windUp) * 0.45;
      rotProgress = t / cfg.windUp;
      hand.position.lerpVectors(idle, target, posProgress);
    } else if (phase === 'active') {
      posProgress = 1;
      rotProgress = 1;
      hand.position.copy(target);
      const extend = (t / cfg.active) * 0.12 * (this.activePunch.weak ? 0.55 : 1);
      hand.position.z -= extend;
    } else {
      posProgress = Math.min(1, t / cfg.recovery);
      rotProgress = 1 - posProgress;
      hand.position.lerpVectors(target, idle, posProgress);
    }

    hand.rotation.set(
      THREE.MathUtils.lerp(idleRot.x, impactRot.x, rotProgress),
      THREE.MathUtils.lerp(idleRot.y, impactRot.y, rotProgress),
      THREE.MathUtils.lerp(idleRot.z, impactRot.z, rotProgress),
    );
  }

  setGuardPose(guarding: boolean): void {
    this.guarding = guarding;
    if (this.activePunch) return;
    this.applyIdleOrGuardPose();
  }

  private applyIdleOrGuardPose(): void {
    if (this.guarding) {
      this.leftGlove.position.copy(GUARD_L);
      this.rightGlove.position.copy(GUARD_R);
    } else {
      this.leftGlove.position.copy(IDLE_L);
      this.rightGlove.position.copy(IDLE_R);
    }
    this.leftGlove.rotation.copy(IDLE_ROT_L);
    this.rightGlove.rotation.copy(IDLE_ROT_R);
  }

  private punchTarget(type: PunchType, hand: 'left' | 'right'): THREE.Vector3 {
    const side = hand === 'left' ? -1 : 1;
    switch (type) {
      case PunchType.Jab:
        // Rápido, linha reta, ombro alinhado.
        return new THREE.Vector3(side * 0.22, -0.3, -0.98);
      case PunchType.Cross:
        // Mais longo, cruza o centro.
        return new THREE.Vector3(side * 0.12, -0.32, -1.08);
      case PunchType.Hook:
        // Arco lateral, cotovelo alto.
        return new THREE.Vector3(side * 0.58, -0.28, -0.72);
      case PunchType.Uppercut:
        // Sobe de baixo, perto do queixo.
        return new THREE.Vector3(side * 0.2, -0.08, -0.82);
      default:
        return new THREE.Vector3(side * 0.34, -0.42, -0.52);
    }
  }

  /** Orientação da luva no impacto — espelha a mecânica real do golpe. */
  private punchRotation(type: PunchType, hand: 'left' | 'right'): THREE.Euler {
    const side = hand === 'left' ? -1 : 1;
    switch (type) {
      case PunchType.Jab:
        return new THREE.Euler(0.05, side * 0.05, side * 0.1);
      case PunchType.Cross:
        return new THREE.Euler(0.1, side * -0.15, side * 0.2);
      case PunchType.Hook:
        return new THREE.Euler(0.1, side * 0.85, side * 0.35);
      case PunchType.Uppercut:
        return new THREE.Euler(-0.95, side * 0.1, side * 0.15);
      default:
        return hand === 'left' ? IDLE_ROT_L.clone() : IDLE_ROT_R.clone();
    }
  }

  getPunchWorldPosition(): THREE.Vector3 {
    if (!this.activePunch) return this.root.position.clone();
    const cfg = PUNCH_CONFIGS[this.activePunch.type];
    const glove = cfg.hand === 'left' ? this.leftGlove : this.rightGlove;
    const v = new THREE.Vector3();
    glove.getWorldPosition(v);
    // Ponto de impacto ≈ face da almofada (à frente do grupo).
    const tip = new THREE.Vector3(0, 0.02, -0.18);
    tip.applyQuaternion(glove.getWorldQuaternion(new THREE.Quaternion()));
    return v.add(tip);
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
