# correcao-regressao · série 2, item 2: tarefa com ✉ pendente sumia (várias mensagens na fila)

Branch `fix/painel-serie-2`, sobre `1423721` (item 1, PR #14). 2026-10-22. TDD.

## Sintoma
A orquestradora mandou várias mensagens seguidas à correcao-regressao (ocupada), todas na fila (✉). No
pedido seguinte, tarefas com ✉ ainda pendente sumiram da resumida.

## Regra do usuário (fixada em teste)
"quando eu enviar novas mensagens, em novos turnos, se existirem tarefas em andamento, essas tarefas devem
continuar sendo mostradas. o painel só deve ser limpo quando enviar uma mensagem em um novo turno e todas as
tarefas estiverem finalizadas." Já cumprida desde o PR #13 (3 testes passam na main ba7a05b).

## Causa (não é regressão: falha igual em 5a5d2f7 e 20daa8e)
`watchSends` (task-tree/hooks/sessions.ts): um envio era dado por recebido quando o arquivo da sessão
destino tinha qualquer mensagem recebida desta sessão com `at` ≥ o envio (ou qualquer turno depois). Com
duas mensagens na fila, a primeira entrega fechava as duas tarefas.

## Correção
- Com `received` publicado: casamento um a um, em ordem de tempo (envio pendente mais antigo ↔ mensagem
  recebida mais antiga não casada com `at` ≥ envio); `usedReceipts` (módulo) evita casar a mesma mensagem
  duas vezes. Sem `received`: regra antiga.
- `task-tree/state/durability.ts`: linha `usedReceipts`.

## TDD
`task-tree/tests/resumida-limpeza.test.ts` (4). Vermelho antes (main 1423721: 339 pass, 1 fail; igual em
5a5d2f7 e 20daa8e): "duas mensagens na fila para a mesma sessão; ela recebe uma…":
`Expected: containing "✉"`, `Received: "└─ ◉ Segunda mensagem  ⑂  1/1  0:02"` (o envio da segunda dado
por recebido pela entrega da primeira; o ⑂ é do gatilho start_session do teste).
Os outros 3 (regra de limpeza) passavam antes e passam depois (fixação).

## Testes
340 pass / 0 fail em 2 rodadas; validate ok; 0 GOLDEN-NEW / TEXTOS-NEW; orçamento na baseline (rodada 2:
−14 bytes, artefato do relógio do teste).

## Commit sugerido
Arquivos: `task-tree/hooks/sessions.ts`, `task-tree/state/durability.ts`,
`task-tree/tests/resumida-limpeza.test.ts` (novo) + patch da docs.
Mensagem: `fix(task-tree): cada mensagem na fila fecha a sua tarefa só com a sua entrega`
