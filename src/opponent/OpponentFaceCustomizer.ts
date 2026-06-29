import * as THREE from 'three';

/**
 * Troca de rosto no mesh base Mixamo (`Boxing.glb`).
 * Animações separadas (ex.: `anim-death.glb`) movem só o esqueleto — o rosto customizado acompanha.
 *
 * Requisitos da imagem (próxima fase / upload):
 * - Rosto frontal, centrado, boa iluminação
 * - PNG ou JPEG, mín. 256×256 (ideal 512×512), proporção ~1:1 ou 3:4
 */
export type OpponentFaceSource =
  | { kind: 'mixamo-default' }
  | { kind: 'image'; imageUrl: string; mimeType?: string };

export interface OpponentFaceSlot {
  mesh: THREE.SkinnedMesh;
  materialIndex: number;
  originalMap: THREE.Texture | null;
  slotName: string;
}

export class OpponentFaceCustomizer {
  private slots: OpponentFaceSlot[] = [];
  private pendingTexture: THREE.Texture | null = null;
  private currentSource: OpponentFaceSource = { kind: 'mixamo-default' };

  get source(): OpponentFaceSource {
    return this.currentSource;
  }

  get hasCustomFace(): boolean {
    return this.currentSource.kind === 'image' && this.pendingTexture !== null;
  }

  /** Vincula meshes de cabeça/rosto do modelo Mixamo (mesh base, não clips de animação). */
  bindFromModel(root: THREE.Object3D): void {
    this.disposePending();
    this.slots = [];

    root.traverse((obj) => {
      if (!(obj instanceof THREE.SkinnedMesh)) return;

      const name = obj.name.toLowerCase();
      const isHead =
        name.includes('head') ||
        name.includes('face') ||
        name.includes('ch33_1002');

      if (!isHead) return;

      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((mat, materialIndex) => {
        if (!(mat instanceof THREE.MeshStandardMaterial)) return;
        this.slots.push({
          mesh: obj,
          materialIndex,
          originalMap: mat.map,
          slotName: obj.name || 'head',
        });
      });
    });

    if (this.slots.length === 0) {
      this.bindFallbackHeadSlots(root);
    }
  }

  async applySource(source: OpponentFaceSource): Promise<void> {
    this.currentSource = source;

    if (source.kind === 'mixamo-default') {
      this.restoreOriginal();
      return;
    }

    if (source.kind === 'image') {
      await this.applyImageTexture(source);
    }
  }

  /**
   * Reaplica rosto após troca de animação (death, victory, hit…).
   * Evita perda de textura customizada em crossfade do AnimationMixer.
   */
  async reapplyAfterAnimationChange(animLabel?: string): Promise<void> {
    if (this.slots.length === 0) return;

    if (this.currentSource.kind === 'mixamo-default') {
      this.restoreOriginal();
      return;
    }

    if (this.pendingTexture) {
      this.applyTextureToSlots(this.pendingTexture);
      return;
    }

    if (this.currentSource.kind === 'image') {
      await this.applyImageTexture(this.currentSource);
      if (animLabel) {
        console.info(`[OpponentFaceCustomizer] Rosto reaplicado durante animação: ${animLabel}`);
      }
    }
  }

  private async applyImageTexture(source: OpponentFaceSource & { kind: 'image' }): Promise<void> {
    if (this.slots.length === 0) {
      console.warn('[OpponentFaceCustomizer] Nenhum slot de rosto no mesh base.');
      return;
    }

    try {
      const loader = new THREE.TextureLoader();
      const texture = await loader.loadAsync(source.imageUrl);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      this.applyTextureToSlots(texture);
    } catch (error) {
      console.error('[OpponentFaceCustomizer] Falha ao carregar imagem de rosto:', error);
    }
  }

  protected applyTextureToSlots(texture: THREE.Texture): void {
    this.disposePending();
    this.pendingTexture = texture;

    for (const slot of this.slots) {
      const mats = Array.isArray(slot.mesh.material)
        ? slot.mesh.material
        : [slot.mesh.material];
      const mat = mats[slot.materialIndex];
      if (mat instanceof THREE.MeshStandardMaterial) {
        mat.map = texture;
        mat.needsUpdate = true;
      }
    }
  }

  private restoreOriginal(): void {
    this.disposePending();
    for (const slot of this.slots) {
      const mats = Array.isArray(slot.mesh.material)
        ? slot.mesh.material
        : [slot.mesh.material];
      const mat = mats[slot.materialIndex];
      if (mat instanceof THREE.MeshStandardMaterial) {
        mat.map = slot.originalMap;
        mat.needsUpdate = true;
      }
    }
  }

  private bindFallbackHeadSlots(root: THREE.Object3D): void {
    root.traverse((obj) => {
      if (!(obj instanceof THREE.SkinnedMesh)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat, materialIndex) => {
        if (!(mat instanceof THREE.MeshStandardMaterial) || !mat.map) return;
        const mapName = mat.map.name?.toLowerCase() ?? '';
        if (!mapName.includes('1002') && !mapName.includes('head')) return;
        this.slots.push({
          mesh: obj,
          materialIndex,
          originalMap: mat.map,
          slotName: `fallback-${obj.name}`,
        });
      });
    });
  }

  dispose(): void {
    this.disposePending();
    this.slots = [];
    this.currentSource = { kind: 'mixamo-default' };
  }

  private disposePending(): void {
    this.pendingTexture?.dispose();
    this.pendingTexture = null;
  }
}
