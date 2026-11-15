# Pedidos

O agrupamento por mensagem e o replanejamento.

Código da área: hooks/tools.ts, state/tasks.ts, hooks/prompt-submit.ts, hooks/panel.ts

### pedidos.titulo-vem-do-request
O título do pedido vem do request do primeiro plan dele.

- Dado uma mensagem longa da pessoa
- Quando o modelo chama plan com request, e depois, no mesmo pedido (um replano, ou um plan depois de um aviso do app ou do relato de uma filha), outro plan com outro request
- Então a linha do pedido mostra o primeiro request, não o texto da mensagem nem o request do plan seguinte; o primeiro plan de um pedido novo dá o título dele

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Reescrito: 2026-11-14, decisão do usuário ("Não, vale o 1º (Recomendado)"); antes, o request de qualquer plan trocava o título. O teste existente não muda.
Estado: coberto

### pedidos.uma-mensagem-um-pedido
Cada mensagem abre o seu pedido, menos a que continua o pedido em curso no meio do turno.

- Dado duas mensagens da pessoa, cada uma com o seu plano, a segunda depois do fim do turno da primeira
- Quando o painel é desenhado
- Então cada plano fica sob o seu pedido, na ordem das mensagens; a mensagem que continua o pedido em curso no meio do turno não abre pedido (pedidos.mensagem-no-meio-do-turno-continua-o-pedido)

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Reescrito: 2026-11-12, decisão do usuário ("Entra no pedido em curso (Recomendado)"); só para o relato de uma sessão que esta abriu e a mensagem da pessoa, entregues no meio do turno, que deixam de abrir o seu pedido. O teste não muda.
Estado: coberto

### pedidos.mensagem-no-meio-do-turno-continua-o-pedido
A mensagem entregue no meio do turno continua o pedido em curso.

- Dado um pedido em curso, com um nível 1 aberto, uma tarefa ◉ e o cartão de uma sessão filha sob ela
- Quando chega, com o turno em curso, o relato de uma sessão que esta abriu ou uma mensagem que a pessoa digitou por cima do turno, e o modelo replaneja o nível 1 com o mesmo id
- Então a mensagem não ganha linha de pedido nem ✉; o plano fica no pedido em curso, quem mantém o id mantém o estado (pedidos.replano-preserva-estado), nada fica ✕, nada vai a "+N pedidos anteriores" e o cartão segue sob a tarefa de origem; a mensagem de outra sessão segue publicada como recebida, e a remetente confirma a entrega por ela; a mensagem de uma sessão que esta não abriu (a que a abriu, uma irmã) segue abrindo o seu pedido, com a carta, mesmo no meio do turno (envios.pedido-recebido-mostra-carta, sessoes.um-cartao-por-mensagem); com o turno terminado, a mensagem seguinte abre o seu pedido (pedidos.uma-mensagem-um-pedido); depois de um Esc, a mensagem abre o seu pedido e pede o replano (lembretes.mensagem-no-meio-do-turno)

Origem: auditoria 2026-11-10 (a mensagem entregue no meio do turno abria um pedido na hora, e o replano seguinte, no mesmo turno do modelo, caía em "pedido novo": o nível 1 em curso virava histórico, tudo voltava a ○ e o cartão ficava solto); decisão do usuário, 2026-11-12 ("Entra no pedido em curso (Recomendado)", sobre "o relato de uma filha, ou algo que você digita enquanto ela trabalha"). Desfaz, só para o meio do turno, "cada mensagem abre o seu pedido" (pedidos.uma-mensagem-um-pedido) e "uma carta por mensagem" (envios.pedido-recebido-mostra-carta).
Código: hooks/sessions.ts, text/rules.ts
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
- Então quem mantém o id mantém o estado; as novas entram ○; quem sai do plano some (o cartão de sessão ou de subagente que pendia dele passa ao nível 1: pedidos.replano-leva-o-cartao-ao-nivel-1); um pai abaixo do nível 1 que estava ✓ e ganha filha nova reabre

Origem: decisão do usuário, 2026-10-27 ("◉ segue ◉, ✓ segue ✓, ✉ segue até a entrega; só tarefas novas nascem ○"); commit fbf3c5c.
Reescrito: 2026-11-14, decisão do usuário ("Sob o nível 1 (Recomendado)"); os testes deste cenário não mudam.
Estado: coberto

### pedidos.replano-leva-o-cartao-ao-nivel-1
O cartão cuja tarefa de origem sai do plano num replano fica sob o nível 1 que a continha.

- Dado uma subtarefa com o cartão de uma sessão filha (ou de um subagente) embaixo
- Quando o modelo replaneja o nível 1 no mesmo pedido sem essa subtarefa
- Então o cartão passa para baixo do nível 1, com o busto na linha dele, e fica lá, vivo ou concluído; as tarefas da filha seguem contando no x/y do nível 1 e do pedido, e o nível 1 segue ◉ enquanto ela trabalha; o cartão nunca fica solto no fim; a carta segue a regra dela (pedidos.replano-mantem-envio-ate-entrega)

Origem: decisão do usuário, 2026-11-14 ("Sob o nível 1 (Recomendado)"), sobre os achados da auditoria de 2026-11-10 (carta, subagente e cartão de sessão tinham três tratamentos; o cartão da filha ficava solto e sumia ao concluir).
Código: hooks/tools.ts, hooks/panel.ts
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
Um nível 1 concluído reabre no replano do mesmo pedido e fica como histórico no pedido seguinte.

- Dado um nível 1 ✓ (fechou sozinho, com todos os passos ✓, ou foi fechado com done)
- Quando o modelo chama plan com o mesmo id, no mesmo pedido com um passo a mais, ou num pedido seguinte
- Então, no mesmo pedido, o mesmo nível 1 volta a aberto no lugar, os passos que mantêm o id seguem ✓ e só o passo novo nasce ○; cartões e cartas seguem sob as tarefas; um plano igual, sem passo novo, não muda nada; para refazer um passo, o modelo usa um id novo. Num pedido seguinte, o ✓ fica como histórico e o plano novo entra ○ sob o pedido novo. O replano de um subagente sobre as tarefas dele segue deixando a concluída como histórico (subagentes.id-reusado-nao-herda-cartao)

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Reescrito: 2026-11-14, decisão do usuário ("Reabre mantendo os ✓ (Recomendado)"); desfaz, só para o replano no mesmo pedido do loop principal, "o ✓ fica como histórico e o plano novo entra ○ ao lado".
Código: text/rules.ts
Estado: coberto

### pedidos.plan-avisa-o-que-fez-as-tarefas-antigas
A resposta do plan diz o que ele fez às tarefas que já existiam com o mesmo id.

- Dado um plan que repete o id de um nível 1 que já existe
- Quando o plan responde
- Então, além de "Plano exibido", a resposta avisa: o nível 1 aberto de pedido anterior que ficou como histórico, com quantas abertas interrompidas; o nível 1 já fechado que ficou como histórico; e, no replano do mesmo pedido (também o do nível 1 concluído, que reabre), quantas tarefas mantiveram o estado; sem id repetido, não há avisos

Origem: auditoria 2026-11-10 (o modelo não sabia o que o plan tinha interrompido ou guardado); aplica pedidos.plano-anterior-vira-historico, pedidos.nivel1-concluido-e-historico e pedidos.replano-preserva-estado, sem mudar nenhuma delas.
Código: text/rules.ts
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
- Então o painel mantém os dois (o anterior inteiro, com o que já concluiu); com tudo fechado, só o novo, e o anterior fica em "+N pedidos anteriores"; um cartão de sessão ainda viva sob um pedido fora do trabalho não traz o pedido de volta, mas é desenhado solto no fim (sessoes.cartao-vivo-nunca-some)

Origem: decisão do usuário, 2026-10-23 ("somente limpe os itens quando todos estiverem concluidos e quando iniciarem novas tarefas"); commit 897c0d7.
Reescrito: 2026-11-03, decisão do usuário ("Cartão vivo solto no fim (Recomendado)"); desfaz, só para o cartão vivo, "nem o cartão é desenhado solto" (2026-10-23).
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)").
Código: draw/layout.ts
Reescrito: 2026-11-14, texto: o pedido anterior com algo aberto é desenhado inteiro e não é contado em "+N" (auditoria 2026-11-10); aplica a decisão de 2026-10-23 ("somente limpe os itens quando todos estiverem concluidos e quando iniciarem novas tarefas"), sem mudar a regra. Os testes deste cenário não mudam.
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

### pedidos.replano-aceita-o-id-completo
O replano aceita os ids das subtarefas como o painel os mostra nos lembretes.

- Dado um nível 1 aberto com uma tarefa ✓ e outra ◉
- Quando o modelo replaneja o nível 1 passando as subtarefas com o id completo ("A/1", "A/2.1"), como os lembretes as listam
- Então o id completo vale como o curto: quem mantém o id mantém o estado, só o passo novo nasce ○, e o prefixo não se repete no id

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: o replano com o id do lembrete duplicava o prefixo e perdia o estado); aplica pedidos.replano-preserva-estado (decisão do usuário, 2026-10-27), sem mudar nenhuma regra.
Estado: coberto

### pedidos.marca-so-no-comeco-do-prompt
A mensagem só é de outra sessão, ou retorno de subagente, quando a marca abre o texto.

- Dado um texto que a pessoa digita ou cola, com a tag de mensagem de outra sessão ou a marca "[Subagent hand-back]" no meio
- Quando ele é enviado
- Então abre um pedido comum, com o começo do texto no título, sem carta de recebida, com o lembrete de pedido novo, e nenhum recebimento é publicado por ele; a mensagem que começa pela tag (direto, ou depois da linha de abertura que o app põe antes dela) segue sendo de outra sessão, o retorno de subagente segue sem abrir pedido, e várias mensagens entregues juntas contam todas

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: as duas marcas valiam em qualquer posição do texto); forma real das mensagens medida nos transcritos em 2026-11-14 (a linha "Another Claude session sent a message:" antes da tag em parte delas). Aplica envios.pedido-recebido-mostra-carta e turnos.prompt-sem-turno, sem mudar nenhuma das duas.
Código: hooks/sessions.ts
Estado: coberto

### pedidos.dobra-nao-passa-ao-id-reusado
A linha que a pessoa recolheu segue com a tarefa dela, não com o id.

- Dado um nível 1 que a pessoa recolheu, de um pedido anterior
- Quando um pedido novo traz plan com o mesmo id
- Então o nível 1 novo nasce aberto, e o antigo, que virou histórico, segue recolhido como a pessoa o deixou; nada recolhe sozinho

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: a dobra era guardada pelo id, e o id reusado herdava a dobra da tarefa antiga); aplica "se eu quiser, eu mesmo colapso" (nada recolhe sozinho) e pedidos.plano-anterior-vira-historico.
Código: hooks/render.tsx, draw/layout.ts
Estado: coberto
