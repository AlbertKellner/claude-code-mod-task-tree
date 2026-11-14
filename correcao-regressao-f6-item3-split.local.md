# correcao-regressao · fase 6, parte A, item 3 — split olha c.part antes de breaks

Sessão `correcao-regressao`. Branch `perf/fase-6-desempenho`, sobre `e9a3730` (item 2). 2026-10-22.

## O que mudou

`task-tree/draw/layout.ts`, `split()`: a verificação `c.part !== undefined` (cartão já cortado a uma
rodada pelo `cut()` da visão resumida) vem antes da chamada a `breaks()`. Antes, `breaks` era calculado
para cada cartão já dividido e o resultado jogado fora (`return [c]` logo depois); a lista nova de
cartões não acertava o memo, então eram recálculos. O retorno é o mesmo em todos os casos.
Comentário de duas linhas explicando. Sem teste novo (o relatório não pede): protegem
`layout.test.ts` ("visão resumida", determinístico), golden `real-resumida`, cartões por mensagem em
`task-tree.test.ts`.

## Medidas (bancada `run6.sh`, mesma máquina; antes = código antes dos itens 2 e 3; depois = com os dois)

Contagem de `breaks()` por `layout()` na visão resumida (a medida do item; meta: ≤ as da completa +
cartões):

| Cenário | breaks resumida antes (recalc.) | depois | completa depois |
|---|---|---|---|
| REAL | 323 (310) | 154 (154) | 154 |
| C20x20 | 1 020 (620) | 120 (120) | 120 |
| R16x20 | 816 (496) | 96 (96) | 96 |
| C50x5 | 1 050 (800) | 300 (300) | 300 |

**Meta atingida: na resumida, `breaks` = as da completa (nenhum recálculo).**

Tempos (`layout()` direto, mediana, ms): REAL resumida 7,8 → 3,9 (`split` 6,2 → 3,5); C20x20 resumida
69,4 → 31,5 (`split` 32,3 → 7,3); R16x20 resumida 53,4 → 24,4; C50x5 resumida 50,2 → 20,8. A visão
resumida deixou de custar mais que a completa com filhas. Kit (REAL resumida, sem o hook): fase
`layout` 8,2 → 3,5 ms (terminal), 8,8 → 3,1 (desktop); parede do desenho 16,9 → 8,3 e 21,1 → 9,9.
`same: true` em 56/56 comparações de linhas.

A âncora do `patch6.mjs` para o `split` mudou (adaptada só na cópia do scratchpad, como nos itens 1 e 2).

## Testes

- **318 pass / 0 fail** em 2 rodadas; `validate task-tree` ok.
- 0 `GOLDEN-NEW`, 0 `TEXTOS-NEW`; orçamento 11657 / 11775 / 47400 / 48162 igual.

## Commit sugerido

Arquivo: `task-tree/draw/layout.ts` (só ele).
Mensagem: `perf(task-tree): split devolve o cartão já cortado antes de calcular as quebras`

## Bugs encontrados

Nenhum.
