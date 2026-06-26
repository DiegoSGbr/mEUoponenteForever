# mEU_Oponente_Forever

[![Beta](https://img.shields.io/badge/status-beta-orange)](https://github.com/DiegoSGbr/mEUoponenteForever)
[![CI](https://github.com/DiegoSGbr/mEUoponenteForever/actions/workflows/ci.yml/badge.svg)](https://github.com/DiegoSGbr/mEUoponenteForever/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Jogo de boxe em **primeira pessoa** no navegador. Você vê suas luvas e enfrenta um oponente controlado por IA no ringue — *aquele cara no espelho é o seu maior adversário*.

> **Versão beta** — o MVP está jogável; feedback, bugs e ideias são bem-vindos. Veja [como contribuir](CONTRIBUTING.md).

## Jogar online

Após ativar o GitHub Pages (veja [Deploy](#deploy)), a demo fica em:

**https://DiegoSGbr.github.io/mEUoponenteForever/**

Requisitos: navegador moderno com suporte a WebGL e pointer lock.

## Como rodar localmente

```bash
git clone https://github.com/DiegoSGbr/mEUoponenteForever.git
cd mEUoponenteForever
npm install
npm run dev
```

Abra o endereço exibido no terminal (geralmente `http://localhost:5173`).

### Build de produção

```bash
npm run build
npm run preview
```

## Controles

| Ação | Controle |
|------|----------|
| Jab | Botão esquerdo do mouse |
| Cross | Botão direito do mouse |
| Hook | Q |
| Uppercut | E |
| Guarda alta | Shift (segurar) |
| Esquiva lateral | Espaço |
| Mover | WASD |
| Pausa | Esc |
| Mira | Mouse |
| Acelerar timer (debug) | `` ` `` |

Clique no canvas para capturar o mouse (pointer lock). O primeiro clique esquerdo inicia a captura; depois disso, cliques esquerdo e direito disparam socos.

## O que está na beta

- Menu completo: Jogar, Tutorial, Configurações (volume), Créditos
- Luta em 3 rounds × 2 minutos com KO, TKO e decisão
- 4 tipos de soco, guarda, esquiva e sistema de stamina
- Combo **Jab → Jab → Cross** com bônus de dano
- IA com estados (aproximar, pressionar, defender, contra-atacar, cansar)
- Áudio procedural (Web Audio API), sem arquivos externos
- Tutorial guiado passo a passo

Limitações conhecidas e próximos passos: [ROADMAP.md](ROADMAP.md).

## Sistema de pontuação

Este MVP usa **barra de saúde + decisão** (não 10-point must):

- Cada lutador começa com 100 de saúde.
- **KO:** saúde chega a 0.
- **TKO:** 3 knockdowns (socos pesados sem bloqueio).
- **Decisão:** após 3 rounds de 2 minutos, vence quem tiver mais saúde (empate se diferença ≤ 5).

## Stack

- [Vite](https://vitejs.dev/) + TypeScript
- [Three.js](https://threejs.org/) (primitivas 3D, sem modelos externos)
- Colisão por hitboxes (sem física pesada)
- UI em HTML/CSS sobre o canvas
- Áudio via Web Audio API
- Volume salvo em `localStorage`

## Estrutura do código

```
src/
  main.ts
  game/Game.ts, StateMachine.ts
  combat/CombatManager.ts, PunchType.ts, ComboDetector.ts, HitResolver.ts
  player/PlayerController.ts, StaminaSystem.ts
  opponent/OpponentAI.ts
  scene/RingScene.ts, FirstPersonRig.ts
  ui/Menu.ts, HUD.ts, Tutorial.ts
  audio/AudioManager.ts
```

Documentação técnica detalhada para contribuidores e agentes de IA: [AGENT.md](AGENT.md).

## Contribuir

1. Leia [CONTRIBUTING.md](CONTRIBUTING.md)
2. Trabalhe a partir da branch **`dev`** (não de `main`)
3. Abra PR para **`dev`**; produção vai para **`main`** após revisão do mantenedor

```bash
git checkout dev
git pull origin dev
# sua branch de trabalho → PR para dev
```

Áreas onde ajuda é especialmente útil: gameplay, IA, áudio, UI, acessibilidade e testes manuais da beta.

## Deploy (produção)

A demo pública reflete a branch **`main`**:

**https://DiegoSGbr.github.io/mEUoponenteForever/**

Fluxo de publicação:

1. Desenvolvimento e PRs de colaboradores → **`dev`**
2. Quando estiver pronto para produção → **PR `dev` → `main`**
3. Mantenedor aprova e faz merge → workflow `.github/workflows/deploy-pages.yml` publica no GitHub Pages

Configuração inicial (uma vez): **Settings → Pages → Build and deployment → Source: GitHub Actions**

## Changelog

Veja [CHANGELOG.md](CHANGELOG.md).

## Licença

[MIT](LICENSE) — use, modifique e contribua livremente.
