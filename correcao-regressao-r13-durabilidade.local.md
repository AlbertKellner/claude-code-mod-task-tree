# correcao-regressao · R13 — tabela de durabilidade (`task-tree/state/durability.ts`)

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Item 3 (último) da fase 2 do
`docs/analises/04-plano-de-aprofundamento.md` (R13 do `03`). Branch `refactor/fase-2-extracoes`,
sobre `758dbb7` (R16). 2026-10-22.

## O que entrou

- **`task-tree/state/durability.ts`** (novo, ~175 linhas). A tabela `TABLE`, uma linha por chave,
  com `lives` (state · state+store · store · module), `store` (prefixo da chave do store),
  `merge` (current · fill · union · replace · none), `keep`, `restoredAt` (start · resume ·
  first-use · first-save) e `note`. 14 linhas de `$.state`, 1 do store (`sessions`) e 16 de
  variáveis de módulo. Junto: `STATE_KEYS`, `STORES`, `LINK_KEYS`, `rowOf`, `stateOf`,
  `restoredAt(key, when)`, `storeKey(key, id)`, `KEEP`, o conjunto `loaded` (os guardas
  `groupsLoaded`/`linksLoaded` virados num só), `Link`/`linkOf`, `merge(key, cur, old)` (a fusão
  pela linha), `current(cur, old)`, `loadStore($, key, id?)`, `saveStore($, key, value)` e
  `saveGroups($, groups)` (o `session:` + a lista `sessions` com `KEEP`).
- **`task-tree/hooks/register.tsx`** (−75/+40): `persist` → `saveGroups`; `keptGroups` → `loadStore`;
  `ensureGroups` usa `loaded` e `restoredAt('groups','first-use')`; `session.start` marca
  `loaded.add('groups')`; `setView/restoreView`, `setWork/restoreWork` → `saveStore/loadStore` +
  `current`; `saveLinks` guarda por `loaded.has('links')` + `restoredAt('children','first-save')`;
  `restoreLinks` funde cada chave com `merge(...)` da tabela (o `join` local e o `cur.map` do
  `children` saíram); `KEEP`, `Link`, `linkOf`, `linksLoaded`, `groupsLoaded` saíram. As 14 consts
  `{ plugin, key }` **ficam literais** no register: o validador do kit exige a referência de estado
  escrita no próprio arquivo (um `stateOf('x')` importado é recusado: "takes a reference whose plugin
  and key are string literals … written there or in a const of this file"). Por isso a tabela não é
  a origem das consts; é o teste que garante que toda chave tem linha.
- **`task-tree/tests/durabilidade.test.ts`** (novo, 59 testes): 4 por chave do state × 14 (A planta
  pela API do mod e guarda state/store; B reinício com `session.start`; C reinício sem; D recarga a
  quente com o state semeado), 1 do `sessions`, 1 de sanidade da tabela (chave única, store só onde
  vive no store, fusão só onde há store, toda chave tem `PLANT`) e 1 de "chave nova sem linha": um
  cenário largo (start, prompts, plan/start/done, pergunta, Agent, sessões, envio, erro do host,
  visão, dobra, wrap_up, fim de turno, resume, desenho) grava toda chave do state e todo prefixo do
  store tocados; falha se algum não tem linha, e se alguma linha não é tocada.
  `engine` e `ended` são plantados por semeadura (não há API de teste para `turn.step`; `ended` é
  consumido pela mesma chamada que o grava) e `tasks` (legado) idem; os três são conferidos em B, C
  e D.

## A tabela (resumo)

| chave | vive | store | fusão | volta em |
|---|---|---|---|---|
| groups | state+store | session | current (resume: replace) | start, resume, first-use |
| tasks (legado) | state | — | none (adopt move para groups) | — |
| view | state+store | view | current | start |
| work | state+store | work | current | start |
| children | state+store | links | fill | start, first-save |
| sends | state+store | links | union | start, first-save |
| received | state+store | links | union (20) | start, first-save |
| launches | state+store | links | union (20) | start, first-save |
| waits, engine, ended, childrenError, brief, collapsed | state | — | none | — |
| sessions | store | sessions | — | — |
| loaded, keptLinks, lastRecap, ownId, refreshedAt, drawNow, drawSize, drawRows, renderError, actions, ticker, poller, engineSeen, breaksMemo, unplanned/planned/answeredInChat | module | — | — | — |

## Divergências registradas (a tabela tornaria diferente; NÃO mudei)

1. **`view` e `work` só voltam no `session.start`.** Num reinício sem `session.start` (respawn do
   worker), a visão fica a padrão e o trabalho atual recomeça vazio: o próximo `plan` grava
   `work: ['B']` por cima do `['A', …]` do store (teste C de `work` prova: não volta). `groups` e os
   links têm `first-use`/`first-save`; dar o mesmo a `view`/`work` é trocar `restoredAt` na linha e
   chamar `restoreView`/`restoreWork` em `ensureGroups`. Era o que a minha nota do R20 sugeria; fica
   para o usuário decidir.
2. **`lastRecap` é variável de módulo.** Uma recarga entre o `wrap_up` e o fim do turno perde o
   recap; o ↩ usa a mensagem final. O `brief` já foi para o state (bug 3); o `lastRecap` poderia ir
   do mesmo jeito. Linha `module` na tabela, não mudado.
3. **`groups` no resume substitui, no start prefere o state.** `classic.SessionStart` com `resume`
   chama `restore` sem olhar o state; `session.start` só restaura com state vazio. Comportamento de
   sempre, agora dito na linha.
4. **`sends` sem teto na fusão; `received`/`launches` com 20.** Como antes.
5. **Um `Agent` só chega ao store na próxima publicação.** O `tool.call` genérico grava o lançamento
   no state; o store (`links`) só o recebe no próximo `saveLinks` (qualquer `publishWait`). Uma
   recarga/reinício entre o `Agent` e a próxima publicação perde o lançamento no store (o state o
   mantém na recarga). O teste A de `launches` planta com um `plan` depois do `Agent` por isso.
6. **A visão vai ao store só no clique.** `setView` grava state+store; nenhuma outra gravação a leva
   ao store (o teste D de `view` não exige). Coerente com a tabela; registrado para completar.
7. **O `ended` não é consumido pelas tools do painel.** `plan`/`start`/`done` respondem sem passar
   pelo `tool.call` genérico; o lembrete "terminou o turno" sai na próxima chamada comum (`Read`…) ou
   no `prompt.submit`. Como antes; o teste D de `ended` mostra.

## Achado sobre o orçamento (`orcamento.test.ts`)

O `size` varia 14–16 bytes entre processos sem nenhuma mudança no desenho: o JSON desenhado traz
`press.handle` dos botões, inteiros que o kit sorteia por processo (ex.: `885836960` vs `65134610`),
e o comprimento muda com os dígitos. Comparei o desenho do `HEAD` e o desta árvore com os handles
zerados: **idênticos** (11 663 = 11 663). Logo a "diferença de 14–16 bytes" relatada no R14 era esse
ruído, não o R20. Sugestão (item de testes, não deste): o orçamento medir o JSON com os handles
normalizados.

## Testes

- **260 pass / 0 fail** (8 arquivos; +59). `claude plugin validate task-tree` e `validate .` ok.
- Reinício/recarga (`reinicio.test.ts`), arquivo publicado, golden do SVG (0 `GOLDEN-NEW`), golden
  dos textos (0 `TEXTOS-NEW`) e orçamento: iguais e passando. Orçamento 11 657 / 11 775 / 47 400 /
  48 158 (a variação entre execuções é o ruído dos handles, acima).
- O desenho do caso real no `HEAD` (`758dbb7`) e nesta árvore, com os handles zerados: idêntico.
- Saldo: `register.tsx` −61/+44; `durability.ts` 167 linhas; `durabilidade.test.ts` 280 linhas.
- Pergunta 2 do `04` (armadilha do `$` em arquivo importado): **não há armadilha para funções**:
  `loadStore($, …)`, `saveStore($, …)`, `saveGroups($, …)` em `state/durability.ts` passam no
  validador. O que ele exige é que a **referência de estado** (`{ plugin, key }`) seja literal no
  arquivo que chama `$.state.get/set`.

## O que conferir no app

Nada muda. Se quiser olhar o que a tabela protege: salvar um arquivo do mod no meio de um turno (a
recarga) e ver o painel inteiro e os cartões no lugar; ou, com a sessão retomada, ver o painel
voltar.

## Fase 2

Concluída com este item (R14 geometria, R16 textos, R13 durabilidade). Pendências que ficaram
registradas, para o usuário: as divergências 1 e 2 acima; o teto `BASELINE` do orçamento
(normalizar handles); LICENSE/ícone do validador (governança).
