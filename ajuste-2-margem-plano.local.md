# Plano do ajuste 2: a árvore afastada da margem esquerda (PR 37)

Escrito pelo planejador do ajuste 2 em 2026-11-13, sobre `feat/painel-nativo` na ponta `22ad5de`.
Só leitura: nenhum arquivo do repositório foi tocado, nenhum teste foi rodado.

## Resumo

- O que muda no mod: um arquivo só, `task-tree/hooks/render.tsx`. A raiz do desenho do app ganha 2
  colunas de espaço à esquerda, e o cabeçalho e a árvore passam a contar as colunas do painel menos
  essas 2.
- O cabeçalho entra no ajuste: no print ele está cortado pela mesma causa (sem a borda esquerda e sem
  a faixa de estado).
- A causa do corte não está no código do mod e não pôde ser confirmada pelo repositório. Há uma
  confirmação pendente com o usuário (seção "Ponto em aberto"), que não contraria nenhuma decisão
  registrada. O plano vale nas duas hipóteses principais.
- Nenhum bloqueio por decisão registrada.

## 1. Causa

### O que está escrito no código

- `hooks/render.tsx`, linha 95: a raiz do desenho do app é um `Box` em coluna, sem `padding` nem
  `margin`. Os filhos diretos são a linha de erro, o cabeçalho e as linhas da árvore.
- `draw/head.tsx`, linha 104: o cabeçalho é um `Box` com `borderStyle="round"`, sem margem; a borda
  dele fica na coluna 0 da raiz e a faixa de estado (`width={1}`, linha 105) logo depois.
- `draw/desktop.tsx`, linha 34: uma linha de profundidade 0 não tem guias (`cells` devolve vazio).
  O primeiro elemento dela é a célula do ícone (`iconCell`, linhas 50 a 65: 3 caracteres mono de
  largura, o `Svg` de 16 px no meio) ou, na seção "+N pedidos anteriores", o `Box` de 3 colunas com o
  botão ▸ (linhas 195 a 197). Os dois começam na coluna 0 da raiz.
- `draw/desktop.tsx`, linhas 334 a 349: num cartão de profundidade 0 (o cartão solto) a tira de
  guias é vazia (`wide` = 0), então o `Box` com borda (`CARD`, linha 301) é o primeiro elemento, na
  coluna 0 da raiz.
- Contas, com a célula de cerca de 7,8 px: o ícone do primeiro nível fica de 3,8 px a 19,8 px da
  borda da raiz; a borda do cartão solto e a do cabeçalho ficam em 0.
- O desenho antigo em SVG (apagado em `d5b5ad3`; `draw/geometry.ts` em `d5b5ad3^`) tinha
  praticamente as mesmas margens: ícone centrado em 12 px (`COL_0`; de 4 a 20 px), cartão de
  profundidade 0 a 0,5 px da borda, cartão do cabeçalho a 2,5 px (`CARD_RIGHT`). A raiz já era um
  `Box` em coluna sem `padding`. Ou seja: a migração para o nativo não tirou uma margem que existia.

### O que foi medido no print (leitura dos pixels, sem gravar nada)

- Escala 1,5: uma coluna tem cerca de 11,67 px do print (7,8 px de CSS).
- O ícone do primeiro nível ("Cartão do subagente não aparece…", y = 243) tem o centro em x entre 0
  e 1,5: aparece só a metade direita. O ▸ de "+57 pedidos anteriores" (y = 213) também.
- Cabeçalho: a borda de cima chega a x = 0 sem o canto arredondado da esquerda; não há borda
  esquerda nem faixa de estado em nenhuma linha lida (y = 60, 100, 150); a pílula "1 sessão ativa"
  começa em x = 9, onde a conta do código daria 24,8.
- Cartão solto: as bordas de cima (y = 377) e de baixo (y = 1021) chegam a x = 0; não há borda
  esquerda.
- Tudo está deslocado na mesma medida, cerca de 16 px do print (10,7 px de CSS, 1,4 coluna):
  cabeçalho, árvore e cartão. À direita nada passa da borda da raiz (x = 1362), e sobram 36 px
  vazios até o fim do print.

### O que é dedução

- O corte é da raiz inteira, não da árvore: o cabeçalho tem a mesma causa.
- O mod não tem como produzir esse corte sozinho: não há margem negativa, deslocamento nem nada à
  esquerda da raiz. Sobram três hipóteses, que o repositório não decide:
  1. o painel do app esconde uma faixa de cerca de 11 px de CSS à esquerda do corpo;
  2. o print foi recortado à mão cerca de 16 px para dentro do painel (o print não mostra a moldura
     do painel em nenhum lado, então é um recorte manual);
  3. o corpo do painel está deslocado na horizontal (rolagem lateral).
- Contra a hipótese 1: o desenho antigo tinha os ícones no mesmo lugar (4 a 20 px) e foi validado
  várias vezes sem corte. Ela só se sustenta se o app mudou.
- Em qualquer hipótese, o que o código garante é que a árvore fica encostada (0 a 4 px) na borda do
  corpo do painel.

## 2. O que muda

Arquivo do mod: `task-tree/hooks/render.tsx`, e só ele. `draw/desktop.tsx` e `draw/head.tsx` não
mudam, o que evita colisão de texto com os outros três ajustes.

- Uma constante nova no topo do arquivo, junto de `TEXT_LIMIT`: a margem esquerda do desenho do app,
  valor 2 (colunas). O comentário dela cita o pedido do usuário e a data (2026-11-13, "outro exemplo
  de comportamento estranho", com o print) e diz o que ela protege: a borda e a faixa do cabeçalho,
  os ícones do primeiro nível, o ▸ da seção e a borda do cartão solto.
- `drawDesktop` (linha 95): o `Box` raiz ganha `paddingLeft` com essa constante. Vale para a linha
  de erro, o cabeçalho e a árvore; os três continuam alinhados entre si.
- No ramo do app de `paint` (linha 292): `cols` passa a ser as colunas do painel (`bodyColumns`, ou
  40 na falta) menos a constante. A subtração é feita uma vez, nessa definição: o valor já vai a
  `desktopHead` (linha 304) e a `drawDesktop`/`desktopTree` (linha 305). A chave `pane` do mapa
  `fitted` (linha 359) segue com o `bodyColumns` cru.
- Sem margem à direita: no print já sobram cerca de 24 px de CSS depois da borda da raiz.
- O terminal (`drawTerminal`) não muda.

Por que 2 colunas: são cerca de 15,6 px de CSS. Se o app esconde 10,7 px (hipótese 1), a borda do
cabeçalho e a do cartão ficam 4,9 px para dentro da parte visível e os ícones 8,7 px; com 1 coluna
(7,8 px) a borda seguiria cortada. Se o print é que foi recortado (hipótese 2), 2 colunas viram um
recuo de 15,6 px, sem dano. O valor é um número inteiro de colunas, como os outros `padding` do
desenho (`paddingLeft={1}` nas linhas já funciona no app, como o print mostra). Não há cor
envolvida, então não depende do tema.

Fora do plano, de propósito: o aviso "Painel grande demais" (linha 382) e a linha de erro do `catch`
(linha 397) têm raiz própria e valem também para o terminal. Não ganham a margem.

## 3. Matriz de impacto

`npm run impacto -- task-tree/hooks/render.tsx`:

- Núcleo tocado (`hooks/render.tsx`): todos os 149 cenários cobertos (o check roda todos).
- Checklist do app listado: `cabecalho.aviso-de-painel-grande-volta`,
  `envios.destino-arquivado-no-app`, `subagentes.cartao-no-app`, `subagentes.lancados-juntos-no-app`,
  `subagentes.neto-no-app`, `subagentes.sem-fim-no-app`, `ultracode.cor-e-corte`,
  `visual.largura-real`, `visual.cliques-no-icone-e-no-anel`, `visual.animacao-de-linha-nova`,
  `visual.cores-dos-temas`, `visual.cabecalho-em-cartao`, `visual.status-embaixo-da-caixa`,
  `visual.cartao-modelo-e-esforco`, `visual.cartao-posicao-de-toks-e-repo`,
  `visual.cartoes-ordem-e-espera`, `visual.recarga-real-e-respawn`,
  `visual.cabecalho-barra-e-chips-desenhados`, `visual.secao-sem-traco`.
- Golden: `visual.desenho-principal`, `visual.desenho-cartao-filha`, `visual.desenho-envios`,
  `visual.desenho-subagente`.
- Fora do mapa: nenhum.

Os que interessam de fato a este ajuste: os quatro do golden, `visual.largura-real`,
`visual.cabecalho-em-cartao` e `visual.cliques-no-icone-e-no-anel`.

## 4. Testes

### Leitura nova no kit (`task-tree/tests/kit/leitura.ts`)

Uma leitura do desenho do app, `recuoDoApp(d, key)`: as colunas livres entre a borda esquerda do
painel e a borda esquerda do `Box` com essa key.

- Anda de `d.raiz` até o primeiro `Box` com a key e soma, em cada ancestral (a raiz incluída, o
  próprio `Box` não), o espaço interno da esquerda: `paddingLeft`; na falta, `paddingX`; na falta,
  `padding`. Soma também a margem esquerda (`marginLeft`, `marginX`, `margin`, nessa ordem) dos
  ancestrais e do próprio `Box`.
- Só números. Um nome de passo (`'sm'` etc.) faz a leitura falhar com erro, para ninguém usar um sem
  perceber.
- Sem a key no desenho, devolve `undefined`.
- Não conta irmãos à esquerda na mesma linha: serve para o que é o primeiro elemento do seu
  contêiner (cabeçalho, linha fora de cartão, `Box` `c<i>` de um cartão). Dizer isso no comentário.
- Para o cartão que uma linha encabeça, a key é `c` mais o índice da key `r<i>` da linha; essa
  regra fica dentro do kit (uma segunda leitura pequena, ou uma opção da primeira), não no teste.

### Teste 1, novo, em `task-tree/tests/visual.test.ts`

- Nome: `no app, o cabeçalho, a seção, as linhas do primeiro nível e o cartão solto ficam afastados da margem esquerda`
- Cita: `visual.margem-esquerda`.
- Roteiro: o do print. Um pedido antigo com uma filha parada que deixou uma tarefa aberta, e depois
  três pedidos novos, cada um planejado, iniciado, concluído e com o turno encerrado, com o relógio
  avançando entre eles. O modelo é `filhasNoPedidoAntigo`, em `tests/sessoes.test.ts`, linhas 465 a
  494; basta a filha viva. O painel fica com "+N pedidos anteriores" em cima, os pedidos novos no
  primeiro nível e o cartão solto `viva · do pedido "Pedido antigo"` no fim.
- Afirma, lendo `noApp($)`:
  1. o recuo do cabeçalho (key `head`) é pelo menos 2;
  2. a linha da seção (a que casa com "pedidos anteriores") existe, tem o ▸ como botão e recuo de
     pelo menos 2;
  3. a linha do primeiro nível "Pedido 4" tem recuo de pelo menos 2 e o primeiro pedaço dela é o
     ícone (um `Svg`), sem guia antes;
  4. o cartão solto (o cartão que a linha `viva · do pedido "Pedido antigo"` encabeça) tem recuo de
     pelo menos 2.
- Por que "pelo menos 2" e não "igual a 2": os ajustes seguintes podem acrescentar espaço interno
  sem quebrar este teste.
- Por que falha hoje: a raiz não tem `paddingLeft`; os quatro recuos dão 0.
- A confirmar ao escrever: que esse roteiro desenha a seção e o cartão solto no app (`layout.ts`,
  linhas 1419 a 1431 e 1613 a 1618, diz que sim: os dois saem com profundidade 0).

### Teste 2, novo, em `task-tree/tests/visual.test.ts`

- Nome: `no app, o que cabe é contado sem as colunas da margem: com 85 colunas o cabeçalho ainda é o estreito`
- Cita: `visual.margem-esquerda`.
- Roteiro: um pedido, um plano de uma tarefa iniciada, e o ultracode ligado como em
  `tests/ultracode.test.ts` (o stub de `prompt.attachment` antes da primeira chamada a `$`, depois o
  attachment `ultra_effort_enter`). O painel do app é montado duas vezes: `noApp($, { colunas: 85 })`
  e `noApp($, { colunas: 86 })`.
- Afirma:
  1. com 85 colunas, o cabeçalho não tem nenhum pedaço de texto igual a "ultracode" (a palavra segue
     no texto alternativo da barra, que é pedaço de `Svg`);
  2. com 86 colunas, tem.
- Por que serve: o cabeçalho é o estreito abaixo de 84 colunas (`NARROW`, `draw/head.tsx`, linha
  56), e o estreito não escreve "ultracode" no bloco de números (linhas 96 e 97). Com a margem,
  85 − 2 = 83 é estreito e 86 − 2 = 84 não é. A segunda afirmação trava uma subtração maior que 2.
- Por que falha hoje: com 85 colunas `cols` é 85, o cabeçalho não é o estreito e escreve
  "ultracode".
- Por que no cabeçalho e não no rótulo do cartão: o limiar de 84 não depende dos espaços internos
  do cartão, que o ajuste 4 vai mexer.

### Testes existentes

Nenhum muda. Conferido por leitura:

- os testes que leem o app (`visual`, `ultracode`, `taxa`, `cabecalho`) acham o cabeçalho e as
  linhas pela key em qualquer profundidade; a raiz com `paddingLeft` não os afeta;
- a 60 colunas (58 depois da margem), o que cabe não muda em nenhum deles: o rótulo de
  `ultracode.cartao-da-filha` precisa de 22 colunas e tem 33; os testes do cabeçalho leem o texto
  alternativo;
- os testes de 600 KB de `cabecalho.test.ts` têm folga: o desenho cresce uns 16 bytes.

Os quatro testes do golden falham até a aprovação (seção 7); o corpo deles não muda.

## 5. Catálogo (`regras/visual.md`)

### Cenário novo, coberto

```markdown
### visual.margem-esquerda
O desenho do app fica afastado da margem esquerda do painel.

- Dado o painel no app desktop, com a linha "+N pedidos anteriores", linhas do primeiro nível e um cartão de sessão solto (sem tarefa de origem à vista)
- Quando o painel é desenhado
- Então o cabeçalho, o ▸ da seção, os ícones do primeiro nível e o cartão solto começam pelo menos 2 colunas depois da margem esquerda, e o que cabe (cabeçalho estreito ou não, rótulo do cartão, pílulas) é contado nas colunas que sobram

Origem: decisão do usuário, 2026-11-13 ("outro exemplo de comportamento estranho", com o print do painel nativo: os ícones do primeiro nível, o ▸ e o cartão solto cortados na margem esquerda).
Código: hooks/render.tsx
Estado: coberto
```

### Cenário novo, de checklist

```markdown
### visual.margem-esquerda-no-app
No app, nada do painel sai cortado na margem esquerda.

- Dado o painel aberto no app, com "+N pedidos anteriores", linhas do primeiro nível e um cartão solto
- Quando o painel é desenhado, nos dois temas, e depois de clicar num ícone e de rolar o painel
- Então a borda esquerda e a faixa de estado do cabeçalho, os ícones do primeiro nível, o ▸ e a borda esquerda do cartão solto aparecem inteiros

Origem: decisão do usuário, 2026-11-13 ("outro exemplo de comportamento estranho"); o que o harness não alcança de visual.margem-esquerda.
Código: hooks/render.tsx
Estado: checklist (pintura real; a borda do painel é do app)
```

### Reescritos

Nenhum. Os quatro `visual.desenho-*` não mudam de regra; o golden deles é regravado com as palavras
do usuário (seção 7).

### Selos, da raiz do repositório, nesta ordem

```bash
node scripts/selos.mjs --kit task-tree/tests/kit/leitura.ts --tipo refatoracao --motivo "kit: recuoDoApp, as colunas livres à esquerda de um Box do desenho do app (margem esquerda, 2026-11-13)"
npm run regras:selar -- "task-tree/tests/visual.test.ts::no app, o cabeçalho, a seção, as linhas do primeiro nível e o cartão solto ficam afastados da margem esquerda" --tipo novo --motivo "margem esquerda do desenho do app: 2 colunas na raiz; pedido do usuário, 2026-11-13"
npm run regras:selar -- "task-tree/tests/visual.test.ts::no app, o que cabe é contado sem as colunas da margem: com 85 colunas o cabeçalho ainda é o estreito" --tipo novo --motivo "margem esquerda do desenho do app: o que cabe conta as colunas menos a margem; pedido do usuário, 2026-11-13"
```

Se outro ajuste aplicado antes ou depois também mexer em `kit/leitura.ts` ou em `regras/selos.json`,
basta rodar de novo os comandos acima sobre o arquivo final: o selo do kit é o hash do arquivo
inteiro.

## 6. Documentação

- `task-tree/DESENVOLVIMENTO.md`, seção "Desenho nativo híbrido (2026-11-13)": um item novo com a
  margem esquerda (a raiz do desenho do app tem 2 colunas de `paddingLeft` em `drawDesktop`; o
  cabeçalho e a árvore contam `bodyColumns` − 2), o motivo (o print de 2026-11-13) e o que ficou sem
  confirmar (a causa do corte é do app ou do recorte do print; o desenho antigo tinha as mesmas
  margens).
- `CLAUDE.md`, "Checklist do app": no item "largura real e recorte na borda, nos dois temas",
  acrescentar a margem esquerda (borda e faixa do cabeçalho, ícones do primeiro nível, ▸ e borda do
  cartão solto inteiros).

## 7. O que o check deve acusar

- `regras`, `travas`, `selos`, os dois `validate` e o `tsc`: passam, com o cenário novo, os dois
  testes e os três selos.
- `plugin test`: os quatro testes de `tests/golden.test.ts` falham com "o desenho de <cenário>
  mudou", nos quatro cenários (principal, filha, envios, subagente). A diferença esperada é uma só,
  logo no começo de cada árvore: as props do `Box` raiz passam de `flexDirection` para
  `flexDirection` e `paddingLeft` 2.
- Nada mais deve mudar nos quatro, conferido por conta a 58 colunas: o rótulo do cartão de "filha"
  segue com repositório, branch e toks/s (precisa de 27,6 colunas, tem 29); as pílulas seguem só
  com números em "envios", "filha" e "principal" e com as palavras em "subagente" (37 colunas, tem
  41). Outra diferença no golden é sinal de erro (ou é de um ajuste aplicado antes).
- `regressao`: o golden de `HEAD` falha contra o código novo e só é aceito com o desenho aprovado no
  dia. A mudança fica sem commit até o usuário validar no app; aí
  `npm run golden:aprovar -- --todos --motivo "\"<palavras dele>\", AAAA-MM-DD"`. Não rodar antes.

## 8. Checklist do app

O harness não vê a pintura nem a borda do painel. O usuário confere, nos dois temas:

1. a borda esquerda e a faixa colorida do cabeçalho aparecem inteiras;
2. os ícones do primeiro nível e o ▸ de "+N pedidos anteriores" aparecem inteiros;
3. a borda esquerda e os cantos do cartão solto aparecem; ela fica alinhada com a do cabeçalho;
4. o realce do botão sobre um ícone do primeiro nível não sai cortado à esquerda;
5. à direita nada mudou: as linhas terminam na borda real, os tempos inteiros;
6. depois de clicar num ícone, no anel e de rolar o painel, a esquerda continua inteira (se o corte
   voltar só depois de um clique, é deslocamento do corpo do painel, e a margem não resolve);
7. com o painel estreito, o rótulo do cartão segue tirando repositório, depois modelo, depois
   toks/s, e nada estoura.

## 9. Riscos e interações

- A causa não está confirmada (seção 1). Se o corpo do painel estiver deslocado por rolagem lateral,
  a margem não resolve: o item 6 do checklist mostra isso.
- Se o corte for só do recorte do print, o ajuste vira um recuo de 15,6 px sem necessidade técnica.
  O número fica numa constante só.
- A árvore e o cabeçalho ficam 2 colunas mais estreitos: os títulos cortam 2 caracteres antes.
- Ajuste 1 (fundo e borda do cartão): mexe em `CARD` e talvez no cabeçalho; não toca a raiz. As
  diferenças no golden se somam; a aprovação no fim cobre as duas.
- Ajuste 3 (guias): mexe em `cells` e nas tiras; não toca a raiz. Os testes novos afirmam "pelo
  menos 2", e seguem valendo se a célula do ícone mudar.
- Ajuste 4 (contraste e espaços internos): se mudar o espaço interno do cartão, não afeta os testes
  novos (a leitura soma só os ancestrais do `Box` lido, e o teste 2 usa o cabeçalho).
- `regras/selos.json` e `kit/leitura.ts` são os pontos de colisão entre os ajustes: refazer com os
  comandos da seção 5.
- Recarga a quente: a mudança do mod é num arquivo só; não há estado intermediário.

## 10. Bloqueio

Nenhum. A margem não contraria decisão registrada: `visual.cabecalho-em-cartao`,
`visual.largura-real` e os `visual.desenho-*` seguem valendo (o golden passa pela validação do
usuário, como manda o `CLAUDE.md`).

## Ponto em aberto (não é bloqueio por decisão)

Vale uma pergunta ao usuário antes de implementar, porque decide se 2 colunas é a medida certa e se a
margem é o conserto certo:

> No app, agora, o lado esquerdo do painel aparece cortado como no print (ícones do primeiro nível
> pela metade, cabeçalho sem a borda esquerda e sem a faixa colorida)? Ou foi o print que saiu
> recortado por dentro do painel?

- "Aparece cortado no app, sempre": implementar o plano como está.
- "Só o print saiu recortado": a árvore está a 0 a 4 px da borda, como no desenho antigo. Decidir
  com ele se ainda quer o recuo (1 coluna bastaria) ou se o ajuste sai.
- "Aparece cortado só às vezes (depois de clicar ou rolar)": é deslocamento do corpo do painel. A
  margem não resolve, e a causa precisa ser investigada no app antes de qualquer mudança.
