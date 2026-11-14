# Envio pendurado numa tarefa aberta antes (regressão do d956e11)

Caso: a principal tinha "Escolha do ícone pelo usuário" (29.2) em andamento, sem envio, aberta antes;
depois planejou e deu start em "Conferir que o envelope de recebimento cobre o print" (30) e mandou
SendMessage. O painel pendurou a mensagem em 29.2.

## Causa
`hooks/panel.ts` `sendAnchor(list, used)` (linhas 123–135, do d956e11): com **mais de uma folha em
andamento**, ordena todas por `startedAt` (mais antiga primeiro) e pega **a primeira sem envio desde
que começou** (`used`, de `usedAnchors`: os `sends` e as rodadas das filhas). Uma tarefa antiga, ainda
aberta e sem envio (29.2), vence qualquer tarefa iniciada depois (30). A regra foi feita para o caso
paralelo do print 29 (start em A e B juntos, uma mensagem para cada), mas vale para quaisquer duas
folhas abertas, de qualquer momento. Quem chama: `hooks/tool-call.ts:103` (o SendMessage, na hora) e
`hooks/sessions.ts:203` (`recordStart`, sessão nova).

## Decisões do usuário
- **Lote recente**: só concorrem as folhas em andamento do **último lote de starts** (iniciadas na
  mesma resposta, segundos entre si) que ainda não têm envio; dentro do lote, **pela ordem de início**.
  Folhas iniciadas antes só recebem o envio se todo o lote recente já tiver envio.
- Folha em andamento **com uma pergunta aberta embaixo** (AskUserQuestion, ExitPlanMode, wrap_up com
  ask: um `Wait` do laço principal ancorado nela) **fica de fora**.

## Plano (`hooks/panel.ts`, `sendAnchor`)
1. `going` = folhas `open`, sem filhas, `started` definido, **excluindo** as que têm pergunta aberta:
   `sendAnchor` recebe também as âncoras das esperas (`waits` do grupo principal com `kind` question/
   plan/choice; hoje o `Wait` não guarda a tarefa → acrescentar `anchor` ao `Wait` em `addWait`, com
   `current(...)` do laço, como já se faz para desenhar a linha de espera).
2. Com `going.length > 1`:
   - `free` = as de `going` sem envio desde o início (o `has` atual).
   - **Lote**: `newest = max(startedAt)` entre as `free`; `batch = free.filter(t => newest −
     t.startedAt ≤ LOTE)` com `LOTE = 3000` ms (os starts de uma mesma resposta saem em
     milissegundos; uma resposta nova vem depois de segundos ou minutos).
   - Devolve a **primeira do lote por ordem de início** (`startedAt`, empate pela ordem do plano).
   - Sem `free` (todas já com envio): a regra atual (`current`, a última iniciada).
3. Uma só em andamento: igual a hoje. Nenhuma em andamento: igual a hoje (a pendente planejada por
   último do pedido atual).
4. Os dois chamadores passam os novos argumentos (`waits` do estado).
5. Sem testes nem docs (memória do projeto). Validar a recarga do mod. Validação visual:
   - caso de agora: 29.2 aberta antes, start em 30, SendMessage → cartão sob 30;
   - caso paralelo: start em A e B na mesma resposta, mensagem para A e depois para B → A recebe a
     1ª, B a 2ª;
   - pergunta aberta: uma tarefa com AskUserQuestion pendente e outra em andamento → o envio vai para
     a outra.
