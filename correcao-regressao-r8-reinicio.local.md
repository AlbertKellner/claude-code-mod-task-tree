# correcao-regressao · R8 — testes de recarga e reinício

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Item 3 da fase 1 do
`docs/analises/04-plano-de-aprofundamento.md`. 2026-10-22.

## O que entrou

- `task-tree/tests/reinicio.test.ts` — 8 testes, com o fixture do R6. Nenhum arquivo alterado.

### Como o kit simula cada caso

- **Reinício do processo** (crash do hooks worker, `/model`): cada teste do kit é um módulo novo com
  `$.state` vazio; o store passa entre testes por um objeto compartilhado do arquivo (`SHARED`). Com
  ou sem `session.start`, conforme o teste chama `$.session.start` ou não.
- **Recarga a quente** (state mantido, módulo novo, sem `session.start`): o teste segura o
  `$.state`. `seedState(on, state)` põe hooks `state.get`/`state.set` abaixo do kit: espelha toda
  escrita em `state` e responde uma leitura para a qual o kit não tem nada com o que `state` guarda
  (até o módulo escrever aquela chave). As versões continuam sendo as do kit (sem isso o `update()`
  acusa "written by another every time it was read"). Assim o teste "com session.start 1/2" entrega
  ao teste de recarga o state exato que o módulo montou (`HOTSTATE`), e um par de testes compartilha
  um state (`HOT`) para o caso do `summary`.
- **Falha conhecida** (`known(nome, ok, detalhe)` + `KNOWN`): o kit não tem skip/todo. Um cenário que
  revela bug entra em `KNOWN` com o motivo; o teste imprime `TODO …` e passa; quando o bug for
  corrigido, falha pedindo para tirá-lo da lista.

### Testes e resultado

| Teste | Resultado |
|---|---|
| Reinício com `session.start` 1/2: painel volta do store; cartões sob as tarefas de origem (caso C), ↩ voltam, links inteiros | passa |
| Reinício com `session.start` 2/2: outro processo, mesmo store: desenha igual; `start`/`done` achem as tarefas e gravam os 97 níveis 1 de volta (caso F) | passa |
| Reinício **sem** `session.start`: `start` na tarefa do store e o store não encolhe | **BUG H6.1 confirmado** (KNOWN `reinicio-sem-session-start`): `"98" não existe`; `session:<id>` no store **97 → 0 tarefas** |
| Reinício sem `session.start`: primeira gravação dos links traz os antigos (guarda `linksLoaded`) | passa |
| Reinício sem `session.start`, lista do host parcial (H3.2) | **BUG confirmado** (KNOWN `links-lista-parcial`): `codigo-task-tree` (20 rodadas) some do store; ficam só as listadas pelo host + a nova. Responde a pergunta 5 do `04`: sim, perde |
| Recarga a quente: painel desenha igual ao de antes; `start`/`done` gravam o painel inteiro no store | passa |
| `summary` antes da recarga 1/2: `done` com summary (variável do módulo) | passa |
| `summary` antes da recarga 2/2: `turn.complete` no módulo novo | **confirmado** (KNOWN `recarga-perde-summary`): `brief` undefined; ↩ fica com a mensagem final (`reply`) |

Só o arquivo: 8 pass / 0 fail (2,6 s). Suíte inteira e validação: ver relato.

## Bugs para itens próprios (não corrigidos aqui)

1. **H6.1 — reinício sem `session.start` zera o painel no store.** `change()` parte de `cur ?? []`
   e `persist()` sobrescreve `session:<id>`. Perda definitiva de todo o histórico da sessão na
   primeira escrita. Correção proposta (R13): guarda em `change()` igual ao `linksLoaded` de
   `saveLinks` (restaurar do store antes da primeira escrita do módulo se o state está vazio), ou
   `restore()` no primeiro hook de qualquer tipo. Depende da pergunta 11 do `04` (o respawn roda
   `session.start`?); se rodar, o bug não acontece na prática, mas o guarda continua barato.
2. **H3.2 — lista parcial do host apaga links do store.** `restoreLinks` faz `cur.map(...)` quando
   `cur` não é vazio: filhas ausentes de `cur` não voltam, e `saveLinks` grava sem elas. Correção:
   unir as entradas antigas que não estão em `cur` (como já faz para `sends`/`received`), ou nunca
   gravar um `links:` com menos filhas do que o salvo.
3. **`lastBrief`/`lastRecap` morrem na recarga.** Um `done` com `summary` seguido de recarga (salvar
   um arquivo do mod no meio do turno) deixa o turno sem ↩ com o resumo. Correção (R13): guardar no
   `$.state` (ex.: chave `brief`), lido em `turn.complete`.

## Limites (R10)

- O kit não simula o respawn real do worker: não sabemos se ele roda `session.start` (pergunta 11).
  Os dois caminhos estão testados; o que vale na prática depende dessa resposta.
- `actions` (clique entre a recarga e o primeiro desenho) e timers não têm teste: o `ui.press` do kit
  sempre desenha antes de clicar.
- A recarga a quente é simulada com o state que o módulo montou num reinício com `session.start`;
  o state de uma sessão longa tem mais chaves (`ended`, `engine`, `childrenError`), não cobertas.
