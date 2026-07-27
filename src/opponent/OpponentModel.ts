import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { PUNCH_CONFIGS } from '../combat/PunchType';
import type { OpponentAI } from './OpponentAI';
import {
  ANIM_EXIT_BLEND_SEC,
  ANIM_FADES,
  CRITICAL_ANIMS,
  DEFERRED_ANIMS,
  LOOPING_ANIMS,
  OPPONENT_ANIMATIONS,
  OPPONENT_BASE_GLB,
  PUNCH_TO_ANIM,
  type OpponentAnimKey,
} from './OpponentAssets';
import {
  OpponentFaceCustomizer,
  type OpponentFaceSource,
  type PortraitAdjust,
} from './OpponentFaceCustomizer';
import { OPPONENT_FACE_REAPPLY_ON_ANIM } from './OpponentFaceConfig';
import type { FaceSide } from './OpponentFaceConfig';
import type { InjuryRegion } from './OpponentFaceInjuryConfig';
import {
  createOpponentGlove,
  loadOpponentGloveTemplate,
  measureHandLengthWorld,
  OPPONENT_HAND_MESH_COLLAPSE,
} from './OpponentGloves';

const TARGET_HEIGHT = 1.75;
const FACE_PLAYER_Y = 0;
const PUNCH_ANIMS = new Set<OpponentAnimKey>(['jab', 'cross', 'hook', 'uppercut']);
/** Não reinicia a reação de hit se outra acabou de começar (evita "tremida" em spam). */
const REACTION_RESTART_MIN_SEC = 0.22;
/** Limites do timeScale dos golpes (fora disso o clipe fica robótico). */
const PUNCH_TIMESCALE_MIN = 0.85;
const PUNCH_TIMESCALE_MAX = 2.4;

export interface OpponentLoadConfig {
  face?: OpponentFaceSource;
}

export class OpponentModel {
  readonly root = new THREE.Group();
  readonly faceCustomizer = new OpponentFaceCustomizer();

  private mixer: THREE.AnimationMixer | null = null;
  private readonly actions = new Map<OpponentAnimKey, THREE.AnimationAction>();
  private readonly meshes: THREE.Mesh[] = [];
  private readonly collapsedHandBones: THREE.Object3D[] = [];
  private currentAnim: OpponentAnimKey | null = null;
  private loaded = false;
  private activePunchToken = '';
  private hitReactionPlaying = false;

  get isLoaded(): boolean {
    return this.loaded;
  }

  /** Garante texturas prontas e compila shaders antes da primeira renderização visível. */
  async prepareForDisplay(renderer: THREE.WebGLRenderer, camera: THREE.Camera): Promise<void> {
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
    await this.faceCustomizer.prepareBase(renderer);
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
    await this.attachBoxingGloves(model);

    this.faceCustomizer.bindFromModel(model);
    await this.faceCustomizer.applySource(config.face ?? { kind: 'mixamo-default' });
    // Rosto fica no mesh base (Boxing.glb); troca + ferimentos PBR persistem nas animações.

    this.mixer = new THREE.AnimationMixer(model);
    await this.loadAnimationClips(loader, CRITICAL_ANIMS);

    this.fadeTo('guard', 0);
    this.loaded = true;

    // Golpes / reações / fim de luta — não bloqueiam o menu.
    void this.loadAnimationClips(loader, DEFERRED_ANIMS).catch((error) => {
      console.error('[OpponentModel] Falha ao carregar clips diferidos:', error);
    });
  }

  private async loadAnimationClips(
    loader: GLTFLoader,
    keys: readonly OpponentAnimKey[],
  ): Promise<void> {
    await Promise.all(
      keys.map(async (key) => {
        const url = OPPONENT_ANIMATIONS[key];
        try {
          const gltf = await loader.loadAsync(url);
          const clip = gltf.animations[0];
          if (!clip) {
            console.warn(`[OpponentModel] Sem clip em ${url}`);
            return;
          }

          if (!this.mixer) return;

          const sanitized = this.stripRootMotion(clip);
          sanitized.name = key;
          const action = this.mixer.clipAction(sanitized);

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
      this.reassertHandCollapse();
      return;
    }

    for (const action of this.actions.values()) action.paused = false;

    if (this.currentAnim === 'death') {
      this.mixer.update(dt);
      this.faceCustomizer.update(dt);
      this.reassertHandCollapse();
      return;
    }

    if (this.updatePunchAnimation(dt, ai)) {
      this.faceCustomizer.update(dt);
      return;
    }
    if (this.updateReactionAnimation(dt)) {
      this.faceCustomizer.update(dt);
      return;
    }

    this.updateStanceAnimation(ai);
    this.mixer.update(dt);
    this.faceCustomizer.update(dt);
    this.reassertHandCollapse();
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
      const timeScale = THREE.MathUtils.clamp(
        clipDuration / combatDuration,
        PUNCH_TIMESCALE_MIN,
        PUNCH_TIMESCALE_MAX,
      );
      this.playOneShot(animKey, timeScale, ANIM_FADES.punchIn);
    }

    this.mixer!.update(dt);
    this.reassertHandCollapse();
    return true;
  }

  private updateReactionAnimation(dt: number): boolean {
    if (!this.hitReactionPlaying || !this.currentAnim) return false;

    const action = this.actions.get(this.currentAnim);
    // Libera a postura antes do fim para o crossfade acontecer ainda em movimento.
    // action.time está em segundos do clipe; converte o blend real via timeScale.
    const exitAt = action
      ? action.getClip().duration - ANIM_EXIT_BLEND_SEC * Math.abs(action.timeScale)
      : 0;
    if (!action || action.time >= exitAt) {
      this.hitReactionPlaying = false;
      return false;
    }

    this.mixer!.update(dt);
    this.reassertHandCollapse();
    return true;
  }

  private updateStanceAnimation(ai: OpponentAI): void {
    if (this.isPunchClipStillPlaying()) return;

    // Saindo de um golpe: fade de retorno mais longo (recovery natural).
    const leavingPunch = this.currentAnim !== null && PUNCH_ANIMS.has(this.currentAnim);
    const fade = leavingPunch ? ANIM_FADES.punchOut : ANIM_FADES.stance;

    if (ai.isGuarding()) {
      this.fadeTo('guard', fade);
      return;
    }

    if (ai.state === 'Tired') {
      this.fadeTo('idleTired', fade);
      return;
    }

    if (ai.state === 'Approach' || ai.state === 'Counter') {
      this.fadeTo('walking', fade);
      return;
    }

    this.fadeTo('guard', fade);
  }

  private isPunchClipStillPlaying(): boolean {
    if (!this.currentAnim || !PUNCH_ANIMS.has(this.currentAnim)) return false;
    const action = this.actions.get(this.currentAnim);
    if (!action) return false;
    // Libera antes do fim: o crossfade para a guarda acontece durante o recovery,
    // sem congelar no último frame (clampWhenFinished).
    // action.time está em segundos do clipe; converte o blend real via timeScale.
    const exitAt =
      action.getClip().duration - ANIM_EXIT_BLEND_SEC * Math.abs(action.timeScale);
    return action.isRunning() && action.time < exitAt;
  }

  private fadeTo(key: OpponentAnimKey, fade: number = ANIM_FADES.stance): void {
    if (this.currentAnim === key) return;

    const next = this.actions.get(key);
    if (!next) return;

    const prev = this.currentAnim ? this.actions.get(this.currentAnim) : null;

    next.reset();
    next.setEffectiveWeight(1);
    if (LOOPING_ANIMS.has(key)) {
      next.setLoop(THREE.LoopRepeat, Infinity);
    } else {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    }

    if (prev && prev !== next && LOOPING_ANIMS.has(key) && this.isLoopingAnim(this.currentAnim)) {
      // Loop → loop: crossfade com warp sincroniza a fase dos passos.
      next.play();
      prev.crossFadeTo(next, fade, true);
    } else {
      prev?.fadeOut(fade);
      next.fadeIn(fade).play();
    }

    this.currentAnim = key;
    this.syncFaceAfterAnim(key);
  }

  private isLoopingAnim(key: OpponentAnimKey | null): boolean {
    return key !== null && LOOPING_ANIMS.has(key);
  }

  private syncFaceAfterAnim(key: OpponentAnimKey): void {
    if (!OPPONENT_FACE_REAPPLY_ON_ANIM.includes(key)) return;
    void this.faceCustomizer.reapplyAfterAnimationChange(key);
  }

  private playOneShot(
    key: OpponentAnimKey,
    timeScale = 1,
    fade: number = ANIM_FADES.stance,
  ): void {
    const action = this.actions.get(key);
    if (!action) return;

    const prev = this.currentAnim ? this.actions.get(this.currentAnim) : null;
    prev?.fadeOut(fade);

    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.timeScale = timeScale;
    action.setEffectiveWeight(1);
    action.fadeIn(fade).play();
    this.currentAnim = key;
    this.syncFaceAfterAnim(key);
  }

  playVictory(): void {
    this.playOneShot('victory', 1, ANIM_FADES.finish);
  }

  playDefeat(): void {
    this.playOneShot('death', 1, ANIM_FADES.finish);
  }

  resetForMatch(): void {
    this.hitReactionPlaying = false;
    this.activePunchToken = '';
    this.faceCustomizer.resetInjury();
    this.fadeTo('guard', 0);
    void this.refreshFace();
  }

  /**
   * Acumula ferimento facial (região na visão do jogador → canais RGBA).
   */
  registerFaceHit(side: FaceSide, damage: number): void {
    const region: InjuryRegion =
      side === 'left' ? 'leftEye' : side === 'right' ? 'rightEye' : 'noseMouth';
    this.registrarSoco(region, damage);
  }

  /** API canônica de impacto facial (também usada pelo hitbox). */
  registrarSoco(region: InjuryRegion, damage: number): void {
    this.faceCustomizer.registrarSoco(region, damage);
    const v = this.faceCustomizer.injury.target;
    console.info(
      `[OpponentFace] soco ${region} R=${v.x.toFixed(2)} G=${v.y.toFixed(2)} B=${v.z.toFixed(2)} A=${v.w.toFixed(2)}`,
    );
  }

  async setFaceSource(source: OpponentFaceSource): Promise<void> {
    await this.faceCustomizer.applySource(source);
  }

  async adjustFacePortrait(adjust: Partial<PortraitAdjust>): Promise<void> {
    await this.faceCustomizer.setPortraitAdjust(adjust);
  }

  /** Reaplica a fonte de rosto atual (útil após hot-reload de assets). */
  async refreshFace(): Promise<void> {
    await this.faceCustomizer.applySource(this.faceCustomizer.source);
  }

  setGuardPose(_guarding: boolean): void {
    // Transições em updateStanceAnimation().
  }

  applyHitFlash(zone: 'head' | 'body' = 'head'): void {
    for (const mesh of this.meshes) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
        const orig = mat.emissive.getHex();
        mat.emissive.setHex(0x442222);
        setTimeout(() => mat.emissive.setHex(orig), 120);
      }
    }

    // Se uma reação acabou de começar, não reinicia (evita "tremida" em spam de socos).
    if (this.hitReactionPlaying && this.currentAnim) {
      const action = this.actions.get(this.currentAnim);
      if (action && action.time < REACTION_RESTART_MIN_SEC) return;
    }

    const key: OpponentAnimKey = zone === 'body' ? 'hitBody' : 'hitHead';
    // Variação sutil de velocidade — reações idênticas parecem robóticas.
    const timeScale = 1.05 + Math.random() * 0.25;
    this.hitReactionPlaying = true;
    this.playOneShot(key, timeScale, ANIM_FADES.reactionIn);
    void this.faceCustomizer.reapplyAfterAnimationChange(key);
  }

  /**
   * Anexa luvas do oponente (GLB se existir, senão procedural) e colapsa mãos Mixamo.
   */
  private async attachBoxingGloves(model: THREE.Object3D): Promise<void> {
    const leftBone = this.findHandBone(model, 'left');
    const rightBone = this.findHandBone(model, 'right');

    if (!leftBone && !rightBone) {
      console.warn('[OpponentModel] Bones das mãos não encontrados; luvas não anexadas.');
      return;
    }

    const template = await loadOpponentGloveTemplate();

    if (leftBone) this.mountGloveOnHand(leftBone, true, template);
    if (rightBone) this.mountGloveOnHand(rightBone, false, template);
  }

  private mountGloveOnHand(
    handBone: THREE.Object3D,
    mirrored: boolean,
    template: THREE.Object3D | null,
  ): void {
    // Mede a mão ANTES de colapsar os dedos.
    const handLengthWorld = measureHandLengthWorld(handBone);

    handBone.scale.setScalar(OPPONENT_HAND_MESH_COLLAPSE);
    this.collapsedHandBones.push(handBone);
    handBone.updateWorldMatrix(true, false);

    const boneWorldScale = handBone.getWorldScale(new THREE.Vector3()).x;

    const glove = createOpponentGlove({
      mirrored,
      template,
      handLengthWorld,
      handBoneWorldScale: Math.abs(boneWorldScale) || OPPONENT_HAND_MESH_COLLAPSE,
    });
    handBone.add(glove);
  }

  /** Clips Mixamo às vezes resetam scale; reaplica o colapso após o mixer. */
  private reassertHandCollapse(): void {
    for (const bone of this.collapsedHandBones) {
      bone.scale.setScalar(OPPONENT_HAND_MESH_COLLAPSE);
    }
  }

  private findHandBone(
    root: THREE.Object3D,
    side: 'left' | 'right',
  ): THREE.Object3D | null {
    const target = side === 'left' ? 'lefthand' : 'righthand';
    let found: THREE.Object3D | null = null;

    root.traverse((obj) => {
      if (found) return;
      const n = obj.name.replace(/[:_\-\s]/g, '').toLowerCase();
      if (!n.endsWith(target)) return;
      if (
        n.includes('thumb') ||
        n.includes('index') ||
        n.includes('middle') ||
        n.includes('ring') ||
        n.includes('pinky')
      ) {
        return;
      }
      found = obj;
    });

    return found;
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
    this.collapsedHandBones.length = 0;
    this.faceCustomizer.dispose();
    this.root.clear();
    this.loaded = false;
    this.currentAnim = null;
    this.activePunchToken = '';
    this.hitReactionPlaying = false;
  }
}
