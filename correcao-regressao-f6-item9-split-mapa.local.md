# correcao-regressao · fase 6, parte A, item 9 — split com mapa turno → parte

Sessão `correcao-regressao`. Branch `perf/fase-6-desempenho`, sobre `dacbd18` (item 8). 2026-10-22.

## O que mudou

`task-tree/draw/layout.ts`, `split()`, só o miolo (a função densa: `turnPart`, `tasksIn`, `holder`,
`ownerOf`), com o mesmo resultado:
- `partOfTurn`: a parte (rodada) de cada turno, calculada uma vez por turno (`roundOf`), em vez de
  `turns.find` + `roundOf` por tarefa, por parte e por âncora;
- `tasksByPart`: as tarefas de nível 1 de cada parte, na ordem da lista, uma vez; `parts` são as suas
  chaves ordenadas (antes, `includes` + `push` + `sort`); `flatIn`: o `flat` de cada parte, uma vez;
- `partOfTask`: tarefa → primeira parte (em ordem de parte) que a contém, para o `holder` (antes,
  `parts.find` com `flat(tasksIn(k)).some(...)` por âncora);
- `ownerOf` lembrado por agente (o `current(main.tasks)` do grupo principal era refeito por grupo e
  por espera de cada parte);
- nos cartões: `turns.filter` por `Set` dos turnos das tarefas e `work.filter` por `Set` dos ids.

`task-tree/tests/layout.test.ts` (fixado ANTES da mudança, 325 pass com o `split` antigo): describe
"split: os cartões de uma filha funda, fixados", 2 testes com uma filha sintética de 6 pedidos e 3
rodadas (entre os pedidos 2|3, 4|5 e 5|6), uma espera, um grupo de subagente pendurado na tarefa T2 e
uma neta pendurada na T4, mãe com "Orquestrar" (Abrir concluída, Conferir em andamento): (1) os 4
cartões com parte, âncora, lastAnchor, running, waiting, anel, tarefas, turnos, grupos, esperas, neta
e trabalho, fixados em JSON (o subagente vai ao cartão 0, a neta ao 1, a espera ao cartão em
andamento); (2) as linhas das duas visões (35 e 27 linhas), fixadas.

## Medidas (bancada `run6.sh`, camada pura, `split()` direto com memo novo, mediana, ms)

| Filha sintética (pedidos / rodadas) | Antes | Depois | Meta |
|---|---|---|---|
| 500 / 20 (21 cartões) | 18,2 | 1,1 | ≤ 2 ✓ |
| 500 / 5 | 6,3 | 0,9 | |
| 500 / 1 | 2,7 | 0,8 | |
| 200 / 20 | 6,8 | 0,4 | ≲ 1 ✓ |
| 200 / 5 | 3,5 | 0,3 | |
| 70 / 20 | 1,5 | 0,2 | |

Filhas reais (5, por filha): 0,2–0,7 → 0,2–0,5 ms; do que fica, 0,2–0,3 é o `breaks` (fora deste
item). Meta "REAL por filha ≤ 0,3": 4 de 5 em ≤ 0,3, uma em 0,5 (51 pedidos, 50 `breaks`).
`same: true` em 56/56 comparações de linhas; goldens `filha-*` e `real-*` iguais. Nenhuma âncora do
`patch6.mjs` precisou mudar.

## Testes

- **325 pass / 0 fail** em 2 rodadas com o código final (323 + 2 novos; os 2 novos também passaram
  com o código antigo); `validate task-tree` ok.
- 0 `GOLDEN-NEW`, 0 `TEXTOS-NEW`; orçamento 11657 / 11775 / 47400 / 48162 nas 2 rodadas.

## Commit sugerido

Arquivos: `task-tree/draw/layout.ts`, `task-tree/tests/layout.test.ts`.
Mensagem: `perf(task-tree): split acha a parte de cada turno e tarefa por mapas, mesmos cartões`

## Bugs encontrados

Nenhum.
