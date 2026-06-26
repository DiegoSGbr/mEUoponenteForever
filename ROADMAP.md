# Roadmap (beta)

Prioridades para evolução do projeto. Itens sem dono — sinta-se à vontade para pegar um e abrir uma PR (comente na issue relacionada, se houver).

## Legenda

- ✅ Feito no MVP/beta atual
- 🚧 Em discussão ou parcial
- 📋 Planejado
- 💡 Ideia (sem compromisso)

---

## v0.1 — Beta pública (atual)

| Item | Status |
|------|--------|
| Fluxo menu → luta → resultado | ✅ |
| Tutorial guiado | ✅ |
| 4 socos + guarda + esquiva | ✅ |
| Stamina e penalidades | ✅ |
| Combo Jab → Jab → Cross | ✅ |
| IA Normal (5 estados) | ✅ |
| Áudio procedural | ✅ |
| Controles mouse + teclado | ✅ |
| Repositório público e docs de contribuição | ✅ |

---

## v0.2 — Polish e feedback

| Item | Status | Notas |
|------|--------|-------|
| Dificuldades da IA (Fácil / Difícil) | 📋 | Ajustar cooldowns, precisão e agressividade |
| Mais combos ou feedback visual de combo | 📋 | |
| Sons de knockdown ligados em todos os casos | 📋 | `playKnockdown()` existe mas pode estar incompleto |
| Melhorias de acessibilidade (remapear teclas?) | 💡 | |
| Screenshot/GIF no README | 📋 | Ajuda na página do GitHub |
| Testes automatizados (lógica de combate) | 💡 | Sem engine de teste hoje |

---

## v0.3 — Conteúdo e variedade

| Item | Status | Notas |
|------|--------|-------|
| Mais estilos de oponente ou “personalidade” de IA | 💡 | |
| Treino livre (sem timer) | 💡 | |
| Estatísticas persistentes (localStorage) | 💡 | |
| Samples de áudio reais (opcional) | 💡 | Manter interface do `AudioManager` |

---

## Fora de escopo (por enquanto)

- Multiplayer online
- Login / contas
- Backend ou ranking global
- Modelos 3D externos obrigatórios
- Monetização ou plugins pagos

---

## Como sugerir prioridades

1. Abra uma [feature request](https://github.com/DiegoSGbr/mEUoponenteForever/issues/new/choose)
2. Explique o benefício para quem joga
3. Se quiser implementar, mencione na issue antes de abrir a PR
