/**
 * Prompts em inglês para gerar os 3 mapas PBR (+ máscara RGBA opcional).
 * Use o mesmo seed/rosto de referência e UV layout flat (ilha do rosto Mixamo
 * no topo-direita do atlas 1024², ou mapa 1:1 só do rosto se for UV dedicado).
 *
 * Saída recomendada: PNG 1024×1024 ou 2048×2048, fundo transparente ou preto,
 * flipY=false / UV origin top-left (glTF).
 */

export const PROMPT_INJURY_ALBEDO = `
Photorealistic PBR albedo / basecolor texture map of a male professional boxer's face injuries only, flat UV layout, orthographic unwrap, isolated on pure black background (#000000), no lighting bake, no ambient occlusion baked into color.
Anatomically rigorous facial trauma for a Caucasian/mixed fighter: deep vertical cut through the left eyebrow (superciliary laceration) with fresh dark crimson blood streaks running toward the eyelid; swollen purple-blue hematoma around both orbital sockets (periorbital contusions), worse on one side; broken capillaries and mottled red-purple cheek bruising; split lip corner with dark coagulated blood; nose bridge abrasion with dried and wet blood mix; subtle forehead swelling discoloration.
Skin undertone visible under bruises (yellowish green healing edges + fresh red centers). Blood should look wet and saturated where open wounds are, matte purple where deep bruising sits under skin.
Strictly flat color map, even exposure, no perspective, no hair strands covering wounds, no clothing, no text, no logos, 1024x1024, seamless UV island framing a front-facing face unwrap similar to game character face atlases (Fight Night / Undisputed style).
`.trim();

export const PROMPT_INJURY_NORMAL = `
Photorealistic PBR tangent-space normal map of the same male boxer face injury layout, flat UV unwrap, isolated, OpenGL normal map convention (Y+ up), base color neutral flat normal blue-purple (#8080FF) where undamaged.
Encode strong 3D relief only on trauma: raised swollen periorbital tissue (puffy black eyes), ridged eyebrow laceration trench, bumpy cheek hematoma volume, split lip ridge, swollen nose bridge, subtle forehead puff.
No albedo color, no roughness, no AO — normals only. High frequency pore detail lightly preserved, medium frequency swelling domes clearly readable. 1024x1024, orthographic, UV origin top-left, game-ready, aligned to the same facial UV as the albedo injury map.
`.trim();

export const PROMPT_INJURY_ROUGHNESS = `
Photorealistic PBR roughness map (grayscale) of the same male boxer face injury UV layout, flat unwrap, isolated on mid-gray.
Convention: black = rough/dry matte skin and crusted blood; white = smooth wet glossy fresh blood and open wound fluid; mid-gray = healthy skin.
Make eyebrow cuts, lip split, and nose blood streaks near white (wet), deep purple bruise zones medium-dark (matte subcutaneous), dry scabs darker. No color, no normals, no lighting — pure roughness. 1024x1024, orthographic, identical UV alignment to albedo/normal maps, game-ready for Fight Night style wet-blood specular response.
`.trim();

export const PROMPT_INJURY_MASK_RGBA = `
Utility RGBA region mask texture for a male boxer face flat UV unwrap (same layout as injury albedo), pure black background.
Pack soft feathered masks into channels with ZERO color bleed between channels:
- Red channel: left eye socket + left eyebrow + left cheek (viewer-left)
- Green channel: right eye socket + right eyebrow + right cheek (viewer-right)
- Blue channel: nose + mouth + philtrum + chin center
- Alpha channel: soft full-face wash / forehead / overall swelling mask
Soft gaussian falloff edges, no text, no photos of skin, only grayscale-per-channel masks. 1024x1024, UV top-left origin, game VFX mask style.
`.trim();
