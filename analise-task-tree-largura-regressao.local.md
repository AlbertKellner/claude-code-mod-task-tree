# Faixa vazia à direita do painel (regressão da largura)

Pedido: "o painel voltou a ficar desalinhado, dando espaço em branco na direita" (print 34).
Branch `fix/task-tree-serie-12` (309f9be).

## Revisão: o 3517f84 cortou o painel (revertido em f34e719)
"ficou pior, está cortando o panel" (print 35, painel expandido): cabeçalho e linhas cortados no
mesmo x, ≈ 450 px do print; o ≡/▤ sozinho na borda.
- **Causa**: o monitor é 4K com o Windows a 150 %, então 1 px do desenho = 1,5 px no print (linhas
  de 28 px medem 42); o corte em 450 px são **300 px**, o tamanho padrão de uma imagem SVG sem
  largura própria (`width="100%"` não dá largura intrínseca). Só um pai flex **em coluna** (com o
  `stretch` padrão) estica a imagem até o slot. A prova da 1ª rodada tinha o `Svg` direto num Box
  `flexDirection="column"`; o commit deixou o `Svg` do cabeçalho num `Box position="relative"`
  (linha, o padrão do Box) e o das linhas num `Box position="relative" flexGrow={1}` (também em
  linha) dentro de `Box flexDirection="row" alignItems="center"`: nenhum estica a imagem, que ficou
  com 300 px.
- **Prova 2** (feita e revertida, sem commit), confirmada pelo usuário no painel normal e no
  expandido: A `Box position="relative" flexDirection="column"` > `Svg` e B
  `Box flexDirection="column"` > `Box position="relative" flexDirection="column"` > `Svg` vão até a
  borda nos dois; C `Box position="relative"` > `Svg` (como no commit) fica com tamanho fixo.
- **Nova proposta**: refazer o 3517f84 (`git revert f34e719`, que traz de volta o desenho a 100 % e
  a direita ancorada) **mais** os Boxes em coluna em `hooks/render.tsx` `drawDesktop`:
  - cabeçalho: `<Box key="head" position="relative" flexDirection="column">`;
  - linhas: o Box de fora `flexDirection="row" alignItems="center"` vira
    `<Box key={`r${i}`} flexDirection="column">` (sem `alignItems="center"`: centralizar também
    impede o `stretch`), e o de dentro `<Box position="relative" flexDirection="column">` (sem
    precisar de `flexGrow`);
  - os overlays (ícone, anel, hover do nome, ≡/▤) são `position="absolute"`, fora do fluxo: não
    mudam com a direção do pai. Conferir só que o Box do anel (`right`, `top/bottom 0`) e o do
    ícone continuam na altura da linha.
  - Nenhum `Svg` de largura 100 % pode ficar num pai em linha nem com `alignItems`/`alignSelf`
    diferente de `stretch`; as camadas interativas (hover) têm `width` em px e ficam como estão.
- Validação: painel normal **e** expandido (⤢), estreito e largo: nada cortado, a direita encostada
  na borda; o resto da lista de validação abaixo.

## Medida (print 34)
- Escala do print ≈ 1,85 px de imagem por px CSS (as linhas de 28 px CSS medem 51–54 px).
- O cartão do cabeçalho e os cartões das linhas terminam em x ≈ 571 da imagem; o ▤ (Box ancorado
  em `right=0`, a borda real do slot) termina em ≈ 642. Faixa vazia ≈ 70–80 px de imagem, ≈ 40 px
  CSS.

## Causa
- O código não regrediu: `lineWidth` (`draw/geometry.ts:24`) é o mesmo desde a série 5 (b36ef55):
  `W = floor(bodyColumns × COL_PX)`, com `COL_PX = 8.6` calibrado na tela de então (77 colunas ≈
  670 px). Toda linha e o cabeçalho são `Svg` com `width={W}` (`hooks/render.tsx:128,149`), e tudo à
  direita (tempo, contagem, barra, busto, palavras, anel, modelo, toks/s, borda direita dos cartões)
  é contado a partir de `W`.
- `bodyColumns` é a largura do painel dividida pelo avanço da fonte de código do app (tipos do kit:
  "the pane's width and height over the advance and line height of its code font"). O px por coluna
  real depende da fonte, do tamanho dela e do ambiente; nesta máquina ele passou de 8,6, então `W`
  fica curto. O usuário confirmou: **a faixa cresce ao alargar o painel** (erro proporcional às
  colunas) e **continua sem zoom**. Qualquer constante calibrada volta a quebrar quando a fonte,
  a tela ou o app mudarem.

## Decisão do usuário
**Largura pelo slot**: o desenho passa a ocupar a largura real do painel e alinha à borda direita,
sem converter colunas em px.

## Prova (feita e revertida, sem commit)
Quatro `Svg` no topo do painel, cada um com contorno `rect style="width:calc(100% - 1px)"`, texto à
esquerda e um texto "direita" num `<g style="transform-box:view-box;transform:translateX(100%)">` com
`x="-8" text-anchor="end"`:
- P0 `width={W}` (hoje): curto.
- **P1 sem a prop `width`, markup `width="100%"`, sem `viewBox`: vai até a borda real**, com o
  contorno (CSS `calc` no `rect`) e o texto ancorado à direita (`translateX(100%)` com
  `transform-box:view-box`) encostados nela. ← o caminho.
- P2 igual ao P1 com `isInteractive` (moldura): não vai. As camadas interativas (hover dos títulos e
  do cabeçalho) continuam com largura em px, ancoradas à esquerda; não precisam mudar.
- P3 markup `width="4000"`: não vai.

## Plano de implementação
Ideia: manter toda a conta em px como hoje, com `W` agora só uma **estimativa** (a mesma
`lineWidth`), e deslocar para a borda real só o que é ancorado à direita, por CSS; o que se estica
(meio dos cartões, trilho da barra do cabeçalho, linha de seção) ganha largura em `calc(100% − k)`.
Seja `D = max(100%, W px)` (não encolher abaixo de `W`: num slot mais estreito que a estimativa fica
como hoje, cortado na borda).

1. **Raiz dos `Svg` das linhas e do cabeçalho** (`draw/svg.ts` `rowSvg`, `labelSvg`, `headerSvg`):
   `<svg … width="100%" height="${H}" font-family=…>` **sem `viewBox`** (o viewBox escalaria o
   desenho). Em `hooks/render.tsx` (linhas 128 e 149) tirar a prop `width={W}` dos dois `Svg`.
   - Os Boxes que embrulham a linha: hoje `Box flexDirection="row" alignItems="center"` → `Box
     position="relative"` → `Svg`. Numa linha flex o filho não estica na largura; conferir na prova
     visual que a linha ocupa o slot e, se não, fazer o Box da linha esticar (`flexGrow={1}` ou
     `width="100%"` no `position="relative"`, ou a linha em `flexDirection="column"`). O P1 da prova
     estava num Box em coluna.
2. **Grupo da direita**: tudo que hoje é contado de `W` para a esquerda vai num
   `<g style="transform-box:view-box;transform:translateX(calc(max(100%, ${W}px) - ${W}px))">`
   (desloca pela diferença entre o slot e `W`; px internos inalterados):
   - `rowSvg`: o array `right` (tempo, contagem, trilho e barra 36 px, palavras, meta) e o `mark`
     (busto); o `≡`/`▤` já está na borda real.
   - `labelSvg`: o anel (`contextRing`), o modelo (`engine`) e o toks/s (`rate`). O repo/branch
     (`gitSvg`) é ancorado à esquerda, depois do nome: fica fora do grupo.
   - `headerSvg`: nada fica só à direita além do fim da barra e do cartão (itens 3 e 4).
3. **Cartões** (`cardSlice`, usado nas linhas e no cabeçalho): hoje um `path` de `L` a `Rc`
   (`Rc = W − k`, `k = CARD_RIGHT + CARD_NEST·m`). Partir em três:
   - peça esquerda (de `L` a `L + r`: cantos, lado esquerdo e fundo) como hoje, em px;
   - peça direita (de `Rc − r` a `Rc`) desenhada nas mesmas coordenadas e posta no grupo da direita;
   - meio: fundo `rect x="${L + r}" y=y0 height=y1−y0 style="width:calc(D - ${L + r + r + k}px)"`
     e as bordas de cima/baixo (só nas fatias `first`/`last`) como `rect` de 1 px de altura
     (`y = y0 − 0.5`), na cor da borda. A borda é `stroke` (classe `cs`): criar a classe de
     preenchimento com a mesma cor (ex. `csf`, nas listas `LIGHT`/`DARK` do `slim`, claro e escuro),
     pois o `slim` só põe na folha as regras das classes usadas.
   - Juntar peças sem emenda visível: fundo e bordas sobrepostos 0,5–1 px nas junções (cores
     opacas, `#20201f`/`#373736` e `#f9f9f7`/`#e1e1df`, não escurecem na sobreposição).
4. **Barra do cabeçalho** (`headerSvg`, linhas 589–590): trilho
   `style="width:calc(D - ${2·HEADER_PAD}px)"`; preenchida
   `style="width:max(4px, calc((D - ${2·HEADER_PAD}px) * ${d/n}))"`. **Manter o atributo
   `width` em px** (com a conta de hoje) além do `style`: o `barOf` (`draw/motion.ts:125`) lê o
   atributo e o `growFrom` só usa a razão antes/agora, que é a mesma; o `scaleX` com
   `transform-box:fill-box` segue valendo com a largura do CSS.
5. **Linha de seção** (`rowSvg`, `M0 0.5H${R}`): trocar por `rect` de 1 px com
   `width:calc(D - ${W - R}px)` na cor da classe `ln`.
6. **Overlays** (`geometry.ts` `overlays`): o anel é um Box ancorado em `right` (células da borda
   direita) e passa a casar melhor com o anel deslocado, já que agora os dois contam da borda real;
   os Boxes da esquerda (ícone, hover do nome) não mudam. O hover do cabeçalho (`W − 64`, ancorado à
   esquerda) não muda.
7. **Animações** (`draw/motion.ts`): o `animate` embrulha o conteúdo em `<g class="mv">`; o
   `fadeIn` revela `.mv>:not(.cd):not(.cs):not(.g):not(.ic)` com `clip-path:inset(…%)` na caixa de
   cada filho, então o grupo da direita é revelado na própria caixa (correto). Se as novas classes
   do cartão (`csf`) ou o grupo da direita aparecerem no reveal sem querer, acrescentá-las ao
   `:not(...)` como `.cd`/`.cs`.
8. **O que continua usando a estimativa `W`**: o corte dos títulos com "…" (`fit`, `labelName`,
   `edge`) e as escolhas de "cabe ou não" (chips, repo/branch, modelo, toks/s). Onde o slot é maior
   que `W`, sobra um pouco de espaço entre o título cortado e a direita; nunca sobrepõe. `COL_PX`
   fica como está; atualizar o comentário de `geometry.ts` (agora só a estimativa para os cortes).
   Se o corte cedo incomodar, é outro item (texto com `foreignObject` e `text-overflow`).
9. `claude plugin validate task-tree`; mudança multiarquivo num passo só (o clone recarrega a cada
   save). Sem testes nem docs. Commit:
   `fix(task-tree): linhas e cabeçalho ocupam a largura real do painel (Svg a 100%, direita ancorada na borda)`.

## Validação visual
- Tempos, contagens, barras, bustos, anel, modelo e toks/s encostados na borda direita (a 8 px do
  cartão), alinhados com o ▤; o cartão do cabeçalho e os cartões das linhas até a borda (2,5 px).
- Alargar e estreitar o painel: tudo acompanha a borda, sem faixa e sem rolagem lateral.
- Cantos dos cartões redondos, sem emenda visível no meio (claro e escuro); cartões aninhados com
  6 px entre si à direita.
- A barra do cabeçalho vai de ponta a ponta e cresce animada quando a contagem sobe.
- Linha nova entrando (revelar), ícone mudando de estado, chips novos: animações como antes.
- Clique no anel abre a sessão; hover do título mostra o nome inteiro.
