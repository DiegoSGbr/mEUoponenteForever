# AGENT.md — Boxe FP no navegador

Projeto: **mEUoponenteForever**  
Pasta: `D:\projetos\mEUoponenteForever`  
Escopo: médio | Estilo: simulação leve | Controles: teclado + mouse

---

## Instrução para o agente (ler primeiro)

Você é um desenvolvedor sênior de jogos web. **Implemente este jogo na ordem das 10 etapas abaixo.** Não pule etapas. Não adicione multiplayer, backend ou Unity/Unreal.

Após cada etapa:

1. Liste o que foi feito.
2. Diga como testar manualmente.
3. Atualize o **Checklist de progresso** no final deste arquivo.

Se a pasta estiver vazia (sem `package.json`), comece com:

```bash
npm create vite@latest . -- --template vanilla-ts
npm install three
npm install -D @types/three
```

---

## Stack obrigatória

- Vite + TypeScript
- Three.js (render 3D)
- Colisão de combate por **hitboxes** (sem ragdoll / sem física pesada)
- UI em HTML/CSS sobre o canvas
- MVP visual com primitivas Three.js (sem modelos externos obrigatórios)
- Áudio: Web Audio API ou Howler.js
- README em português ao final

---

## Visão do jogo

Boxe em **primeira pessoa** no ringue. O jogador vê as luvas e o oponente à frente. Partidas em rounds; vitória por KO, TKO ou decisão.

---

## Mecânicas obrigatórias

### Câmera e movimento

- Mouse: olhar com limites (sem 360° livre)
- WASD: passos curtos, limitados ao ringue
- Espaço: esquiva lateral (cooldown + custo de stamina)

### Socos

Tipos: **jab**, **cross**, **hook**, **uppercut**  
Cada um: wind-up → janela ativa → recovery; dano, alcance e custo de stamina distintos; soco fraco se stamina insuficiente.

### Guarda

- Shift (segurar): guarda alta, reduz dano (não 100%)
- Feedback de bloqueio (som + shake leve)

### Stamina

- 0–100, regenera em repouso
- Abaixo de 20%: penalidades visíveis no HUD

### Combos

- Exemplo: jab → jab → cross (janela ~2–3s)
- Bônus de dano ou stagger; indicador no HUD

### IA do oponente

Estados: `Approach`, `Pressure`, `Defend`, `Counter`, `Tired`  
Dificuldade única **Normal**; cooldowns; reage à distância e agressividade.

### Rounds

- 3 rounds × 2 min (tecla `` ` `` acelera timer em debug)
- Sistema: **barra de saúde + decisão** OU 10-point must — escolha um e documente no README
- KO: saúde 0 | TKO: 3 knockdowns | empate possível

### Tutorial

Passos (só avança ao cumprir a ação):

1. Olhar (mouse)
2. Mover no ringue
3. Jab e cross
4. Guarda
5. Esquiva
6. Combo exemplo

### Menu e fluxo

- Início: Jogar | Tutorial | Configurações (volume) | Créditos
- Esc: pausa (retomar / reiniciar / menu)
- Resultado: estatísticas (socos, acertos, % guarda, tempo)

### Áudio

- SFX: impacto, bloqueio, whoosh, bell
- Volume em `localStorage`

### HUD

- Saúde (jogador + oponente), stamina, timer, combo, mensagens curtas

---

## Controles

| Ação | Tecla |
|------|-------|
| Jab | Q |
| Cross | E |
| Hook | R |
| Uppercut | F |
| Guarda | Shift (segurar) |
| Esquiva | Espaço |
| Mover | WASD |
| Pausa | Esc |
| Mira | Mouse |

---

## Estrutura de pastas alvo

```
src/
  main.ts
  game/Game.ts
  game/StateMachine.ts
  combat/CombatManager.ts
  combat/PunchType.ts
  combat/ComboDetector.ts
  combat/HitResolver.ts
  player/PlayerController.ts
  player/StaminaSystem.ts
  opponent/OpponentAI.ts
  scene/RingScene.ts
  scene/FirstPersonRig.ts
  ui/Menu.ts
  ui/HUD.ts
  ui/Tutorial.ts
  audio/AudioManager.ts
```

---

## Ordem de implementação (estrita)

- [x] **1.** Vite+TS+Three, ringue, câmera FP, movimento limitado
- [x] **2.** Luvas/mãos + animação procedural de socos
- [x] **3.** HitResolver + dano + HUD saúde
- [x] **4.** Stamina + penalidades
- [x] **5.** IA oponente (socos + guarda)
- [x] **6.** Rounds, timer, vitória
- [x] **7.** ComboDetector
- [x] **8.** Menu + pause + máquina de estados
- [x] **9.** Tutorial guiado
- [x] **10.** Áudio + polish (shake, partículas no impacto)

---

## Definition of Done

- [x] `npm run dev` sem erros no console
- [x] Fluxo: menu → luta 3 rounds → resultado
- [x] Tutorial completo
- [x] 4 socos + guarda + esquiva com feedback
- [x] Stamina afeta gameplay
- [x] ≥1 combo funcional
- [x] IA ataca, defende e cansa
- [x] SFX impacto/bloqueio/bell; volume salvo
- [x] README em português

---

## Restrições

- Sem multiplayer, login ou backend
- Sem plugins pagos
- Código claro > over-engineering

---

## Comandos úteis

```bash
npm install
npm run dev
```

---

## Checklist de progresso (agente atualiza)

| Etapa | Status | Testado em |
|-------|--------|------------|
| 1 | ✅ | 2026-05-25 — build OK |
| 2 | ✅ | 2026-05-25 — build OK |
| 3 | ✅ | 2026-05-25 — build OK |
| 4 | ✅ | 2026-05-25 — build OK |
| 5 | ✅ | 2026-05-25 — build OK |
| 6 | ✅ | 2026-05-25 — build OK |
| 7 | ✅ | 2026-05-25 — build OK |
| 8 | ✅ | 2026-05-25 — build OK |
| 9 | ✅ | 2026-05-25 — build OK |
| 10 | ✅ | 2026-05-25 — build OK |
