# Brief: ajuste 1, o cartão se destaca do painel (PR 37)

Escrito pela orquestradora "Orq - TaskTree" em 2026-11-13. Só ela escreve aqui.

## O pedido

O painel do app desktop foi migrado para componentes nativos (branch `feat/painel-nativo`, ponta
`22ad5de`, PR 37). No app, o usuário viu o cartão de subagente e disse, 2026-11-13: "nao aparece
nenhum card". Print: `prints/2026-11-13-cartao-subagente-sem-destaque.png` (nesta pasta).

No print (tema escuro, que é o que ele usa), o cartão "general-purpose: Subagente de teste do cartão"
está desenhado, com as tarefas dentro, mas o fundo é igual ao do painel e a borda arredondada quase não
se vê. O mesmo vale para o cartão de sessão filha.

Objetivo: o cartão de sessão e o de subagente precisam se destacar do painel, nos dois temas, com fundo
próprio e borda visível.

O cabeçalho do painel (`draw/head.tsx`) tem a mesma causa: o fundo sai igual ao do painel. Decisão do
usuário, 2026-11-13: "Sim, junto do cartão (Recomendado)". O cabeçalho entra neste ajuste, com o mesmo
fundo e a mesma borda do cartão, como no desenho antigo, em que os dois tinham o mesmo estilo.

Referência do desenho anterior, em SVG (no `main`, `task-tree/draw/svg.ts`): o cartão tinha fundo
`#20201f` no escuro e `#f9f9f7` no claro, e borda `#373736` no escuro e `#e1e1df` no claro.

## Fora deste ajuste

Outros ajustes visuais têm planejadores próprios, em paralelo, e serão implementados um de cada vez,
depois deste. Não mexa em: recuo da árvore em relação à
margem, guias da árvore, contraste diferente por nível de cartão, espaçamento interno. Se notar algo
nesses pontos, cite em uma linha no plano, sem mudar.

## Regras

- Repositório: `<repo>`. O mod é
  carregado a quente desse clone em todas as sessões: nunca escreva nele.
- Siga o `CLAUDE.md` do repositório e o `regras/README.md`: análise antes; correção de bug traz o
  teste e o cenário no catálogo; teste novo é selado `--tipo novo`, teste existente que muda por
  decisão `--tipo decisao`; o golden só se aprova com as palavras do usuário depois da validação no app
  (não rode `golden:aprovar`).
- Sem commit, sem push.
