# Pedidos

O agrupamento por mensagem e o replanejamento.

Código da área: hooks/tools.ts, state/tasks.ts, hooks/prompt-submit.ts, hooks/panel.ts

### pedidos.titulo-vem-do-request
O título do pedido vem do request do plan.

- Dado uma mensagem longa da pessoa
- Quando o modelo chama plan com request
- Então a linha do pedido mostra o request, não o texto da mensagem

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Estado: coberto

### pedidos.uma-mensagem-um-pedido
Cada mensagem abre o seu pedido.

- Dado duas mensagens da pessoa, cada uma com o seu plano
- Quando o painel é desenhado
- Então cada plano fica sob o seu pedido, na ordem das mensagens

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Estado: coberto

### pedidos.aviso-do-app-nao-abre-pedido
Um aviso do app não abre pedido.

- Dado um aviso do app (<side-sessions-event>)
- Quando ele chega
- Então não abre pedido, e o plano seguinte entra no pedido atual

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Estado: coberto

### pedidos.replano-no-lugar
O replano no mesmo pedido substitui no lugar.

- Dado um nível 1 aberto do pedido atual
- Quando o modelo chama plan com o mesmo id
- Então ele é substituído no mesmo lugar da lista, sem ✕

Origem: decisão do usuário, 2026-10-21 (ordem do plano); commit 4af1b92.
Estado: coberto

### pedidos.replano-preserva-estado
O replano no mesmo pedido preserva o estado das tarefas que mantêm o id.

- Dado tarefas ◉ e ✓ num nível 1 aberto
- Quando o modelo replaneja com o mesmo id no mesmo pedido
- Então quem mantém o id mantém o estado; as novas entram ○; quem sai do plano some; um pai abaixo do nível 1 que estava ✓ e ganha filha nova reabre

Origem: decisão do usuário, 2026-10-27 ("◉ segue ◉, ✓ segue ✓, ✉ segue até a entrega; só tarefas novas nascem ○"); commit fbf3c5c.
Estado: coberto

### pedidos.replano-mantem-envio-ate-entrega
A tarefa de mensagem que sai do plano fica até a entrega.

- Dado uma tarefa de mensagem com ✉ na fila
- Quando o replano a tira do plano
- Então ela segue visível com o ✉ até a entrega e depois some

Origem: decisão do usuário, 2026-10-27; commit fbf3c5c.
Estado: coberto

### pedidos.plano-anterior-vira-historico
Um plano de pedido anterior com o mesmo id vira histórico.

- Dado um nível 1 aberto de um pedido anterior
- Quando um pedido novo traz plan com o mesmo id
- Então o antigo fica ✕, renomeado, sob o pedido antigo, e o novo fica sob o pedido novo

Origem: série 2, 2026-10-23; o usuário confirmou em 2026-10-27.
Estado: coberto

### pedidos.nivel1-concluido-e-historico
Um nível 1 concluído fica como histórico.

- Dado um nível 1 ✓
- Quando o modelo chama plan com o mesmo id
- Então o ✓ fica como histórico e o plano novo entra ○ ao lado

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Estado: coberto

### pedidos.resumida-mantem-anteriores-com-algo-aberto
A resumida mantém os pedidos anteriores enquanto há algo aberto.

- Dado um pedido anterior com algo aberto à vista
- Quando um pedido novo começa
- Então a visão resumida mantém os dois; com tudo fechado, só o novo

Origem: decisão do usuário, 2026-10-23 ("somente limpe os itens quando todos estiverem concluidos e quando iniciarem novas tarefas"); commit 897c0d7.
Código: draw/layout.ts, hooks/command.ts
Estado: coberto
