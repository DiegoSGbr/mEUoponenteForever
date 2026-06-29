import * as THREE from 'three';

export const RING_HALF = 3;

/** Margem extra para o modelo 3D (braços estendidos na guarda de boxe). */
export const OPPONENT_RING_MARGIN = 0.9;

/** Spawn dentro do ringue, lado -Z, ~2 m do jogador. */
export const OPPONENT_SPAWN_Z = -(RING_HALF - OPPONENT_RING_MARGIN - 0.25);

export function clampOpponentToRing(pos: THREE.Vector3): void {
  const limitX = RING_HALF - OPPONENT_RING_MARGIN;
  const minZ = -(RING_HALF - OPPONENT_RING_MARGIN);
  const maxZ = -0.85;

  pos.x = THREE.MathUtils.clamp(pos.x, -limitX, limitX);
  pos.z = THREE.MathUtils.clamp(pos.z, minZ, maxZ);
}
