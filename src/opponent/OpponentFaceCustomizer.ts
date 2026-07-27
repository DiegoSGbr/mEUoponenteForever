import * as THREE from 'three';
import { FACE_BRUISE_REGIONS, FACE_PORTRAIT_UV_ELLIPSE } from './OpponentFaceConfig';
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
  /** Substitui o atlas inteiro (imagem já no layout UV do Ch33_1001). */
  | { kind: 'image'; imageUrl: string; mimeType?: string }
  /** Retrato comum (foto de rosto) — composto na ilha UV sobre o atlas original. */
  | { kind: 'portrait'; imageUrl: string };

/** Ajuste fino manual do encaixe do retrato (sliders no menu). */
export interface PortraitAdjust {
  /** Deslocamento horizontal em UV (±0.03 ≈ ±30 px no atlas 1024). */
  du: number;
  /** Deslocamento vertical em UV. */
  dv: number;
  /** Multiplicador de escala (1 = automático por distância dos olhos). */
  scale: number;
}

export const DEFAULT_PORTRAIT_ADJUST: PortraitAdjust = { du: 0, dv: 0, scale: 1 };

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
  private portraitAdjust: PortraitAdjust = { ...DEFAULT_PORTRAIT_ADJUST };

  get source(): OpponentFaceSource {
    return this.currentSource;
  }

  get hasCustomFace(): boolean {
    return this.currentSource.kind !== 'mixamo-default' && this.pendingTexture !== null;
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
      return;
    }

    if (source.kind === 'portrait') {
      await this.applyPortraitTexture(source.imageUrl);
    }
  }

  async reapplyAfterAnimationChange(animLabel?: string): Promise<void> {
    if (this.slots.length === 0) return;

    if (this.currentSource.kind !== 'mixamo-default' && this.pendingTexture) {
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

  /** Ajuste fino do encaixe do retrato — recompõe na hora se houver retrato ativo. */
  async setPortraitAdjust(adjust: Partial<PortraitAdjust>): Promise<void> {
    this.portraitAdjust = { ...this.portraitAdjust, ...adjust };
    if (this.currentSource.kind === 'portrait') {
      await this.applyPortraitTexture(this.currentSource.imageUrl);
    }
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

  /**
   * Compõe um retrato comum na ilha UV do rosto, por cima do atlas original.
   * Recorte elíptico com borda suavizada (feather) para fundir com a pele.
   */
  private async applyPortraitTexture(imageUrl: string): Promise<void> {
    if (this.slots.length === 0) {
      console.warn('[OpponentFaceCustomizer] Nenhum slot de rosto no mesh base.');
      return;
    }

    try {
      const portrait = await loadImageElement(imageUrl);
      const baseImage = this.slots[0]!.originalMap?.image as CanvasImageSource | undefined;
      if (!baseImage) {
        throw new Error('Atlas base indisponível para composição.');
      }

      const size = 1024;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      // 1. Atlas original por baixo (roupa/pele/orelhas continuam intactos).
      ctx.drawImage(baseImage, 0, 0, size, size);

      // 2. Retrato recortado em elipse com borda suave.
      const e = FACE_PORTRAIT_UV_ELLIPSE;
      const cx = e.u * size;
      const cy = e.v * size;
      const rx = e.rx * size;
      const ry = e.ry * size;

      const layer = document.createElement('canvas');
      layer.width = size;
      layer.height = size;
      const lctx = layer.getContext('2d')!;

      // Encaixe ancorado nos OLHOS: a linha dos olhos da foto é alinhada com a
      // linha dos olhos do modelo no atlas, e a escala é definida pela distância
      // interpupilar. Assim olhos/nariz/boca da foto caem nas UVs certas — e os
      // ferimentos (olho roxo, sangue) também acertam os traços da foto.
      // Âncoras típicas de retrato frontal (rosto ocupando ~60–70% da foto):
      const PHOTO_EYE_LINE_V = 0.38; // linha dos olhos a ~38% do topo
      const PHOTO_EYE_SPAN_U = 0.2; // distância entre pupilas ≈ 20% da largura
      const eyeL = FACE_BRUISE_REGIONS.left.eye;
      const eyeR = FACE_BRUISE_REGIONS.right.eye;
      const uvEyeMidX = ((eyeL.u + eyeR.u) / 2) * size;
      const uvEyeMidY = ((eyeL.v + eyeR.v) / 2) * size;
      const uvEyeSpan = (eyeR.u - eyeL.u) * size;

      const pw = portrait.naturalWidth;
      const ph = portrait.naturalHeight;
      const adj = this.portraitAdjust;
      const scale = (uvEyeSpan / (PHOTO_EYE_SPAN_U * pw)) * adj.scale;
      const dw = pw * scale;
      const dh = ph * scale;
      const drawX = uvEyeMidX + adj.du * size - dw / 2;
      const drawY = uvEyeMidY + adj.dv * size - PHOTO_EYE_LINE_V * dh;
      lctx.drawImage(portrait, drawX, drawY, dw, dh);

      // Máscara elíptica com borda suave (feather ~18% do raio) via destination-in.
      // Gradiente criado DENTRO do espaço transformado (unitário) — coordenadas
      // de gradiente são interpretadas no transform vigente na hora do fill.
      lctx.globalCompositeOperation = 'destination-in';
      lctx.save();
      lctx.translate(cx, cy);
      lctx.scale(rx, ry);
      const mask = lctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      mask.addColorStop(0, 'rgba(0,0,0,1)');
      mask.addColorStop(0.72, 'rgba(0,0,0,1)');
      mask.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = mask;
      lctx.beginPath();
      lctx.arc(0, 0, 1, 0, Math.PI * 2);
      lctx.fill();
      lctx.restore();
      lctx.globalCompositeOperation = 'source-over';

      // 3. Correção suave de tom de pele: aproxima a foto do tom do modelo
      //    para a borda oval não marcar (foto muito clara/escura destoa).
      const baseSkin = averageColor(ctx, [
        [FACE_BRUISE_REGIONS.left.cheek.u * size, FACE_BRUISE_REGIONS.left.cheek.v * size],
        [FACE_BRUISE_REGIONS.right.cheek.u * size, FACE_BRUISE_REGIONS.right.cheek.v * size],
      ]);
      // Testa da foto (acima da linha dos olhos) — região quase sempre de pele.
      const foreheadX = uvEyeMidX + adj.du * size;
      const foreheadY = uvEyeMidY + adj.dv * size;
      const photoSkin = averageColor(lctx, [
        [foreheadX, foreheadY - dh * 0.1],
        [foreheadX - dw * 0.06, foreheadY - dh * 0.09],
        [foreheadX + dw * 0.06, foreheadY - dh * 0.09],
      ]);
      if (baseSkin && photoSkin) {
        const strength = 0.75; // aproxima bem do tom do modelo (borda some)
        const factor = baseSkin.map((b, i) => {
          const ratio = THREE.MathUtils.clamp(b / Math.max(photoSkin[i]!, 1), 0.7, 1.4);
          return 1 + (ratio - 1) * strength;
        });
        const img = lctx.getImageData(0, 0, size, size);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] === 0) continue;
          d[i] = Math.min(255, d[i]! * factor[0]!);
          d[i + 1] = Math.min(255, d[i + 1]! * factor[1]!);
          d[i + 2] = Math.min(255, d[i + 2]! * factor[2]!);
        }
        lctx.putImageData(img, 0, 0);
      }

      ctx.drawImage(layer, 0, 0);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      texture.needsUpdate = true;

      this.disposePending();
      this.pendingTexture = texture;
      this.applyAlbedoToSlots(texture);
      // Ferimentos continuam funcionando: mesmo espaço UV da ilha do rosto.
      this.patchAllMaterials();
      console.info('[OpponentFaceCustomizer] Retrato composto no atlas do rosto.');
    } catch (error) {
      console.error('[OpponentFaceCustomizer] Falha ao compor retrato:', error);
      // Fallback: aplica a imagem crua como atlas (comportamento antigo).
      await this.applyImageTexture(imageUrl);
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

/** Média RGB de patches 8×8 nos pontos dados (ignora pixels transparentes). */
function averageColor(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<readonly [number, number]>,
): [number, number, number] | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const [px, py] of points) {
    const data = ctx.getImageData(Math.round(px) - 4, Math.round(py) - 4, 8, 8).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! < 200) continue;
      r += data[i]!;
      g += data[i + 1]!;
      b += data[i + 2]!;
      n++;
    }
  }
  return n > 0 ? [r / n, g / n, b / n] : null;
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${url}`));
    img.src = url;
  });
}
