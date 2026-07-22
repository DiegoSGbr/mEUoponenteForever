import * as THREE from 'three';
import {
  instantiateBoxingGlove,
  loadBoxingGloveTemplate,
} from '../scene/BoxingGloveAssets';
import { createBoxingGlove } from '../scene/BoxingGloveFactory';

/**
 * Luvas do oponente.
 * Preferência: GLB RenderCrate. Fallback: procedural.
 */

/** Colapsa mão/dedos skinned do Mixamo (só mesh da mão; a luva compensa). */
export const OPPONENT_HAND_MESH_COLLAPSE = 0.02;

/** Luva ≈ esta fração do comprimento mão→dedo médio (mundo). */
const GLOVE_TO_HAND_RATIO = 1.815; // ~1.65 × 1.10

export async function loadOpponentGloveTemplate(): Promise<THREE.Object3D | null> {
  return loadBoxingGloveTemplate();
}

/**
 * Distância mundo da mão até a ponta do dedo médio (antes do colapso).
 */
export function measureHandLengthWorld(handBone: THREE.Object3D): number {
  handBone.updateWorldMatrix(true, true);
  const origin = new THREE.Vector3();
  handBone.getWorldPosition(origin);

  let tipBone: THREE.Object3D | undefined;
  handBone.traverse((obj) => {
    if (tipBone) return;
    const n = obj.name.replace(/[:_\-\s]/g, '').toLowerCase();
    if (n.endsWith('handmiddle4') || n.endsWith('middle4')) {
      tipBone = obj;
    }
  });

  if (!tipBone) {
    return 0.1;
  }

  const tipPos = new THREE.Vector3();
  tipBone.updateWorldMatrix(true, false);
  tipBone.getWorldPosition(tipPos);
  const len = origin.distanceTo(tipPos);
  return len > 0.01 ? len : 0.1;
}

export function createOpponentGlove(opts: {
  mirrored: boolean;
  template: THREE.Object3D | null;
  /** Comprimento da mão em metros (mundo), medido antes do colapso. */
  handLengthWorld: number;
  /** Escala mundo do bone da mão DEPOIS do colapso. */
  handBoneWorldScale: number;
}): THREE.Object3D {
  const { mirrored, template, handLengthWorld, handBoneWorldScale } = opts;

  const targetWorldLen = THREE.MathUtils.clamp(
    handLengthWorld * GLOVE_TO_HAND_RATIO,
    0.12,
    0.22,
  );

  if (template) {
    const nativeMaxDim = (template.userData.nativeMaxDim as number) || 35;
    // localScale * handBoneWorldScale * nativeMaxDim = targetWorldLen
    const localScale =
      targetWorldLen / Math.max(handBoneWorldScale * nativeMaxDim, 1e-8);

    const glove = instantiateBoxingGlove(template, {
      // mirrored=true na mão esquerda → polegar do lado interno (correto na guarda).
      mirrored,
      scale: localScale,
      castShadow: true,
    });
    // Mixamo Hand: +Y = dedos. Luva local −Z → Rx(+90°) → +Y.
    // Rz(π) coloca o dorso para cima (não na palma).
    glove.rotation.set(Math.PI / 2, 0, Math.PI);
    glove.position.set(0, handLengthWorld * 0.35, 0);
    return glove;
  }

  const glove = createBoxingGlove({
    scale: targetWorldLen / 0.22 / Math.max(handBoneWorldScale, 1e-8),
    mirrored,
    castShadow: true,
  });
  glove.rotation.set(Math.PI / 2, 0, Math.PI);
  glove.position.set(0, 0.05, 0);
  return glove;
}
