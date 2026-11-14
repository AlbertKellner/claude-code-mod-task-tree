# Brief: ajuste 3, as guias contínuas em caixas nativas (PR 37)

Escrito pela orquestradora "Orq - TaskTree" em 2026-11-13. Só ela escreve aqui.

## O pedido

O painel do app desktop foi migrado para componentes nativos (branch `feat/painel-nativo`, ponta
`22ad5de`, PR 37). As guias da árvore (os traços que ligam pai e filhas, │ ├─ └─) hoje são caracteres
de caixa em fonte de largura fixa, por decisão do usuário de 2026-11-13: "Caracteres (Recomendado)".
No app, o caractere não ocupa a altura toda da linha, e as guias ficam com falhas entre as linhas
(print `prints/2026-11-13-cartao-filha-estranho.png`, nesta pasta).

Decisão nova do usuário, 2026-11-13, à pergunta se queria guias contínuas: "Caixas finas nativas
(Recomendado)". Quer dizer: as guias viram caixas nativas finas com fundo, contínuas entre as linhas,
sem `Svg` e sem caracteres.

Objetivo:
- guias contínuas, sem falhas entre as linhas, como caixas nativas finas;
- o mesmo desenho dentro e fora dos cartões, incluindo a faixa de guias à esquerda de um cartão;
- alinhadas com os ícones das linhas;
- visíveis nos dois temas, sem o mod saber qual está ativo.

A decisão anterior ("Caracteres") é desfeita: o cenário do catálogo ganha
`Reescrito: 2026-11-13, decisão do usuário ("Caixas finas nativas (Recomendado)")`.

## Fora deste ajuste

Outros ajustes visuais têm planejadores próprios, em paralelo, e serão implementados um de cada vez,
cada um depois do anterior: o fundo e a borda do cartão; a árvore afastada da margem esquerda; o
contraste por nível de cartão e os espaços internos (que pode mudar a altura das linhas). Não mexa
nesses pontos; diga no plano o que nas guias precisa acompanhar uma mudança de altura de linha ou de
recuo.

## Regras

- Repositório: `<repo>`. O mod é
  carregado a quente desse clone em todas as sessões: nunca escreva nele.
- Siga o `CLAUDE.md` do repositório e o `regras/README.md`: análise antes; correção de bug traz o
  teste e o cenário no catálogo; teste novo é selado `--tipo novo`, teste existente que muda por
  decisão `--tipo decisao`; o golden só se aprova com as palavras do usuário depois da validação no app
  (não rode `golden:aprovar`).
- Como os ajustes serão aplicados em série, traga os comandos exatos de selo, para quem implementar
  refazer `regras/selos.json` se o diff colidir.
- Sem commit, sem push.
