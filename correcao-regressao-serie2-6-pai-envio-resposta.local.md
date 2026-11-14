# correcao-regressao · série 2, item 6 (bug D): pai de tarefa ✉ como não iniciado; ↩ "resposta" vazio

Branch `fix/painel-serie-2`, sobre `1119461`. 2026-10-23. TDD.

## Causas
1. Um nível 1 com só a subtarefa ✉ (planejada e enviada sem start, mensagem na fila) aparecia ○ (aberto,
   0/1) quando a tarefa acesa era outra; o pedido também. O tom só olhava `lit` e o trabalho das sessões.
2. Sem `summary`, a linha ↩ mostrava o marcador "resposta" (regra antiga do usuário: nunca a resposta
   cortada). Regra nova: "a linha ↩ só aparece com texto de verdade".

## Correção (task-tree/draw/layout.ts)
- `waitingBelow(t, pending)`: tarefa aberta com algo embaixo esperando uma sessão → `current`, e o pedido
  (`turnRows`) também.
- `hasBrief(u)`: a linha ↩ (pedido e cartão) só com resumo; sem resumo, sem linha. Resposta nunca cortada.

## TDD
`task-tree/tests/envio-e-resposta.test.ts` (4). Vermelhos antes (1119461: 350 pass, 3 fail; log
`correcao-regressao-retomada/vermelho-d.log`):
1. "a subtarefa mostra ✉; o nível 1 e o pedido aparecem em andamento…": Expected "current", Received "open".
2. "pedido concluído sem summary: sem linha ↩…": Expected ["Resumo do pedido"], Received ["resposta", "Resumo do pedido"].
3. "cartão de sessão: o turno sem summary não tem linha ↩…": Expected ["Resumo da filha"], Received ["resposta", "Resumo da filha"].
Controle "sem mensagem pendente, o mesmo nível 1 continua aberto" passa antes e depois.
Primeira versão do teste do pai passava por engano (sem tarefa iniciada, a primeira aberta fica acesa);
reescrito com outra tarefa acesa, como no painel real.

## Golden e testes atualizados
- tests/golden/svg.ts: real-completa e real-resumida regravados (atualizar.mjs): sai em cada um a linha
  "Resposta: resposta" (pedido 71, sem resumo) e a camada de tooltip dela; a linha acima fecha o ramo.
- layout.test.ts (3), cartoes-ancora.test.ts (1), task-tree.test.ts (1) atualizados para a regra nova.
- Orçamento: −1 linha e ~220 bytes por desenho (11.519 / 11.637 / 44.999 / 45.761), dentro da folga.

## Testes
353 pass / 0 fail em 2 rodadas; validate ok; 0 TEXTOS-NEW.

## Commit sugerido
Arquivos: `task-tree/draw/layout.ts`, `task-tree/tests/envio-e-resposta.test.ts` (novo),
`task-tree/tests/golden/svg.ts`, `task-tree/tests/layout.test.ts`, `task-tree/tests/cartoes-ancora.test.ts`,
`task-tree/tests/task-tree.test.ts` + patch da docs.
Mensagem: `fix(task-tree): pai de tarefa ✉ em andamento; linha ↩ só com resumo`
