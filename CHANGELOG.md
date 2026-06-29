# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Unreleased]

### Alterado
- Deslocamento do oponente: `anim-walking.glb` substitui `anim-footwork` (Jogging With Box)
- Caminhada só nos estados Approach e Counter; em Pressure usa guarda

## [0.1.1-beta] - 2026-06-28

### Adicionado
- Modelo 3D do oponente via Mixamo (`public/models/Boxing.glb`) com `GLTFLoader` e `AnimationMixer`
- Módulo [`OpponentModel`](src/opponent/OpponentModel.ts) com fallback para placeholder procedural
- `MeshoptDecoder` para GLB otimizado; `public/models/README.md` com instruções de conversão

### Alterado
- [`RingScene`](src/scene/RingScene.ts): carga assíncrona do oponente e animação sincronizada com a IA
- Créditos in-game citam Adobe Mixamo

## [0.1.0-beta] - 2026-06-14

### Adicionado
- MVP jogável: menu, tutorial, 3 rounds, KO/TKO/decisão
- 4 socos, guarda, esquiva, stamina, combos e IA com estados
- Áudio procedural via Web Audio API
- HUD, pausa, tela de resultado e volume em `localStorage`

### Alterado
- Controles de soco: Jab (clique esquerdo), Cross (clique direito), Hook (Q), Uppercut (E)
- Correção do spawn do oponente à frente do jogador (eixo -Z)
- SFX de impacto, sino de abertura e reação da torcida ao fim da partida

[Unreleased]: https://github.com/DiegoSGbr/mEUoponenteForever/compare/v0.1.0-beta...HEAD
[0.1.0-beta]: https://github.com/DiegoSGbr/mEUoponenteForever/releases/tag/v0.1.0-beta
