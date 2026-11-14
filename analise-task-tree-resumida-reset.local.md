# Visão resumida apaga pedidos anteriores com sessão filha trabalhando

Pedido do usuário: "quando enviar mensagens no mesmo turno, as tarefas nao devem ser resetadas. as
tarefas da visao resumida somente sao resetadas quando a sessao terminou e todas as tarefas estão
concluidas". Caso: a implementação trabalhava sob o pedido das animações; o usuário mandou uma
mensagem nova; a resumida ficou só com o pedido novo e o cartão da implementação sumiu.

## Como o `work` da resumida é decidido
- A resumida é `trimToWork(cut())` (`draw/layout.ts:1136–1141`): mostra os pedidos cujas tarefas
  de nível 1 estão em `work`, inteiros, e os cartões das filhas cujo **cartão de rodada** (`split`,
  um `Child` por rodada, com o `anchor` da rodada) está sob uma tarefa desses pedidos.
- `work` é escrito no primeiro `plan` de cada turno (`hooks/tools.ts:56,109`): `startsWork` diz se é
  pedido novo (turno sem tarefa no `work`); então `joinWork(ids, fresh=true)`
  (`hooks/panel.ts:476–487`) **mantém o work anterior só se `openInSight(...)` for verdadeiro**;
  senão fica só o pedido novo. Essa é a regra do 897c0d7 ("tudo fica enquanto houver algo aberto à
  vista").

## Causa
`openInSight` (`draw/layout.ts:572–581`) considera "aberto à vista": tarefa aberta nos pedidos do
work, ✉ pendente ancorado neles, ou **filha com `c.anchor` nesses pedidos e com tarefa aberta no
painel dela**. Dois defeitos:
1. **Usa `c.anchor`, o âncora de abertura** (`2/2.3`, o primeiro pedido, para todas as filhas
   antigas), e recebe os `children` crus do estado, não os cartões de rodada. A rodada atual da
   implementação estava sob BQ (pedido das animações, no work), mas `c.anchor` não está no work →
   a filha não conta. É o mesmo descompasso que o 59ccd54/0e9868c corrigiram em `atWork` com
   `roundAt`/`lastAnchor`, sem corrigir aqui.
2. **Exige tarefa aberta no painel da filha** (`hasOpen`). Uma filha `running` entre dois planos, ou
   com tudo concluído enquanto ainda trabalha, não conta. O usuário quer "sessão filha
   trabalhando" como motivo de manter.
Com os dois falsos, e as tarefas da principal todas concluídas, `openInSight` → false → o work vira só
o pedido novo → `trimToWork` deixa os pedidos antigos e o cartão da implementação fora.

## Plano
1. `openInSight` (`draw/layout.ts`): a filha conta quando **alguma rodada dela** está ancorada nos
   pedidos do work e ela está **viva (`live(c)`) ou tem tarefa aberta**:
   ```ts
   const anchors = (c: Child) => [c.anchor, c.lastAnchor, ...(c.rounds ?? []).map(r => r.anchor)].filter(a => a !== undefined)
   return (p.children ?? []).some(c => anchors(c).some(a => all.includes(a)) && (live(c) || hasOpen(allTasks(panelOf(c), 1))))
   ```
   Os âncoras das rodadas podem precisar de `resolveAnchor(owner, …)` (como em `split`, linha 180)
   quando a rodada aponta para um id renomeado; usar a mesma resolução.
2. Regra do "mesmo turno": a mensagem nova chega com o turno anterior ainda em curso (tarefas abertas
   da principal) → `hasOpen(seen)` já mantém. Nada a mudar, só conferir que `startsWork` não zera
   antes do `plan` (o `openTurn` em `prompt.submit` não mexe no work: certo).
3. `trimToWork` (`layout.ts:598–613`): sem mudança de regra: com o work mantido, os pedidos antigos e
   os cartões de rodada sob eles voltam a ser desenhados. Conferir que uma filha viva sob um pedido
   antigo **fora** do work continua fora (decisão anterior do usuário, comentário nas linhas
   592–597): o plano só muda o critério de manter o work no pedido novo.
4. Quando a filha termina e tudo está concluído, o próximo pedido novo reseta (openInSight false):
   é a regra "resetadas quando a sessão terminou e todas as tarefas estão concluídas".
5. Sem testes nem docs (memória do projeto). Validar a recarga do mod; validação visual pelo
   usuário: com uma filha trabalhando sob o pedido A (tudo da principal concluído), mandar um pedido
   B: a resumida deve mostrar A (com o cartão da filha) e B; quando a filha terminar e B concluir, o
   pedido C deve vir sozinho.
