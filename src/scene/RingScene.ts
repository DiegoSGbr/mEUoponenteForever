import * as THREE from 'three';
import { OpponentModel, type OpponentLoadConfig } from '../opponent/OpponentModel';
import type { OpponentFaceSource } from '../opponent/OpponentFaceCustomizer';
import type { OpponentAI } from '../opponent/OpponentAI';
import { OPPONENT_SPAWN_Z, RING_HALF } from './ringBounds';

export { RING_HALF } from './ringBounds';
export const RING_FLOOR_Y = 0;

const DEFAULT_OPPONENT_LOAD: OpponentLoadConfig = {
  face: { kind: 'mixamo-default' },
};

export class RingScene {
  readonly scene: THREE.Scene;
  readonly opponentGroup: THREE.Group;
  readonly opponentHitbox: THREE.Box3;
  private opponentModel: OpponentModel | null = null;
  private placeholderGroup: THREE.Group | null = null;
  private placeholderBody: THREE.Mesh | null = null;
  private modelLoadPromise: Promise<void> | null = null;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1520);
    this.scene.fog = new THREE.Fog(0x1a1520, 8, 22);

    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xfff5e6, 1.1);
    key.position.set(2, 8, 4);
    key.castShadow = true;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x8899ff, 0.35);
    fill.position.set(-4, 5, -2);
    this.scene.add(fill);

    this.buildRing();

    this.opponentGroup = new THREE.Group();
    this.opponentGroup.position.set(0, 0, OPPONENT_SPAWN_Z);
    this.opponentGroup.visible = false;
    this.scene.add(this.opponentGroup);

    const hitSize = new THREE.Vector3(0.7, 1.6, 0.5);
    this.opponentHitbox = new THREE.Box3(
      new THREE.Vector3(-hitSize.x / 2, 0.9, -hitSize.z / 2),
      new THREE.Vector3(hitSize.x / 2, 2.5, hitSize.z / 2),
    );
  }

  get isOpponentReady(): boolean {
    return this.opponentModel?.isLoaded ?? false;
  }

  loadOpponentModel(config: OpponentLoadConfig = DEFAULT_OPPONENT_LOAD): Promise<void> {
    if (!this.modelLoadPromise) {
      this.modelLoadPromise = this.loadOpponentModelInternal(config);
    }
    return this.modelLoadPromise;
  }

  prepareOpponentDisplay(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    this.opponentModel?.prepareForDisplay(renderer, camera);
  }

  async setOpponentFace(source: OpponentFaceSource): Promise<void> {
    await this.opponentModel?.setFaceSource(source);
  }

  async refreshOpponentFace(): Promise<void> {
    await this.opponentModel?.refreshFace();
  }

  playOpponentVictory(): void {
    this.opponentModel?.playVictory();
  }

  playOpponentDefeat(): void {
    this.opponentModel?.playDefeat();
  }

  resetOpponentForMatch(): void {
    this.opponentModel?.resetForMatch();
  }

  private async loadOpponentModelInternal(config: OpponentLoadConfig): Promise<void> {
    try {
      const model = new OpponentModel();
      await model.load(config);

      this.opponentGroup.add(model.root);
      this.opponentModel = model;
      this.updateOpponentHitbox();
      this.opponentGroup.visible = true;
      console.info('[RingScene] Oponente Mixamo carregado.');
    } catch (error) {
      console.error('[RingScene] Falha ao carregar modelo do oponente; usando placeholder.', error);
      this.showPlaceholderOpponent();
    }
  }

  updateOpponentAnimation(dt: number, ai: OpponentAI, isPlaying: boolean): void {
    this.opponentModel?.update(dt, ai, isPlaying);
  }

  private buildRing(): void {
    const floorGeo = new THREE.PlaneGeometry(RING_HALF * 2, RING_HALF * 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x2a2438,
      roughness: 0.85,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = RING_FLOOR_Y;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const canvasGeo = new THREE.PlaneGeometry(RING_HALF * 2 - 0.4, RING_HALF * 2 - 0.4);
    const canvasMat = new THREE.MeshStandardMaterial({
      color: 0x3d2848,
      roughness: 0.7,
    });
    const canvas = new THREE.Mesh(canvasGeo, canvasMat);
    canvas.rotation.x = -Math.PI / 2;
    canvas.position.y = RING_FLOOR_Y + 0.01;
    this.scene.add(canvas);

    const ropeMat = new THREE.MeshStandardMaterial({
      color: 0xcc3333,
      emissive: 0x330000,
      roughness: 0.4,
    });
    const ropeHeight = 1.0;
    const sizes = [
      { w: RING_HALF * 2, d: 0.08, px: 0, pz: RING_HALF },
      { w: RING_HALF * 2, d: 0.08, px: 0, pz: -RING_HALF },
      { w: 0.08, d: RING_HALF * 2, px: RING_HALF, pz: 0 },
      { w: 0.08, d: RING_HALF * 2, px: -RING_HALF, pz: 0 },
    ];
    for (let level = 0; level < 3; level++) {
      const y = 0.35 + level * 0.28;
      for (const s of sizes) {
        const geo = new THREE.BoxGeometry(s.w, 0.06, s.d);
        const rope = new THREE.Mesh(geo, ropeMat);
        rope.position.set(s.px, y, s.pz);
        this.scene.add(rope);
      }
    }

    const postMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const corners = [
      [RING_HALF, RING_HALF],
      [-RING_HALF, RING_HALF],
      [RING_HALF, -RING_HALF],
      [-RING_HALF, -RING_HALF],
    ];
    for (const [x, z] of corners) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, ropeHeight + 0.5, 8),
        postMat,
      );
      post.position.set(x, ropeHeight / 2, z);
      this.scene.add(post);
    }
  }

  private showPlaceholderOpponent(): void {
    if (this.placeholderGroup) return;

    this.placeholderGroup = this.buildPlaceholderOpponent();
    this.opponentGroup.add(this.placeholderGroup);
    this.placeholderBody = this.placeholderGroup.children[0] as THREE.Mesh;
    this.opponentGroup.visible = true;
  }

  private buildPlaceholderOpponent(): THREE.Group {
    const group = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc68642, roughness: 0.6 });
    const shortsMat = new THREE.MeshStandardMaterial({ color: 0x2244aa, roughness: 0.7 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.5 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.1, 0.4), shortsMat);
    torso.position.y = 1.35;
    torso.castShadow = true;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), skinMat);
    head.position.y = 2.15;
    head.castShadow = true;
    group.add(head);

    const leftGlove = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.28), gloveMat);
    leftGlove.position.set(-0.55, 1.55, 0.25);
    leftGlove.userData.isGlove = true;
    group.add(leftGlove);

    const rightGlove = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.28), gloveMat);
    rightGlove.position.set(0.55, 1.55, 0.25);
    rightGlove.userData.isGlove = true;
    group.add(rightGlove);

    return group;
  }

  updateOpponentHitbox(): void {
    if (this.opponentModel?.isLoaded) {
      this.opponentModel.computeHitbox(this.opponentHitbox);
      return;
    }

    const worldPos = new THREE.Vector3();
    this.opponentGroup.getWorldPosition(worldPos);
    const size = new THREE.Vector3(0.7, 1.6, 0.5);
    this.opponentHitbox.setFromCenterAndSize(
      worldPos.clone().add(new THREE.Vector3(0, 1.5, 0)),
      size,
    );
  }

  getOpponentWorldPosition(): THREE.Vector3 {
    const p = new THREE.Vector3();
    this.opponentGroup.getWorldPosition(p);
    return p;
  }

  setOpponentPosition(x: number, z: number): void {
    this.opponentGroup.position.x = x;
    this.opponentGroup.position.z = z;
  }

  setOpponentGuardVisual(guarding: boolean): void {
    if (this.opponentModel?.isLoaded) {
      this.opponentModel.setGuardPose(guarding);
      return;
    }

    if (!this.placeholderGroup || !this.placeholderBody) return;

    const gloves = this.placeholderGroup.children.filter(
      (c) => c instanceof THREE.Mesh && c.userData.isGlove,
    ) as THREE.Mesh[];
    for (const g of gloves) {
      g.position.y = guarding ? 1.85 : 1.55;
      g.position.z = guarding ? 0.45 : 0.25;
    }
  }

  applyOpponentHitFlash(): void {
    if (this.opponentModel?.isLoaded) {
      this.opponentModel.applyHitFlash();
      return;
    }

    if (!this.placeholderBody) return;
    const mat = this.placeholderBody.material as THREE.MeshStandardMaterial;
    const orig = mat.emissive.getHex();
    mat.emissive.setHex(0x442222);
    setTimeout(() => mat.emissive.setHex(orig), 120);
  }
}
