# correcao-regressao · série 2, bug 1: plan numa mensagem nova substituía no lugar o nível 1 aberto do pedido antigo

Branch `fix/painel-serie-2` (sobre a main `ba7a05b`, PRs #12 e #13). 2026-10-22. TDD.

## Sintoma
Pedido "Verificar merge do PR 13" deixou o "1" aberto (done só com summary). No pedido seguinte, plan com
"1","2","3": o "1" novo ("Preparar ambiente de teste") ficou no lugar do antigo, sob o cabeçalho do pedido
antigo; "2" e "3" sob o novo; a resumida manteve o pedido antigo à vista.

## Causa (não é regressão: existe desde a 0.7.3)
`planTool` (task-tree/hooks/tools.ts) substituía no lugar qualquer nível 1 aberto com id reutilizado e
mantinha o turno dele (`was(id)`), sem olhar se o pedido era outro.

## Correção (task-tree/hooks/tools.ts)
- `replanned(t)`: aberto + id reutilizado + mesmo pedido (último turno; ou sem turnos / tarefa sem turno /
  subagente). Só esses são substituídos no lugar e no turno.
- Aberto de pedido anterior com id reutilizado: `interrupt(now)` e renomeado (`tag:id`), fica no pedido
  antigo; entra em `renamed` (ligações renomeadas por `renameAnchors`). O novo vai ao turno novo.
- `sends` descartados só para os de fato replanejados (`replannedIds`).
- O import de `interrupt` (linha 8) estava no arquivo quando minha chamada com `sed` foi recusada pelo
  usuário; tomei o arquivo como estava.

## TDD
Arquivo novo `task-tree/tests/plano-pedido-novo.test.ts` (4). Na main (e em 5a5d2f7 e 20daa8e): 3 fail,
saída resumida:
1. completa: `expect(at('Preparar ambiente de teste')).toBeGreaterThan(newReq)` → Expected > 5, Received 1
   (o "1" novo sob "Verificar merge do PR 13").
2. resumida: `expect(at('Verificar merge do PR 13')).toBe(-1)` → Expected -1, Received 0.
3. estado publicado: `expect(novo.turn).toBe(newTurn)` → Expected 2, Received 1.
4. controle (mesmo pedido, replanejar no lugar) passa antes e depois.

Teste existente atualizado (regra antiga contrária à nova, nota de implementação da 0.7.3 sem pedido do
usuário): `turnos > request dá o nome do pedido; mensagem sem plano não vira turno` em task-tree.test.ts:
agora o "Agrupar" antigo fica interrompido no pedido 1 e "Agrupar de novo" vai para "Outra coisa".

## Testes
336 pass / 0 fail em 2 rodadas com o código final (a rodada anterior teve 1 fail: o teste acima, antes da
atualização); validate ok; 0 GOLDEN-NEW / TEXTOS-NEW; orçamento na baseline.

## Commit sugerido
Arquivos: `task-tree/hooks/tools.ts`, `task-tree/tests/plano-pedido-novo.test.ts` (novo),
`task-tree/tests/task-tree.test.ts` + patch da docs.
Mensagem: `fix(task-tree): plan numa mensagem nova põe todos os níveis 1 no pedido novo`

## Regra "só limpa com tudo finalizado" e ✉ pendente (mensagens da orquestradora depois do bug 1)
- `task-tree/tests/resumida-limpeza.test.ts`, 3 testes pelo fluxo real: tudo finalizado → limpa; uma em
  andamento → continua no pedido dela; ✉ pendente (um envio) → continua com ✉. **Passam já na main
  `ba7a05b` (regra do PR #13) e com o bug 1**: a regra do usuário já é cumprida; ficam como fixação.
- O ✉ que sumiu no painel real tem outra raiz: `watchSends` (task-tree/hooks/sessions.ts) dá um envio
  por recebido quando o arquivo da sessão destino tem QUALQUER recebimento meu (ou turno) depois dele;
  com duas mensagens na fila para a mesma sessão, a primeira entrega fecha as duas.
  Teste vermelho no mesmo arquivo ("duas mensagens na fila para a mesma sessão; ela recebe uma…"):
  `Expected: containing "✉"`, `Received: "└─ ◉ Segunda mensagem  ⑂  1/1  0:02"` (o envio da segunda dado
  por recebido; o ⑂ é do gatilho start_session do teste). Log: scratchpad `vermelho-envelope.log`.
  Commit próprio, depois do hash do bug 1.
