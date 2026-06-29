/**
 * Converte FBX do Mixamo em GLB para uso com GLTFLoader.
 * Uso: node scripts/convert-opponent-anims.mjs
 */
import { readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const convert = require('fbx2gltf');

const modelsDir = join(process.cwd(), 'public', 'models');

const RENAME = {
  'anim-idle-despair-almost-losing.fbx': 'anim-idle-tired.glb',
  'anim-hit-to-head.fbx': 'anim-hit-head.glb',
  'anim-hit.fbx': 'anim-hit-body.glb',
};

/** FBX legado — não converter (substituído por anim-walking.fbx). */
const SKIP = new Set(['Boxing.fbx', 'Jogging With Box.fbx']);

function outputName(file) {
  if (RENAME[file]) return RENAME[file];
  return basename(file, '.fbx') + '.glb';
}

const files = (await readdir(modelsDir)).filter(
  (f) => f.endsWith('.fbx') && !SKIP.has(f),
);

for (const file of files) {
  const src = join(modelsDir, file);
  const dest = join(modelsDir, outputName(file));
  process.stdout.write(`Converting ${file} → ${outputName(file)}... `);
  try {
    await convert(src, dest);
    console.log('OK');
  } catch (err) {
    console.error('FAIL', err.message);
  }
}

console.log('Done.');
