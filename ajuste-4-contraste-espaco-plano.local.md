# Plano do ajuste 4: contraste por nível de cartão e mais espaço, dentro e fora dos cartões

Escrito pelo planejador do ajuste 4 em 2026-11-13 e atualizado no mesmo dia com as três respostas do
usuário (item 9). Só leitura do repositório, do brief, dos planos dos ajustes 1 e 3 e dos prints.
Rodei `git log`/`git show`/`git diff`/`git status`, `npm run impacto` e leituras de pixels dos prints;
nenhum teste, nada escrito no clone.

Em que ponta li: `feat/painel-nativo`, ponta `fdbefcb` (o ajuste 3 em commit), com a árvore de
trabalho limpa. É o mesmo conteúdo que eu tinha lido antes, quando o ajuste 3 ainda estava sem commit.
Conferi de novo as linhas citadas de `desktop.tsx`, `DESENVOLVIMENTO.md`, `CLAUDE.md` e
`regras/visual.md`: todas continuam valendo.

Resumo: sem bloqueio. Um arquivo do mod muda: `task-tree/draw/desktop.tsx`. `draw/head.tsx` não é
editado (ele importa `CARD_FILL` e `CARD_BORDER`, que mudam de valor). Acompanham:
`tests/kit/leitura.ts`, `tests/visual.test.ts`, `regras/visual.md`, `regras/selos.json`,
`DESENVOLVIMENTO.md`, `CLAUDE.md` e o golden.

## 1. Causa

### Escrito no código

- Contraste: `desktop.tsx:372-374`. Todo cartão recebe a mesma constante `CARD`, com
  `CARD_FILL` = `rgba(136,135,128,0.06)` e `CARD_BORDER` = `rgba(136,135,128,0.22)`, sem olhar o nível.
  O degrau entre um cartão e o de dentro existe só porque a cor é translúcida, e encolhe a cada nível.
- Altura da linha: `desktop.tsx:41`, `ROW_H = 1`, usada no `Box key="r<i>"` das duas funções de linha
  (linhas 181 e 341) e no bloco do conector da faixa (linha 97).
- Respiro do cartão: `CARD` tem `paddingY: 0` e `paddingX: 1` (linha 374). A primeira e a última linha
  encostam na borda.
- Nada centra o conteúdo na altura da linha: a caixa do título (linhas 184 e 344) e a caixa da direita
  (linha 357) não têm `alignItems`. Com a linha de 1 de altura isso não aparece; com a linha mais alta,
  o texto ficaria no alto e o braço da guia (no meio da linha) não encontraria o texto.

### Medido no print `prints/2026-11-13-cartao-filha-estranho.png` (tema escuro)

- Escala do print: 1,5. A barra do cabeçalho (um `Svg` de 4 px) mede 6 px na tela, e a mini barra das
  linhas (`height={0.2}`) também. Logo 1 linha vale 20 px, e o passo entre as linhas é 30 px na tela
  (20 px).
- O texto (da ponta da haste à ponta da perna) ocupa cerca de 13 px desses 20: sobram perto de 7 px
  entre o texto de uma linha e o da seguinte.
- Cartão de uma linha (borda em y=498 e y=529, texto de 507 a 527): o texto fica a cerca de 5 px da
  borda de cima e a pouco mais de 1 px da de baixo.
- Lado esquerdo do cartão: da borda ao ícone, cerca de 15 px (a coluna do `paddingX`, a folga da
  célula do ícone e a do desenho do ícone). Lado direito: do fim do texto do tempo à borda, cerca de
  7 px.
- Do ícone ao título: cerca de 13 px.

### Referência: o desenho em SVG que ele usava antes da migração

`git show d5b5ad3^:task-tree/draw/geometry.ts`: `ROW_H = 28` px (30 no nível 0), `PAD = 6` px em cima
e embaixo do cartão, `EDGE_PAD = 8` px à direita, e o título a 13 px do centro do ícone (cerca de 6 px
da borda do ícone). A linha nativa tem 20 px contra 28 e o cartão não tem os 6 px: é daí que vem o
"muito colados".

### Dedução

- Tema claro com painel `#ffffff`: vem do plano do ajuste 1, não foi medido.
- O app pinta a borda sobre o fundo do próprio `Box` (o padrão de um `div`): do plano do ajuste 1.
- Cor translúcida de um cartão de dentro se soma à do de fora (ele é filho do outro na árvore):
  nenhum print mostra, porque os prints são anteriores ao commit do ajuste 1.

## 2. O que muda

Tudo em `task-tree/draw/desktop.tsx`. `draw/head.tsx`, `draw/layout.ts`, `draw/svg.ts`,
`draw/icons.ts` e `hooks/render.tsx` não mudam. O terminal não muda.

### 2.1 Valores

| O quê | Hoje | Novo | Unidade | De onde vem |
|---|---|---|---|---|
| altura da linha (`ROW_H`) | 1 | 1,4 | linhas | 28 px, a altura do desenho em SVG; ele confirmou: "1,4" |
| respiro do cartão em cima e embaixo (nome novo) | 0 | 0,3 | linhas | 6 px, o `PAD` do desenho em SVG |
| respiro do cartão à esquerda e à direita (`paddingX`) | 1 | 2 | colunas | ele pediu "nos 4 lados"; cerca de 8 px a mais de cada lado |
| colunas que o cartão toma (`CARD_COLS`) | 3 | 5 | colunas | 4 de respiro mais a borda |
| espaço entre o ícone e o título | 1 | 1 | colunas | não muda: "Não, fica como está (Recomendado)" |
| fundo e borda do cartão | um valor | por nível | cor crua | tabela abaixo |

Fundo e borda por nível (nível = quantos cartões há em volta; o cabeçalho usa o nível 0). O cinza é o
mesmo de hoje, `136,135,128`; só o alfa muda. O texto de cada cor segue o formato de hoje,
`rgba(136,135,128,<alfa>)`, sem espaços.

| Nível | Alfa do fundo | Alfa da borda | Escuro: fundo, borda | Claro: fundo, borda |
|---|---|---|---|---|
| 0 | 0.1 | 0.244 | `#242423`, `#3c3c3a` | `#f3f3f2`, `#d9d9d6` |
| 1 | 0.111 | 0.275 | `#2f2f2e`, `#484744` | `#e7e7e6`, `#cdcdca` |
| 2 | 0.125 | 0.314 | `#3a3a38`, `#53524f` | `#dbdbd9`, `#c1c1bd` |
| 3 | 0.143 | 0.367 | `#454542`, `#5e5d59` | `#cfcfcc`, `#b5b5b0` |
| 4 ou mais | 0.167 | 0.44 | `#50504c`, `#696863` | `#c3c3bf`, `#a9a9a4` |

Para comparar, hoje: nível 0 `#20201f` com borda `#373634` no escuro (`#f8f8f7`, `#dfdfdd` no claro);
nível 1 `#262625`. As cores resultantes foram calculadas sobre `#191919` (medido) e `#ffffff`
(dedução).

### 2.2 Por que funciona sem o mod saber o tema

- Cor translúcida: resultado = o que está embaixo + alfa × (cinza − o que está embaixo). Sobre o
  painel escuro clareia, sobre o claro escurece. É o mecanismo do ajuste 1.
- Degrau igual a cada nível: com o mesmo alfa em todo cartão, cada nível anda uma fração do que
  falta até o cinza, e o que falta diminui; os degraus encolhem (hoje 6,7, depois 6,3, depois 5,9
  níveis de cor). Para o degrau ser sempre o mesmo, o alfa do nível k é `a / (1 − k × a)`, com
  `a` = 0,10: cada cartão anda 10 % da distância entre o painel e o cinza, qualquer que seja o painel.
  No escuro são 11 níveis de cor por cartão; no claro, 12.
- A borda acompanha: o alfa da borda do nível k é `b / (1 − (k + 1) × a)`, com `b` = 0,22. Assim a
  borda fica sempre 22 % dessa mesma distância além do fundo do próprio cartão (24 níveis de cor no
  escuro, 26 no claro), em todo nível.
- Os valores da tabela são essas duas contas arredondadas em 3 casas. Entram como tabela literal de 5
  linhas, não como conta em tempo de desenho (o texto da cor fica estável no golden). Do nível 4 em
  diante repete o nível 4: a conta não vale além do nível 9 e, a 60 colunas, não cabe tanto cartão.
- "Um pouco mais claro": o nível 0 sobe 4 níveis de cor no escuro (de `#20201f` para `#242423`), a
  borda 5. O cartão de dentro sobe 9 (de `#262625` para `#2f2f2e`), que é o "repita isso".
- Os espaços são em linhas e colunas do app: acompanham a fonte e a escala, não o tema.

### 2.3 Cartão por nível

- `CARD_FILL` e `CARD_BORDER` continuam exportadas, com o valor do nível 0. `head.tsx` segue
  importando as duas, sem edição, e o cabeçalho continua igual ao cartão de fora (decisão dele: "Sim,
  junto do cartão (Recomendado)").
- A constante `CARD` (linha 374) passa a depender do nível: as props do cartão saem de uma função que
  recebe o nível e lê a tabela (níveis acima de 4 usam a linha 4).
- Em `desktopTree`, `block` (linha 396) ganha o nível como parâmetro: a chamada de fora passa 0; a
  chamada de dentro de um cartão (linha 419) passa o nível mais 1. O `Box` do cartão (linha 417) usa as
  props do nível de `block`.
- O comentário de `CARD` (linhas 365-371) é reescrito: os valores por nível, as duas contas, as
  palavras dele ("aumente um pouco o contraste do card, deixando ele um pouco mais claro, e repita isso
  para cada card dentro de card", 2026-11-13) e as cores resultantes do nível 0 e 1.

### 2.4 Altura da linha e conteúdo centrado

- `ROW_H` (linha 41) passa a 1,4 (ele, 2026-11-13: "1,4"). É a única fonte da altura: as duas funções
  de linha e o bloco do conector da faixa já a usam. Nada de `rowGap`, margem ou `paddingY` na linha
  (regra do ajuste 3).
- As guias (`Box key="guides"`) e a célula do ícone não mudam: sem altura própria, esticam até a
  linha; o ícone e o botão já são centrados na camada deles, e o braço da guia fica no meio da linha.
- O resto do conteúdo passa a ser centrado na altura, com `alignItems="center"` nas caixas que já
  existem (nenhum nó novo, e é uma prop que o app já desenha: a mini barra e o anel):
  - em `desktopRow`: a caixa do título (linha 344), a caixa da direita (linha 357) e a caixa do ▸/▾ de
    uma seção (linha 261);
  - em `labelRow`: a caixa do nome (linha 184), a da palavra de estado (197), a do repositório e
    branch (204), a de toks/s (212) e a do modelo e esforço (219). A do anel (233) já tem.
- Não usar `alignItems` no próprio `r<i>`: as guias deixariam de esticar, e o `alignSelf` do kit não
  tem `stretch`.
- O comentário de `desktopRow` ("Every line ROW_H high…", linha 250) ganha o motivo do 1,4 e do
  conteúdo centrado.

### 2.5 Respiro do cartão nos quatro lados

Decisão dele, 2026-11-13: "nos 4 lados".

- Em cima e embaixo: o respiro não entra por `paddingY`. Entra como duas caixas vazias dentro do `Box`
  do cartão: a primeira filha e a última, cada uma com `height` igual ao respiro (0,3) e
  `flexShrink={0}`, sem fundo, sem key e sem filhos. Motivo: altura fracionária de `Box` é o que o app
  já desenha (a mini barra, `height={0.2}`); espaçamento fracionário (`paddingY={0.3}`) não foi visto
  em lugar nenhum. `paddingY: 0` fica como está.
- À esquerda e à direita: `paddingX` passa de 1 para 2 (inteiro, como hoje).
- Vale para todo cartão, em qualquer nível, inclusive o de uma linha só e o recolhido.
- `CARD_COLS` (linha 377) passa a 5, e o comentário dele diz a conta nova (4 colunas de respiro e a
  borda). A conta de `inner` (linha 409) não muda de forma: cada cartão em volta tira 2 colunas a mais
  do que hoje.
- O que cabe no rótulo de sessão segue a mesma conta (`room`, linha 170, não muda). Conferido à mão
  nos dois casos que os testes olham a 60 colunas: no golden da filha o repositório, a branch e o
  toks/s continuam cabendo (precisam de 27,6 colunas, sobram 29); no teste do ultracode o modelo e a
  palavra continuam cabendo (precisam de 22, sobram pelo menos 27).
- Resultado em px, a partir do print: o texto do tempo fica a cerca de 15 px da borda direita (hoje
  7); o ícone fica a cerca de 23 px da borda esquerda (hoje 15), porque a célula do ícone já tem folga
  própria. Em cima e embaixo, cerca de 10 px entre a borda e o texto (os 6 do respiro mais os 4 que a
  linha mais alta deixa).

### 2.6 O conector da faixa desce com o cabeçalho

Em `guideCell`, no ramo `strip` (linhas 95-103), a camada em coluna ganha um primeiro filho, antes do
bloco do conector: um trecho de barra com a altura do respiro de cima do cartão. Vale para o ramo e
para o fim (nos dois a barra vem de cima). O bloco do conector segue com `ROW_H`, e no ramo a barra
segue até o pé (cobre o respiro de baixo sozinha).

Forma do trecho, que não é livre: uma caixa em linha com `height` igual ao respiro e
`justifyContent="center"`; dentro, uma caixa com `width` da barra (`GUIDE_W`) e `flexDirection`
coluna, sem fundo; dentro dela, a caixa com o fundo (`GUIDE_COLOR`) e `flexGrow={1}`, sem `width` e
sem `height`. É o arranjo da meia barra do fim que o ajuste 3 já usa. Motivo: a leitura do kit
(`celula`, em `leitura.ts`) classifica a célula pelos traços, e um traço com `width` e fundo faria o
fim ser lido como ramo; os testes do ajuste 3 afirmam `fim` na faixa. Essa leitura não pode mudar.

O respiro da esquerda e o da direita não mexem no conector: o braço termina na borda direita da
faixa, onde começa a borda do cartão, e o `paddingX` fica do lado de dentro dela. A guia continua
encostando no cartão; o que muda é que o ícone do cabeçalho do cartão fica uma coluna mais longe da
borda.

A borda de 1 px do cartão continua sem compensação (o braço fica cerca de 1 px acima do meio do
ícone), como no ajuste 3.

O nome do respiro vertical é um só, usado nas duas caixas vazias do cartão e nesse trecho.

### 2.7 O que não muda: o espaço entre o ícone e o título

Decisão dele, 2026-11-13: "Não, fica como está (Recomendado)". A caixa do título segue com
`paddingLeft` de 1 coluna depois da célula do ícone (cerca de 13 px no print), em `desktopRow` e em
`labelRow`. Nenhuma caixa nova entre o ícone e o título, e a conta de `room` do rótulo de sessão
(linha 170) não muda.

### 2.8 Comentários do topo

O parágrafo do contrato com o kit (linhas 11-20) ganha: a altura da linha é o `height` do `r<i>`; o
respiro de cima e de baixo do cartão são a primeira e a última filha vazias do `Box` do cartão, e o
dos lados é o `paddingX` dele; na faixa, o trecho antes do bloco do braço tem a altura do respiro.

### 2.9 Comportamento novo

- Cartão e cabeçalho um pouco mais destacados do painel; cada cartão dentro de outro, um degrau igual
  além do de fora, com a borda acompanhando.
- Linhas com 28 px no lugar de 20, com o texto no meio.
- Cartão com respiro nos quatro lados: 6 px em cima e embaixo, e uma coluna a mais à esquerda e à
  direita.
- Um cartão de uma linha passa de cerca de 22 px para cerca de 42 px de altura (no desenho em SVG eram
  40).
- Cada cartão em volta tira 5 colunas do que está dentro (hoje 3), fora a faixa.
- O painel inteiro fica cerca de 40 % mais alto.
- O espaço entre o ícone e o título não muda.

## 3. Matriz de impacto

`npm run impacto -- task-tree/draw/desktop.tsx` (rodado em 2026-11-13, com o ajuste 3):

- Arquivo do mod tocado: `draw/desktop.tsx`. Fora do mapa: nenhum.
- 33 cenários afetados: 3 de `sessoes`, 5 de `ultracode` e 25 de `visual`.
- Cobertos, com os testes: `sessoes.busto-so-no-pai`, `sessoes.pasta-sem-git`,
  `sessoes.toks-e-repo-branch-no-cartao` (`sessoes.test.ts`); `ultracode.cartao-da-filha`,
  `ultracode.so-o-interruptor-real`, `ultracode.cabecalho`, `ultracode.subagente-sem-palavra`
  (`ultracode.test.ts`); em `visual.test.ts`, `visual.botoes-por-chave`, `visual.tooltip`,
  `visual.titulo-sem-contagem-vai-ate-o-tempo`, `visual.faixa-de-estado-geral`,
  `visual.cartao-e-cabecalho-destacados` (2 testes), `visual.guias-em-caixas-nativas` (1),
  `visual.guias-na-faixa-do-cartao` (2); em `golden.test.ts`, `visual.golden-gera-desenho` e os quatro
  `visual.desenho-*`.
- Checklist do app: `ultracode.cor-e-corte`, `visual.guias-continuas-e-visiveis` e os 12 de `visual`
  que já estavam (largura real, cliques, animação, cores dos temas, cabeçalho em cartão, status, modelo
  e esforço, toks e repo, ordem dos cartões, recarga, barra e pílulas, seção sem traço).
- Golden: os quatro `visual.desenho-*`.

Dos testes existentes, só os 4 do golden enxergam a mudança. Conferido:

- os de `sessoes.test.ts` leem o terminal;
- os de `ultracode.test.ts` e `taxa.test.ts` leem textos do app, e o que cabe no rótulo não muda
  (item 2.5);
- os 2 de `visual.cartao-e-cabecalho-destacados` afirmam alfa entre 0 e 1, borda mais forte que o
  fundo e cabeçalho igual ao cartão que não está dentro de outro: seguem valendo com a tabela;
- os 3 das guias leem o tipo das células, que o item 2.6 preserva;
- os 3 de corte por tamanho de `cabecalho.test.ts` afirmam só o que o corte garante.

## 4. Testes

### 4.1 Kit (`task-tree/tests/kit/leitura.ts`): só acréscimos

Nenhuma função existente muda (nem `caixa`, `cartoesDoApp`, `alfa`, `celula`, `faixasDoApp`). Entram
leituras novas, no fim do arquivo:

- a altura de uma linha do app: o `height` do `Box key="r<i>"`;
- se o conteúdo de uma linha está centrado na altura: todo texto com algo além de espaço, todo `Svg`
  e todo `Button` da linha, fora o `Box key="guides"`, tem, entre ele e o `r<i>`, uma caixa em linha
  com `alignItems` `center`;
- quantos vãos há entre as linhas do desenho: linhas `r<i>` com margem ou padding vertical, mais
  caixas que têm `r<i>` ou `c<i>` como filho direto e têm `gap` ou `rowGap`;
- os respiros dos cartões, na ordem de `cartoesDoApp`: o texto da primeira linha, quantos cartões há
  em volta, o respiro de cima e o de baixo (o `height` da primeira e da última filha do `Box` do
  cartão, quando é uma caixa sem filhos e sem fundo; senão 0), o da esquerda e o da direita
  (`paddingLeft` e `paddingRight`, ou `paddingX`, do `Box` do cartão) e, quando o `c<i>` tem `strip`, o
  conector: na última célula da faixa, a altura da caixa que contém o braço (o traço com `height`) e a
  soma das alturas das caixas antes dela na mesma coluna;
- o tom de uma cor `rgba(r,g,b,a)`: o trecho "r,g,b"; nada para outro texto.

O comentário do bloco do app em `leitura.ts` ganha as frases do contrato novo (item 2.8).

### 4.2 Testes novos (`task-tree/tests/visual.test.ts`)

Um roteiro novo, de topo, para os três (não mexer em `comCartoes`, `destacada`, `UM`, `faixa`,
`LONGO`, `guiasDaLinha` e `umaCor`, que entram no hash de testes selados). É o cenário de
`subagentes.test.ts` "numa filha, o subagente terminado que outro subagente lançou segue no cartão
dele", lido no app: relógio fixo; host com uma filha de nome próprio, uma tarefa aberta e iniciada e
dois grupos de subagente publicados (o primeiro ancorado na tarefa da filha, rodando, com uma tarefa
própria; o segundo lançado pelo primeiro e ancorado nessa tarefa, concluído); pedido; plano "Plano A"
com "Um" e "Dois"; `start` de "Um"; `abrirSessao`; `aviso`; desenho com `noApp`. Dá três cartões, um
dentro do outro. O implementador confirma os três níveis na primeira execução; se a leitura do app não
der três, ajusta o roteiro, não o código.

**A. `no app, cada cartão dentro de outro tem o fundo e a borda um degrau além, o mesmo a cada nível`**
- Regra: `visual.cartao-dentro-de-cartao-um-degrau`.
- Afirma:
  - há um cartão sem nenhum em volta, um com 1 em volta e um com 2 em volta;
  - o fundo e a borda dos três têm o mesmo tom, e o alfa do fundo cresce a cada nível, o da borda
    também;
  - em cada um, o alfa da borda é maior que o do fundo;
  - os degraus são iguais: o quanto cada cartão anda em direção ao cinza (o alfa dele vezes o que os
    de fora deixaram, o produto de 1 menos o alfa de cada um) é o mesmo nos três, com 2 % de
    tolerância. A conta não depende do tema;
  - o cabeçalho tem o fundo e a borda do cartão sem nenhum em volta.
- Falha hoje: os três cartões têm o mesmo alfa (0,06), então "cresce a cada nível" falha; e os
  degraus de hoje diferem 6 % um do outro.

**B. `no app, toda linha tem a mesma altura, maior que a do texto, com o conteúdo centrado e sem vão entre linhas`**
- Regra: `visual.linhas-com-respiro`.
- Afirma, sobre todas as linhas do desenho (o pedido, as tarefas, o rótulo da sessão, os cabeçalhos
  dos cartões de subagente e as tarefas de dentro):
  - toda linha tem altura numérica, a mesma em todas, maior que 1;
  - toda linha tem o conteúdo centrado na altura;
  - o desenho não tem vão entre linhas (contagem zero).
- Falha hoje: a altura é 1, e o título não tem caixa que o centre. A contagem de vãos já é zero hoje:
  fica como guarda da regra do ajuste 3.
- Não afirma nada sobre o espaço entre o ícone e o título, que não muda.

**C. `no app, o cartão tem respiro nos quatro lados, e o conector da faixa desce com o cabeçalho`**
- Regra: `visual.cartao-com-respiro`.
- Afirma, para os três cartões:
  - o respiro de cima é maior que 0 e igual ao de baixo, e é o mesmo nos três;
  - o respiro da esquerda é maior que 1 coluna e igual ao da direita, e é o mesmo nos três;
  - em cada cartão que tem faixa (pelo menos o da sessão, sob "Um"): a soma das alturas antes do bloco
    do braço é igual ao respiro de cima do cartão, e o bloco do braço tem a altura da primeira linha do
    cartão.
- Falha hoje: não há respiro em cima nem embaixo (0), o dos lados é exatamente 1 e não há nada antes
  do bloco do braço.

O implementador prova as três falhas rodando os testes contra o código de antes de mexer em
`desktop.tsx`.

### 4.3 Testes existentes

Nenhum muda de texto. Os 4 de `golden.test.ts` passam a falhar até o golden ser regravado (item 7).
Se outro teste existente falhar, a correção é no código.

## 5. Catálogo (`regras/visual.md`) e selos

### 5.1 Cenários novos (depois de `visual.guias-continuas-e-visiveis`, antes de `visual.desenho-principal`)

**`visual.cartao-dentro-de-cartao-um-degrau`** (coberto)
- Título: cada cartão dentro de outro fica um degrau além do de fora, o mesmo a cada nível.
- Dado um cartão de sessão com um cartão de subagente dentro, e outro dentro deste, no app desktop.
- Quando o painel é desenhado.
- Então o fundo e a borda de cada cartão são o mesmo cinza translúcido, mais forte a cada nível, de
  modo que cada cartão se afasta do de fora o mesmo tanto (mais claro no tema escuro, mais escuro no
  claro, sem o mod saber o tema); a borda é sempre mais forte que o fundo dela; o cabeçalho usa os do
  cartão que não está dentro de outro.
- Origem: decisão do usuário, 2026-11-13 ("aumente um pouco o contraste do card, deixando ele um pouco
  mais claro, e repita isso para cada card dentro de card"). Mais o commit.
- Código: `draw/layout.ts`.

**`visual.linhas-com-respiro`** (coberto)
- Título: as linhas do app têm respiro: mais altas que o texto, com o conteúdo no meio.
- Dado um painel com tarefas, um cartão de sessão e cartões de subagente, no app desktop.
- Quando o painel é desenhado.
- Então toda linha tem a mesma altura, maior que a do texto, com o ícone, o título e o que vem à
  direita centrados nela; o espaço entre as linhas vem só dessa altura (nenhuma margem, nenhum vão: as
  guias seguem contínuas); o espaço entre o ícone e o título fica como era.
- Origem: decisão do usuário, 2026-11-13 ("aumente um pouco o padding interno tambem, os textos estão
  muito colados, tando dentro do cartao, quanto fora"; para a altura da linha, 1,4 linha: "1,4"; para
  mais espaço entre o ícone e o título: "Não, fica como está (Recomendado)"). Referência: a linha de
  28 px do desenho em SVG anterior. Mais o commit.

**`visual.cartao-com-respiro`** (coberto)
- Título: o cartão tem respiro nos quatro lados, e a guia entra nele na altura do cabeçalho.
- Dado um cartão de sessão ou de subagente, em qualquer nível, no app desktop.
- Quando o painel é desenhado.
- Então entre a borda e o conteúdo há respiro nos quatro lados: o mesmo em cima e embaixo, e o mesmo
  à esquerda e à direita, maior que uma coluna; e o conector da faixa à esquerda desce o respiro de
  cima, para chegar ao cartão na altura do cabeçalho dele.
- Origem: decisão do usuário, 2026-11-13 ("aumente um pouco o padding interno tambem, os textos estão
  muito colados, tando dentro do cartao, quanto fora"; para os lados do cartão: "nos 4 lados").
  Referência: os 6 px do cartão do desenho em SVG anterior. Mais o commit.
- Código: `draw/layout.ts`.

**`visual.contraste-e-respiro-no-app`** (checklist: pintura real)
- Título: o contraste por nível e o respiro aparecem no app, nos dois temas.
- Dado o painel aberto no app, no tema claro e no escuro, com cartão dentro de cartão.
- Quando o painel é desenhado.
- Então cada nível de cartão se distingue do de fora a olho; o texto fica no meio da linha e não
  encosta em nenhum dos quatro lados do cartão; e as guias seguem contínuas com a linha mais alta.
- Origem: as mesmas decisões, 2026-11-13 ("1,4"; "nos 4 lados").

### 5.2 Cenários reescritos

- `visual.cartao-e-cabecalho-destacados`: o "Então" troca o fim por "o cabeçalho usa o mesmo fundo e a
  mesma borda do cartão que não está dentro de outro", e ganha
  `Reescrito: 2026-11-13, decisão do usuário ("aumente um pouco o contraste do card, deixando ele um
  pouco mais claro, e repita isso para cada card dentro de card"): o fundo e a borda ficam um pouco mais
  fortes e passam a variar com o nível do cartão (visual.cartao-dentro-de-cartao-um-degrau).`
  Os 2 testes dele não mudam, então não há selo novo para eles.
- Os quatro `visual.desenho-*`, uma linha em cada, antes do `Código:`:
  `Reescrito: 2026-11-13, decisão do usuário ("aumente um pouco o contraste do card, deixando ele um
  pouco mais claro, e repita isso para cada card dentro de card. aumente um pouco o padding interno
  tambem, os textos estão muito colados, tando dentro do cartao, quanto fora"; "1,4"; "nos 4 lados";
  "Não, fica como está (Recomendado)"): o fundo e a borda do cartão por nível, a linha de 1,4 de altura
  com o conteúdo centrado e o respiro do cartão nos quatro lados; o espaço entre o ícone e o título não
  muda; o golden é regravado ("Validar só no fim (Recomendado)") e validado pelo usuário no app no fim.`

### 5.3 Selos (depois de escrever os testes, o kit e o catálogo)

    npm run regras:selar -- "task-tree/tests/visual.test.ts::no app, cada cartão dentro de outro tem o fundo e a borda um degrau além, o mesmo a cada nível" --tipo novo --motivo "contraste por nível de cartão (decisão do usuário, 2026-11-13: repita isso para cada card dentro de card)"

    npm run regras:selar -- "task-tree/tests/visual.test.ts::no app, toda linha tem a mesma altura, maior que a do texto, com o conteúdo centrado e sem vão entre linhas" --tipo novo --motivo "linhas com respiro (decisão do usuário, 2026-11-13: os textos estão muito colados; altura 1,4)"

    npm run regras:selar -- "task-tree/tests/visual.test.ts::no app, o cartão tem respiro nos quatro lados, e o conector da faixa desce com o cabeçalho" --tipo novo --motivo "respiro do cartão (decisão do usuário, 2026-11-13: nos 4 lados)"

    node scripts/selos.mjs --kit task-tree/tests/kit/leitura.ts --tipo refatoracao --motivo "leitura da altura e do centro das linhas, dos vãos, dos respiros dos cartões e do tom de uma cor; nenhuma leitura existente muda"

- Nenhum selo `decisao`: nenhum teste existente muda.
- Se o nome de um teste mudar na implementação, a chave do selo muda junto.
- O selo do golden não é destes comandos (item 7).

## 6. Documentação

`task-tree/DESENVOLVIMENTO.md`:

- lista de módulos, `desktop.tsx` (linha 70): a contagem de linhas do arquivo, e "os cartões de sessão
  são `Box` com borda e fundo translúcido" ganha "por nível, com respiro nos quatro lados";
- "O que só é verificável no app" (linha 671): acrescentar a altura das linhas, o texto centrado, o
  respiro dos cartões e o degrau de tom por nível;
- seção "Desenho nativo híbrido (2026-11-13)":
  - no item do cartão destacado (linha 1654), os valores passam a ser os do nível 0 e o texto aponta
    para o item novo ("Um cartão dentro de outro soma o tom" deixa de ser a regra);
  - no item das guias (linha 1674), "o conector fica num bloco de `ROW_H` no alto" vira: depois de um
    trecho de barra com a altura do respiro do cartão;
  - um item novo: as palavras dele (o pedido e as três respostas: "1,4", "Não, fica como está
    (Recomendado)", "nos 4 lados"), as medidas do print (linha de 20 px, 7 px entre textos, texto a
    1 px da borda de baixo), a referência do desenho em SVG (28 px e 6 px), os valores (item 2.1), as
    duas contas do alfa, por que o respiro vertical são caixas com altura e não `paddingY`, por que o
    conteúdo é centrado nas caixas e não no `r<i>`, e a forma do trecho de barra do conector;
  - as medidas do harness, se forem refeitas.

`CLAUDE.md`, "Checklist do app", item do desenho nativo (linha 170): onde diz "o cartão dentro de
cartão (um tom a mais)", passa a dizer um degrau igual a cada nível, nos dois temas; e entram a altura
das linhas com o texto no meio, o respiro dos cartões nos quatro lados, e o conector chegando na
altura do cabeçalho do cartão.

Nada em `task-tree/text/rules.ts`.

## 7. O que o check acusa depois

Com o código, os testes, o kit, o catálogo e os quatro selos do item 5.3:

- `regras`, `travas`, `selos`, os dois `validate` e o `tsc`: passam.
- `claude plugin test task-tree`: os 3 testes novos passam; os 4 do golden falham com "o desenho de
  envios|filha|principal|subagente mudou". Em cada cenário, contra o golden de `fdbefcb`:
  - `Box key="head"` (os 4): o texto do fundo e o da borda;
  - toda linha `r<i>` (os 4): `height` de 1 para 1.4, e `alignItems` nas caixas do título e da direita
    (e nas do rótulo de sessão). Nenhum nó novo na linha;
  - todo `Box` de cartão (1 em `filha`, 1 em `envios`, 3 em `subagente`, nenhum em `principal`): o
    fundo e a borda do nível 0, `paddingX` de 1 para 2, e as duas caixas vazias de 0.3;
  - toda faixa `strip` (as mesmas 5): na última célula, o trecho de barra de 0.3 antes do bloco, e o
    bloco com `height` 1.4;
  - nenhum texto, `alt`, key ou fonte de `Svg` muda. Nenhum cenário do golden tem cartão dentro de
    cartão: os níveis 1 e 2 ficam cobertos só pelo teste A.
- `regressao`: os 4 testes do golden de `HEAD` falham contra o código novo; a etapa só aceita com o
  golden regravado no dia. Os outros testes de `HEAD`, os do ajuste 3 incluídos, têm de passar.
- O golden segue o que vale nesta série (commits `e15780c` e `fdbefcb`): regravado com
  `npm run golden:aprovar -- --todos --motivo "\"Validar só no fim (Recomendado)\", 2026-11-13"`, por
  quem as instruções do implementador indicarem, e validado por ele no app no fim.

## 8. Checklist do app

O harness só vê a árvore. Nos dois temas, com uma sessão filha que tenha um subagente dentro:

1. O cartão e o cabeçalho um pouco mais destacados do painel que antes, com a borda visível.
2. O cartão de dentro um degrau além do de fora (mais claro no escuro, mais escuro no claro); com três
   níveis, os dois degraus parecem iguais.
3. O texto apagado (`inactive`) continua legível dentro do cartão de nível 2.
4. As linhas mais espaçadas, com o ícone, o título, a contagem e o tempo na mesma altura, no meio da
   linha. No rótulo da sessão, o nome, a branch, o toks/s e o modelo (textos de tamanhos diferentes)
   parecem na mesma linha de base.
5. As guias contínuas com a linha mais alta, e o braço chegando no meio do ícone.
6. No cartão, o conteúdo longe das quatro bordas. À esquerda o ícone fica mais longe da borda (cerca
   de 23 px) do que o tempo fica da direita (cerca de 15 px): conferir se parece equilibrado.
7. O conector da faixa chegando ao cartão na altura do ícone do cabeçalho dele (pode ficar 1 px
   acima), sem falha entre o trecho novo e o resto da barra.
8. O cartão de uma linha só (subagente concluído, cartão recolhido) com os cantos inteiros e o texto no
   meio.
9. Cartão dentro de cartão em painel estreito: o que sobra de largura para os títulos de dentro.
10. O realce dos botões (ícone, busto, anel, ▸ das seções) centrado no ícone.
11. O que cabe no rótulo da sessão em painel estreito (repositório, modelo, toks/s saem nessa ordem).
12. Recarga a quente sem "reload failed"; nada pisca.

Se o cartão de dentro sair igual ao de fora, o app não soma a cor translúcida: anotar. Se o respiro
de cima e de baixo não aparecer, o app não desenha a caixa vazia com altura: anotar.

## 9. Riscos, interações e decisões do usuário

- Cor somada entre cartões é dedução (item 1). Se o app não somar, o cartão de dentro sai quase igual
  ao de fora. A saída seria dar ao nível k o alfa acumulado (10 %, 20 %, 30 %…), o que não é este
  plano: só com o que ele vir no app.
- Texto apagado sobre o nível 3 ou 4 no escuro (`#454542`, `#50504c`) perde contraste. Três cartões em
  volta é raro; se incomodar, a tabela para de crescer mais cedo.
- Linha de base: com o conteúdo centrado, textos de tamanhos diferentes na mesma linha (o rótulo da
  sessão) são centrados pelo meio, não pela base. Item 4 do checklist.
- Largura dentro de cartões aninhados: cada cartão tira 5 colunas (hoje 3), fora a faixa. A 60
  colunas, três cartões um dentro do outro tiram 15 colunas só de respiro e borda. O piso de 10
  colunas de `inner` não muda. Item 9 do checklist.
- Lados desiguais a olho: com 2 colunas dos dois lados, o ícone fica a cerca de 23 px da borda esquerda
  e o texto da direita a cerca de 15 px, porque a célula do ícone tem folga própria. É o que "nos 4
  lados" dá com o mesmo valor dos dois lados. Item 6 do checklist.
- Painel 40 % mais alto: mais rolagem. O corte de 400 linhas e o de 600 KB não mudam de regra. O
  desenho cresce cerca de 45 B por linha (2,5 %) e cerca de 300 B por cartão; o corte por tamanho chega
  um pouco antes.
- A forma do trecho de barra do conector é presa pela leitura do kit (item 2.6). Quem mexer nela
  precisa manter os testes do ajuste 3 passando.
- Nenhuma primitiva nova no app: altura fracionária de `Box` (a mini barra), `alignItems` e
  espaçamento inteiro já são desenhados hoje.
- Recarga a quente: o mod muda num arquivo só (`desktop.tsx`); um salvamento.
- Série 1, 3, 4: o ajuste 2 (margem esquerda) saiu, e este plano não toca a margem do painel. Este
  ajuste parte de `fdbefcb`. Do que o ajuste 3 pediu aos outros, tudo é mantido: a altura muda só no
  `ROW_H`; o bloco do conector usa o mesmo `ROW_H`; o conector desce o respiro do cartão; não há
  `columnGap` nem margem entre a faixa e o cartão; a faixa segue irmã do `Box` do cartão.

Fora deste ajuste (notado, sem mexer):

- O bloco de números do cabeçalho ("100 %", "12 de 12") fica a cerca de 8 px da borda direita; o
  cabeçalho já tem respiro vertical. O "nos 4 lados" foi resposta sobre o cartão; o cabeçalho só
  acompanha o cartão no fundo e na borda. É uma prop em `head.tsx`, se ele quiser igualar.
- Dois cartões seguidos ficam com as bordas encostadas (linha dupla). Espaço entre cartões teria de
  entrar dentro do `c<i>`, para não abrir vão nas guias.
- No desenho em SVG a linha de nível 0 tinha 30 px; aqui todas têm a mesma altura.

Decisões do usuário sobre os três pontos que a primeira versão deste plano deixou em aberto, todas de
2026-11-13:

1. Altura da linha: "1,4". Fica como proposto (itens 2.1 e 2.4).
2. Mais espaço entre o ícone e o título: "Não, fica como está (Recomendado)". Saíram a caixa de meia
   coluna, a troca na conta de `room`, a leitura dessa folga no kit e a afirmação correspondente do
   teste B (item 2.7).
3. Folga lateral do cartão: "nos 4 lados". O respiro cresce em cima, embaixo, à esquerda e à direita:
   `paddingX` 2 (antes o plano crescia só à direita) e `CARD_COLS` 5 (itens 2.1 e 2.5). O conector da
   faixa segue com o trecho do respiro de cima e não muda por causa dos lados (item 2.6). O teste C e o
   cenário `visual.cartao-com-respiro` passaram a afirmar os quatro lados.

## 10. Bloqueio

Nenhum. As decisões registradas que tocam o assunto são seguidas ou desfeitas pelo próprio pedido:

- "calcule qual seria a terceira cor" e "use a mesma cor da borda" (a referência do ajuste 1): o
  pedido novo pede o cartão um pouco mais claro que essa referência; o cinza e o mecanismo são os
  mesmos.
- "Sim, junto do cartão (Recomendado)": o cabeçalho segue com o fundo e a borda do cartão de fora.
- "Caixas finas nativas (Recomendado)": as guias seguem contínuas; o espaço entra só pela altura da
  linha e por caixas dentro do cartão.
- "migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG": nenhum
  `Svg` novo.
- "Validar só no fim (Recomendado)": o golden é regravado e validado no fim.
- "1,4", "Não, fica como está (Recomendado)" e "nos 4 lados": aplicadas como estão no item 9.
- Não há cenário em `regras/` sobre altura de linha, respiro ou contraste por nível que o plano
  contrarie (busquei "espaç", "altura", "respiro", "padding", "contraste").
