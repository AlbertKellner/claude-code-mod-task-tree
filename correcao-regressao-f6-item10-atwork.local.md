# correcao-regressao · fase 6, parte A, item 10 — atWork uma vez por nível 1 e passada

Sessão `correcao-regressao`. Branch `perf/fase-6-desempenho`, sobre `684ba40` (item 9). 2026-10-22.

## O que mudou

`task-tree/draw/layout.ts`, em `panel()`: o `work(t)` do grupo principal (`atWork(t, sessions, level)`)
passa por um `WeakMap<TaskNode, Work>` criado por passada: `turnRows` soma o trabalho das tarefas de
nível 1 do pedido (`list.map(work)`) e `rows` pede o mesmo trabalho de novo por linha; dentro de uma
passada a resposta é a mesma (mesma tarefa, mesmas sessões), então é lembrada por objeto de tarefa.
A assinatura de `rows`/`turnRows` não mudou (a alternativa do relatório, passar os `ws`, foi evitada).
Subtarefas também ficam lembradas (uma chamada cada). Mesmo resultado.

Sem teste novo (o relatório não pede): protegem `layout.test.ts` (inclusive os cartões fixados no item
9), os goldens e os 166 testes do cabeçalho em `task-tree.test.ts`.

## Medidas (bancada `run6.sh`, camada pura, `layout()` direto, mediana)

| Cenário | atWork# antes (depois do item 9) | atWork# depois | tarefas desenhadas | `layout()` ms antes → depois |
|---|---|---|---|---|
| D3000 (3 000 níveis 1) | 6 000 | 3 000 | 3 000 | 20,6 → 14,4 (`atWork` 5,6 → 2,5) |
| O2500 completa | 3 750 | 3 125 | 3 125 | 19,5 → 17,6 |
| C20x20 completa | 1 204 | 1 203 | 1 203 | 19,6 → 20,2 (ruído) |
| REAL completa | 27 | 17 | 17 | 5,9 → 5,8 (`atWork` 0,1) |
| T3000 completa | 12 | 9 | 9 | 9,4 → 10,5 (ruído) |

**Meta: `atWork` ≤ 1 chamada por nível 1 por passada → igual ao número de tarefas desenhadas ✓.**
Antes da fase 6, D3000 fazia 12 000 chamadas (duas passadas × duas por tarefa) em 34,7 ms.
`same: true` em 56/56 comparações de linhas. Nenhuma âncora do `patch6.mjs` precisou mudar.

## Testes

- **325 pass / 0 fail** em 2 rodadas; `validate task-tree` ok.
- 0 `GOLDEN-NEW`, 0 `TEXTOS-NEW`; orçamento 11657 / 11775 / 47400 / 48162 nas 2 rodadas.

## Commit sugerido

Arquivo: `task-tree/draw/layout.ts` (só ele).
Mensagem: `perf(task-tree): o trabalho das sessões sob cada tarefa é calculado uma vez por passada`

## Acumulado da parte A (itens 1 a 10), caso real, mesma máquina

- Desenho no kit: completa 17 → 11 ms, resumida 17 → 8 ms; `layout()` direto 8,9 → ~5 (completa),
  7,8 → ~3 (resumida); cabeçalho 2,2 → 0,2 ms; `rowSvg` 1,5 → 0,5 ms.
- Poll sem mudança: 45–60 → 9–12 ms, 220 KB → 0 KB gravados, 20 → 8 idas ao host, 0 `state.set`
  de `children`.
- Sessões longas: cabeçalho com 1 000 pedidos 1 129 → 1,1 ms; `layout()` com 3 000 pedidos 65 → 10 ms;
  3 000 níveis 1 35 → 14 ms; `split` de uma filha com 500 pedidos e 20 rodadas 18 → 1,1 ms; 400 linhas
  estreitas no SVG 18 → 2,9 ms.
- Linhas, bytes e textos do desenho idênticos em todos os itens (goldens, orçamento, 56/56 da bancada).
- Testes: 316 → 325 (9 novos). Bugs encontrados: nenhum.

## Bugs encontrados

Nenhum.
