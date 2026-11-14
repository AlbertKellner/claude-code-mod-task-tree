# correcao-regressao · fase 4, etapa 3 — um arquivo por hook

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Branch `refactor/fase-4-io-e-eventos`, sobre
`7b1a3e5` (etapa 2). 2026-10-22. Fluxo da fase 4: sinal à documentação sem esperar o ok. O turno foi
interrompido uma vez por engano do usuário e retomado do ponto em que estava (a divisão escrita e
validada; faltava a suite).

## O que mudou

`task-tree/hooks/register.tsx` (2 116 → 31 linhas) só registra os 14 hooks, cada um pelo nome de uma
função importada do seu arquivo; o matcher do `ui.render` usa o literal `'task-tree'`. O código foi
fatiado por âncoras do texto original (script), sem reescrita, salvo onde dito abaixo.

Arquivos novos em `task-tree/hooks/`:

| arquivo | linhas | o que tem |
|---|---|---|
| `panel.ts` | 490 | o estado do painel: chaves literais (só deste arquivo), `lastBrief/lastRecap`, `reminders` (antes `unplanned/planned/answeredInChat`, closures do register), `stamp`, `migrate`, `openTurn`, `sendAnchor`, `openList`, `identify`, `ensureGroup`, `showStatus`, `persist`, `adopt`, `change`, `replace`, `keptGroups`, `restore`, `ensureGroups/View/Work`, `inDesktopApp`, `selfId` + `knownId()`, `publishPanel`, `DRAW_LIMIT`, `drawn` (antes `drawSize/drawRows/renderError`), `actions/act`, `showPane`, `addWait/dropWaits/dropAsked`, `setView/restoreView`, `nothingOpen/startsWork/setWork/joinWork`, `keptLinks/keptLink/saveLinks/restoreLinks/restoreWork` |
| `sessions.ts` | 233 | `refreshChildren` (composição dos passos de `io/host.ts`), `noteReceived`, `watchSends`, `takenNote`, `refreshStale`, `recordStart`, `endedNote`, `ticker/POLL/poller/watchSessions/anyRunning/tick/keepTime`, `openSession` |
| `session-start.ts` | 80 | `sessionStart` (session.start), `classicSessionStart` (classic.SessionStart) |
| `prompt-submit.ts` | 98 | `NO_TURN`, **`said` (classificação, pura, exportada)**, `promptSubmit` (efeitos), `promptCompose` |
| `command.ts` | 34 | `commandRun` (/task-tree) |
| `tools.ts` | 208 | esquemas `node/level`, `planTool`, `doneTool`, `startTool` |
| `permission.ts` | 22 | `permissionRequest` |
| `turn.ts` | 87 | `brief` (exportada), `turnStep`, `turnComplete` |
| `tool-call.ts` | 211 | o `tool.call` genérico em **handlers por responsabilidade** (R17): antes da chamada `launch` (Agent/Task), `asked` (pergunta/plano: toma a chamada inteira, recusa sem tarefa aberta, espera, lembrete da resposta), `wrapUpAsk` (recap e pergunta do wrap_up); depois, só no laço principal, `sentMessage`, `sessionNotes` (ended, taken), `wrapUpOpen` (chamados pelo nome, na ordem: o validador recusa `$` passado a uma variável de laço) e `reminder` (o lembrete de planejar). Mesma ordem e mesmos efeitos do código original; `Call = { agent, e, sentAt, r }` é o que os handlers compartilham |
| `render.tsx` | 332 | `folds` + `setFold` (vieram do register: o `read($, folds)` exige o atom no mesmo arquivo), `pressOf`, `drawDesktop`, `drawTerminal`, `press` (ui.press), `render` (ui.render) |

Fora de `hooks/`:
- **`task-tree/draw/svg.ts`** (420, novo): os construtores puros de SVG e glifos do terminal
  (`GLYPH`, `prefix`, `ratioBar`, `plural`, `percent`, `clockText`, `slim`, `xml`, `textW`, `fit`,
  `contextRing`, `ringTerm`, `branch`, `progress`, `icon`, `labelName`, `labelSvg`, `RING_LABEL`,
  `rowHeight`, `cardSlice`, `rowSvg`, `chips`, `headerSvg`, `rowAlt`, `rightText`).
- **`task-tree/state/tasks.ts`** (107, novo): as edições puras da árvore (`InNode`, `build`,
  `duplicates`, `resolve`, `edit`, `finish`, `fillStarts`, `fill`, `settle`, `begin`).
- **`task-tree/tests/hooks-puros.test.ts`** (novo, 9 testes): `said` (pedido, mensagem de outra
  sessão, hand-back, aviso do app), `brief` (corte em BRIEF), e as edições da árvore (`build`,
  `duplicates`, `resolve` com ambiguidade e aberta-antes-de-fechada, `begin`/`finish`/`settle`,
  `fillStarts`).

## O limite do kit, confirmado no validate (três experimentos antes da divisão)

1. `on('x', hookOf())` (hook vindo de uma chamada): **recusado** ("the hook is not a function
   literal or the name of one").
2. `on('x', nome)` com `nome` importado de outro arquivo, e `$.state.get/set` com const literal
   **nesse** arquivo: **aceito**; o validate lista as chamadas "via" as funções dos outros arquivos
   e os mesmos 15 reads/writes de estado.
3. Chave de estado importada de outro arquivo (ou exportada): **recusada** ("written there or in a
   const of this file"; "the const … is also … exported here"). Por isso cada arquivo de hook
   declara as chaves que usa (7 arquivos; `panel.ts` não as exporta), e `folds` foi para o render.
4. `$` passado a uma variável de laço (`for (const add of NOTES) await add($, …)`): **recusado**; os
   handlers de notas são chamados pelo nome.

Checagem extra, fora do kit: `tsc --noEmit` (typescript 5.6.3 via npx, tsconfig do kit) dá 194
erros contra 193 no HEAD, todos de tipo já existentes (testes com `any`, `Argument of type`…);
nenhum "cannot find name" ou "used before declaration" (houve um, `request` local do `plan`
colidindo com o objeto novo, corrigido renomeando o objeto para `reminders`).

## Comportamento

Idêntico: mesmos 14 hooks, mesma ordem de registro, mesmas chamadas do engine e mesmos
reads/writes de estado segundo o validate; goldens, orçamento, reinício e todos os testes iguais.
Diferenças de forma, sem efeito: `$` dos hooks tipado `EngineInterface`; `unplanned/planned/
answeredInChat` viraram campos de `reminders` (módulo, como eram closures do módulo);
`drawSize/drawRows/renderError` viraram `drawn.size/rows/error`; `ownId` lido pelo render via
`knownId()`.

## Testes

- **316 pass / 0 fail** (307 + 9), em 3 rodadas seguidas depois da última alteração (mais 2 antes
  dela, verdes). `validate task-tree` e `validate .` ok (o validate passou a anotar
  "gating hook without .catch: command.run", informativo, por o hook ser agora uma função nomeada).
- Golden do SVG (0 `GOLDEN-NEW`), golden dos textos (0 `TEXTOS-NEW`), orçamento (11657 / 11775 /
  47400 / 48162) iguais.

## Registrado, fora do item

- A tabela de durabilidade tem linhas `drawSize`, `drawRows`, `renderError`, `unplanned, planned,
  answeredInChat` e `ownId` como variáveis do módulo: continuam variáveis de módulo (`drawn`,
  `reminders`, `ownId` em `panel.ts`); os nomes nas notas da tabela são da documentação.
- O `02` previa `selfId`, `watchSends`, `inDesktopApp`, `openSession`, `showPane` em `io/host.ts`:
  ficaram em `hooks/panel.ts` e `hooks/sessions.ts` (usam estado ou são efeitos do painel).
- Fila de bugs: **vazia**. Nenhum bug encontrado nesta etapa.

## O que conferir no app

Nada visível muda. Vale conferir que o painel abre, os botões (recolher, abrir sessão, visão)
respondem e o `/task-tree` responde como antes, já que todo hook mudou de arquivo.
