/**
 * Canais de impacto no rosto (espaço UV do atlas Ch33_1001 / ilha do rosto).
 *
 * Layout vec4 / RGBA:
 *   R (x) = olho + sobrancelha + bochecha ESQUERDOS na tela (visão do jogador)
 *   G (y) = olho + sobrancelha + bochecha DIREITOS na tela
 *   B (z) = nariz / boca / centro
 *   A (w) = lavagem geral / testa / inchaço difuso
 *
 * Troca de rosto futura: albedo custom deve respeitar o mesmo layout UV da ilha
 * (ou fornecer mapas de injury no mesmo UV). O shader mistura por vMapUv.
 */

export type InjuryRegion = 'leftEye' | 'rightEye' | 'noseMouth' | 'cheeks';

/** Índice no vec4 u_injuryVectors. */
export const INJURY_CHANNEL: Record<InjuryRegion, 0 | 1 | 2 | 3> = {
  leftEye: 0,
  rightEye: 1,
  noseMouth: 2,
  cheeks: 3,
};

/** Dano acumulado para saturar um canal em 1.0 (menor = machucado aparece mais cedo). */
export const INJURY_FULL_THRESHOLD = 36;

/** Velocidade do lerp visual (maior = surge mais rápido). */
export const INJURY_LERP_SPEED = 4.2;

/** Intensidade do relevo (normal map). */
export const INJURY_NORMAL_STRENGTH = 0.85;

/**
 * Paths opcionais — se existirem em `public/`, substituem os procedurais.
 * Gere com os prompts em `OpponentFaceInjuryPrompts.ts`.
 */
export const INJURY_MAP_URLS = {
  /** Máscara RGBA por região (R/G/B/A). */
  mask: './textures/face-injury/injury-mask-rgba.png',
  albedo: './textures/face-injury/injury-albedo.png',
  normal: './textures/face-injury/injury-normal.png',
  roughness: './textures/face-injury/injury-roughness.png',
} as const;

export const INJURY_ATLAS_SIZE = 1024;
