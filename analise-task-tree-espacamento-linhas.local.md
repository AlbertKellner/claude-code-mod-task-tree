# Espaçamento estranho entre as linhas (print 27), que sumiu sozinho (print 28)

Pedido: "percebi que as linhas estao com esse espaçamento, mesmo apos finalizar a animacao".

## Medição
- **Print 27** (1277×361): em todas as linhas, uma faixa de **~6 px** de fundo do painel (#191919)
  entre uma linha e a próxima. Dentro do cartão da governanca, o fundo do cartão (#20201f) para em
  y 204 e volta em 211; para em 255 e volta em 262. A guia da árvore em x 20 também é interrompida
  nos mesmos pontos (93–99, 144–150, 205–211, 255–261, 317–323). Ou seja: a caixa de cada linha
  ficou ~6 px mais alta que o SVG da linha, e a sobra aparece como faixa.
- **Print 28** (1302×1885, mesmo fundo #191919, minutos depois): o cartão é contínuo (x 900: fundo
  do cartão de 569 a 931 e de 1148 a 1309, sem cortes) e as guias também. Nenhuma faixa.
- Print 25 (série 8): contínuo, como o 28.

## Resposta do usuário
Perguntado qual espaçamento está estranho, com o print 28 em mãos: "parou de fazer e nem percebi.
vc mexeu em algo?".

## Conclusão
- **Ninguém mexeu**: a árvore de trabalho está limpa e o último commit continua o 3fc1f26 (a
  revelação da esquerda para a direita). Entre os prints 27 e 28 não houve mudança de código.
- As faixas do print 27 não vêm da animação nova: a revelação (`fadeIn` com `clip-path`) exclui
  moldura (`cd`, `cs`) e guias (`g`), e a faixa atravessa as guias e o fundo do cartão inteiro.
  Elas vêm de um **desencontro passageiro entre a altura da caixa de cada linha (posta pelo app em
  células) e a altura do SVG da linha (em px)**: com as caixas mais altas que os SVGs, cada linha
  é centralizada (`alignItems="center"` em `hooks/render.tsx`) e sobra o fundo em cima e embaixo.
  Isso acontece quando o app recalcula o tamanho da célula, por exemplo durante um redimensionamento
  da janela ou do painel, uma mudança de zoom, ou um desenho feito enquanto a recarga do mod ainda
  estava em curso; no desenho seguinte, as alturas voltaram a casar.
- Não há como reproduzir agora. Causa provável, não confirmada.

## Plano
1. **Sem correção de código por ora** (nada a corrigir que se reproduza). Item registrado.
2. Se voltar: o usuário anota o que fez logo antes (redimensionou, mudou zoom, trocou de monitor,
   o mod recarregou) e manda o print; a análise liga um log temporário com a altura das linhas
   (`rowHeight`), o `viewport` e o `bodyColumns` de cada desenho, para cruzar com o momento.
3. Mitigação possível, só se reproduzir: em `hooks/render.tsx`, a caixa da linha alinhada ao topo
   (`alignItems="flex-start"`) e o SVG estendido para baixo até o fim da caixa não é possível (o
   SVG é imagem de altura fixa); a alternativa é desenhar o fundo do cartão e as guias numa camada
   contínua atrás das linhas (um SVG por cartão com a altura somada), o que é uma mudança maior e
   só vale se o defeito for frequente.

## Reaberto: "instalei em uma maquina zerada esse plugin, e ele ficou com os espaçamentos"
### Respostas do usuário
- App desktop na máquina nova: **mesma versão** (3.6556.x).
- Escala: "testei com várias escalas, todas funcionam normalmente nesse momento".
- Instalação: **marketplace (main)**.
- Onde apareceu: **painel lateral, tema escuro**.

### O que o código faz (série 8, a main até o merge da série 9)
- Até a série 8, a linha nova entrava com `fadeIn` = `opacity 0,3→1` + `translateY(−6px→0)` aplicado
  ao grupo `.mv`, que envolve o **desenho inteiro da linha**: o pedaço do cartão (`cd`, `cs`), as
  guias (`g`), o ícone e o texto (`draw/motion.ts` da a507825, linha 88).
- Os quadros (`nextFrame`, `hooks/render.tsx:164–176`) redesenham a cada 100 ms até 500 ms; cada
  quadro leva o estado do momento e um trecho CSS de 100 ms até o seguinte. Enquanto isso, **cada
  linha nova fica deslocada até 6 px para cima**: some o topo dela, sobra uma faixa do fundo do
  painel embaixo e as guias e o fundo do cartão deixam de se encontrar — exatamente as faixas de
  ~6 px dos prints 26 e 27.
- Numa instalação limpa, várias coisas fazem muitas linhas "entrarem" juntas e as faixas aparecem em
  todas: a primeira abertura do painel com o histórico já carregado, a recarga do mod, a troca de
  visão (≡/▤) em versões em que a regra "mais da metade nova não anima" ainda não estava, e cada
  rodada de filha que chega pelo poll. Como o app também recria as imagens por conta própria, uma
  linha entre dois quadros mostra o trecho em curso; se a cadeia de quadros parar antes do fim (o
  painel fora da tela ou sem foco atrasa os `invalidate`), a linha fica parada num quadro do meio
  até o próximo desenho — por isso pareceu "permanente".
- Nada disso depende de arquivo local, cache, escala, fonte nem tema: depende só do código da main
  instalado.

### Causa
**A animação de entrada da série 8** (deslocar o desenho inteiro da linha 6 px), que vinha na main
instalada pelo marketplace. A série 9 (3fc1f26, já na main: `origin/main` = d81bff5, PR #21) troca
essa entrada pela revelação da esquerda para a direita **só do conteúdo**, com moldura, guias e
ícone fixos; com ela, nada da linha sai da caixa e as faixas não têm de onde vir. Isso bate com o
"funcionam normalmente nesse momento" na máquina nova.

### Plano
1. Sem mudança de código: a correção já está na main (série 9).
2. Na máquina nova: atualizar o plugin do marketplace (`/plugin` → atualizar, ou reinstalar) para
   pegar a main com o d81bff5, e conferir que a versão instalada é a da série 9.
3. Se as faixas voltarem com a série 9: o usuário manda o print e diz o que fez antes; a análise
   liga um log temporário de desenho (altura das linhas, marcas de animação e os quadros) para ver
   se é um quadro do meio parado, e então o plano é garantir o desenho final mesmo com o painel fora
   de foco (um `invalidate` final em `DUR + 50` ms que não dependa da cadeia de quadros).
