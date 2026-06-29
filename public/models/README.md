# Modelos do oponente (Mixamo / Adobe)

## Estrutura

| Arquivo | Uso no jogo |
|---------|-------------|
| `Boxing.glb` | Mesh + esqueleto base |
| `anim-jab.glb` | Golpe: jab |
| `anim-cross.glb` | Golpe: cross |
| `anim-hook.glb` | Golpe: hook |
| `anim-uppercut.glb` | Golpe: uppercut |
| `anim-guard.glb` | Guarda alta (loop) |
| `anim-walking.glb` | Caminhada ao ir de encontro ao jogador (loop) |
| `anim-idle-tired.glb` | Cansado / perdendo (loop) |
| `anim-hit-head.glb` | Reação ao levar golpe na cabeça |
| `anim-hit-body.glb` | Reação corporal (reserva) |
| `anim-victory.glb` | Vitória do oponente (fim de luta) |
| `anim-death.glb` | Queda / nocaute quando o **jogador vence** (rosto customizado segue o esqueleto) |

Arquivos `.fbx` são fonte local (gitignore). O jogo carrega apenas `.glb`.

> **Rosto:** a textura da cabeça fica no mesh base `Boxing.glb`. Clips como `anim-death` só animam ossos — `OpponentFaceCustomizer` reaplica o rosto ao iniciar death/victory/hit.

## Converter FBX → GLB

```bash
npm install --no-save fbx2gltf
node scripts/convert-opponent-anims.mjs
```

Opcional (reduzir tamanho):

```bash
npx @gltf-transform/cli optimize public/models/anim-jab.glb public/models/anim-jab.glb
```

## Troca de rosto

Código em `src/opponent/OpponentFaceCustomizer.ts` + `OpponentFaceConfig.ts`.

Requisitos da imagem:

- Rosto frontal, centrado, boa luz
- PNG ou JPEG, mín. 256×256 (ideal 512×512)
- Proporção ~1:1 ou 3:4

O rosto persiste em **todas** as animações, inclusive `anim-death` ao vencer:

```ts
await ring.setOpponentFace({ kind: 'image', imageUrl: '/uploads/rosto.png' });
await ring.refreshOpponentFace(); // reaplica após recarregar assets
```

## Licença

Termos [Adobe Mixamo](https://www.adobe.com/legal/terms.html).
