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

export const ANIM_FADE_SEC = 0.12;
