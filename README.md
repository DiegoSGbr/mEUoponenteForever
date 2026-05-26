# Boxe FP — mEUoponenteForever

Jogo de boxe em **primeira pessoa** no navegador. Você vê suas luvas e enfrenta um oponente controlado por IA no ringue.

## Stack

- Vite + TypeScript
- Three.js (primitivas 3D, sem modelos externos)
- Colisão por hitboxes (sem física pesada)
- UI em HTML/CSS sobre o canvas
- Áudio via Web Audio API
- Volume salvo em `localStorage`

## Como rodar

```bash
npm install
npm run dev
```

Abra o endereço exibido no terminal (geralmente `http://localhost:5173`).

## Controles

| Ação | Tecla |
|------|-------|
| Jab | Q |
| Cross | E |
| Hook | R |
| Uppercut | F |
| Guarda alta | Shift (segurar) |
| Esquiva lateral | Espaço |
| Mover | WASD |
| Pausa | Esc |
| Mira | Mouse |
| Acelerar timer (debug) | `` ` `` |

Clique no canvas para capturar o mouse (pointer lock).

## Sistema de pontuação

Este MVP usa **barra de saúde + decisão** (não 10-point must):

- Cada lutador começa com 100 de saúde.
- **KO:** saúde chega a 0.
- **TKO:** 3 knockdowns (socos pesados sem bloqueio).
- **Decisão:** após 3 rounds de 2 minutos, vence quem tiver mais saúde (empate se diferença ≤ 5).

## Fluxo do jogo

1. Menu: Jogar, Tutorial, Configurações (volume), Créditos
2. Luta em 3 rounds × 2 min
3. Tela de resultado com estatísticas
4. Esc durante a luta: pausa (retomar / reiniciar / menu)

## Tutorial

Passos guiados (só avança ao cumprir):

1. Olhar com o mouse  
2. Mover com WASD  
3. Jab (Q) e Cross (E)  
4. Guarda (Shift)  
5. Esquiva (Espaço)  
6. Combo Jab → Jab → Cross  

## Combos

Sequência exemplo: **Jab → Jab → Cross** em até ~2,8 s após acertos. Concede bônus de dano (+25%) e stagger no oponente.

## IA (Normal)

Estados: Approach, Pressure, Defend, Counter, Tired. O oponente aproxima, pressiona, defende, contra-ataca e cansa quando a stamina interna fica baixa.

## Stamina

- 0–100, regenera em repouso  
- Socos e esquiva consomem stamina  
- Abaixo de 20%: socos ficam fracos e o HUD pulsa  

## Estrutura

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

## Build

```bash
npm run build
npm run preview
```
