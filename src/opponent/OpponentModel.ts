import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { PUNCH_CONFIGS } from '../combat/PunchType';
import type { OpponentAI } from './OpponentAI';
import {
  ANIM_FADE_SEC,
  LOOPING_ANIMS,
  OPPONENT_ANIMATIONS,
  OPPONENT_BASE_GLB,
  PUNCH_TO_ANIM,
  type OpponentAnimKey,
} from './OpponentAssets';
import { OpponentFaceCustomizer, type OpponentFaceSource } from './OpponentFaceCustomizer';
import { OPPONENT_FACE_REAPPLY_ON_ANIM } from './OpponentFaceConfig';

const TARGET_HEIGHT = 1.75;
const FACE_PLAYER_Y = 0;
const PUNCH_ANIMS = new Set<OpponentAnimKey>(['jab', 'cross', 'hook', 'uppercut']);

export interface OpponentLoadConfig {
  face?: OpponentFaceSource;
}

export class OpponentModel {
  readonly root = new THREE.Group();
  readonly faceCustomizer = new OpponentFaceCustomizer();

  private mixer: THREE.AnimationMixer | null = null;
  private readonly actions = new Map<OpponentAnimKey, THREE.AnimationAction>();
  private readonly meshes: THREE.Mesh[] = [];
  private currentAnim: OpponentAnimKey | null = null;
  private loaded = false;
  private activePunchToken = '';
  private hitReactionPlaying = false;

  get isLoaded(): boolean {
    return this.loaded;
  }

  /** Garante texturas prontas e compila shaders antes da primeira renderização visível. */
  prepareForDisplay(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    this.root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
        for (const tex of [
          mat.map,
          mat.normalMap,
          mat.roughnessMap,
          mat.metalnessMap,
          mat.aoMap,
          mat.emissiveMap,
        ]) {
          if (tex) renderer.initTexture(tex);
        }
      }
    });
    renderer.compile(this.root, camera);
  }

  async load(config: OpponentLoadConfig = {}): Promise<void> {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    const baseGltf = await loader.loadAsync(OPPONENT_BASE_GLB);
    const model = baseGltf.scene;

    model.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        this.meshes.push(obj);
      }
    });

    this.fitModelToRing(model);
    this.root.add(model);

    this.faceCustomizer.bindFromModel(model);
    await this.faceCustomizer.applySource(config.face ?? { kind: 'mixamo-default' });
    // Rosto fica no mesh base (Boxing.glb); troca persiste em todas as animações.

    this.mixer = new THREE.AnimationMixer(model);
    await this.loadAnimationClips(loader);

    this.fadeTo('guard', 0);
    this.loaded = true;
  }

  private async loadAnimationClips(loader: GLTFLoader): Promise<void> {
    const entries = Object.entries(OPPONENT_ANIMATIONS) as [OpponentAnimKey, string][];

    await Promise.all(
      entries.map(async ([key, url]) => {
        try {
          const gltf = await loader.loadAsync(url);
          const clip = gltf.animations[0];
          if (!clip) {
            console.warn(`[OpponentModel] Sem clip em ${url}`);
            return;
          }

          const sanitized = this.stripRootMotion(clip);
          sanitized.name = key;
          const action = this.mixer!.clipAction(sanitized);

          if (LOOPING_ANIMS.has(key)) {
            action.setLoop(THREE.LoopRepeat, Infinity);
          } else {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
          }

          this.actions.set(key, action);
        } catch (error) {
          console.error(`[OpponentModel] Falha ao carregar ${url}`, error);
        }
      }),
    );
  }

  update(dt: number, ai: OpponentAI, isPlaying: boolean): void {
    if (!this.mixer) return;

    if (!isPlaying) {
      for (const action of this.actions.values()) action.paused = true;
      return;
    }

    for (const action of this.actions.values()) action.paused = false;

    if (this.currentAnim === 'death') {
      this.mixer.update(dt);
      return;
    }

    if (this.updatePunchAnimation(dt, ai)) return;
    if (this.updateReactionAnimation(dt)) return;

    this.updateStanceAnimation(ai);
    this.mixer.update(dt);
  }

  private updatePunchAnimation(dt: number, ai: OpponentAI): boolean {
    const punch = ai.activePunch;
    if (!punch) {
      this.activePunchToken = '';
      return false;
    }

    const token = `${punch.type}-${punch.phase}`;
    if (punch.phase === 'windup' && punch.timer < dt * 2 && token !== this.activePunchToken) {
      this.activePunchToken = token;
      const animKey = PUNCH_TO_ANIM[punch.type];
      const cfg = PUNCH_CONFIGS[punch.type];
      const combatDuration = cfg.windUp * 1.1 + cfg.active + cfg.recovery;
      const clipDuration = this.actions.get(animKey)?.getClip().duration ?? 1;
      this.playOneShot(animKey, clipDuration / combatDuration);
    }

    this.mixer!.update(dt);
    return true;
  }

  private updateReactionAnimation(dt: number): boolean {
    if (!this.hitReactionPlaying || !this.currentAnim) return false;

    const action = this.actions.get(this.currentAnim);
    if (!action || action.time >= action.getClip().duration - 0.04) {
      this.hitReactionPlaying = false;
      return false;
    }

    this.mixer!.update(dt);
    return true;
  }

  private updateStanceAnimation(ai: OpponentAI): void {
    if (this.isPunchClipStillPlaying()) return;

    if (ai.isGuarding()) {
      this.fadeTo('guard');
      return;
    }

    if (ai.state === 'Tired') {
      this.fadeTo('idleTired');
      return;
    }

    if (ai.state === 'Approach' || ai.state === 'Counter') {
      this.fadeTo('walking');
      return;
    }

    if (ai.state === 'Pressure') {
      this.fadeTo('guard');
      return;
    }

    this.fadeTo('guard');
  }

  private isPunchClipStillPlaying(): boolean {
    if (!this.currentAnim || !PUNCH_ANIMS.has(this.currentAnim)) return false;
    const action = this.actions.get(this.currentAnim);
    if (!action) return false;
    return action.isRunning() && action.time < action.getClip().duration - 0.05;
  }

  private fadeTo(key: OpponentAnimKey, fade = ANIM_FADE_SEC): void {
    if (this.currentAnim === key) return;

    const next = this.actions.get(key);
    if (!next) return;

    const prev = this.currentAnim ? this.actions.get(this.currentAnim) : null;
    prev?.fadeOut(fade);

    next.reset();
    next.setEffectiveWeight(1);
    if (LOOPING_ANIMS.has(key)) {
      next.setLoop(THREE.LoopRepeat, Infinity);
    } else {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    }
    next.fadeIn(fade).play();
    this.currentAnim = key;
    this.syncFaceAfterAnim(key);
  }

  private syncFaceAfterAnim(key: OpponentAnimKey): void {
    if (!OPPONENT_FACE_REAPPLY_ON_ANIM.includes(key)) return;
    void this.faceCustomizer.reapplyAfterAnimationChange(key);
  }

  private playOneShot(key: OpponentAnimKey, timeScale = 1): void {
    const action = this.actions.get(key);
    if (!action) return;

    const prev = this.currentAnim ? this.actions.get(this.currentAnim) : null;
    prev?.fadeOut(ANIM_FADE_SEC);

    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.timeScale = timeScale;
    action.setEffectiveWeight(1);
    action.fadeIn(ANIM_FADE_SEC).play();
    this.currentAnim = key;
    this.syncFaceAfterAnim(key);
  }

  playVictory(): void {
    this.playOneShot('victory', 1);
  }

  playDefeat(): void {
    this.playOneShot('death', 1);
  }

  resetForMatch(): void {
    this.hitReactionPlaying = false;
    this.activePunchToken = '';
    this.fadeTo('guard', 0);
    void this.refreshFace();
  }

  async setFaceSource(source: OpponentFaceSource): Promise<void> {
    await this.faceCustomizer.applySource(source);
  }

  /** Reaplica a fonte de rosto atual (útil após hot-reload de assets). */
  async refreshFace(): Promise<void> {
    await this.faceCustomizer.applySource(this.faceCustomizer.source);
  }

  setGuardPose(_guarding: boolean): void {
    // Transições em updateStanceAnimation().
  }

  applyHitFlash(): void {
    for (const mesh of this.meshes) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
        const orig = mat.emissive.getHex();
        mat.emissive.setHex(0x442222);
        setTimeout(() => mat.emissive.setHex(orig), 120);
      }
    }

    this.hitReactionPlaying = true;
    this.playOneShot('hitHead', 1.15);
    void this.faceCustomizer.reapplyAfterAnimationChange('hitHead');
  }

  private fitModelToRing(model: THREE.Group): void {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    if (size.y > 0.01) {
      model.scale.setScalar(TARGET_HEIGHT / size.y);
    }

    const fitted = new THREE.Box3().setFromObject(model);
    const center = fitted.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= fitted.min.y;
    model.rotation.y = FACE_PLAYER_Y;
  }

  private stripRootMotion(clip: THREE.AnimationClip): THREE.AnimationClip {
    const tracks = clip.tracks.filter((track) => {
      if (!track.name.endsWith('.position')) return true;
      const bone = track.name.toLowerCase();
      return !bone.includes('hips') && !bone.includes('root') && !bone.includes('pelvis');
    });
    return new THREE.AnimationClip(clip.name, clip.duration, tracks);
  }

  computeHitbox(target: THREE.Box3): void {
    const worldPos = new THREE.Vector3();
    this.root.getWorldPosition(worldPos);

    if (this.meshes.length > 0) {
      target.makeEmpty();
      for (const mesh of this.meshes) {
        target.expandByObject(mesh);
      }
      target.min.y = Math.max(0.5, target.min.y);
      return;
    }

    const size = new THREE.Vector3(0.7, 1.6, 0.5);
    target.setFromCenterAndSize(
      worldPos.clone().add(new THREE.Vector3(0, 1.5, 0)),
      size,
    );
  }

  dispose(): void {
    this.mixer?.stopAllAction();
    this.mixer = null;
    this.actions.clear();
    this.meshes.length = 0;
    this.faceCustomizer.dispose();
    this.root.clear();
    this.loaded = false;
    this.currentAnim = null;
    this.activePunchToken = '';
    this.hitReactionPlaying = false;
  }
}
