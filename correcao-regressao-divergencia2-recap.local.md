# correcao-regressao · divergência 2 — `lastRecap` no `$.state`

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Última correção desta leva, pedida pelo
usuário depois do R13: divergência 2 da nota do R13. Branch `refactor/fase-2-extracoes`, sobre
`fba6171` (divergência 1), PR #7. 2026-10-22.

## O bug

O recap do `wrap_up` (a resposta do turno que o cartão da sessão mostra sob as tarefas do turno) era
uma variável de módulo (`lastRecap`). Uma recarga do mod entre o `wrap_up` e o `turn.complete`
(salvar um arquivo do mod nesse intervalo) perdia o recap, e o cartão mostrava a mensagem final em
seu lugar. O `brief` (summary do `done`) já tinha sido levado ao state pelo mesmo motivo (bug 3).

## A correção

- **`task-tree/types/index.d.ts`**: `recap: string` em `PluginState['task-tree']` (o validador lista
  as chaves de estado a partir daqui), com o comentário.
- **`task-tree/state/durability.ts`**: a linha `lastRecap` (module) sai; entra `recap` (state,
  merge none, restoredAt []): sobrevive à recarga, morre com o processo, como o `brief`.
- **`task-tree/hooks/register.tsx`** (+13/−5): `recapState` literal (limite do kit);
  `lastRecap($)` passa a ser função que lê o state ('' = nenhum), como `lastBrief($)`; o `wrap_up`
  grava `$.state.set(recapState, input.recap)`; o `turn.complete` lê, usa `recap ?? e.answer` como
  antes e zera com `''`. A ordem das operações no `turn.complete` é a mesma.
- **`task-tree/tests/reinicio.test.ts`** (+2 testes, 11): "recap antes da recarga, 1/2 e 2/2": o
  primeiro módulo faz prompt, plan, done e `wrap_up` com recap; o segundo (módulo novo, state
  semeado) termina o turno com uma mensagem final diferente e o cartão (`turn.reply`) traz o recap;
  o state fica `''` depois.
- **`task-tree/tests/durabilidade.test.ts`**: `PLANT` de `recap` (wrap_up com recap). Com isso a
  linha nova ganha os 4 testes (A/B/C/D) do laço, e o teste de "chave sem linha" passa a exigir a
  linha (sem ela, a chave `recap` tocada falharia).

## Testes

- **267 pass / 0 fail** (8 arquivos; +6: 2 no reinício, 4 na durabilidade pela linha nova).
  `claude plugin validate task-tree` (declara as 15 chaves, com `recap`) e `validate .` ok.
- Golden do SVG (0 `GOLDEN-NEW`), golden dos textos (0 `TEXTOS-NEW`), orçamento (11 657 / 11 775 /
  47 400 / 48 158), publicado, limite de linhas: iguais.
- Saldo: `register.tsx` +13/−5; `durability.ts` 1 linha trocada; `index.d.ts` +3/−1;
  `reinicio.test.ts` +24; `durabilidade.test.ts` +1.

## O que conferir no app

Numa sessão filha: chamar `wrap_up` com recap, salvar um arquivo do mod antes de encerrar o turno
(recarga) e, na sessão que a abriu, ver o cartão da filha mostrar o recap sob as tarefas do turno,
não a mensagem final.

## Leva de correções

Concluída: divergência 1 (`fba6171`) e divergência 2 (este item). Ficam registradas na nota do R13
as divergências 3 a 7, o ruído dos handles no orçamento e LICENSE/ícone do validador.
