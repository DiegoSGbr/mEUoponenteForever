import * as THREE from 'three';
import {
  FACE_BRUISE_REGIONS,
  FACE_NOSE_BLOOD,
  FACE_NOSE_DRIP,
  FACE_SKIN_UV_GATE,
} from './OpponentFaceConfig';
import { INJURY_ATLAS_SIZE, INJURY_MAP_URLS } from './OpponentFaceInjuryConfig';

export interface FaceInjuryMaps {
  /** RGBA = pesos por região (R leftEye, G rightEye, B noseMouth, A cheeks). */
  mask: THREE.Texture;
  albedo: THREE.Texture;
  normal: THREE.Texture;
  roughness: THREE.Texture;
  dispose: () => void;
}

type Blob = { u: number; v: number; rx: number; ry: number };

function uvToCanvas(blob: Blob, size: number): { x: number; y: number; rx: number; ry: number } {
  // glTF / flipY=false: v=0 no topo do canvas
  return {
    x: blob.u * size,
    y: blob.v * size,
    rx: blob.rx * size,
    ry: blob.ry * size,
  };
}

function paintSoftEllipse(
  ctx: CanvasRenderingContext2D,
  blob: Blob,
  size: number,
  color: string,
  expand = 1.1,
): void {
  const { x, y, rx, ry } = uvToCanvas(blob, size);
  const rad = Math.max(rx, ry) * expand;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, rad);
  grad.addColorStop(0, color);
  grad.addColorStop(0.5, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(x, y, rx * expand, ry * expand, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Zera pixels fora do portão da pele do rosto (protege couro cabeludo na mesma ilha UV). */
function clipToFaceSkinGate(ctx: CanvasRenderingContext2D, size: number): void {
  const img = ctx.getImageData(0, 0, size, size);
  const data = img.data;
  const gate = FACE_SKIN_UV_GATE;
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const nu = (u - gate.u) / gate.rx;
      const nv = (v - gate.v) / gate.ry;
      const d = nu * nu + nv * nv;
      const i = (y * size + x) * 4;
      if (d > 1) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      } else if (d > 0.8) {
        const fade = 1 - (d - 0.8) / 0.2;
        data[i] = Math.floor(data[i] * fade);
        data[i + 1] = Math.floor(data[i + 1] * fade);
        data[i + 2] = Math.floor(data[i + 2] * fade);
        data[i + 3] = Math.floor(data[i + 3] * fade);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Máscara RGBA procedural — só features do rosto (sem lavagem no scalp). */
export function createProceduralInjuryMask(size = INJURY_ATLAS_SIZE): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  // Canal R — esquerda da tela
  ctx.globalCompositeOperation = 'lighter';
  paintSoftEllipse(ctx, FACE_BRUISE_REGIONS.left.eye, size, 'rgba(255,0,0,1)');
  paintSoftEllipse(ctx, FACE_BRUISE_REGIONS.left.brow, size, 'rgba(255,0,0,0.85)');
  paintSoftEllipse(ctx, FACE_BRUISE_REGIONS.left.cheek, size, 'rgba(255,0,0,0.65)');

  // Canal G — direita da tela
  paintSoftEllipse(ctx, FACE_BRUISE_REGIONS.right.eye, size, 'rgba(0,255,0,1)');
  paintSoftEllipse(ctx, FACE_BRUISE_REGIONS.right.brow, size, 'rgba(0,255,0,0.85)');
  paintSoftEllipse(ctx, FACE_BRUISE_REGIONS.right.cheek, size, 'rgba(0,255,0,0.65)');

  // Canal B — nariz / filete / boca
  paintSoftEllipse(ctx, FACE_NOSE_BLOOD, size, 'rgba(0,0,255,1)');
  paintSoftEllipse(ctx, FACE_NOSE_DRIP, size, 'rgba(0,0,255,0.95)', 1.25);
  paintSoftEllipse(ctx, FACE_BRUISE_REGIONS.left.mouth, size, 'rgba(0,0,255,0.55)');
  paintSoftEllipse(ctx, FACE_BRUISE_REGIONS.right.mouth, size, 'rgba(0,0,255,0.55)');

  // Canal A = bochechas (peso). premultiplyAlpha=false preserva R/G/B mesmo com A baixo.
  const tmp = document.createElement('canvas');
  tmp.width = size;
  tmp.height = size;
  const tctx = tmp.getContext('2d')!;
  paintSoftEllipse(tctx, FACE_BRUISE_REGIONS.left.cheek, size, 'rgba(255,255,255,0.9)');
  paintSoftEllipse(tctx, FACE_BRUISE_REGIONS.right.cheek, size, 'rgba(255,255,255,0.9)');
  const cheek = tctx.getImageData(0, 0, size, size).data;

  const merged = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < merged.data.length; i += 4) {
    merged.data[i + 3] = cheek[i];
  }
  ctx.putImageData(merged, 0, 0);

  clipToFaceSkinGate(ctx, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.flipY = false;
  tex.premultiplyAlpha = false;
  tex.needsUpdate = true;
  return tex;
}

/** Pinta olho roxo em camadas (órbita escura + inchaço) — bem legível no ringue. */
function paintBlackEye(ctx: CanvasRenderingContext2D, side: 'left' | 'right', size: number): void {
  const eye = FACE_BRUISE_REGIONS[side].eye;
  const brow = FACE_BRUISE_REGIONS[side].brow;
  paintSoftEllipse(ctx, { ...eye, rx: eye.rx * 1.35, ry: eye.ry * 1.4 }, size, 'rgba(55,18,90,1)', 1.25);
  paintSoftEllipse(ctx, eye, size, 'rgba(30,8,55,1)', 1.0);
  paintSoftEllipse(
    ctx,
    { u: eye.u, v: eye.v + 0.015, rx: eye.rx * 1.2, ry: eye.ry * 0.75 },
    size,
    'rgba(140,45,55,0.85)',
    1.15,
  );
  paintSoftEllipse(ctx, brow, size, 'rgba(100,12,18,1)', 1.1);
}

/** Filete de sangue estático abaixo do nariz (sem animação). V maior = em direção à boca. */
function paintNoseBleed(ctx: CanvasRenderingContext2D, size: number): void {
  paintSoftEllipse(ctx, FACE_NOSE_BLOOD, size, 'rgba(120,10,14,1)', 1.15);
  const drip = FACE_NOSE_DRIP;
  const { x, y, rx, ry } = uvToCanvas(drip, size);
  // Do nariz (V menor / y menor) para a boca (V maior / y maior)
  const grad = ctx.createLinearGradient(x, y - ry, x, y + ry);
  grad.addColorStop(0, 'rgba(150,12,16,0.98)');
  grad.addColorStop(0.45, 'rgba(110,6,10,0.95)');
  grad.addColorStop(1, 'rgba(60,0,0,0.2)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(x, y, rx * 0.75, ry * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  paintSoftEllipse(
    ctx,
    { u: drip.u, v: drip.v + drip.ry * 0.7, rx: 0.007, ry: 0.01 },
    size,
    'rgba(95,0,0,0.9)',
    1,
  );
}

/** Albedo de hematoma/sangue (sRGB). */
export function createProceduralInjuryAlbedo(size = INJURY_ATLAS_SIZE): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const paint = (blob: Blob, rgb: string, a: number) => {
    paintSoftEllipse(ctx, blob, size, rgb.replace(')', `,${a})`).replace('rgb', 'rgba'));
  };

  // Olhos roxos por lado (ativados via máscara R/G no shader)
  paintBlackEye(ctx, 'left', size);
  paintBlackEye(ctx, 'right', size);

  // Bochechas
  paint(FACE_BRUISE_REGIONS.left.cheek, 'rgb(170,40,45)', 0.95);
  paint(FACE_BRUISE_REGIONS.right.cheek, 'rgb(165,38,42)', 0.95);

  // Nariz sangrando (estático) + canto da boca
  paintNoseBleed(ctx, size);
  paint(FACE_BRUISE_REGIONS.left.mouth, 'rgb(140,25,30)', 0.85);
  paint(FACE_BRUISE_REGIONS.right.mouth, 'rgb(140,25,30)', 0.85);

  clipToFaceSkinGate(ctx, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.premultiplyAlpha = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Normal map procedural (tangent-style): inchaço convexo nos blobs.
 * Azul-claro flat (128,128,255) + variação XY.
 */
export function createProceduralInjuryNormal(size = INJURY_ATLAS_SIZE): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  // Base flat
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128;
    data[i + 1] = 128;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }

  const bumps: Blob[] = [
    FACE_BRUISE_REGIONS.left.eye,
    FACE_BRUISE_REGIONS.right.eye,
    { ...FACE_BRUISE_REGIONS.left.eye, rx: FACE_BRUISE_REGIONS.left.eye.rx * 1.2 },
    { ...FACE_BRUISE_REGIONS.right.eye, rx: FACE_BRUISE_REGIONS.right.eye.rx * 1.2 },
    FACE_BRUISE_REGIONS.left.cheek,
    FACE_BRUISE_REGIONS.right.cheek,
    FACE_NOSE_BLOOD,
    FACE_NOSE_DRIP,
    FACE_BRUISE_REGIONS.left.brow,
    FACE_BRUISE_REGIONS.right.brow,
  ];

  for (const blob of bumps) {
    const { x: cx, y: cy, rx, ry } = uvToCanvas(blob, size);
    const rMax = Math.max(rx, ry) * 1.4;
    const x0 = Math.max(0, Math.floor(cx - rMax));
    const x1 = Math.min(size - 1, Math.ceil(cx + rMax));
    const y0 = Math.max(0, Math.floor(cy - rMax));
    const y1 = Math.min(size - 1, Math.ceil(cy + rMax));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const nx = (x - cx) / (rx * 1.2);
        const ny = (y - cy) / (ry * 1.2);
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        const h = Math.cos(Math.sqrt(d) * Math.PI * 0.5);
        const strength = 0.55 * h;
        const i = (y * size + x) * 4;
        data[i] = Math.min(255, Math.max(0, data[i] + nx * strength * 120));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + ny * strength * 120));
        data[i + 2] = Math.min(255, Math.max(180, data[i + 2] - h * 30));
      }
    }
  }

  ctx.putImageData(img, 0, 0);
  // Fora do portão: normal flat (não zerar — quebraria o lighting)
  {
    const out = ctx.getImageData(0, 0, size, size);
    const d = out.data;
    const gate = FACE_SKIN_UV_GATE;
    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const nu = (u - gate.u) / gate.rx;
        const nv = (v - gate.v) / gate.ry;
        if (nu * nu + nv * nv > 1) {
          const i = (y * size + x) * 4;
          d[i] = 128;
          d[i + 1] = 128;
          d[i + 2] = 255;
          d[i + 3] = 255;
        }
      }
    }
    ctx.putImageData(out, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Roughness map: escuro = áspero (pele seca/hematoma),
 * claro = liso/molhado (sangue) — misturamos no shader para forçar roughness↓.
 */
export function createProceduralInjuryRoughness(size = INJURY_ATLAS_SIZE): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  // Neutro transparente-equivalente: mid gray só onde há ferimento (após clip)
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#808080';
  // base só dentro do gate (clip zera fora)
  paintSoftEllipse(ctx, FACE_SKIN_UV_GATE, size, 'rgba(128,128,128,1)', 1);

  // Sangue molhado (claro → roughness baixo no mix)
  const wet = [
    FACE_NOSE_BLOOD,
    FACE_NOSE_DRIP,
    FACE_BRUISE_REGIONS.left.brow,
    FACE_BRUISE_REGIONS.right.brow,
    FACE_BRUISE_REGIONS.left.mouth,
    FACE_BRUISE_REGIONS.right.mouth,
  ];
  for (const blob of wet) {
    paintSoftEllipse(ctx, blob, size, 'rgba(245,245,245,0.95)');
  }
  // Hematoma seco (médio-escuro)
  paintSoftEllipse(ctx, FACE_BRUISE_REGIONS.left.cheek, size, 'rgba(70,70,70,0.7)');
  paintSoftEllipse(ctx, FACE_BRUISE_REGIONS.right.cheek, size, 'rgba(70,70,70,0.7)');
  paintSoftEllipse(ctx, FACE_BRUISE_REGIONS.left.eye, size, 'rgba(55,55,55,0.75)');
  paintSoftEllipse(ctx, FACE_BRUISE_REGIONS.right.eye, size, 'rgba(55,55,55,0.75)');

  clipToFaceSkinGate(ctx, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

async function tryLoadTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
): Promise<THREE.Texture | null> {
  try {
    const loader = new THREE.TextureLoader();
    const tex = await loader.loadAsync(url);
    tex.colorSpace = colorSpace;
    tex.flipY = false;
    tex.needsUpdate = true;
    return tex;
  } catch {
    return null;
  }
}

/**
 * Carrega PNGs de `public/textures/face-injury/` se existirem;
 * senão usa procedurais (MVP jogável sem arte externa).
 */
export async function loadFaceInjuryMaps(): Promise<FaceInjuryMaps> {
  const [maskFile, albedoFile, normalFile, roughnessFile] = await Promise.all([
    tryLoadTexture(INJURY_MAP_URLS.mask, THREE.NoColorSpace),
    tryLoadTexture(INJURY_MAP_URLS.albedo, THREE.SRGBColorSpace),
    tryLoadTexture(INJURY_MAP_URLS.normal, THREE.NoColorSpace),
    tryLoadTexture(INJURY_MAP_URLS.roughness, THREE.NoColorSpace),
  ]);

  const mask = maskFile ?? createProceduralInjuryMask();
  const albedo = albedoFile ?? createProceduralInjuryAlbedo();
  const normal = normalFile ?? createProceduralInjuryNormal();
  const roughness = roughnessFile ?? createProceduralInjuryRoughness();

  console.info(
    `[FaceInjuryMaps] mask=${maskFile ? 'file' : 'procedural'} albedo=${albedoFile ? 'file' : 'procedural'} normal=${normalFile ? 'file' : 'procedural'} roughness=${roughnessFile ? 'file' : 'procedural'}`,
  );

  return {
    mask,
    albedo,
    normal,
    roughness,
    dispose: () => {
      mask.dispose();
      albedo.dispose();
      normal.dispose();
      roughness.dispose();
    },
  };
}
