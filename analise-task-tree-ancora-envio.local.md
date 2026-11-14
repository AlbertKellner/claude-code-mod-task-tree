# Âncora do envio sem tarefa em andamento

## Caso (print 13)
Principal: done AT ("Mandar a Análise…") → plan AU ("Enviar correção…", pendente, sem start) →
SendMessage à implementação. O cartão foi para AT (concluída, outro alvo), e não para AU.

## Regra atual
`sendAnchor` (`hooks/panel.ts:113`), chamada em `hooks/tool-call.ts:100/128/138` e
`hooks/sessions.ts:200`:
- com uma tarefa em andamento (`current().anchor`): ela, ou uma folha aberta, não iniciada e
  planejada depois dela (a mais recente). Esse ramo já trata "planejei o envio e mandei sem start";
- **sem nada em andamento** (b742294): `startedLast(mine)` = a última **iniciada** do pedido atual,
  mesmo concluída; sem nenhuma iniciada, a última do pedido. As pendentes são ignoradas, daí o AT.

## Decisões do usuário
- Envio sem tarefa em andamento ancora numa **pendente (○) do pedido atual** e a marca com ✉
  (tom `sent`, como hoje).
- Várias pendentes: **"A última planejada"**.
- Nenhuma pendente: **"Última iniciada"** (a regra de hoje; sem nenhuma iniciada, a última do
  pedido).

## Plano
1. `sendAnchor`, ramo `anchor === undefined`:
   ```ts
   const mine = …                      // tarefas do último turno, como hoje
   const pending = flat(mine).filter(t => t.status === 'open' && t.children.length === 0 && t.started === undefined)
   if (pending.length > 0) return maxBy(pending, t => t.plannedAt ?? -Infinity).id   // última planejada; empate: a de maior índice (a mais abaixo)
   return startedLast(mine)?.id ?? mine[mine.length - 1]?.id
   ```
   Só folhas: um pai pendente não recebe o envio, e sim a folha dele.
2. Tom ✉: conferir que o desenho põe `sent` na pendente ancorada. Hoje o `sent` vem de
   `queued.map(q => q.anchor)` e `sentTasks`. O chip "em andamento" já exclui as tarefas que
   aguardam sessão (ajuste 2), e o chip "pendentes" também deve excluí-la (ela vira "aguardando
   sessão"). Conferir em `hooks/render.tsx` (`pending`).
3. Depois da entrega, a tarefa continua aberta: a regra atual de envio conclui a tarefa ✉ quando a
   sessão começa a tratar a mensagem. Conferir que isso vale para uma tarefa nunca iniciada
   (`fillStarts` dá a ela um início a partir de `plannedAt`, nunca antes, como no 264206b).
4. O cartão da filha fica sob a pendente (`lastAnchor` = ela) e o `atWork`/`trimToWork` a seguem
   (correção da âncora viva). Assim, a visão resumida mostra o pedido atual com o cartão embaixo
   da tarefa certa.
5. Sem testes nem docs (memória do projeto). Validar a recarga do mod e fazer a validação visual
   repetindo a sequência do print: done de uma tarefa, plan de uma tarefa de envio sem start,
   SendMessage. Esperado: o cartão sob "Enviar…", com ✉. Variações: duas pendentes (vai para a
   planejada por último) e nenhuma pendente (vai para a última iniciada).
