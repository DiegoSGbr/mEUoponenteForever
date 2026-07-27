import type { OpponentAnimKey } from './OpponentAssets';

/**
 * Todas as animações GLB usam o mesmo esqueleto do mesh base (`Boxing.glb`).
 * A textura de rosto fica no albedo da pele (`Ch33_Body` / `Ch33_1001_*`).
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

/** Estados em que o rosto (base+machucados) deve ser reaplicado após troca de clip. */
export const OPPONENT_FACE_REAPPLY_ON_ANIM: readonly OpponentAnimKey[] = [
  'death',
  'victory',
  'hitHead',
] as const;

/** Lado do rosto na visão do jogador (oponente de frente). */
export type FaceSide = 'left' | 'right';

/** Elipse normalizada na textura (u,v ∈ [0,1], raios em fração da textura). */
export interface FaceUvBlob {
  u: number;
  v: number;
  rx: number;
  ry: number;
}

/**
 * Regiões UV no atlas `Ch33_1001` — órbitas confirmadas no Diffuse (markers nos olhos):
 * - Olho tela-ESQUERDA ≈ (0.711, 0.127)
 * - Olho tela-DIREITA  ≈ (0.783, 0.132)
 * - Nariz / filete logo abaixo (NÃO no pescoço; pescoço começa ~V 0.28)
 *
 * glTF / flipY=false: v=0 no TOPO da imagem.
 */
export const FACE_BRUISE_REGIONS: Record<
  FaceSide,
  {
    eye: FaceUvBlob;
    brow: FaceUvBlob;
    cheek: FaceUvBlob;
    mouth: FaceUvBlob;
  }
> = {
  left: {
    eye: { u: 0.711, v: 0.127, rx: 0.048, ry: 0.032 },
    brow: { u: 0.71, v: 0.105, rx: 0.05, ry: 0.01 },
    cheek: { u: 0.69, v: 0.175, rx: 0.05, ry: 0.035 },
    mouth: { u: 0.72, v: 0.215, rx: 0.028, ry: 0.014 },
  },
  right: {
    eye: { u: 0.783, v: 0.132, rx: 0.048, ry: 0.032 },
    brow: { u: 0.785, v: 0.108, rx: 0.05, ry: 0.01 },
    cheek: { u: 0.81, v: 0.175, rx: 0.05, ry: 0.035 },
    mouth: { u: 0.78, v: 0.215, rx: 0.028, ry: 0.014 },
  },
};

/** Base do nariz / sangue (philtrum). */
export const FACE_NOSE_BLOOD: FaceUvBlob = {
  u: 0.747,
  v: 0.175,
  rx: 0.02,
  ry: 0.022,
};

/** Filete de sangue estático — só até o lábio, longe do pescoço. */
export const FACE_NOSE_DRIP: FaceUvBlob = {
  u: 0.747,
  v: 0.205,
  rx: 0.01,
  ry: 0.025,
};

/**
 * Portão UV do rosto (corta pescoço ~V≥0.27 e cabelo nas bordas).
 */
export const FACE_SKIN_UV_GATE: FaceUvBlob = {
  u: 0.75,
  v: 0.16,
  rx: 0.2,
  ry: 0.1,
};

/**
 * Elipse onde o retrato enviado pelo usuário é composto no atlas
 * (testa→queixo / têmpora→têmpora, sem invadir cabelo/pescoço).
 */
export const FACE_PORTRAIT_UV_ELLIPSE: FaceUvBlob = {
  u: 0.747,
  v: 0.158,
  // Estreita: fora disso ficam têmporas/costeletas do modelo — se a oval
  // for larga demais, o FUNDO da foto vaza nas laterais do rosto.
  rx: 0.07,
  ry: 0.098,
};

/** Dano acumulado para chegar a severity 1.0 num lado. */
export const FACE_DAMAGE_FULL_THRESHOLD = 48;
