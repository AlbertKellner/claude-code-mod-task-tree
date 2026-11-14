# correcao-regressao · R14 — geometria num módulo (`task-tree/draw/geometry.ts`)

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Item 1 da fase 2 do
`docs/analises/04-plano-de-aprofundamento.md` (R14 do `03`). Branch `refactor/fase-2-extracoes`.
2026-10-22.

## O que entrou

- **`task-tree/draw/geometry.ts`** (novo, ~110 linhas, puro: sem `$`, sem kit). Exporta:
  - `CELL = 8` com a nota da célula real (≈7,87 px, escala 1,25) e a **regra "ancorar pela borda
    mais próxima"** escrita uma vez no cabeçalho do arquivo (deriva ≈0,13 px/célula; 7 px depois de
    ~57 células; ícone e nome pela esquerda, anel pela direita).
  - Largura da linha: `MIN_W 240`, `MAX_W 900`, `lineWidth(columns) = clamp(columns·CELL − CELL)`.
  - Colunas: `COL_0 12`, `COL_STEP 20`, `col(k) = COL_0 + k·COL_STEP + .5`; `TEXT_IN 13`
    (o `+13`), `SECTION_TEXT_OUT 6`, `CARD_IN 12` (o `−12`), `BRANCH_GAP 9` (o `−9`).
  - Cartões: `CARD_RIGHT 2.5`, `CARD_NEST 6` (o `6·m`), `EDGE_PAD 8`, `cardRight(W, m)`,
    `textRight(W, inner)`, `CARD_RADIUS 6`, `PAD 6`, `CARD_EDGE 3.5`; alturas `ROW_H 28`,
    `ROW_H_TOP 30`; `RIGHT_GAP 12`, `BAR_W 36`, `BAR_GAP 8`, `BRANCH_IN 12`, `GUIDE_FROM 8`.
  - Cabeçalho: `HEADER_PAD 8`, `HEADER_H_EMPTY 44`, `HEADER_H 66`, `HEADER_H_CHIPS 88`, `ICONS_W 72`.
  - Anel: `RING_D 15`, `RING_IN = CARD_RIGHT + RING_D` (o `17.5`), `RING_CELLS 4`, `RING_GAP 8`.
  - `overBox(cx, widths, half)` (movida, agora em termos de `CELL`), `ringRight(m)`,
    `ringFromRight(m)` (movidas) e **`overlay(kind, …)`**: `'icon'` → `{left, width}` em células
    (sobre `col(depth)`); `'ring'` → `{right, width}` em células (pela direita); `'name'` →
    `{left, width}` (células pela esquerda, livre do Box do ícone; largura em px até `W`).
- **`task-tree/hooks/register.tsx`**: importa tudo isso de `../draw/geometry` e perde as cópias
  (`overBox`, `RING_CELLS`, `ringRight`, `ringFromRight`, `col`, `PAD`, `ICONS_W`, `iconBox`); os
  números soltos de `labelName`, `labelSvg`, `rowHeight`, `cardSlice`, `rowSvg`, `headerSvg`,
  `ringOver`, `foldOver`, `nameLayer` e o `W` do desktop viram os nomes acima. `ringOver` perdeu o
  parâmetro `W` que não usava. Comentários do anel/célula encurtados e apontando para o módulo.
  Saldo: −125/+69 linhas no `register.tsx` (antes do módulo novo).

## O que ficou fora (de propósito)

- Os traçados dos glifos (`icon`, `branch`, `contextRing`: `±3.5`, `2.5`, `4.5`…) e as linhas de
  base de texto (`cy + 4`, `cy + 4.5`): são o desenho do ícone, não a geometria de posição.
- A camada de tooltip do cabeçalho (`W − 64`, `24`) e o `− 10` do fim do motor sem anel: um uso cada,
  deixados onde estão.
- O terminal (`prefix`, 3 colunas por nível): texto, não px.

## Ponto flutuante

Cada substituição mantém a **ordem das operações** da expressão original (`W − 2.5 − 6·m` →
`W − CARD_RIGHT − CARD_NEST·m`; `(cx − 4·w)/8` → `(cx − (CELL/2)·w)/CELL`, com `CELL/2 = 4`
exato; `17.5 + 6·m` com `RING_IN = 2.5 + 15 = 17.5` exato), por isso o SVG sai idêntico byte a byte.

## Pergunta 2 do `04` (import relativo) e a armadilha do `$`

O kit aceita `import { … } from '../draw/geometry'` no módulo de hooks (`claude plugin validate`
passou; a suíte carrega). O módulo descartável para a armadilha "`$` passado a função fora do topo do
arquivo" **não foi feito aqui**: `geometry.ts` não recebe `$`. Vale fazê-lo antes do R13
(`state/durability.ts`), o primeiro módulo que recebe `$`.

## Testes

- **194 pass / 0 fail** (6 arquivos); `claude plugin validate task-tree` e `validate .` ok (só o
  aviso de ícone, que já existia).
- Golden do SVG: 7 testes passam, **0 linhas `GOLDEN-NEW`** (nenhum SVG mudou, em nenhum cenário
  ou tom).
- Orçamento: `terminal/summary 11 657 · terminal/full 11 775 · desktop/summary 47 400 ·
  desktop/full 48 158` bytes. São 14–16 bytes abaixo da `BASELINE` do teste (11 671 / 11 789 /
  47 416 / 48 174); medi o `HEAD` (`e9a24e7`, antes deste item) numa cópia temporária com o mesmo
  teste e deu **os mesmos bytes**, logo a diferença veio do R20 (texto do anel no terminal) e o R14
  não mudou um byte do desenho. A `BASELINE` do `orcamento.test.ts` pode ser rebaixada num item de
  testes, se quiserem; dentro da folga de 1,5× não faz diferença.
- Saldo: `register.tsx` −78/+47; `geometry.ts` 117 linhas.

## O que conferir no app

Nada: comportamento idêntico (golden do SVG byte a byte nos 12 cenários × 12 tons; orçamento,
reinício, publicado e limite de linhas iguais). Se quiser olhar: um cartão de sessão com anel de
contexto, o botão do anel e o do ícone continuam centrados.
