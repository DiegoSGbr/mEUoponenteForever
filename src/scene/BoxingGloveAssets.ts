import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { BOXING_GLOVE_COLOR, BOXING_GLOVE_EMISSIVE } from './BoxingGloveFactory';

/** Luva RenderCrate otimizada (meshopt + WebP 512). */
export const BOXING_GLOVE_GLB = './models/boxing-glove.glb';

/** Comprimento alvo padrão (metros) quando não há medição de mão. */
export const DEFAULT_GLOVE_LENGTH = 0.18;

let templatePromise: Promise<THREE.Object3D | null> | null = null;

/**
 * Carrega o template uma vez. Guarda `userData.nativeMaxDim` (unidades do arquivo).
 * NÃO altera a geometria — a escala é aplicada só na instância.
 */
export function loadBoxingGloveTemplate(): Promise<THREE.Object3D | null> {
  if (!templatePromise) {
    templatePromise = loadAndPrepare().catch((error) => {
      console.warn('[BoxingGloveAssets] Falha ao carregar luva GLB:', error);
      templatePromise = Promise.resolve(null);
      return null;
    });
  }
  return templatePromise;
}

async function loadAndPrepare(): Promise<THREE.Object3D | null> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(BOXING_GLOVE_GLB);
  const root = gltf.scene;

  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const nativeMaxDim = Math.max(size.x, size.y, size.z);
  root.userData.nativeMaxDim = nativeMaxDim;

  // Centraliza o grafo na origem (só position do root), sem mexer na geometria.
  const center = box.getCenter(new THREE.Vector3());
  root.position.sub(center);

  tintGloveRed(root);

  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  console.info(
    '[BoxingGloveAssets] Template pronto:',
    BOXING_GLOVE_GLB,
    `nativeMaxDim=${nativeMaxDim.toFixed(2)}`,
  );
  return root;
}

/** Vermelho clássico: remove albedo colorido; mantém normal/AO. */
export function tintGloveRed(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
      if (mat.map) {
        mat.map.dispose();
        mat.map = null;
      }
      mat.color.setHex(BOXING_GLOVE_COLOR);
      mat.emissive.setHex(BOXING_GLOVE_EMISSIVE);
      mat.emissiveIntensity = 0.12;
      mat.roughness = 0.38;
      mat.metalness = 0.08;
      mat.needsUpdate = true;
    }
  });
}

export interface GloveInstanceOptions {
  mirrored?: boolean;
  /**
   * Comprimento desejado no espaço do **pai** da luva (antes do world).
   * Se omitido, usa DEFAULT_GLOVE_LENGTH assumindo pai com scale ≈ 1.
   */
  targetLength?: number;
  /**
   * Escala uniforme explícita sobre o mesh nativo (alternativa a targetLength).
   * Se ambos forem passados, `scale` tem prioridade.
   */
  scale?: number;
  castShadow?: boolean;
}

/**
 * Instância com tamanho controlado.
 * Convenção: ponta da luva em −Z (frente do soco).
 */
export function instantiateBoxingGlove(
  template: THREE.Object3D,
  options: GloveInstanceOptions = {},
): THREE.Group {
  const mirrored = options.mirrored ?? false;
  const castShadow = options.castShadow ?? true;
  const nativeMaxDim = (template.userData.nativeMaxDim as number) || 1;

  let uniform: number;
  if (options.scale != null) {
    uniform = options.scale;
  } else {
    const target = options.targetLength ?? DEFAULT_GLOVE_LENGTH;
    uniform = target / nativeMaxDim;
  }

  const wrap = new THREE.Group();
  wrap.name = mirrored ? 'BoxingGloveLeft' : 'BoxingGloveRight';
  wrap.userData.isGlove = true;

  const clone = template.clone(true);
  // Eixo longo ≈ Z no asset. Inverte para ponta em −Z.
  clone.rotation.y = Math.PI;
  // Espelho no X para o outro lado (polegar).
  clone.scale.set(mirrored ? -uniform : uniform, uniform, uniform);

  clone.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.castShadow = castShadow;
    obj.receiveShadow = castShadow;
    obj.frustumCulled = false;
    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map((m) => m.clone());
    } else if (obj.material) {
      obj.material = obj.material.clone();
    }
  });
  tintGloveRed(clone);

  wrap.add(clone);
  return wrap;
}
