# correcao-regressao · fase 6, parte A, item 2 — uma passada só em layout()

Sessão `correcao-regressao`. Branch `perf/fase-6-desempenho`, sobre `4038e45` (item 1). 2026-10-22.

## O que mudou

`task-tree/draw/layout.ts`: `layout()` chamava `panel(all, …)` uma vez sem escolhas (`fl = {}`), jogava o
resultado fora, trocava `fl = chosen` e chamava `panel()` de novo. A primeira passada vinha da etapa 1 da
fase 3 (o render antigo montava `plain` para os chips) e só preenchia o memo dos `breaks`, que a segunda
preenchia igual; os chips do cabeçalho vêm dos nós das linhas desenhadas (`Row.nodes`) desde a fase 3.
Agora `const fl = chosen` e uma só chamada a `panel()`. Comentário das linhas 593-596 atualizado.

`task-tree/DESENVOLVIMENTO.md` (duas linhas da documentação, fora da seção local do clone): o item
"O render monta as linhas duas vezes" virou "O layout monta as linhas uma vez só…" e a pendência
"Sobras da etapa 1 do layout: `panel(all, …)` roda uma vez sem escolhas…" ficou só com o `elapsed`
não usado, registrando que a passada saiu na fase 6.

Sem teste novo (o relatório não pede): protegem `layout.test.ts` (determinístico, 28/27 linhas reais,
escolhas, resumida), os goldens `real-completa`/`real-resumida`/`filha-recolhida`, o orçamento e os
testes montados de `task-tree.test.ts`.

## Medidas (bancada `run6.sh`, camada pura, `layout()` direto, mediana; mesma máquina, hoje)

| Cenário | Antes | Depois | Nota |
|---|---|---|---|
| REAL completa | 8,9 ms (mín 7,1) | 4,6 (mín 3,7) | meta ≤ 5 (mín ≤ 3,5): mediana ok, mín 0,2 acima |
| REAL resumida | 7,8 (mín 6,6) | 5,5 (mín 3,8) | |
| O2500 completa | 57,7 | 26,0 (mín 15,4) | meta ≤ 20 não atingida na mediana; a variante "pass1 pulada" do próprio relatório deu 22,7 hoje contra 18 no relatório: a máquina está ~20 % mais lenta hoje |
| D3000 | 34,7 | 25,2 | relatório previa 29 |
| T3000 resumida | 31,6 | 0,4 | relatório previa 1 |
| C50x5 completa | 40,3 | 16,3 | relatório previa 20 |
| C20x20 completa | — | 27,7 | |

Kit (desenho inteiro, REAL, sem o hook de contagem): fase `layout` 8,8 → 4,1 ms (desktop/completa);
parede do desenho 17,4 → 11,0 ms (desktop/completa), 16,9 → 8,8 (terminal/resumida). Contadores:
`panel#` 6 → 3, `split#` 10 → 5, `atWork#` 54 → 27 (REAL completa), como a variante previa.
`same: true` em 56/56 comparações de linhas; nenhuma linha mudou.

Observação: a primeira rodada do "depois" teve um ponto fora (C50x5 completa 59,6 ms com os mesmos
contadores da variante a 25,4 na mesma rodada); a segunda rodada da camada pura, sozinha, deu 16,3.
A âncora do `patch6.mjs` para este trecho também mudou (adaptada só na cópia do scratchpad).

## Testes

- **318 pass / 0 fail** em 2 rodadas; `validate task-tree` ok.
- 0 `GOLDEN-NEW`, 0 `TEXTOS-NEW`; orçamento 11657 / 11775 / 47400 / 48162 igual.

## Commit sugerido

Arquivos: `task-tree/draw/layout.ts` e, de `task-tree/DESENVOLVIMENTO.md`, só os dois trechos meus.
O arquivo tem também a seção local do clone (não commitada); por isso o patch só com os meus dois
hunks está em `correcao-regressao-f6-item2-desenvolvimento.patch` (nesta pasta), conferido com
`git apply --cached --check`. Para o stage: `git add task-tree/draw/layout.ts && git apply --cached
<patch>`; o `git diff --cached` deve mostrar só esses dois hunks do DESENVOLVIMENTO.md.
Mensagem: `perf(task-tree): layout() monta as linhas numa passada só`

## Bugs encontrados

Nenhum.
