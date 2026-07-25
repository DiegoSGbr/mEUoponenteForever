import * as THREE from 'three';
import { INJURY_MAP_URLS } from './OpponentFaceInjuryConfig';
import { loadFaceInjuryMaps, type FaceInjuryMaps } from './OpponentFaceInjuryMaps';
import { initFaceInjuryTextures, patchFaceInjuryMaterial } from './OpponentFaceInjuryShader';
import { OpponentFaceInjuryState } from './OpponentFaceInjuryState';
import type { InjuryRegion } from './OpponentFaceInjuryConfig';

/**
 * Troca de rosto + ferimentos PBR dinâmicos no mesh Mixamo (`Ch33_Body` / atlas 1001).
 *
 * Ferimentos: máscara RGBA + albedo/normal/roughness misturados na GPU
 * (`onBeforeCompile`), com intensidades suavizadas (lerp) em `OpponentFaceInjuryState`.
 *
 * Troca de rosto futura: `applySource({ kind:'image', imageUrl })` substitui o albedo
 * base; os mapas de injury continuam no mesmo espaço UV da ilha do rosto.
 *
 * Assets opcionais (substituem procedurais): ver `INJURY_MAP_URLS` /
 * prompts em `OpponentFaceInjuryPrompts.ts`.
 */
export type OpponentFaceSource =
  | { kind: 'mixamo-default' }
  | { kind: 'image'; imageUrl: string; mimeType?: string };

export interface OpponentFaceSlot {
  mesh: THREE.SkinnedMesh;
  materialIndex: number;
  originalMap: THREE.Texture | null;
  slotName: string;
  material: THREE.MeshStandardMaterial;
}

export class OpponentFaceCustomizer {
  private slots: OpponentFaceSlot[] = [];
  private pendingTexture: THREE.Texture | null = null;
  private currentSource: OpponentFaceSource = { kind: 'mixamo-default' };

  readonly injury = new OpponentFaceInjuryState();
  private injuryMaps: FaceInjuryMaps | null = null;
  private mapsPromise: Promise<void> | null = null;

  get source(): OpponentFaceSource {
    return this.currentSource;
  }

  get hasCustomFace(): boolean {
    return this.currentSource.kind === 'image' && this.pendingTexture !== null;
  }

  /** Paths esperados para arte final (documentação / hot-reload). */
  get injuryMapUrls(): typeof INJURY_MAP_URLS {
    return INJURY_MAP_URLS;
  }

  /** Vincula Ch33_Body e clona o material (atlas compartilhado com roupa). */
  bindFromModel(root: THREE.Object3D): void {
    this.disposePending();
    this.slots = [];

    root.traverse((obj) => {
      if (!(obj instanceof THREE.SkinnedMesh)) return;
      if (obj.name.toLowerCase() !== 'ch33_body') return;

      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      const nextMats = materials.map((mat, materialIndex) => {
        if (!(mat instanceof THREE.MeshStandardMaterial) || !mat.map) return mat;

        const cloned = mat.clone();
        cloned.map = mat.map;
        cloned.needsUpdate = true;

        this.slots.push({
          mesh: obj,
          materialIndex,
          originalMap: mat.map,
          slotName: obj.name || 'body-face',
          material: cloned,
        });
        return cloned;
      });

      obj.material = nextMats.length === 1 ? nextMats[0]! : nextMats;
    });

    if (this.slots.length === 0) {
      this.bindFallbackSkinSlots(root);
    }

    void this.ensureInjuryMaps();

    console.info(
      `[OpponentFaceCustomizer] Slots de rosto: ${this.slots.map((s) => s.slotName).join(', ') || '(nenhum)'}`,
    );
  }

  /** Prepara texturas de injury (await antes do compile do renderer). */
  async prepareBase(renderer: THREE.WebGLRenderer): Promise<void> {
    await this.ensureInjuryMaps();
    if (!this.injuryMaps) return;
    initFaceInjuryTextures(renderer, this.injuryMaps);
    this.patchAllMaterials();
  }

  async applySource(source: OpponentFaceSource): Promise<void> {
    this.currentSource = source;

    if (source.kind === 'mixamo-default') {
      this.restoreOriginalMapsOnly();
      return;
    }

    if (source.kind === 'image') {
      await this.applyImageTexture(source.imageUrl);
    }
  }

  async reapplyAfterAnimationChange(animLabel?: string): Promise<void> {
    if (this.slots.length === 0) return;

    if (this.currentSource.kind === 'image' && this.pendingTexture) {
      this.applyAlbedoToSlots(this.pendingTexture);
    } else {
      this.restoreOriginalMapsOnly();
    }

    // Reafirma uniforms após possível recompile
    this.patchAllMaterials();

    if (animLabel) {
      console.info(`[OpponentFaceCustomizer] Rosto reaplicado: ${animLabel}`);
    }
  }

  /**
   * API principal de combate — região + dano.
   * A suavização visual acontece em `update(dt)`.
   */
  registrarSoco(region: InjuryRegion, damage: number): void {
    this.injury.registrarSoco(region, damage);
  }

  /** Lerp GPU uniforms — chamar no loop do jogo. */
  update(dt: number): void {
    this.injury.update(dt);
    // Vector4 é compartilhado por referência com o uniform — não precisa reassign.
  }

  resetInjury(): void {
    this.injury.reset();
  }

  private async ensureInjuryMaps(): Promise<void> {
    if (this.injuryMaps) return;
    if (this.mapsPromise) return this.mapsPromise;

    this.mapsPromise = loadFaceInjuryMaps()
      .then((maps) => {
        this.injuryMaps = maps;
        this.patchAllMaterials();
      })
      .catch((error) => {
        console.error('[OpponentFaceCustomizer] Falha ao carregar mapas de injury:', error);
        this.mapsPromise = null;
      });

    return this.mapsPromise;
  }

  private patchAllMaterials(): void {
    if (!this.injuryMaps) return;
    for (const slot of this.slots) {
      patchFaceInjuryMaterial(slot.material, this.injuryMaps, this.injury.current);
    }
  }

  private async applyImageTexture(imageUrl: string): Promise<void> {
    if (this.slots.length === 0) {
      console.warn('[OpponentFaceCustomizer] Nenhum slot de rosto no mesh base.');
      return;
    }

    try {
      const loader = new THREE.TextureLoader();
      const texture = await loader.loadAsync(imageUrl);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      this.disposePending();
      this.pendingTexture = texture;
      this.applyAlbedoToSlots(texture);
      // Injury maps permanecem — mesmo UV da ilha do rosto.
      this.patchAllMaterials();
    } catch (error) {
      console.error('[OpponentFaceCustomizer] Falha ao carregar imagem de rosto:', error);
    }
  }

  private applyAlbedoToSlots(texture: THREE.Texture): void {
    for (const slot of this.slots) {
      slot.material.map = texture;
      slot.material.needsUpdate = true;
    }
  }

  private restoreOriginalMapsOnly(): void {
    for (const slot of this.slots) {
      slot.material.map = slot.originalMap;
      slot.material.needsUpdate = true;
    }
  }

  private bindFallbackSkinSlots(root: THREE.Object3D): void {
    root.traverse((obj) => {
      if (!(obj instanceof THREE.SkinnedMesh)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      const next = mats.map((mat, materialIndex) => {
        if (!(mat instanceof THREE.MeshStandardMaterial) || !mat.map) return mat;
        const mapName = mat.map.name?.toLowerCase() ?? '';
        if (!mapName.includes('1001') && !mapName.includes('body')) return mat;
        const cloned = mat.clone();
        cloned.map = mat.map;
        this.slots.push({
          mesh: obj,
          materialIndex,
          originalMap: mat.map,
          slotName: `fallback-${obj.name}`,
          material: cloned,
        });
        return cloned;
      });
      if (next.some((m, i) => m !== mats[i])) {
        obj.material = next.length === 1 ? next[0]! : next;
      }
    });
  }

  dispose(): void {
    this.disposePending();
    this.injuryMaps?.dispose();
    this.injuryMaps = null;
    this.mapsPromise = null;
    this.injury.reset();
    this.slots = [];
    this.currentSource = { kind: 'mixamo-default' };
  }

  private disposePending(): void {
    this.pendingTexture?.dispose();
    this.pendingTexture = null;
  }
}
