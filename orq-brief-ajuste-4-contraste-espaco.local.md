# Brief: ajuste 4, contraste por nível de cartão e mais espaço (PR 37)

Escrito pela orquestradora "Orq - TaskTree" em 2026-11-13. Só ela escreve aqui.

## O pedido

O painel do app desktop foi migrado para componentes nativos (branch `feat/painel-nativo`, PR 37).
Pedido do usuário, 2026-11-13, depois de ver os cartões no app:

> aumente um pouco o contraste do card, deixando ele um pouco mais claro, e repita isso para cada card
> dentro de card. aumente um pouco o padding interno tambem, os textos estão muito colados, tando dentro
> do cartao, quanto fora

Ele usa o tema escuro: "mais claro" vale para ele. No tema claro, o mesmo contraste relativo (ali o
cartão escurece).

Objetivo:
1. o fundo do cartão um pouco mais claro que hoje, e a borda acompanha;
2. cada cartão dentro de outro, mais um degrau, de forma regular e visível;
3. mais espaço interno: dentro do cartão (laterais e um respiro em cima e embaixo) e fora dele (entre
   as linhas e entre o ícone e o texto).

## Estado do código e dos outros ajustes

- O ajuste 1 já está em commit (`e15780c`): cartão e cabeçalho com fundo `rgba(136,135,128,0.06)` e
  borda `rgba(136,135,128,0.22)` (`CARD_FILL` e `CARD_BORDER` em `draw/desktop.tsx`). O plano dele, que
  você pode ler: `ajuste-1-cartao-plano.local.md` (nesta pasta). Ele notou que um cartão dentro de outro
  já soma o tom, por ser translúcido.
- O ajuste 3 (guias contínuas em caixas nativas) será implementado antes deste, a partir de
  `ajuste-3-guias-plano.local.md` (nesta pasta, leia-o). A seção dele "o que os outros ajustes precisam
  manter" vale para você: a altura da linha muda pelo `height` do `r<i>`, nunca por `rowGap`, margem ou
  `paddingY` da linha; o bloco do conector da faixa usa a mesma altura da linha; se o cartão ganhar
  `paddingY`, o conector desce junto; nenhum vão entre a faixa e o cartão.
- O ajuste da margem esquerda saiu: não mexa nela.
- Quando você ler o repositório, ele pode estar na ponta `e15780c` ou já ter o commit do ajuste 3.
  Planeje sobre o que encontrar e diga em qual ponta leu; se for antes do ajuste 3, descreva como o seu
  plano se encaixa no plano dele.

## Regras

- Repositório: `<repo>`. O mod é carregado
  a quente desse clone em todas as sessões: nunca escreva nele.
- Siga o `CLAUDE.md` do repositório e o `regras/README.md`. Os cenários que mudarem ganham
  `Reescrito: 2026-11-13, decisão do usuário ("<palavras dele acima>")`; testes existentes que mudarem
  por isso, selo `--tipo decisao`.
