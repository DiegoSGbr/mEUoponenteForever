import type { OpponentAnimKey } from './OpponentAssets';

/**
 * Todas as animações GLB (incl. death) usam o mesmo esqueleto do mesh base (`Boxing.glb`).
 * A textura de rosto customizada fica no material da cabeça do mesh base — não nos FBX/GLB de animação.
 */
export const OPPONENT_FACE_ANIM_COMPATIBLE: readonly OpponentAnimKey[] = [
  'jab',
  'cross',
  'hook',
  'uppercut',
  'guard',
  'idleTired',
  'walking',
  'hitHead',
  'hitBody',
  'victory',
  'death',
] as const;

export const OPPONENT_FACE_ANIM_SET = new Set<OpponentAnimKey>(OPPONENT_FACE_ANIM_COMPATIBLE);

/** Estados em que o rosto customizado deve ser reaplicado após troca de clip. */
export const OPPONENT_FACE_REAPPLY_ON_ANIM: readonly OpponentAnimKey[] = [
  'death',
  'victory',
  'hitHead',
] as const;
