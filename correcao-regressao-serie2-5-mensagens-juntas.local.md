# correcao-regressao · série 2, item 5 (bug C): um cartão só para várias mensagens, no pedido errado

Branch `fix/painel-serie-2`, sobre `c5567e4`. 2026-10-23. TDD.

## Estado real (orquestradora → correcao-regressao)
Rodadas: c1 (…148015), f1 (…338639), r1 (…409978), e1 (…465511), o1 (…531313), k1 (…600786). Turnos da sessão:
74 em …332001 (depois de c1), 75 em …673877 (depois de todas). `received` da sessão: 4 mensagens da
orquestradora em …673831 — entregues juntas no turno 75. Antes: turno 74 sob c1, turno 75 sob k1 (a última
rodada antes dele); f1, r1, e1, o1 sem cartão. Esperado pelo usuário: o cartão sob a primeira (f1).
(A parte "fora do lugar, no fim" do bug C já foi resolvida pelo commit 3.)

## Correção (task-tree/draw/layout.ts, split → partOfTurn)
Turnos em ordem de tempo; um turno com recebimento de `me` entre o turno anterior e ele vai para a rodada
da primeira mensagem de `me` enviada desde o turno anterior; os outros, para a última rodada antes dele.
Depois, no estado real: turno 75 sob f1.

## TDD
`task-tree/tests/cartoes-lugar.test.ts` +2. Vermelho antes (c5567e4: 348 pass, 1 fail):
"quatro mensagens na fila entregues juntas: o cartão do turno vai para a tarefa da primeira":
`Expected: "⑂ filha"`, `Received: "Mensagem de r1"` (f1 sem cartão; o turno foi para o1). Log:
`correcao-regressao-retomada/vermelho-c.log`. Controle "uma mensagem por turno…" passa antes e depois.

## Testes
349 pass / 0 fail em 2 rodadas; validate ok; 0 GOLDEN-NEW / TEXTOS-NEW; orçamento na baseline (rodada 1
com −14 bytes, o artefato do relógio do teste).

## Pista para o bug B (cabeçalho)
No estado real, a parte 8 do cartão está ancorada em `103` "Abrir a sessão de correção (Fable, esforço médio
…)" — a mesma tarefa antiga que o cabeçalho mostrou no print do bug B.

## Commit sugerido
Arquivos: `task-tree/draw/layout.ts`, `task-tree/tests/cartoes-lugar.test.ts` + patch da docs.
Mensagem: `fix(task-tree): mensagens entregues juntas: o cartão do turno vai para a tarefa da primeira`
