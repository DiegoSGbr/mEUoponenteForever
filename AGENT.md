# AGENT.md — mEU_Oponente_Forever (Boxe FP no navegador)

Repositório: [github.com/DiegoSGbr/mEUoponenteForever](https://github.com/DiegoSGbr/mEUoponenteForever)  
Status: **beta pública** | Escopo: médio | Estilo: simulação leve | Controles: mouse + teclado

Documentação para contribuidores humanos: [CONTRIBUTING.md](CONTRIBUTING.md) · Roadmap: [ROADMAP.md](ROADMAP.md)

**Branches:** `dev` (desenvolvimento) · `main` (produção / GitHub Pages)

---

## Instrução para o agente (ler primeiro)

Você é um desenvolvedor sênior de jogos web.

**As 10 etapas do MVP já estão implementadas.** Novo trabalho = correções pós-teste, polish e features extras — **não reimplementar do zero**.

Antes de codar:

1. Leia esta seção **Handoff** e **Convenções técnicas**.
2. Trabalhe na branch **`dev`** (PRs de colaboradores vão para `dev`; `main` = produção).
3. Rode `npm run dev` e reproduza o bug pedido.
4. Após mudanças: liste o feito, como testar, e atualize **Correções pós-MVP** abaixo.

Se a pasta estiver vazia (sem `package.json`), comece com:

```bash
npm create vite@latest . -- --template vanilla-ts
npm install three
npm install -D @types/three
```

---

## Handoff — estado em 2026-06-14

### O que já funciona

- Fluxo completo: menu → luta (3×2 min) → resultado; tutorial guiado; pausa (Esc).
- Combate: 4 socos, guarda, esquiva, stamina, combos (`jab → jab → cross`), IA com estados.
- Vitória: KO, TKO (3 knockdowns), decisão por barra de saúde, empate.
- Áudio procedural via **Web Audio API** (`src/audio/AudioManager.ts`), volume em `localStorage` (`boxe-fp-volume`).
- Build: `npm run build` OK; CI no GitHub Actions; deploy opcional via GitHub Pages.
- Controles: Jab (clique esquerdo), Cross (clique direito), Hook (Q), Uppercut (E).
- Oponente visual: modelo Mixamo em `public/models/Boxing.glb` via [`OpponentModel.ts`](src/opponent/OpponentModel.ts) (`GLTFLoader` + `MeshoptDecoder`); fallback procedural se o load falhar.

### Correções já aplicadas (pós-teste das 10 etapas)

| Data | Problema | Solução | Arquivos principais |
|------|----------|---------|---------------------|
| 2026-05-26 | Oponente spawnava **atrás** do jogador | Câmera FP olha para **-Z**; oponente em `z = -4.2`, `rotation.y = π`, IA limitada em `z ∈ [-5.5, -2]`; `resetLook()` no início da partida | `RingScene.ts`, `OpponentAI.ts`, `FirstPersonRig.ts`, `Game.ts` |
| 2026-05-26 | SFX de impacto/sino/torcida muito básicos | `playImpact()` estilo soco de boxe; `playStartBell()` no **início** da partida; `playCrowdCheer()` / `playCrowdBoo()` no fim conforme vitória/derrota | `AudioManager.ts`, `Game.ts` |
| 2026-06-14 | Controles só no teclado | Jab/Cross no mouse (esq./dir.); Hook (Q); Uppercut (E); `contextmenu` bloqueado em partida | `Game.ts`, `Tutorial.ts` |

### Branding (UI)

- Título da página: `mEU_Oponente_Forever` (`index.html`).
- Menu principal: mesmo título + subtítulo sobre o “adversário no espelho” (`src/ui/Menu.ts`).

### Próximo contribuidor — onde continuar

- Repositório **público em beta** — prioridades em [ROADMAP.md](ROADMAP.md).
- Branch **`dev`** para desenvolvimento; **`main`** só via PR aprovado pelo mantenedor (produção).
- Novo trabalho = correções, polish e features extras — **não reimplementar do zero**.
- Empate (`draw`) em `endMatch` **não** dispara torcida (só vitória/derrota clara por saúde final).
- Após mudanças visíveis: atualizar README, CHANGELOG e tabela **Correções pós-MVP** abaixo.

---

## Convenções técnicas (importante)

### Eixo e câmera FP (Three.js)

- Olhar padrão da câmera: eixo **-Z** (frente do jogador).
- **W** diminui `z` (avança para o oponente).
- Spawn jogador: `(0, 0, 0)`; spawn oponente: `(0, 0, -4.2)`.
- `FirstPersonRig.resetLook()` zera yaw/pitch ao iniciar/reiniciar partida.

### Áudio — API atual (`AudioManager`)

| Método | Quando usar |
|--------|-------------|
| `playImpact()` | Acerto que tira vida (jogador ou oponente), não bloqueio |
| `playBlock()` | Golpe bloqueado |
| `playWhoosh()` | Soco desferido / esquiva |
| `playStartBell()` | **Somente** início de partida (`Game.startMatch`) |
| `playBell()` | Fim de round / intervalo entre rounds |
| `playCrowdCheer()` | Vitória do jogador em `endMatch` (`player.health > opponent.health`) |
| `playCrowdBoo()` | Derrota do jogador em `endMatch` |
| `playKnockdown()` | Existe; verificar se está ligado nos knockdowns |

Sons são **sintetizados** (sem arquivos `.mp3`/`.ogg`). Para trocar por samples reais, manter a mesma interface pública.

### Pontos de integração em `Game.ts`

- `startMatch()` → `playStartBell()`, posição oponente, `rig.resetLook()`.
- `resolvePlayerPunch` / `resolveOpponentPunch` → `playImpact()` ou `playBlock()`.
- `endMatch()` → torcida por comparação de saúde final.
- `updateRoundTimer()` → `playBell()` no intervalo e novo round.

---

## Stack obrigatória

- Vite + TypeScript
- Three.js (render 3D)
- Colisão de combate por **hitboxes** (sem ragdoll / sem física pesada)
- UI em HTML/CSS sobre o canvas
- MVP visual com primitivas Three.js (sem modelos externos obrigatórios)
- Áudio: Web Audio API (implementado; Howler.js opcional se migrar)
- README em português ao final

---

## Visão do jogo

Boxe em **primeira pessoa** no ringue. O jogador vê as luvas e o oponente **à frente** (-Z). Partidas em rounds; vitória por KO, TKO ou decisão.

---

## Mecânicas obrigatórias

### Câmera e movimento

- Mouse: olhar com limites (sem 360° livre) — `YAW_LIMIT` / `PITCH_LIMIT` em `FirstPersonRig.ts`
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
- Sistema: **barra de saúde + decisão** (documentado no README)
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

- SFX: impacto (boxe), bloqueio, whoosh, sino início (`playStartBell`), sino round (`playBell`), torcida vitória/derrota
- Volume em `localStorage`

### HUD

- Saúde (jogador + oponente), stamina, timer, combo, mensagens curtas

---

## Controles

| Ação | Controle |
|------|----------|
| Jab | Botão esquerdo do mouse |
| Cross | Botão direito do mouse |
| Hook | Q |
| Uppercut | E |
| Guarda | Shift (segurar) |
| Esquiva | Espaço |
| Mover | WASD |
| Pausa | Esc |
| Mira | Mouse |
| Debug timer | `` ` `` |

O primeiro clique esquerdo no canvas captura o mouse (pointer lock); socos com mouse só após o lock.

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
  opponent/OpponentModel.ts
  opponent/OpponentAssets.ts
  opponent/OpponentFaceCustomizer.ts
  scene/RingScene.ts
  scene/FirstPersonRig.ts
  ui/Menu.ts
  ui/HUD.ts
  ui/Tutorial.ts
  audio/AudioManager.ts
public/
  models/Boxing.glb
```

---

## Ordem de implementação (estrita) — concluída

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
- [x] Oponente visível à frente no spawn
- [x] SFX impacto/sino início/torcida pós-partida (procedural)

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
npm run build
```

### Teste rápido pós-correções

1. **Spawn:** Jogar → sem mover mouse, oponente centralizado à frente.
2. **Impacto:** Acertar oponente e levar soco — som mais “pesado” que o tom quadrado antigo.
3. **Sino:** Início da partida = `playStartBell`; fim de round = `playBell` (mais simples).
4. **Torcida:** Vencer → aplausos; perder → vaias; empate → silêncio de torcida.

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

### Correções pós-MVP

| Item | Status | Data | Notas |
|------|--------|------|-------|
| Oponente à frente no spawn | ✅ | 2026-05-26 | `z = -4.2`, rotação π, `resetLook()` |
| SFX impacto tipo boxe | ✅ | 2026-05-26 | `playImpact()` |
| Sino início de partida | ✅ | 2026-05-26 | `playStartBell()` vs `playBell()` nos rounds |
| Torcida vitória/derrota | ✅ | 2026-05-26 | `playCrowdCheer` / `playCrowdBoo` em `endMatch` |
| Remapeamento socos (mouse + Q/E) | ✅ | 2026-06-14 | `Game.ts`, `Tutorial.ts` |
| Docs open source (beta pública) | ✅ | 2026-06-14 | README, CONTRIBUTING, ROADMAP, CI, Pages |
| Modelo Mixamo no oponente (GLB) | ✅ | 2026-06-28 | `OpponentModel.ts`, `RingScene.ts`, `public/models/Boxing.glb` |
| Oponente de costas / animação vs golpe | ✅ | 2026-06-28 | `rotation.y = 0` (Mixamo +Z); seek no clip por `PunchType` e fase |
| Oponente atravessando cordas do ringue | ✅ | 2026-06-28 | `ringBounds.ts`, spawn `z=-1.85`, strip root motion Mixamo |
| Animações separadas por golpe (10 clips GLB) | ✅ | 2026-06-28 | `OpponentAssets.ts`, `anim-*.glb`, mapeamento `PunchType` |
| Caminhada ao aproximar (`anim-walking`) | ✅ | 2026-06-29 | Substitui Jogging With Box; estados Approach/Counter |
| Morte ao perder (`anim-death`) + rosto na animação | ✅ | 2026-06-29 | `playDefeat`, `OpponentFaceConfig`, reaplica textura no clip death |
| Hook troca de rosto por imagem | 🚧 | | `OpponentFaceCustomizer.ts` — stub para próxima fase |
| _(próximas correções)_ | ⬜ | | Adicionar linhas aqui |

---

## Histórico de sessão (para contexto)

**Sessão 2026-06-14:** Preparação para beta pública no GitHub — documentação de contribuição, roadmap, licença MIT, CI, deploy GitHub Pages, controles atualizados na documentação.

**Sessão 2026-05-26:** Usuário validou as 10 etapas; pediu (1) corrigir spawn do oponente, (2) melhorar sons de impacto, sino de abertura e reação da plateia ao fim da luta. Implementado e documentado acima.
