# correcao-regressao · R12 — `layout()` puro em `task-tree/draw/layout.ts`

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Etapa 1 da fase 3 do
`docs/analises/04-plano-de-aprofundamento.md` (R12 do `03`). Branch `refactor/fase-3-layout`,
sobre `0e16ee3` (merge da fase 2). 2026-10-22.

## O que entrou

- **`task-tree/draw/layout.ts`** (novo, 867 linhas, 52 exports; sem `$`, sem `await`, sem kit).
  - `layout(model: Model, choices: Choices, now, ownId): Row[]`, função de topo e pura (a menos de
    `drawNow` e `breaksMemo`, deixados como estão de propósito: etapa 2). `Model = { groups, waits,
    children, sends (só as não tomadas), view, work }`; `Choices = Record<string, boolean>` (o atom
    `folds`). Por dentro, o corpo do antigo `ui.render` **sem uma letra mudada** na lógica: `sendsAt`
    local, `notice`, `fl`/`opened`, `rows`, `turnRows`, `session`, `panel`, a chamada
    `panel(all, …)` sem escolhas seguida de `fl = chosen`, `cut`, e o `limitRows(panel(summary ?
    cut() : all, …))` como retorno. `drawNow = now` é feito dentro do `layout()`, no mesmo ponto em
    que o render fazia.
  - Com ela, os auxiliares puros de modelo que ela precisa e o register também usa (não há import
    circular: `layout.ts` só importa `../types`): `MAIN`, `flat`, `tasksOf`, `hasOpen`, `withMain`,
    `stop`, `interrupt`, `timing`, `span`, `elapsed`, `count`, `DEEP`, `live`, `panelOf`, `Break`,
    `unsent`, `breaksMemo`, `breaks`, `begins`, `inOrder`, `WAIT_ORIGIN`, `drawNow`, `split`,
    `total`, `Ring`, `ringOf`, `Work`, `idle`, `allTasks`, `atWork`, `resting`, `stillSpan`,
    `timeOf`, `timeSpan`, `activeLeaves`, `sessionTime`, `firstOpen`, `pathTo`, `current`,
    `waitText`, `SHOWN_TURNS`, `SHOWN_CARD_TURNS`, `MAX_ROWS`, `limitRows`, `trimToWork`, `running`,
    `Tone`, `Row`, `REPLY`. Movidos por corte de linhas (script descartável), só com `export` na
    frente: o texto de cada função é o de antes.
- **`task-tree/hooks/register.tsx`** (−819/+7; 2 342 linhas, era 3 154): importa 17 valores e 2
  tipos de `../draw/layout`; o `ui.render` lê o estado (groups/view/work com os `ensure*`, waits,
  children, childrenError, sends, folds, `stamp`), monta o `Model` e chama `layout(...)`; o resto do
  render (cabeçalho, chips, `guides`, `frames`, SVG, JSX, orçamento) continua igual, sobre `lines`.
  Fica no register tudo que toca `$`, o desenho (SVG/JSX, `guides`, `labelCols`, `frames`,
  `chips`) e os auxiliares das tools (`build`, `resolve`, `sendAnchor`, `openList`, `said`…).
  O limite do kit foi respeitado: nenhuma chamada a `$.state` saiu do register.

## Ordem de leitura do estado no render

Mudou só a posição de duas leituras sem efeito: `view` e `work` eram lidos entre o `panel(all)` sem
escolhas e o `cut()`; agora são lidos antes do `layout()`. São `state.get` (sem efeito colateral),
e `panel(all)` não os usa. `ad/an` (`total`) e `now` continuam onde estavam. `sentTo` (função local
nunca usada) deixou de existir.

## Resíduos vistos no caminho (não mexi)

- `panel(all, 0, 0, '', ownId)` roda uma vez **sem escolhas** com o resultado descartado (o
  comentário fala de "chips contam o que é desenhado por padrão", mas o retorno não é usado), e
  depois com as escolhas. Mantido dentro do `layout()` para o comportamento ser idêntico (inclusive
  o aquecimento do `breaksMemo`); candidato a sair na etapa 2 ou 3, com teste.
- `elapsed` (em `layout.ts` agora) não é usado por ninguém.

## Testes

- **267 pass / 0 fail** (8 arquivos, os mesmos 267), duas vezes: depois do corte e depois de tirar
  do import dois nomes que só apareciam em comentários (`breaks`, `split`).
- `claude plugin validate task-tree` e `validate .` ok (o módulo importado não chama `$`).
- Golden do SVG (0 `GOLDEN-NEW`), golden dos textos (0 `TEXTOS-NEW`), orçamento (11 657 / 11 775 /
  47 400 / 48 158), reinício/recarga, publicado, durabilidade, limite de linhas: iguais.

## O que conferir no app

Nada muda: o desenho é o mesmo (golden do SVG byte a byte, orçamento igual). Se quiser olhar, um
cartão de sessão com rodadas (split) e a visão resumida.

## Fase 3, próximo

Etapa 2: `sendsAt`, `drawNow`, `breaksMemo` como parâmetros/campos do `layout()`; etapa 3: testes
de layout diretos (sem `mount`), com o fixture real; etapa 4: `drawDesktop`/`drawTerminal`.
