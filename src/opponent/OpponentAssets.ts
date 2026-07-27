import { PunchType } from '../combat/PunchType';

/** Mesh + esqueleto base (Mixamo). Animações vêm de arquivos separados. */
export const OPPONENT_BASE_GLB = './models/Boxing.glb';

export type OpponentAnimKey =
  | 'jab'
  | 'cross'
  | 'hook'
  | 'uppercut'
  | 'guard'
  | 'idleTired'
  | 'walking'
  | 'hitHead'
  | 'hitBody'
  | 'victory'
  | 'death';

export const OPPONENT_ANIMATIONS: Record<OpponentAnimKey, string> = {
  jab: './models/anim-jab.glb',
  cross: './models/anim-cross.glb',
  hook: './models/anim-hook.glb',
  uppercut: './models/anim-uppercut.glb',
  guard: './models/anim-guard.glb',
  idleTired: './models/anim-idle-tired.glb',
  walking: './models/anim-walking.glb',
  hitHead: './models/anim-hit-head.glb',
  hitBody: './models/anim-hit-body.glb',
  victory: './models/anim-victory.glb',
  death: './models/anim-death.glb',
};

/** Clips necessários para liberar o menu (pose inicial). */
export const CRITICAL_ANIMS: readonly OpponentAnimKey[] = ['guard'];

/** Clips carregados em background após o oponente ficar visível. */
export const DEFERRED_ANIMS: readonly OpponentAnimKey[] = (
  Object.keys(OPPONENT_ANIMATIONS) as OpponentAnimKey[]
).filter((key) => !CRITICAL_ANIMS.includes(key));

export const PUNCH_TO_ANIM: Record<PunchType, OpponentAnimKey> = {
  [PunchType.Jab]: 'jab',
  [PunchType.Cross]: 'cross',
  [PunchType.Hook]: 'hook',
  [PunchType.Uppercut]: 'uppercut',
};

/** Clips em loop contínuo durante o estado. */
export const LOOPING_ANIMS = new Set<OpponentAnimKey>([
  'guard',
  'idleTired',
  'walking',
]);

/** Um golpe por execução. */
export const ONE_SHOT_ANIMS = new Set<OpponentAnimKey>([
  'jab',
  'cross',
  'hook',
  'uppercut',
  'hitHead',
  'hitBody',
  'victory',
  'death',
]);

/**
 * Fades por categoria (padrão de jogos de luta):
 * - Golpe entra rápido (snap) e sai suave de volta à guarda.
 * - Locomoção/postura cruzam devagar (sem "pulo" de pose).
 * - Reação de hit entra quase instantânea.
 */
export const ANIM_FADES = {
  punchIn: 0.07,
  punchOut: 0.24,
  stance: 0.3,
  reactionIn: 0.05,
  reactionOut: 0.22,
  finish: 0.35,
} as const;

/**
 * Começa a voltar para a postura N segundos antes do fim do clipe one-shot —
 * evita o congelamento no último frame (clampWhenFinished).
 */
export const ANIM_EXIT_BLEND_SEC = 0.18;

/** Compat: fade genérico usado onde não há categoria específica. */
export const ANIM_FADE_SEC = ANIM_FADES.stance;
