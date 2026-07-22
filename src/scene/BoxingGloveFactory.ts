import * as THREE from 'three';

/** Vermelho estilo Mixamo (referência LANCERS / boxeador). */
export const BOXING_GLOVE_COLOR = 0xc41e1e;
export const BOXING_GLOVE_EMISSIVE = 0x100000;
export const BOXING_GLOVE_WHITE = 0xefefef;

export interface BoxingGloveOptions {
  scale?: number;
  mirrored?: boolean;
  castShadow?: boolean;
}

/**
 * Luva estilo Mixamo: mitten achatado (largo na face, fino na espessura),
 * face de impacto lisa, polegar colado, palma/vivo brancos.
 * Origem = pulso; impacto em −Z.
 */
export function createBoxingGlove(options: BoxingGloveOptions = {}): THREE.Group {
  const scale = options.scale ?? 1;
  const mirrored = options.mirrored ?? false;
  const castShadow = options.castShadow ?? true;
  const side = mirrored ? -1 : 1;

  const group = new THREE.Group();
  group.name = mirrored ? 'BoxingGloveLeft' : 'BoxingGloveRight';
  group.userData.isGlove = true;

  const leather = new THREE.MeshStandardMaterial({
    color: BOXING_GLOVE_COLOR,
    roughness: 0.42,
    metalness: 0.06,
    emissive: BOXING_GLOVE_EMISSIVE,
  });
  const impactLeather = new THREE.MeshStandardMaterial({
    color: BOXING_GLOVE_COLOR,
    roughness: 0.3,
    metalness: 0.08,
    emissive: BOXING_GLOVE_EMISSIVE,
  });
  const whiteMat = new THREE.MeshStandardMaterial({
    color: BOXING_GLOVE_WHITE,
    roughness: 0.6,
    metalness: 0.02,
  });

  const add = (mesh: THREE.Mesh) => {
    mesh.castShadow = castShadow;
    mesh.receiveShadow = castShadow;
    group.add(mesh);
  };

  // —— Corpo do mitten (achatado: largo em X, fino em Y, alongado em Z) ——
  // Capsule no eixo Y → Rx(90°) alinha o comprimento com −Z.
  const mitt = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.05, 8, 18), impactLeather);
  mitt.rotation.x = Math.PI / 2;
  mitt.scale.set(1.55, 1.0, 0.92); // largura dos knúckles × comprimento × espessura
  mitt.position.set(0, 0.0, -0.075);
  add(mitt);

  // —— Face de impacto: cúpula lisa (sem costura / sem segundo “degrau”) ——
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.052, 24, 18), impactLeather);
  face.scale.set(1.55, 1.05, 0.72);
  face.position.set(0, 0.0, -0.138);
  add(face);

  // —— Polegar embutido (lóbulo lateral, como Mixamo) ——
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.032, 6, 12), leather);
  thumb.rotation.set(0.35, side * 0.15, side * (Math.PI / 2 + 0.25));
  thumb.position.set(side * 0.062, -0.006, -0.07);
  add(thumb);

  // —— Palma branca (painel interno da referência) ——
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.038, 14, 12), whiteMat);
  palm.scale.set(0.85, 0.32, 1.25);
  palm.position.set(0, -0.032, -0.075);
  add(palm);

  // —— Punho afilado + vivo branco na borda ——
  const cuff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.042, 0.07, 16),
    leather,
  );
  cuff.rotation.x = Math.PI / 2;
  cuff.position.set(0, 0, 0.03);
  add(cuff);

  const cuffBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.041, 0.041, 0.014, 16),
    whiteMat,
  );
  cuffBand.rotation.x = Math.PI / 2;
  cuffBand.position.set(0, 0, 0.062);
  add(cuffBand);

  group.scale.setScalar(scale);
  return group;
}
