# correcao-regressao · fase 6, parte A, item 8 — slim com cache por conjunto de classes

Sessão `correcao-regressao`. Branch `perf/fase-6-desempenho`, sobre `e566523` (item 7). 2026-10-22.

## O que mudou

`task-tree/draw/svg.ts`, `slim(svg)`: a folha `<style>` de cada Svg depende só do conjunto de classes
usado. Agora ela fica num `Map` do módulo (`sheets`), com chave = os atributos `class` na ordem em que
aparecem (lidos numa passada só de uma regex, sem `Set`, `flatMap`, `split` e ordenação por linha);
o conjunto e as regras só são montados quando a chave é nova. Linhas de um mesmo tipo repetem a chave.
Cap de 1 000 entradas (limpa e recomeça). A string resultante é a mesma: as regras saem na ordem das
listas `LIGHT`/`DARK`, não da chave.

Primeira tentativa (cache por conjunto ordenado, mantendo o `matchAll` + `Set` + `sort` por linha) não
mudou nada na bancada (2,0–2,7 → 2,2–2,7 ms): o custo era a varredura e as alocações por linha, não o
filtro das 28 regras. A versão final tira as alocações do caminho quente.

Sem teste novo (o relatório não pede): o golden do SVG (12 cenários) compara a string inteira,
inclusive a folha; o orçamento compara bytes.

## Medidas (bancada `run6.sh`, camada pura, `rowSvg` direto, mediana)

| Medida | Antes da fase 6 | Depois do item 7 | Depois do item 8 | Meta |
|---|---|---|---|---|
| `slim`, 400 linhas a 100 colunas | 2,7 ms | 2,0 | 0,5 ms | ≤ 0,5 ms ✓ |
| `slim`, 400 linhas a 40 colunas | 3,4 ms | 2,1 | 0,5 ms | |
| `slim`, REAL (28 linhas) | 0,3 ms | 0,4 | 0,1 ms | |
| `rowSvg` total, 400 linhas a 100 colunas | 7,8 ms | 4,2 | 2,8 ms | |
| `rowSvg` total, 400 linhas a 40 colunas | 18,1 ms | 5,0 | 2,9 ms | |
| `rowSvg` total, REAL a 100 colunas | 1,5 ms | 1,0 | 0,5 ms | |

Bytes por linha iguais (650 / 679 / 1055 / 1095); `same: true` em 56/56. Âncora do `patch6.mjs` do
`slim` adaptada só na cópia do scratchpad.

## Testes

- **323 pass / 0 fail** em 2 rodadas com o código final (mais 2 rodadas verdes da primeira versão);
  `validate task-tree` ok.
- 0 `GOLDEN-NEW`, 0 `TEXTOS-NEW`; orçamento 11657 / 11775 / 47400 / 48162 nas 2 rodadas.

## Commit sugerido

Arquivo: `task-tree/draw/svg.ts` (só ele).
Mensagem: `perf(task-tree): slim guarda a folha por conjunto de classes`

## Bugs encontrados

Nenhum.
