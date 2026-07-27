/**
 * Validação de imagem de rosto enviada pelo usuário.
 *
 * A imagem é composta na ilha UV do rosto do atlas (`Ch33_1001`), então precisa:
 * - ser um retrato frontal centralizado (o recorte é elíptico);
 * - ter resolução suficiente para não borrar no atlas 1024;
 * - proporção próxima de retrato/quadrado (o encaixe preserva o aspecto).
 */

export const FACE_IMAGE_REQUIREMENTS = {
  /** Formatos aceitos. */
  mimeTypes: ['image/png', 'image/jpeg', 'image/webp'] as readonly string[],
  /** Tamanho máximo do arquivo. */
  maxBytes: 5 * 1024 * 1024,
  /** Lado mínimo (px). */
  minSide: 512,
  /** Lado máximo (px) — acima disso o navegador gasta memória à toa. */
  maxSide: 4096,
  /** Proporção largura/altura aceita (retrato ~3:4 até quadrado largo). */
  aspectMin: 0.6,
  aspectMax: 1.35,
} as const;

/** Texto exibido no menu junto ao campo de upload. */
export const FACE_IMAGE_GUIDELINES: readonly string[] = [
  'Formatos: PNG, JPG ou WebP — máximo 5 MB',
  'Resolução: mínimo 512×512 px (ideal 1024×1024)',
  'Proporção: quadrada ou retrato (ex.: 3:4)',
  'Rosto frontal, centralizado, olhando para a câmera',
  'Olhos na altura de ~40% do topo da foto (enquadramento de retrato)',
  'Expressão neutra (boca fechada) fica mais natural no modelo',
  'Boa iluminação, sem óculos escuros, chapéu ou mão no rosto',
];

export interface FaceImageValidation {
  ok: boolean;
  errors: string[];
  width: number;
  height: number;
}

/** Valida tipo, tamanho, dimensões e proporção. Não altera o arquivo. */
export async function validateFaceImage(file: File): Promise<FaceImageValidation> {
  const req = FACE_IMAGE_REQUIREMENTS;
  const errors: string[] = [];

  if (!req.mimeTypes.includes(file.type)) {
    errors.push(`Formato "${file.type || 'desconhecido'}" não suportado. Use PNG, JPG ou WebP.`);
  }
  if (file.size > req.maxBytes) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    errors.push(`Arquivo com ${mb} MB — o máximo é 5 MB.`);
  }
  if (errors.length > 0) {
    return { ok: false, errors, width: 0, height: 0 };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return {
      ok: false,
      errors: ['Não foi possível ler a imagem (arquivo corrompido?).'],
      width: 0,
      height: 0,
    };
  }

  const { width, height } = bitmap;
  bitmap.close();

  if (Math.min(width, height) < req.minSide) {
    errors.push(`Resolução ${width}×${height} px — o mínimo é ${req.minSide}×${req.minSide}.`);
  }
  if (Math.max(width, height) > req.maxSide) {
    errors.push(`Resolução ${width}×${height} px — o máximo é ${req.maxSide} px por lado.`);
  }
  const aspect = width / height;
  if (aspect < req.aspectMin || aspect > req.aspectMax) {
    errors.push(
      `Proporção ${aspect.toFixed(2)} fora do aceito (${req.aspectMin}–${req.aspectMax}). Use foto quadrada ou retrato.`,
    );
  }

  return { ok: errors.length === 0, errors, width, height };
}
