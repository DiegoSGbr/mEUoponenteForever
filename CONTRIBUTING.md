# Como contribuir

Obrigado por considerar contribuir com o **mEU_Oponente_Forever**! Este projeto está em **beta pública** — toda ajuda conta.

## Antes de começar

1. Leia o [README.md](README.md) para entender o jogo e os controles.
2. Para contexto técnico profundo (arquitetura, convenções, pontos de integração), leia [AGENT.md](AGENT.md).
3. Veja o [ROADMAP.md](ROADMAP.md) para prioridades e ideias já mapeadas.

## Reportar bugs ou sugerir features

Use os templates em [Issues](https://github.com/DiegoSGbr/mEUoponenteForever/issues):

- **Bug report** — descreva passos para reproduzir, navegador e o que esperava vs. o que aconteceu.
- **Feature request** — explique o problema que a feature resolve e, se possível, como testar.

Para dúvidas gerais ou discussão, abra uma issue com o rótulo adequado ou comente em uma issue existente.

## Configurar o ambiente

```bash
git clone https://github.com/DiegoSGbr/mEUoponenteForever.git
cd mEUoponenteForever
npm install
npm run dev
```

Confirme que o build passa antes de abrir o PR:

```bash
npm run build
```

## Fluxo de contribuição

1. **Fork** do repositório
2. Crie uma **branch** a partir de `main`:
   - `fix/descricao-curta` — correções
   - `feat/descricao-curta` — novas funcionalidades
   - `docs/descricao-curta` — só documentação
3. Faça commits **pequenos e descritivos** (em português ou inglês, mas consistentes na PR)
4. Teste manualmente no navegador (menu, tutorial, luta, pausa, resultado)
5. Abra um **Pull Request** para `main` e preencha o template

## Diretrizes de código

- **Mantenha o escopo focado** — uma PR por assunto (bug, feature ou refactor)
- **Siga o estilo existente** — TypeScript, módulos ES, nomes em inglês no código, UI em português
- **Sem over-engineering** — prefira mudanças mínimas e claras
- **Sem dependências pesadas** sem discussão prévia em issue
- **Sem multiplayer, login ou backend** no escopo atual (ver restrições em AGENT.md)
- Comentários só quando a lógica não for óbvia

### Áreas sensíveis (leia AGENT.md antes de alterar)

| Área | Arquivos principais |
|------|---------------------|
| Eixo da câmera / spawn | `FirstPersonRig.ts`, `RingScene.ts`, `OpponentAI.ts` |
| Combate e dano | `HitResolver.ts`, `CombatManager.ts`, `PunchType.ts` |
| Input e fluxo da partida | `Game.ts`, `StateMachine.ts` |
| Áudio procedural | `AudioManager.ts` |

## Testar sua mudança

Checklist mínimo:

- [ ] `npm run dev` — sem erros no console ao jogar uma partida
- [ ] `npm run build` — compila sem erros
- [ ] Tutorial ainda funciona (se tocou em input ou UI)
- [ ] Controles de soco/guarda/esquiva respondem como esperado

## Atualizar documentação

Se sua mudança altera comportamento visível ao jogador, atualize:

- [README.md](README.md) — controles, mecânicas, limitações
- [CHANGELOG.md](CHANGELOG.md) — entrada na seção `[Unreleased]` ou nova versão
- [AGENT.md](AGENT.md) — convenções técnicas ou tabela de correções, se relevante

## Código de conduta

Este projeto segue o [Contributor Covenant](CODE_OF_CONDUCT.md). Seja respeitoso nas issues e PRs.

## Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob a [MIT License](LICENSE).
