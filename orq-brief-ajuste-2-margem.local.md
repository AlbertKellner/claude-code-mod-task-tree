# Brief: ajuste 2, a árvore afastada da margem esquerda (PR 37)

Escrito pela orquestradora "Orq - TaskTree" em 2026-11-13. Só ela escreve aqui.

## O pedido

O painel do app desktop foi migrado para componentes nativos (branch `feat/painel-nativo`, ponta
`22ad5de`, PR 37). No app, o usuário mandou um print e disse, 2026-11-13: "outro exemplo de
comportamento estranho". Print: `prints/2026-11-13-cartao-filha-estranho.png` (nesta pasta).

Um dos problemas desse print é deste ajuste: os ícones do primeiro nível da árvore, o ▸ de
"+N pedidos anteriores" e o cartão de sessão solto (sem tarefa de origem à vista) encostam na borda
esquerda do painel e saem cortados pela metade; com isso, a borda esquerda do cartão solto também some.

Objetivo: nada da árvore sai cortado na margem esquerda; os ícones do primeiro nível, o ▸ e a borda do
cartão solto aparecem inteiros. O cabeçalho do painel não faz parte do ajuste, salvo se a causa for a
mesma.

## Fora deste ajuste

Outros ajustes visuais têm planejadores próprios, em paralelo, e serão implementados um de cada vez,
cada um depois do anterior: o fundo e a borda do cartão; as guias da árvore; o contraste por nível de
cartão e os espaços internos. Não mexa nesses pontos. Os outros pontos do mesmo print (onde aparece o
cartão de uma mensagem recém-entregue, sob qual pedido fica o plano da filha, tarefas com 0:00) seguem
as regras e não mudam.

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
