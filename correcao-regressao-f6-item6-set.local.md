# correcao-regressao · fase 6, parte A, item 6 — pedidos com tarefa por Set

Sessão `correcao-regressao`. Branch `perf/fase-6-desempenho`, sobre `96ab1b5` (item 5). 2026-10-22.

## O que mudou

- `task-tree/draw/layout.ts`, em `panel()` (os cartões antigos): `ats` filtrava os turnos com
  `main.tasks.some(t => t.turn === u.id)` por turno (O(pedidos × tarefas)); agora um `Set` dos turnos
  das tarefas de nível 1 e `withTasks.has(u.id)`. Mesma lista, mesma ordem.
- `task-tree/hooks/panel.ts`, `openTurn`: `used = turns.filter(u => g.tasks.some(…))` idem, por `Set`.

Sem teste novo (o relatório não pede): protegem `layout.test.ts` ("+N pedidos anteriores"), os goldens,
`durabilidade.test.ts` (turnos) e os testes de turnos em `task-tree.test.ts`.

## Medidas (bancada `run6.sh`, camada pura, `layout()` direto, mediana, ms)

| Cenário | Antes dos itens 2–6 | Depois dos itens 2–5 | Depois do item 6 | Meta |
|---|---|---|---|---|
| T3000 completa | 64,8 | 28,1–28,5 | 10,4 (mín 9,8) | ≤ 16 com o item 2 ✓ |
| T3000 resumida | 31,6 | 0,4 | 0,4 | |
| T1000 completa | 10,0 | — | 3,0 | |
| REAL completa | 8,9 | 4,2–4,6 | 5,8 (mín 3,9) | ruído: `ats` real tem 70 pedidos |

`same: true` em 56/56 comparações de linhas. Abaixo de 1 000 pedidos, dentro do ruído, como o
relatório previa. Âncora do `patch6.mjs` do `ats` adaptada só na cópia do scratchpad.

## Testes

- **321 pass / 0 fail** em 2 rodadas; `validate task-tree` ok.
- 0 `GOLDEN-NEW`, 0 `TEXTOS-NEW`; orçamento 11657 / 11775 / 47400 / 48162 igual.

## Commit sugerido

Arquivos: `task-tree/draw/layout.ts`, `task-tree/hooks/panel.ts`.
Mensagem: `perf(task-tree): pedidos com tarefa por Set no layout e no openTurn`

## Bugs encontrados

Nenhum.
