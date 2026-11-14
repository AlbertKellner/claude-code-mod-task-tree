# correcao-regressao · fase 6, parte A, item 7 — fit linear com resultado idêntico

Sessão `correcao-regressao`. Branch `perf/fase-6-desempenho`, sobre `ce9c1bc` (item 6). 2026-10-22.

## O que mudou

`task-tree/draw/svg.ts`:
- `fit(s, size, max)`: em vez de medir `textW(out + ch + '…')` a cada caractere (quadrático no
  título), acumula a largura do que fica, com os mesmos termos na mesma ordem em que `textW` os soma
  (`w + em(ch) * size`, depois `+ em('…') * size`): as somas em ponto flutuante são idênticas, logo o
  corte é idêntico. `trimEnd()` e o `…` continuam iguais. A primeira linha (`if (textW(s, size) <= max)
  return s`) ficou, e é onde a bancada ancora.
- `em(ch)`: a largura de cada caractere (três testes de regex) é lembrada num `Map` do módulo (`ems`),
  pois os mesmos caracteres voltam em todo título de todo desenho. Resultado idêntico. Foi preciso
  para a meta: sem isso, o `fit` de 400 linhas ficava em 3,5 ms, e 2,3 ms eram o próprio `textW`
  mesmo sem corte.

`task-tree/tests/hooks-puros.test.ts` (fixado ANTES da mudança, 323 pass com o código antigo):
describe "fit: o corte de títulos com … é o mesmo da regra original", 2 testes: (1) a regra antiga
copiada como referência (`fitRef`) e comparada com `fit` em 13 títulos (latino, largo, coreano,
japonês, emoji, espaços largos, vazio, 1 caractere), 2 tamanhos e larguras de 0 a 600 de 7 em 7:
> 2 000 comparações, > 500 cortes, todas iguais, e o que fica cabe; (2) 5 casos literais (cabe inteiro,
corta aparando espaços, corta tudo em `…`) e `em('…') = 0,56`.

## Medidas (bancada `run6.sh`, camada pura; mesma máquina)

| Medida | Antes | Depois (fit linear) | Depois (+ cache do em) | Meta |
|---|---|---|---|---|
| `fit` de um título de 92 caracteres, cortando | 100 µs | 30 µs | 10 µs | |
| `fit`, 400 linhas a 40 colunas (372 cortes) | 10,2 ms | 3,5 ms | 0,8 ms | ≤ 1,5 ms ✓ |
| `rowSvg` total, 400 linhas a 40 colunas | 18,1 ms | 8,0 ms | 5,0 ms | |
| `rowSvg` total, 400 linhas a 100 colunas | 7,8 ms | 7,3 ms | 4,2 ms | |
| `rowSvg` total, REAL a 40 colunas | 0,9 ms | 1,2 (ruído) | 0,6 ms | |
| chamadas a `textW` por desenho (O400/40) | 4 654 | 400 | 400 | |

`same: true` em 56/56 comparações de linhas; golden do SVG (12 cenários, `alt` incluído) igual, o que
pega qualquer diferença de corte. Nenhuma âncora do `patch6.mjs` precisou mudar.

## Testes

- **323 pass / 0 fail** em 2 rodadas com o código final (321 + 2 novos); `validate task-tree` ok.
- 0 `GOLDEN-NEW`, 0 `TEXTOS-NEW`. Orçamento: 11657 / 11775 / 47400 / 48162 na rodada 1; na rodada 2
  o artefato do relógio do teste já registrado no item 5 (+14/+16 bytes: o host devolve `t += 1000`
  a cada `clock.now`, e o tempo desenhado depende da corrida da leitura de fundo). Bytes do SVG por
  linha iguais (650 / 679 / 1055 / 1095 na bancada).

## Commit sugerido

Arquivos: `task-tree/draw/svg.ts`, `task-tree/tests/hooks-puros.test.ts`.
Mensagem: `perf(task-tree): fit linear no título e largura por caractere lembrada, mesmo corte`

## Bugs encontrados

Nenhum.
