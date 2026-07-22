# Modelos do oponente (Mixamo / Adobe)

## Estrutura

| Arquivo | Uso no jogo |
|---------|-------------|
| `Boxing.glb` | Mesh + esqueleto base (otimizado: texturas 1024 + meshopt) |
| `boxing-glove.glb` | Luva RenderCrate otimizada (~250 KB) — oponente + FP; tint vermelho em runtime |
| `anim-jab.glb` | Golpe: jab |
| `anim-cross.glb` | Golpe: cross |
| `anim-hook.glb` | Golpe: hook |
| `anim-uppercut.glb` | Golpe: uppercut |
| `anim-guard.glb` | Guarda alta (loop) — carregado no bootstrap |
| `anim-walking.glb` | Caminhada ao ir de encontro ao jogador (loop) |
| `anim-idle-tired.glb` | Cansado / perdendo (loop) |
| `anim-hit-head.glb` | Reação ao levar golpe na cabeça |
| `anim-hit-body.glb` | Reação corporal (reserva) |
| `anim-victory.glb` | Vitória do oponente (fim de luta) |
| `anim-death.glb` | Queda / nocaute quando o **jogador vence** (rosto customizado segue o esqueleto) |

Arquivos `.fbx` são fonte local (gitignore). O jogo carrega apenas `.glb`.

> **Rosto:** a textura da cabeça fica no mesh base `Boxing.glb`. Clips como `anim-death` só animam ossos — `OpponentFaceCustomizer` reaplica o rosto ao iniciar death/victory/hit.

> **Load:** o menu espera só `Boxing.glb` + `anim-guard.glb`. Os demais clips entram em background.

## Pipeline FBX → GLB otimizado

```bash
# 1) Converter FBX do Mixamo em GLB (ainda com mesh+texturas duplicados)
npm install --no-save fbx2gltf
npm run convert:anims

# 2) Slimar clips (só animação) + comprimir Boxing.glb
npm run optimize:assets
```

O passo 2:

- Remove mesh/materiais/texturas de cada `anim-*.glb` (de ~43 MB para ~50 KB)
- Redimensiona texturas do base para 1024, comprime (WebP) e aplica meshopt

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
