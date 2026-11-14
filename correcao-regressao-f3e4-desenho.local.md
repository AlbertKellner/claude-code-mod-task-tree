# correcao-regressao · fase 3, etapa 4 — `drawDesktop`/`drawTerminal` e `overlays()`

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Item 4 (último) da fase 3 do
`docs/analises/04-plano-de-aprofundamento.md`. Branch `refactor/fase-3-layout`, sobre `ba76bee`
(etapa 3). 2026-10-22.

## O que entrou

- **`task-tree/draw/geometry.ts`** (+32): `Placed = { kind: 'icon' | 'ring' | 'name'; left?; right?;
  width }` e **`overlays(line, nested, W): Placed[]`**: todos os Boxes de uma linha, na ordem de
  desenho (o ícone quando a linha dobra, o anel quando é cartão de sessão com anel, a camada do nome
  quando o nome está cortado), cada um pela regra da borda mais próxima já escrita no módulo (chama
  `overlay()` por tipo). **`spanOf(p, W)`** (o trecho em px de cada Box: células × `CELL`, ou px na
  camada do nome) e **`crossings(list, W)`**: os pares que se cruzam. A regra "nenhum par de Box na
  mesma linha se cruza" fica testável.
- **`task-tree/draw/layout.ts`** (+55): `Guide`/`guides`, `Card`/`Frame`/`labelCols`/`frames`
  movidos do register (são estrutura das linhas; o teste precisa de `frames` para o aninhamento).
  Importa `PAD` da geometria.
- **`task-tree/hooks/register.tsx`** (+140/−184; 2 298 linhas): **`drawDesktop($, ui, lines, W, top,
  alt, { errorLine, views })`** e **`drawTerminal($, ui, lines, header, errorLine)`** como funções de
  topo, recebendo as linhas prontas do `layout()`; o `ui.render` monta o modelo, chama `layout()`,
  calcula o cabeçalho e chama uma das duas. No desktop, as três sobreposições vêm de
  `overlays({ depth, folds, ring, hover }, nested, W)`; cada tipo vira o mesmo JSX de antes (`over`),
  nas mesmas três posições de filho (`one('icon')`, `one('ring')`, `one('name')`), para a árvore
  desenhada sair idêntica. `press`/`iconButton`/`ringOver`/`foldOver`/`nameLayer` do render saíram
  (`pressOf` de topo; `iconButton` dentro do `drawTerminal`).
- **`task-tree/tests/sobreposicao.test.ts`** (novo, 6 testes): `overlays()` dá os mesmos Boxes que
  `overlay()` dava, um a um, em 7 profundidades × 4 aninhamentos; spans em px; **estado real**, as
  duas visões, 6 larguras (30 a 112 colunas): nenhum cruzamento; ícone × anel nunca se cruzam (8
  profundidades × 4 aninhamentos × 5 larguras); ícone × camada do nome nunca se cruzam (a camada
  começa depois do Box do ícone); e a **falha conhecida** abaixo.

## Falha conhecida (bug revelado, não corrigido)

`KNOWN['camada do nome cobre o anel']`: numa **sessão com nome cortado e anel**, a camada de tooltip
do nome vai da coluna do nome até a borda direita da linha (`W − left·8` px) e **cobre o Box do
anel** (4 células encostadas na borda direita), desenhada por cima dele (é o último filho). O clique
no anel dessa sessão cai na camada, não no botão que abre a sessão. Não aparece no fixture real (os
nomes das sessões são curtos; o golden não tem camada de nome em cartão), por isso nunca foi visto.
Correção provável, fora desta etapa: a camada do nome parar antes do Box do anel
(`width = min(W − left·8, W − (right + RING_CELLS)·8 − left·8)` quando há anel), decisão do usuário.

## Por que o desenho é idêntico

`overlays()` só reúne as três chamadas `overlay()` que o render já fazia, com as mesmas condições
(`r.fold`, `r.session && r.sid && r.ring`, `hovers(source)`); o JSX de cada Box é o mesmo texto, e os
três continuam como três filhos (ou `null`) do Box da linha, na mesma ordem. `guides`/`frames`/
`labelCols` só mudaram de arquivo.

## Testes

- **287 pass / 0 fail** (10 arquivos; +6), com dois `TODO` impressos (as falhas conhecidas desta e da
  etapa 3). `claude plugin validate task-tree` e `validate .` ok.
- Golden do SVG (0 `GOLDEN-NEW`), golden dos textos (0 `TEXTOS-NEW`), orçamento (11 657 / 11 775 /
  47 400 / 48 158), reinício, publicado, durabilidade, limite de linhas, layout: iguais.
- Tropeço no caminho, já resolvido: o `label` do botão do ícone é um **espaço em (U+2003)**, não um
  espaço comum; ao reescrever o JSX eu digitei um espaço comum e o teste "só o ícone recolhe" caiu
  (ele compara o label). A ferramenta de edição normaliza o caractere, então a volta foi por `perl`
  com `\x{2003}`. Vale uma linha no `DESENVOLVIMENTO.md`: o espaço em é de propósito (o destaque
  nativo do botão com a largura certa) e não pode virar espaço comum.

## O que conferir no app

Nada muda. O bug conhecido pode ser visto com uma sessão filha de nome longo (cortado com …) e anel
de contexto: o anel não abre a sessão ao clique (o tooltip do nome fica por cima).

## Fase 3

Concluída com este item (R12 em 4 etapas). Pendências registradas: o chip "em andamento" com ✉ de
filha (etapa 3), a camada do nome sobre o anel (esta), `panel(all)` sem escolhas com resultado
descartado e `elapsed` sem uso (etapa 1).
