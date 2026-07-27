/**
 * Teste E2E do upload de rosto: reproduz o fluxo do menu e inspeciona
 * onde a cadeia quebra (validação → composição → material do mesh).
 * Uso: node scripts/test-face-upload.mjs   (requer `npm run dev` ativo)
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const IMAGE = join(here, 'test-assets', 'face-test.png');
const OUT_DIR = join(here, 'test-output');
import { mkdirSync } from 'node:fs';
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

// Espera assets do oponente carregarem (botão Jogar habilita).
try {
  await page.waitForSelector('[data-action="play"]:not([disabled])', { timeout: 90000 });
} catch (error) {
  console.log('--- FALHA aguardando carregamento. Logs do console:');
  for (const l of logs) console.log('   ', l);
  await browser.close();
  process.exit(1);
}

// Abre Configurações e faz o upload.
await page.click('[data-action="settings"]');
await page.setInputFiles('#face-file-input', IMAGE);
await page.waitForSelector('#face-preview-wrap:not(.hidden)', { timeout: 10000 });
const statusAfterValidate = await page.textContent('#face-status');

await page.click('[data-action="face-apply"]');
await page.waitForFunction(
  () => !document.querySelector('#face-status')?.textContent?.includes('Aplicando'),
  { timeout: 20000 },
);
const statusAfterApply = await page.textContent('#face-status');

// Dá um tempo para o applySource assíncrono terminar.
await page.waitForTimeout(1500);

// Inspeciona o estado interno via handle de debug.
const state = await page.evaluate(() => {
  const game = window.__game;
  if (!game) return { error: 'window.__game ausente' };
  const ring = game['ring'];
  const model = ring?.['opponentModel'];
  if (!model) return { error: 'opponentModel ausente' };
  const fc = model.faceCustomizer;
  const slots = fc['slots'] ?? [];
  const pending = fc['pendingTexture'];
  const slot = slots[0];
  const baseImage = slot?.originalMap?.image;
  return {
    source: fc.source,
    hasCustomFace: fc.hasCustomFace,
    slotCount: slots.length,
    slotName: slot?.slotName,
    baseImageType: baseImage?.constructor?.name ?? String(baseImage),
    baseImageSize: baseImage ? `${baseImage.width}x${baseImage.height}` : null,
    pendingType: pending?.constructor?.name ?? String(pending),
    mapIsPending: slot ? slot.material.map === pending : null,
    mapIsOriginal: slot ? slot.material.map === slot.originalMap : null,
    meshMaterialIsSlotMaterial: slot ? slot.mesh.material === slot.material ||
      (Array.isArray(slot.mesh.material) && slot.mesh.material.includes(slot.material)) : null,
  };
});

// Exporta o canvas composto (se existir) para inspeção visual.
const dataUrl = await page.evaluate(() => {
  const fc = window.__game?.['ring']?.['opponentModel']?.faceCustomizer;
  const img = fc?.['pendingTexture']?.image;
  if (!img || typeof img.toDataURL !== 'function') return null;
  return img.toDataURL('image/png');
});
if (dataUrl) {
  const b64 = dataUrl.split(',')[1];
  writeFileSync(join(OUT_DIR, '_composed-face-atlas.png'), Buffer.from(b64, 'base64'));
}

// Testa os sliders de ajuste fino (recompõe ao vivo).
const adjustVisible = await page.isVisible('#face-adjust:not(.hidden)');
await page.fill('#face-adjust-du', '10');
await page.dispatchEvent('#face-adjust-du', 'input');
await page.waitForTimeout(500);
await page.fill('#face-adjust-du', '0');
await page.dispatchEvent('#face-adjust-du', 'input');
await page.waitForTimeout(500);
console.log('--- sliders ajuste :', adjustVisible ? 'visíveis e funcionais' : 'NÃO VISÍVEIS');

// Inicia a luta e aproxima o oponente para ver o rosto aplicado no modelo 3D.
await page.evaluate(() => {
  const game = window.__game;
  game['startMatch'](false);
});
await page.waitForTimeout(800);
await page.evaluate(() => {
  const game = window.__game;
  const ai = game['ai'];
  // Congela a IA por completo (sem andar/strafe/golpes) para screenshot determinístico.
  ai.update = () => {};
  ai.activePunch = null;
  ai.position.set(0, 0, -1.3); // câmera olha para -z

  game['rig'].applyLookDelta(0, 140); // inclina a câmera para baixo (rosto fica no centro)
});
await page.waitForTimeout(1400);
await page.screenshot({ path: join(OUT_DIR, '_face-ingame.png') });

console.log('--- status validação:', statusAfterValidate);
console.log('--- status aplicar :', statusAfterApply);
console.log('--- estado interno :', JSON.stringify(state, null, 2));
console.log('--- canvas composto:', dataUrl ? 'exportado para scripts/test-output/_composed-face-atlas.png' : 'INDISPONÍVEL');
console.log('--- logs do console:');
for (const l of logs) console.log('   ', l);

await browser.close();
