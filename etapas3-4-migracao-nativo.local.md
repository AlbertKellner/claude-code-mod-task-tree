# Etapas 3 e 4 da migração para o híbrido nativo: relato

Worktree `claude-code-mod-task-tree-wt\integra`, branch `feat/painel-nativo`. Dois commits locais, sem
push, sem `--no-verify` (o hook de pré-commit passou nos dois):

- `e1fba89` feat(task-tree): cabeçalho em componentes nativos, com a barra em Svg
- `d5b5ad3` refactor(task-tree): sai o desenho em SVG por linha e a geometria em px

A worktree temporária `../faixa-linhas` foi removida (`git worktree remove --force`). Ficam `integra`
e `faixa-docs`.

## Check

Etapa 3 (`npm run check` manual, antes do commit): regras 148 cobertas / 0 pendentes / 19 checklist
(167), mapa sem aviso; travas ok; selos ok; os dois validate ok; tsc ok; plugin test 231 pass, 0 fail
(≈34 s); regressão: 231 testes de HEAD, 4 falharam, todos por decisão registrada (os 4 de golden,
aprovados com o motivo do usuário de 2026-11-13). Hook igual (travas pulada).

Etapa 4: regras igual; plugin test 231 pass, 0 fail (≈30 s); regressão: 231 testes de HEAD, **0
falharam** (o golden de HEAD passa sem aprovar: nenhum byte do desenho mudou). Hook igual.

Nenhum teste estourou os 5 s.

## Testes e cenários reescritos

- Nenhum teste mudou nas duas etapas (`npm run testes:alterados`: "Testes existentes alterados desde
  HEAD: nenhum", nas duas). Nenhum selo de teste; só o golden (etapa 3) foi regravado:
  `node scripts/golden.mjs --aprovar --todos --motivo '"migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG", 2026-11-13'`.
- Os testes de `taxa`, `ultracode`, a faixa (`estadoGeral` por pedaço) e os de 600 KB passaram sem
  mudança com o cabeçalho nativo, como o plano previa.
- Catálogo, etapa 3:
  - `Código da área` com `draw/head.tsx`: `regras/visual.md`, `regras/cabecalho.md`,
    `regras/ultracode.md`; `taxa.fim-do-turno-fica-aceso` ganha `Código: draw/head.tsx`.
  - Texto dos checklist que ficaram falsos (texto livre, sem selo): `visual.largura-real` ("as linhas
    terminam na borda real do painel, com o texto cortado pelo app"), `visual.cliques-no-icone-e-no-anel`
    ("o botão sobre o ícone ou sobre o anel"), `visual.cores-dos-temas` (cores do tema do app; os `Svg`
    que restam levam as suas), `visual.cabecalho-em-cartao` (sem "(16 px)", faixa em fundo de `Box`,
    `Reescrito: 2026-11-13` com as palavras do usuário, `Código: io/git.ts, draw/head.tsx`),
    `visual.cartao-posicao-de-toks-e-repo` ("posição na linha"), `visual.cabecalho-barra-e-chips-desenhados`
    (sem o tooltip "sessão inteira": "no texto alternativo, a sessão inteira"; pílula com "borda da cor
    do tom").
- Catálogo, etapa 4: `regras/visual.md:5` sem `draw/geometry.ts`. Nenhum outro `regras/*.md` citava
  caminho apagado (`grep` de geometry/rowSvg/headerSvg/labelSvg: nada).

## `npm run impacto`

- Etapa 3 (diff contra HEAD): arquivos `draw/head.tsx`, `hooks/render.tsx`; núcleo tocado, 162
  cenários afetados, os 19 de checklist, golden `visual.desenho-*` (os quatro), fora do mapa: nenhum.
- Etapa 4: arquivos `draw/desktop.tsx`, `draw/geometry.ts`, `draw/head.tsx`, `draw/icons.ts`,
  `draw/layout.ts`, `draw/svg.ts`, `hooks/render.tsx`, `hooks/sessions.ts`; núcleo tocado, 167
  cenários, os 19 de checklist, os 4 golden; "Fora do mapa: task-tree/draw/geometry.ts" (é o arquivo
  apagado: só aviso, o check não falha).

## Linhas removidas (etapa 4)

`git diff --shortstat`: 9 arquivos, +54 / −724.

| Arquivo | + | − |
|---|---|---|
| draw/geometry.ts (apagado) | 0 | 156 |
| draw/svg.ts (738 → 245 linhas) | 30 | 523 |
| draw/layout.ts (frames, Card, Frame, import de PAD) | 5 | 26 |
| draw/icons.ts (`slim(x)` sem o segundo argumento) | 6 | 7 |
| hooks/render.tsx, hooks/sessions.ts, draw/desktop.tsx, draw/head.tsx (comentários) | 12 | 11 |
| regras/visual.md | 1 | 1 |

Saíram de `draw/svg.ts`: `rowSvg`, `labelSvg`, `labelName`, `headerSvg`, `cardSlice`, `rowHeight`,
`NO_FRAME`, `TIME_W`, `TIME_GAP`, `COUNT_W`, `textW`, `fit`, `fitStart`, `em`/`emOf`/`WIDE`, `r1`,
`gitSvg`, `gitW`, `FOLDER_MAX`, `repoIcon`, `branch`, `folderIcon`, `toRight`, `slot`, `svgOpen`, `xml`,
`FONT`, `BAND`/`PILL` do SVG, o parâmetro `base` de `slim` (a chave do cache passou a ser só as
classes), e as classes de cor sem uso (`p`, `s`, `pc`, `sc`, `g`, `ln`, `lnf`, `cd`, `cs`, `csf`, `cds`,
`ul`, `blf`, `amp`, `grp`, `gyp`, `blp`). `LIGHT`/`DARK` deixaram de ser exportados; `ringClass`,
`SessionKind` e `PROGRESS` também (só uso interno).

## O que ficou em `draw/svg.ts` (cada export conferido com `grep`)

- Textos comuns: `clockText`, `plural` (hooks/tools.ts), `rateText`, `ULTRA`, `percent`, `gitAlt`,
  `gitTerm`, `rightText`, `rowAlt` (desktop), `chips`/`Chip`, `headerState`/`HeaderState`, `RING_LABEL`.
- Terminal: `GLYPH`, `prefix`, `ratioBar`, `ringTerm`, `MSG_TERM`.
- Primitivas dos ícones (para draw/icons.ts): `slim`, `STYLE`, `icon`, `envelope`, `MSG_CLASS`,
  `sessionIcon`, `contextRing`; e `progress`, `sessionState` (desktop).
- Classes de cor restantes: `am`, `amf`, `gr`, `grf`, `gy`, `gyf`, `tr`, `bl`, `rd`, `tk` (claro) e as
  equivalentes do escuro (as mesmas de antes; `tr` e `tk` seguem sem versão escura, como já era).

## Diferenças visuais do cabeçalho contra o antigo (para o checklist do app)

- Cartão nativo: borda redonda do app e fundo `userMessageBackground` (antes: fundo `cd` e borda `cs`
  desenhados no SVG, 125 px de altura fixa). A altura agora é a das linhas de texto do app.
- Faixa de estado: um `Box` de 1 coluna com fundo por tom (`warning`, `permission`, `success`,
  `inactive`, e as cores cruas `rgba(136,135,128,0.25)` e `rgba(239,159,39,0.5)`); antes, 5 px dentro
  da borda com cantos recortados. Pode ficar mais larga (1 coluna ≈ 7 px) e sem o arredondado.
- Título: `Text size="heading" weight="semibold"` cortado pelo app (`truncate-end`) em vez do corte por
  estimativa de largura; o harness mostra `bold: true` junto.
- Repositório e branch: em texto (`gitTerm`: `repo ⑂ branch` ou `▭ pasta`), sem os ícones Git/branch/
  pasta do SVG; pasta longa cortada pelo fim pelo app (antes: pelo começo, `…\fim`).
- Barra: `Svg` de 4 px, `width="100%"` do seu slot, com piso de 2 % (antes, piso de 4 px), ocupando a
  coluna da esquerda (antes terminava 20 px antes do bloco de números).
- Pílulas: `Box` com borda redonda na cor do tom (`borderDimColor`) e o ícone de estado em `Svg` 16 px;
  antes, fundo colorido a 13 % sem borda. O cálculo do que cabe é por colunas (pílula = texto + 5).
- Bloco de números: `%` em `size="title"`, "d de n" e relógio/toks/s/ultracode em `footnote`; toks/s do
  último turno em `dimColor` (antes `opacity .45`); ultracode em `effortUltra` (antes `#8700FF`/`#AF87FF`).
- Estreito agora é `cols < 84` (equivale aos 600 px de antes a 7,2 px/coluna): some taxa e ultracode.
- Painel vazio: "Tarefas" / "Nenhuma tarefa planejada.", sem barra (o `alt` "Nenhuma tarefa planejada…"
  não é desenhado em `Svg` nenhum nesse caso; o texto visível basta, como o contrato 2.1 item 4 pede).
- `marginBottom={1}` entre o cabeçalho e as linhas (antes, 8 px de `HEADER_GAP` dentro do SVG).

## Desvios

1. `head.tsx` da faixa quebrava no harness ("h is not a function"): o parâmetro `h: Head` escondia a
   função `h` com que o JSX do arquivo é montado. Renomeado para `head`, com um comentário avisando.
   O `tsc` e o `validate` não pegam isso (por isso a faixa não viu).
2. O diff `render-etapa3.diff` não foi aplicado com `git apply`: as três trocas foram feitas à mão
   sobre o `render.tsx` atual (sai `lineWidth`, `W` e o import de `../draw/geometry` já na etapa 3,
   `drawDesktop` recebe o nó `top`).
3. Não reescrevi `cabecalho.limites-de-linhas` ("a sessão inteira, só no tooltip") nem
   `sessoes.turno-proprio-da-filha-no-pedido-vigente` ("o texto digitado no tooltip"): são cenários
   `coberto` cujo texto é antigo (o tooltip já não existia antes da migração); o pedido só citava os
   `checklist` que a etapa tornou falsos. Fica para a etapa 5 (documentação), se o usuário quiser.
4. O teste opcional da cor da faixa e o de 120 colunas não entraram.

## Incertezas

- Nada visto no app: pintura, alturas (`size="heading"`/`"title"` dentro de `Box height={1}` podem
  cortar), as estimativas de colunas do cabeçalho (11/18/6/+5) a 60 e a 120 colunas, as cores cruas com
  transparência e a chave `effortUltra`/`userMessageBackground` (o harness repassa; a pintura é do app).
- A ordem dos pedaços em `d.cabecalho` agora é: título, git, `alt` da barra, `alt` e texto de cada
  pílula, `%`, "d de n", relógio/taxa/ultracode; `estadoGeral` acha o estado no `alt` da barra.
