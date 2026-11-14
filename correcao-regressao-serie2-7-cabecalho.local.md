# correcao-regressao · série 2, item 7 (bugs B/E): cabeçalho

Branch `fix/painel-serie-2`, sobre `ad9f60e`. 2026-10-23. TDD.

## B — título com tarefa antiga (corrigido)
Causa: `render.tsx` usava `current(mainTasks).lit[0]`; `lit` é a concatenação dos caminhos de todas as tarefas
abertas e iniciadas, da iniciada há mais tempo para a mais recente; uma tarefa deixada aberta e iniciada por
um pedido antigo ganhava o título. Correção: o título é o nível 1 que contém a âncora de `current()` (a
tarefa iniciada por último; sem nenhuma iniciada, a primeira aberta, como antes).
Vermelho antes (ad9f60e: 354 pass, 1 fail): "uma tarefa iniciada e deixada aberta num pedido antigo não toma
o título; vale a iniciada por último": `Expected: "Corrigir com TDD"`, `Received: "Abrir a sessão d"`
(log `correcao-regressao-retomada/vermelho-b.log`). Controle "sem nenhuma iniciada…" passa.

## E — números de vários pedidos (NÃO mudado; decisão do usuário)
Regra aprovada pelo usuário: o cabeçalho é a soma das linhas desenhadas na visão ("cada visao deve refletir os
dados do seu tipo de vizualizacao", "Sim, bate nas duas"). Com as regras novas da série, a resumida mantém à
vista os pedidos anteriores ainda em andamento, e o cabeçalho os soma por essa regra. Mudar para "só os
números da tarefa/pedido atual" contraria a regra aprovada: fica para o usuário decidir.

## Testes
`task-tree/tests/cabecalho-tarefa-atual.test.ts` (2). 355 pass / 0 fail em 2 rodadas; validate ok; goldens
iguais; orçamento na baseline (rodada 2: −14 bytes, artefato do relógio do teste).

## Commit sugerido
Arquivos: `task-tree/hooks/render.tsx`, `task-tree/tests/cabecalho-tarefa-atual.test.ts` (novo) + patch da docs.
Mensagem: `fix(task-tree): o título do cabeçalho é a tarefa iniciada por último`
