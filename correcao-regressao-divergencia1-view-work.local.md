# correcao-regressao · divergência 1 — `view` e `work` restaurados no primeiro uso

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Correção pedida pelo usuário depois do R13
(`9fb1c51`): divergência 1 da nota do R13. Branch `refactor/fase-2-extracoes`. 2026-10-22.

## O bug

Num reinício do processo sem `session.start` (respawn do hooks worker), `view` e `work` só voltavam
do store no `session.start`: a visão caía na padrão (`full` no desenho) e o próximo `plan` gravava
`work: ['N']` por cima do `['94', …, '98']` do store, perdendo o trabalho atual da visão resumida.
`groups` e os links já tinham o guarda do primeiro uso (H6.1, H3.2); `view`/`work` não.

## A correção

- **`task-tree/state/durability.ts`**: as linhas de `view` e `work` ganham `first-use` em
  `restoredAt` (com a nota do porquê). Só isso muda na tabela.
- **`task-tree/hooks/register.tsx`** (+58/−6): `ensureView($)` e `ensureWork($)`, no molde do
  `ensureGroups` (guarda em `loaded`, condicionado a `restoredAt(key, 'first-use')`; marcam a chave
  como carregada só quando o state de fato a recebe; devolvem o que trouxeram para quem não pode
  gravar o state). Chamados em `change()` (`ensureView` + `ensureWork`), `publishWait()` e
  `nothingOpen()` (`ensureWork`), e no `ui.render` (os dois; o desenho usa
  `heldView ?? viewBrought ?? 'full'` e `heldWork ?? workBrought ?? []`). `restoreView`/`restoreWork`
  (session.start) marcam `loaded`. Sem nada no store, nada é trazido: o painel fica nos padrões de
  antes.
- **`task-tree/tests/reinicio.test.ts`** (+1 teste, 9): "sem session.start: a visão e o trabalho
  atual voltam do store no primeiro uso; o plan seguinte soma ao trabalho em vez de sobrescrevê-lo":
  store com `view: 'summary'`; o primeiro desenho sai na visão resumida (`[≡]` marcado, menos linhas
  que a completa) antes de qualquer gravação; o `plan N` deixa o store com `94–98 + N` e a visão
  `summary`; o arquivo publicado leva o trabalho restaurado.
- **`task-tree/tests/durabilidade.test.ts`**: sem edição. Os testes C de `view` e `work` são
  guiados por `restoredAt` e passaram de "não volta" para "volta na primeira gravação" sozinhos.

## Observado no caminho (não mudado)

- O arquivo publicado pelo `plan` sai de dentro do `change()`, antes do `joinWork`: o `work` com o
  `N` só é publicado na próxima publicação. Comportamento de sempre; o teste novo confere o que o
  `plan` publica (o trabalho restaurado), não o `N`.
- Um `$.state.set` dentro do `ui.render` lança (é capturado): por isso os `ensure*` devolvem o valor
  e só marcam `loaded` fora do desenho, como o `ensureGroups`.

## Testes

- **261 pass / 0 fail** (8 arquivos; +1). `claude plugin validate task-tree` e `validate .` ok.
- Golden do SVG (0 `GOLDEN-NEW`), golden dos textos (0 `TEXTOS-NEW`), orçamento (11 657 / 11 775 /
  47 400 / 48 158), publicado, limite de linhas: iguais. Reinício/recarga: os 8 de antes iguais, mais
  o novo. Durabilidade: 59 iguais, com os C de `view`/`work` virando "volta" pela tabela.
- Saldo: `register.tsx` +63/−3; `durability.ts` 4 linhas; `reinicio.test.ts` +23.

## O que conferir no app

Com a visão resumida escolhida e um painel com trabalho em andamento, provocar um reinício do
hooks worker sem `session.start` (o `/model` ou um crash do worker, como nos casos do `01`) e ver:
o painel volta na visão resumida com as mesmas tarefas; um `plan` novo soma ao trabalho atual em vez
de deixar só ele na visão resumida.
