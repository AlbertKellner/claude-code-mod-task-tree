# correcao-regressao · série 2, item 3 (A/F): cartão fora do lugar e recolhido sozinho

Branch `fix/painel-serie-2`, sobre `940746c`. 2026-10-22. TDD.

## Sintomas
(A) Cartão de sessão trabalhando aparecia solto no fim da resumida (raiz) e recolhido; na completa sumia.
(F) Cartão aberto voltava recolhido depois de um pedido novo da mãe, sem clique.

## Reproduzido no estado real da orquestradora (layout() direto)
Cartão atual da correcao-regressao = parte 25 do split, ancorada em `z1` (a tarefa que mandou o bug G, já
concluída, pedido 137). Resumida: z1 fora do trabalho atual → cartão vivo solto no fim. Completa: o pedido de
z1 passou dos 3 últimos → cartão some (conta em "+10 cartões antigos"). Rodadas da sessão no teto de 20.

## Causas
1. Chave de recolher `s:<id>#<índice>`: no teto de 20 rodadas, cada mensagem nova desloca os índices e o
   recolhimento muda de cartão.
2. Resumida: sessão viva sem tarefa no trabalho → `anchor: undefined` (fim da lista, regra antiga).
3. Completa: corte dos 3 últimos pedidos sem exceção para pedido com sessão trabalhando.

## Correção (task-tree/draw/layout.ts; Child.partAt em task-tree/types/index.d.ts)
1. `split` grava `partAt` (o `at` da rodada) nas partes k>0; chave `s:<id>#<partAt>`.
2. `trimToWork` mantém o nível 1 com sessão trabalhando embaixo (`atWork(...).busy`), com o pedido; `cut()`
   não solta mais a sessão viva (mantém a âncora).
3. Corte da completa mantém o pedido com sessão trabalhando sob o nível 1.
Depois: o mesmo estado real desenha o cartão sob "Investigar o congelamento só nesta sessão" nas duas visões.

## Regra antiga substituída (avisar o usuário)
"sessão viva sem tarefa no trabalho atual: aparece no fim da resumida" (regra/teste antigo) e a minha escolha
do item da resumida (nível 1 concluído com sessão viva não fica). As regras novas do usuário mandam o cartão
sob a tarefa que mandou a mensagem e manter à vista o que está em andamento.

## TDD
`task-tree/tests/cartoes-lugar.test.ts` (3), vermelhos antes (log scratchpad `vermelho-af.log`):
1. recolher no teto: `expect(cardOf(15)?.fold?.open).toBe(false)` → Expected false, Received true.
2. resumida: `expect(origin).toBeGreaterThanOrEqual(0)` → Expected >= 0, Received -1.
3. completa: idem → Expected >= 0, Received -1.
Testes atualizados para a regra nova: layout.test.ts (2, chaves por horário), task-tree.test.ts (1),
resumida-turno.test.ts (1).

## Testes
343 pass / 0 fail em 2 rodadas; validate ok; 0 GOLDEN-NEW / TEXTOS-NEW. Orçamento +84 bytes nas quatro
(chaves dos botões mais longas; 11.741 / 11.859 / 47.484 / 48.246), dentro da folga de 1,5×.

## Commit sugerido
Arquivos: `task-tree/draw/layout.ts`, `task-tree/types/index.d.ts`, `task-tree/tests/cartoes-lugar.test.ts`
(novo), `task-tree/tests/layout.test.ts`, `task-tree/tests/task-tree.test.ts`,
`task-tree/tests/resumida-turno.test.ts` + patch da docs.
Mensagem: `fix(task-tree): cartão de sessão fica aberto e sob a tarefa que mandou a mensagem`

## Adendo: resumida = completa sem os finalizados (mesmo commit)
- Usuário, com dois prints do mesmo instante: "a visão completa parece mais correta que a resumida" (na
  resumida o cartão ia para a tarefa da última mensagem). `cut()` não realoca mais âncora nenhuma: só
  divide em cartões e recorta (`trimToWork`).
- Vermelho antes: "sessão sem rodadas … o cartão não muda de lugar na resumida": Expected
  `["s:local_filha ⟵ Investigar ainda"]`, Received `["s:local_filha ⟵ Pedido atual"]` (log
  `vermelho-subconjunto.log`). "estado real: cada cartão da resumida está sob a mesma linha que na completa"
  passa (fixação).
- Teste antigo atualizado (task-tree.test.ts): "mensagem à filha numa tarefa do trabalho atual: a resumida
  não muda o cartão de lugar; a completa não muda" (antes esperava o cartão movido para "Pedir à filha").
- Bug H (cartão vivo escondido como antigo na completa, no fim da resumida): coberto pelos testes 2 e 3.
- Suíte: 345 pass / 0 fail em 2 rodadas; goldens iguais; orçamento 11.741 / 11.859 / 47.484 / 48.246.
