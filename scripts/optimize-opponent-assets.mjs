/**
 * Otimiza assets do oponente:
 * 1) anim-*.glb → só AnimationClips (+ hierarquia de bones), sem mesh/texturas
 * 2) Boxing.glb → resize 1024 + WebP + meshopt (via CLI), sem exigir EXT_texture_webp
 *
 * Uso: npm run optimize:assets
 *
 * Pré-requisito: anim-*.glb “cheios” (pós convert:anims) e/ou Boxing.glb fonte.
 * Reexecutar após convert:anims para re-slimar clips.
 */
import { readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const modelsDir = join(process.cwd(), 'public', 'models');

/** Animações usadas em OpponentAssets.ts */
const ANIM_FILES = [
  'anim-jab.glb',
  'anim-cross.glb',
  'anim-hook.glb',
  'anim-uppercut.glb',
  'anim-guard.glb',
  'anim-idle-tired.glb',
  'anim-walking.glb',
  'anim-hit-head.glb',
  'anim-hit-body.glb',
  'anim-victory.glb',
  'anim-death.glb',
];

const BASE_FILE = 'Boxing.glb';

function formatMB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function fileSize(path) {
  return (await stat(path)).size;
}

function createIO() {
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
    });
}

function runNpx(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['--yes', '@gltf-transform/cli@4', ...args], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true,
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`gltf-transform exited with ${code}`));
    });
    child.on('error', reject);
  });
}

/**
 * Remove mesh/materiais/texturas; mantém nodes (bones) + animations.
 * O GLTFLoader precisa dos nodes nomeados para montar tracks (mixamorig:*).
 */
async function stripAnimationGlb(io, filePath) {
  const document = await io.read(filePath);
  const root = document.getRoot();

  for (const node of root.listNodes()) {
    node.setMesh(null);
    node.setSkin(null);
    node.setCamera(null);
  }

  for (const mesh of root.listMeshes()) mesh.dispose();
  for (const material of root.listMaterials()) material.dispose();
  for (const texture of root.listTextures()) texture.dispose();
  for (const skin of root.listSkins()) skin.dispose();

  await document.transform(prune());
  await io.write(filePath, document);
}

/**
 * Three.js GLTFLoader carrega image/webp nativamente, mas falha se
 * EXT_texture_webp estiver em extensionsRequired. Removemos a extensão
 * mantendo as texturas WebP embutidas.
 */
async function dropWebpExtensionRequirement(io, filePath) {
  const document = await io.read(filePath);
  for (const ext of document.getRoot().listExtensionsUsed()) {
    if (ext.extensionName === EXTTextureWebP.EXTENSION_NAME) {
      ext.dispose();
    }
  }
  await io.write(filePath, document);
}

async function optimizeBaseGlb(io, filePath) {
  const tmp = join(modelsDir, 'Boxing.optimize-tmp.glb');
  // Resize first (decodes meshopt if needed)
  await runNpx(['resize', filePath, tmp, '--width', '1024', '--height', '1024']);
  await runNpx(['optimize', tmp, filePath, '--texture-compress', 'webp']);
  await unlink(tmp).catch(() => {});
  await dropWebpExtensionRequirement(io, filePath);
}

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;

const io = createIO();
const existing = new Set(await readdir(modelsDir));

console.log('=== Strip animation GLBs (mesh/textures out) ===');
for (const file of ANIM_FILES) {
  if (!existing.has(file)) {
    console.warn(`SKIP missing: ${file}`);
    continue;
  }
  const path = join(modelsDir, file);
  const before = await fileSize(path);
  // Já slim? (< 1 MB) — só reprocessa se ainda estiver “cheio”
  if (before < 1024 * 1024) {
    console.log(`${file}: ${formatMB(before)} (já otimizado, skip)`);
    continue;
  }
  process.stdout.write(`${file}: ${formatMB(before)} → `);
  await stripAnimationGlb(io, path);
  const after = await fileSize(path);
  console.log(`${formatMB(after)}`);
}

if (existing.has(BASE_FILE)) {
  console.log('\n=== Optimize Boxing.glb ===');
  const path = join(modelsDir, BASE_FILE);
  const before = await fileSize(path);
  process.stdout.write(`${BASE_FILE}: ${formatMB(before)} → `);
  await optimizeBaseGlb(io, path);
  const after = await fileSize(path);
  console.log(`${formatMB(after)}`);
} else {
  console.warn(`SKIP missing: ${BASE_FILE}`);
}

// Limpa backup temporário se existir
await unlink(join(modelsDir, 'Boxing.bak.glb')).catch(() => {});

console.log('\nDone.');
