/**
 * Valida paint de olho roxo + sangue no nariz (espelha OpponentFaceInjuryMaps).
 * Uso: node scripts/test-face-injury-paint.mjs
 */
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 1024;
const LEFT_EYE = { u: 0.711, v: 0.127, rx: 0.048, ry: 0.032 };
const RIGHT_EYE = { u: 0.783, v: 0.132, rx: 0.048, ry: 0.032 };
const NOSE = { u: 0.747, v: 0.175, rx: 0.02, ry: 0.022 };
const DRIP = { u: 0.747, v: 0.205, rx: 0.01, ry: 0.025 };

const lx = LEFT_EYE.u * SIZE;
const ly = (LEFT_EYE.v + 0.032) * SIZE;
const lrx = LEFT_EYE.rx * SIZE * 1.55 * 1.4;
const lry = LEFT_EYE.ry * SIZE * 1.25 * 1.4;

const rx = RIGHT_EYE.u * SIZE;
const ry = (RIGHT_EYE.v + 0.032) * SIZE;
const rrx = RIGHT_EYE.rx * SIZE * 1.55 * 1.4;
const rry = RIGHT_EYE.ry * SIZE * 1.25 * 1.4;

const nx = NOSE.u * SIZE;
const ny = NOSE.v * SIZE;
const nrx = NOSE.rx * SIZE * 1.5;
const nry = NOSE.ry * SIZE * 1.5;

const dx = DRIP.u * SIZE;
const dy0 = (DRIP.v - DRIP.ry * 1.2) * SIZE;
const dy1 = (DRIP.v + DRIP.ry * 1.25) * SIZE;
const dMid = DRIP.v * SIZE;

const svg = `
<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="eye" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgb(120,40,150)"/>
      <stop offset="55%" stop-color="rgb(120,40,150)"/>
      <stop offset="100%" stop-color="rgb(120,40,150)" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="bag" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgb(190,55,75)"/>
      <stop offset="100%" stop-color="rgb(190,55,75)" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="nose" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgb(200,18,22)"/>
      <stop offset="60%" stop-color="rgb(200,18,22)"/>
      <stop offset="100%" stop-color="rgb(200,18,22)" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="${lx}" cy="${ly}" rx="${lrx}" ry="${lry}" fill="url(#eye)"/>
  <ellipse cx="${lx}" cy="${(LEFT_EYE.v + 0.045) * SIZE}" rx="${LEFT_EYE.rx * SIZE * 1.25}" ry="${LEFT_EYE.ry * SIZE * 0.95}" fill="url(#bag)"/>
  <ellipse cx="${rx}" cy="${ry}" rx="${rrx}" ry="${rry}" fill="url(#eye)"/>
  <ellipse cx="${rx}" cy="${(RIGHT_EYE.v + 0.045) * SIZE}" rx="${RIGHT_EYE.rx * SIZE * 1.25}" ry="${RIGHT_EYE.ry * SIZE * 0.95}" fill="url(#bag)"/>
  <ellipse cx="${nx}" cy="${ny}" rx="${nrx}" ry="${nry}" fill="url(#nose)"/>
  <path d="M ${dx - 2} ${dy0} Q ${dx + 8} ${dMid} ${dx} ${dy1}" stroke="rgb(160,10,14)" stroke-width="7" fill="none" stroke-linecap="round"/>
</svg>`;

const buf = await sharp(Buffer.from(svg)).png().toBuffer();
const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

function sample(u, v) {
  const x = Math.min(info.width - 1, Math.max(0, Math.round(u * (info.width - 1))));
  const y = Math.min(info.height - 1, Math.max(0, Math.round(v * (info.height - 1))));
  const i = (y * info.width + x) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
}

const checks = [
  ['under-eye L (roxo)', sample(LEFT_EYE.u, LEFT_EYE.v + 0.032), (p) => p.a > 20 && p.b > 40],
  ['under-eye R (roxo)', sample(RIGHT_EYE.u, RIGHT_EYE.v + 0.032), (p) => p.a > 20 && p.b > 40],
  ['nariz (sangue)', sample(NOSE.u, NOSE.v), (p) => p.a > 20 && p.r > 80 && p.r > p.g],
  ['filete (sangue)', sample(DRIP.u, DRIP.v), (p) => p.a > 10 && p.r > 40],
];

let failed = 0;
for (const [name, pix, ok] of checks) {
  const pass = ok(pix);
  console.log(`${pass ? 'OK' : 'FAIL'} ${name}:`, pix);
  if (!pass) failed++;
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), 'test-output');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, '_injury-albedo-preview.png');
writeFileSync(outPath, buf);
console.log('preview:', outPath);

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll paint checks passed');
