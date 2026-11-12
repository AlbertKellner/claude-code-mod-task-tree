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
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)"); o teste só deixa de escolher a visão ou abre a linha.
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
- Então a tarefa sai do plano, e a carta dela pende do nível 1 do pedido até a entrega

Origem: decisão do usuário, 2026-10-27; commit fbf3c5c.
Reescrito: 2026-10-30, decisão do usuário ("a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria"; "A: linha própria sob a tarefa (Recomendado)"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"); a tarefa não é mais mantida; a carta rependura no nível 1.
Reescrito: 2026-11-04, validado pelo usuário no app ("Funcionou").
Estado: coberto

### pedidos.plano-anterior-vira-historico
Um plano de pedido anterior com o mesmo id vira histórico.

- Dado um nível 1 aberto de um pedido anterior
- Quando um pedido novo traz plan com o mesmo id
- Então as folhas abertas do antigo ficam ✕, e ele fica ✓ se tem filhas (✕ se é folha), renomeado, sob o pedido antigo (em "+N pedidos anteriores"), e o novo fica sob o pedido novo

Origem: série 2, 2026-10-23; o usuário confirmou em 2026-10-27.
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)").
Reescrito: 2026-11-04, decisão do usuário ("todos os subitens estão concluidos ou interrompidos, mas a tarefa pai está como em andamento, ela deveria estar concluida tambem"; pai com só ✕ embaixo: "Fica ✓").
Estado: coberto

### pedidos.nivel1-concluido-e-historico
Um nível 1 concluído fica como histórico.

- Dado um nível 1 ✓
- Quando o modelo chama plan com o mesmo id
- Então o ✓ fica como histórico e o plano novo entra ○ ao lado

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Estado: coberto

### pedidos.rodada-descartada-nao-segura-a-visao
Uma rodada descartada não conta como algo aberto à vista.

- Dado um cartão de rodada descartada, com tarefa aberta, sob um pedido fechado
- Quando um pedido novo começa
- Então o painel mostra só o pedido novo, como com tudo fechado

Origem: bug achado na análise do pedido do usuário, 2026-11-04 ("entao pq esse card de plano esta parado? analise se é um bug do mod, ou se podemos fazer melhoria. ele ja deveria estar encerrado").
Estado: coberto

### pedidos.resumida-mantem-anteriores-com-algo-aberto
O painel mantém os pedidos anteriores enquanto há algo aberto.

- Dado um pedido anterior com algo aberto à vista
- Quando um pedido novo começa
- Então o painel mantém os dois; com tudo fechado, só o novo, e o anterior fica em "+N pedidos anteriores"; um cartão de sessão ainda viva sob um pedido fora do trabalho não traz o pedido de volta, mas é desenhado solto no fim (sessoes.cartao-vivo-nunca-some)

Origem: decisão do usuário, 2026-10-23 ("somente limpe os itens quando todos estiverem concluidos e quando iniciarem novas tarefas"); commit 897c0d7.
Reescrito: 2026-11-03, decisão do usuário ("Cartão vivo solto no fim (Recomendado)"); desfaz, só para o cartão vivo, "nem o cartão é desenhado solto" (2026-10-23).
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)").
Código: draw/layout.ts, hooks/command.ts
Estado: coberto

### pedidos.id-reusado-nao-segura-pedido-concluido
Um pedido anterior todo concluído sai de vista mesmo quando o pedido novo reusa o id de um nível 1 dele.

- Dado um pedido anterior com dois níveis 1, os dois ✓
- Quando um pedido novo traz plan reusando o id de um deles e começa a trabalhar
- Então o painel mostra só o pedido novo, com o plano novo ○, e o anterior fica em "+N pedidos anteriores", como com tudo fechado

Origem: auditoria 2026-11-10 (o trabalho atual não acompanha a renomeação do nível 1); aplica pedidos.resumida-mantem-anteriores-com-algo-aberto ("com tudo fechado, só o novo") ao id reusado, sem mudar pedidos.plano-anterior-vira-historico.
Código: draw/layout.ts
Estado: coberto

### pedidos.id-reusado-segura-pedido-com-cartao-aberto
O pedido anterior cujo nível 1 foi reusado segue à vista enquanto um cartão com tarefa aberta pende da cópia antiga.

- Dado um nível 1 aberto de um pedido anterior, com uma sessão filha aberta de uma tarefa dele (ou que recebeu mensagem dela) e com tarefa própria aberta
- Quando um pedido novo traz plan com o mesmo id
- Então o antigo vira histórico como em pedidos.plano-anterior-vira-historico, mas o pedido anterior segue à vista, acima do novo, com o cartão e a carta sob a tarefa de origem, nunca soltos; o nível 1 novo nasce ○ sob o pedido novo

Origem: auditoria 2026-11-10 (o trabalho atual não acompanha a renomeação do nível 1, cartão solto); aplica pedidos.resumida-mantem-anteriores-com-algo-aberto à cópia renomeada, sem mudar pedidos.plano-anterior-vira-historico.
Reescrito: 2026-11-12, decisão do usuário ("Sim, fica à vista (Recomendado)"); desfaz "sessão trabalhando sem tarefa própria aberta, ou só carta na fila, não segura": esses casos também seguram (pedidos.id-reusado-segura-pedido-com-sessao-viva). Os testes não mudam.
Código: hooks/panel.ts, hooks/tools.ts
Estado: coberto

### pedidos.id-reusado-segura-pedido-com-sessao-viva
O pedido anterior cujo nível 1 foi reusado segue à vista enquanto a sessão sob a cópia antiga trabalha ou a carta dela está na fila.

- Dado um nível 1 aberto de um pedido anterior, com uma sessão filha trabalhando sob uma tarefa dele (mesmo sem tarefa própria aberta) ou uma carta ainda na fila saída dela
- Quando um pedido novo traz plan com o mesmo id
- Então o antigo vira histórico como em pedidos.plano-anterior-vira-historico, mas o pedido anterior segue à vista, acima do novo, com o cartão sob a tarefa de origem, nunca solto, e a carta sob ela (cinza "interrompida", envios.cor-por-estado); o nível 1 novo nasce ○ sob o pedido novo. A linha "+N pedidos anteriores" só leva o pedido antigo num pedido seguinte, depois que a sessão parou e a carta foi entregue, como quando o id não é reusado (pedidos.resumida-mantem-anteriores-com-algo-aberto)

Origem: auditoria 2026-11-10 (o trabalho atual não acompanha a renomeação do nível 1, cartão solto); decisão do usuário, 2026-11-12 ("Sim, fica à vista (Recomendado)"). Desfaz, para o id reusado, "sessão trabalhando sem tarefa própria aberta, ou só carta na fila, não segura" (2026-11-10) e o cartão vivo solto no fim desse caso (sessoes.cartao-vivo-nunca-some segue valendo para o pedido que já saiu do trabalho).
Código: draw/layout.ts, hooks/sessions.ts
Estado: coberto
