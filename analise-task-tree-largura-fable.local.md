# Largura do painel: a 0.7.7 corta no outro dev e não aqui (análise, só leitura)

Sessão `analise-largura-painel` (Fable 5.1), 2026-10-27. Código lido na v0.7.7 (`4a3a425`, main =
origin/main nas duas máquinas), commits `3517f84`, `f34e719`, `12a27c8`, e o bundle do app
(`AppData\Local\AnthropicClaude\app-3.6556.2\resources\ion-dist\assets\v1\c2719cf1b-6DwSkJnU.js`;
o `app-3.1623.4` desenha a `Svg` do mesmo jeito).

Notícia que mudou a leitura: aqui, com a 0.7.7, o painel ficou correto; no outro dev, com a mesma
0.7.7, continua cortado a ~427 px. Logo não é o código em si, é o código reagindo ao ambiente.

## Causa em uma frase

A 0.7.7 ainda desenha tudo em W = `floor(bodyColumns × 8,6)` (`task-tree/draw/geometry.ts:21-26`,
`task-tree/hooks/render.tsx:403`) e só "puxa" para a borda real o que sobra quando a imagem é mais
larga que W, porque `slot(W) = max(100%, W px)` tem piso em W (`task-tree/draw/svg.ts:113`); na máquina
do dev a fonte de código tem avanço por coluna menor que 8,6 px, `bodyColumns` sai maior para a mesma
largura, W passa da imagem e tudo o que fica à direita de ~427 px é cortado pela própria imagem.

## Por que lá corta e aqui não (mecanismo, com arquivo:linha)

1. **`bodyColumns` vem do avanço da fonte de código do app.** No bundle (função `I_`):
   `bodyColumns = floor((clientWidth − paddingLeft − paddingRight − reservedPx) / cell.width)`, onde
   `cell.width` é o avanço do caractere da fonte de código (muda com a fonte instalada, o tamanho da
   fonte de código escolhido no app e a escala da tela). O tipo diz o mesmo
   (`task-tree/.claude-plugin/types/claude-code/index.d.ts:10925-10933`: "the pane's width over the
   advance of its code font").
2. **W é `bodyColumns × 8,6`, e 8,6 foi medido aqui** (`geometry.ts:16-21`: 77 colunas ≈ 670 px). Isso
   é `cell.width` daqui mais a parte do padding/reservado dividida pelas colunas. Em outra máquina:
   - avanço menor que o daqui (fonte de código menor ou mais estreita): mais colunas para o mesmo
     painel → **W > imagem** → corte (o caso do dev);
   - avanço maior: **W < imagem** → sobra (o que aqui acontecia na 0.7.6, com `width={W}` fixo).
   Exemplo com os números do print: painel ~427 px; para cortar basta `bodyColumns ≥ 50`, ou seja,
   `cell.width ≤ (427 − padding − reservado) / 50 ≈ 7,3 px` (fonte de código de 12 px: 7,2 px);
   aqui `cell.width ≈ 7,87` (escala 1,25; `geometry.ts:5-12`) e 8,6 fecha com o painel.
3. **A 0.7.7 só trata W < imagem.** `slot(W) = max(100%, W px)` (`svg.ts:113`), e `toRight` desloca
   `calc(slot(W) − W px)` (`svg.ts:114-115`): com a imagem mais estreita que W o deslocamento é 0 e os
   miolos (`calc(slot(W) − K px)`, `svg.ts:455-461`, `:559`, `:611-613`) ficam em W − K. Tudo
   permanece em px de W, maior que a imagem, e a imagem (`<img>` com `width="100%"` da coluna,
   `render.tsx:125-129`; estilo `display:block; max-width:100%` dado pelo app, função `Wf` do bundle)
   corta o que passa da sua viewport. O comentário em `svg.ts:108-112` registra esse caso como
   "cortado na borda, como antes": é o que o dev vê.
4. **O que o print do dev mostra, batendo com isso:**
   - nas linhas de tarefa concluídas, depois de "3/3" não há tempo nem "—"; mas toda tarefa
     concluída desenha um tempo (`layout.ts:969-974`: `time` número ou `null`, e `svg.ts:510-511`
     desenha "—" para `null`) em `R = W − 8` (`svg.ts:496`). A coluna do tempo está lá, mas além da
     borda da imagem: **W > ~427**;
   - o cartão do cabeçalho não mostra a borda direita (a peça da direita está em `W − 2,5`,
     `svg.ts:590`, deslocada por 0) e a barra vai até perto da borda (`W − 14,5`);
   - os botões ≡/▤ ficam na borda real do painel (`Box` absoluto com `right=0`, `render.tsx:138`),
     por cima do cartão cortado: eles são do app e não dependem de W.
   - Aqui, após o `git pull`, a imagem é ≥ W: `toRight` leva a coluna da direita e a borda do cartão à
     borda real, e a sobra some. Por isso "funciona normal" aqui.
5. **Hipótese do avanço da fonte, não da escala:** px CSS não mudam com a escala do Windows; o que muda
   é `cell.width` (fonte e tamanho da fonte de código do app). Também pode haver diferença de
   `reservedPx` (espaço que o app reserva à direita), que entra no mesmo cálculo. Os dois casos têm a
   mesma correção abaixo.

## Correção que não depende do ambiente

Princípio: nada que seja posição final pode depender de W; W (ou qualquer estimativa) só pode servir
para decidir **o que cabe** e precisa errar sempre para baixo.

1. **Tirar o piso de W** (`svg.ts:113`): `slot(W)` vira `100%` puro, e `toRight` vira
   `translateX(calc(100% − W px))`, que é negativo quando a imagem é mais estreita que W: a coluna da
   direita (tempo, contagem, barra, ⑂, anel, modelo, taxa), a peça direita do cartão e os miolos
   (`calc(100% − K px)`) passam a terminar na borda real da imagem nos dois sentidos, com qualquer
   fonte. Isso sozinho resolve o corte do dev e mantém o que já funciona aqui. Conferir que o `100%`
   do `translateX` em `<g>` com `transform-box: view-box` resolve contra a viewport da imagem (é o que
   o Chromium faz e o que já sustenta a 0.7.7 aqui).
2. **W só para o que cabe, e conservador.** `fit` dos títulos (`svg.ts:550`, `labelName`
   `svg.ts:354-360`), as escolhas repo/modelo/taxa (`svg.ts:386-397`) e os chips do cabeçalho
   (`svg.ts:596-615`) continuam contra `textRight(W, …)`. Para isso W não pode ser maior que a imagem
   em nenhuma máquina: trocar `COL_PX = 8,6` por um piso do avanço (`CELL` = 8, ou 7,5, cobrindo fonte
   de código de 12 px) e tirar o `+ padding/reservado` que o 8,6 embutia. Custo: numa fonte larga o
   título é cortado com "…" alguns px antes da coluna da direita (vão), nunca por cima dela.
3. **Garantia sem estimativa para o título.** Como segunda camada, o texto do título recebe um
   `clip-path: inset(0 calc(100% − (100% − K px)) …)`, ou melhor um `<clipPath>` com `<rect
   style="width:calc(100% − K px)">` (K = o que a coluna da direita ocupa em px fixos, que já é
   contado em W: `svg.ts:512-532`): se a estimativa falhar, o título é recortado na borda da coluna da
   direita em vez de passar por baixo dela. Sem "…" nesse caso, mas sem sobreposição.
4. **Camadas interativas em px de W** (`render.tsx:135`, `width={W − 64}`; `geometry.ts:133-135`,
   camada do nome): com W conservador ficam dentro do painel. Opcional: `width` da camada do
   cabeçalho pela mesma regra (W − ICONS_W) e conferir a regra de não cruzar (`geometry.ts:157-168`).
5. **Diagnóstico de 1 linha, se quiser medir antes:** um `<rect y="0" height="2" style="width:100%">`
   colorido no `headerSvg` e um `<rect x="${W − 2}" width="2">`: na tela do dev, o primeiro termina na
   borda real e o segundo além dela; a diferença é o erro de W naquela máquina. Também serve para
   calibrar o piso do item 2 (pedir ao dev o tamanho da fonte de código no app).
6. **Validação visual obrigatória** nas duas máquinas e nas duas larguras (~427 e ~809 px), antes de
   dizer que está corrigido.

## O que não foi verificado

- Não medi `cell.width` nem `reservedPx` na máquina do dev (o diagnóstico do item 5 mede; basta
  perguntar ao dev a fonte/tamanho da fonte de código no app para estimar).
- A leitura do print é por olho (imagem reduzida): a evidência mais forte é a ausência da coluna do
  tempo nas tarefas concluídas, que o código sempre desenha.
- Nada foi editado nem rodado; sem commit.
