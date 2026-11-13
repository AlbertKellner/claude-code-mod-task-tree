# Envios

As mensagens a outras sessões (✉).

Código da área: hooks/tool-call.ts, hooks/sessions.ts, hooks/panel.ts, state/tasks.ts

### envios.fica-ate-entrega
O ✉ fica na tarefa até a entrega.

- Dado uma tarefa de onde saiu uma mensagem a outra sessão, ainda na fila
- Quando a tarefa é concluída antes da entrega
- Então a carta ✉ fica azul na linha sob a tarefa até a entrega, mesmo com a tarefa concluída; na entrega, verde, e o painel conclui a tarefa que enviou; se a sessão destino for arquivada antes de tomar a mensagem, vale envios.destino-arquivado-nao-entregue

Origem: decisão do usuário, 2026-10-23 ("não mostre como interrompida, deixe como mensagem até ela ser entregue"); commit 109b92d.
Reescrito: 2026-10-30, decisão do usuário ("a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria"; "A: linha própria sob a tarefa (Recomendado)"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"); a carta é uma linha própria sob a tarefa.
Reescrito: 2026-11-04, validado pelo usuário no app ("Funcionou").
Reescrito: 2026-11-12, decisão do usuário ("Cinza \"não entregue\" (Recomendado)"); a carta só fica azul até a entrega enquanto a mensagem ainda pode ser entregue: com a sessão destino arquivada antes de tomá-la, fica cinza "não entregue" (envios.destino-arquivado-nao-entregue). Os testes deste cenário não mudam.
Estado: coberto

### envios.entrega-imediata-fica-verde
A entrega imediata aparece entregue na hora, e a tarefa segue em andamento até o done.

- Dado uma tarefa em andamento de onde sai uma mensagem
- Quando o app responde que a sessão destino já começou a tratá-la ("its turn has started")
- Então a carta fica verde na hora, e a tarefa segue em andamento até o done

Origem: decisão do usuário, 2026-10-28 (sobre "✉ até o destino começar a tratar", 2026-10-21, commit 7c734de; o ✉ "para sinalizar que essa etapa esta em andamento").
Reescrito: 2026-10-30, decisão do usuário ("a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria"; "A: linha própria sob a tarefa (Recomendado)"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"); a carta é a linha sob a tarefa.
Reescrito: 2026-11-04, validado pelo usuário no app ("Funcionou").
Estado: coberto

### envios.esc-apos-entrega-imediata
Depois de uma entrega imediata, o fim do turno e o Esc não interrompem a mensagem.

- Dado uma tarefa de mensagem em andamento cuja mensagem foi entregue na hora
- Quando o turno termina, normal ou com Esc
- Então a carta segue verde; a tarefa iniciada fica ✕ no Esc, como qualquer outra (entregue a mensagem, ela é uma tarefa comum)

Origem: decisão do usuário, 2026-10-28 ("a mensagem foi entregue; não é interrompida"; o ✉ verde igual com a tarefa aberta ou concluída está bom).
Reescrito: 2026-10-30, decisão do usuário ("a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria"; "A: linha própria sob a tarefa (Recomendado)"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"); só a carta ficava verde no Esc; a tarefa passa a ser tratada como qualquer outra.
Reescrito: 2026-11-04, validado pelo usuário no app ("Funcionou").
Código: draw/layout.ts, draw/svg.ts, draw/icons.ts
Estado: coberto

### envios.cor-por-estado
O ✉ mantém o ícone e muda só a cor.

- Dado uma tarefa de mensagem
- Quando a mensagem está na fila, é entregue, fica num plano interrompido ou não é entregue (a sessão destino arquivada antes de tomá-la)
- Então a carta muda só de cor (azul na fila, verde entregue, cinza descartada antes da entrega ou não entregue); a tarefa tem o ícone comum e conta

Origem: decisão do usuário, 2026-10-24 ("mantenha o ícone e troque somente a cor"); commit 8eb801c.
Reescrito: 2026-10-30, decisão do usuário ("a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria"; "A: linha própria sob a tarefa (Recomendado)"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"); a cor é da carta, não da tarefa.
Reescrito: 2026-11-04, validado pelo usuário no app ("Funcionou").
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)"); o teste só deixa de escolher a visão ou abre a linha.
Reescrito: 2026-11-12, decisão do usuário ("Sim, fica à vista (Recomendado)"); a carta do plano abandonado por um pedido novo que reusa o id segue à vista, sob a tarefa de origem, enquanto a sessão trabalha ou a carta está na fila (pedidos.id-reusado-segura-pedido-com-sessao-viva); desfaz, para esse caso, "Ficam em '+N pedidos anteriores'": o teste deixa de abrir a linha. A cor não muda.
Reescrito: 2026-11-12, decisão do usuário ("Cinza \"não entregue\" (Recomendado)"); o cinza vale também para a carta não entregue, com a palavra "não entregue" no lugar de "interrompida" (envios.destino-arquivado-nao-entregue). Os testes deste cenário não mudam.
Código: draw/layout.ts, draw/svg.ts, draw/icons.ts
Estado: coberto

### envios.ancora-no-lote-recente
O envio vai ao lote recente de starts sem envio.

- Dado várias tarefas em andamento, umas iniciadas agora e outras antes, e talvez uma com pergunta aberta
- Quando sai uma mensagem
- Então ela vai à primeira do lote recente ainda sem envio; à tarefa antiga só depois; nunca à que tem pergunta aberta

Origem: decisão do usuário, 2026-10-24; commit 26adf08.
Reescrito: 2026-10-30, decisão do usuário ("a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria"; "A: linha própria sob a tarefa (Recomendado)"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"); a carta aparece sob a tarefa escolhida.
Reescrito: 2026-11-04, validado pelo usuário no app ("Funcionou").
Estado: coberto

### envios.sem-andamento-vai-a-pendente-planejada-por-ultimo
Sem nada em andamento, o envio vai à pendente planejada por último.

- Dado nada em andamento no pedido atual
- Quando sai uma mensagem
- Então ela vai à pendente planejada por último; sem pendente, à última iniciada

Origem: decisão do usuário, 2026-10-23 ("Várias pendentes: a última planejada. Nenhuma pendente: última iniciada"); commits b742294 e 5f3df6e.
Reescrito: 2026-10-30, decisão do usuário ("a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria"; "A: linha própria sob a tarefa (Recomendado)"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"); a carta aparece sob a tarefa escolhida.
Reescrito: 2026-11-04, validado pelo usuário no app ("Funcionou").
Reescrito: 2026-11-09, decisão do usuário ("em paralelo, a sessõ de pesquisa na WEB abriu na tarefa errada"; "Pelo nome"): com várias pendentes planejadas juntas, o envio vai à primeira delas ainda sem carta, na ordem do plano (antes, à última), depois de tentar o nome da sessão (envios.carta-pelo-nome-da-sessao).
Estado: coberto

### envios.carta-pelo-nome-da-sessao
A carta vai à tarefa cujo título casa com o nome da sessão destino.

- Dado várias tarefas candidatas (pendentes sem nada em andamento, ou várias em andamento)
- Quando sai uma mensagem, ou abre uma sessão, cujo nome casa com o título de uma única candidata (sem acento, sem hífen e sem diferença de maiúsculas: o título contém o nome, ou o nome contém o começo do título antes de ":")
- Então a carta e o cartão ficam sob essa tarefa; sem casamento único, vale a ordem: a primeira pendente planejada junto ainda sem carta

Origem: decisão do usuário, 2026-11-09 ("em paralelo, a sessõ de pesquisa na WEB abriu na tarefa errada"; "Pelo nome").
Código: hooks/tool-call.ts, hooks/sessions.ts
Reescrito: 2026-11-09, decisão do usuário ("Sim, por palavra (Recomendado)"): casa também quando uma palavra do nome, com 4 letras ou mais, é palavra do título de uma única candidata ("analise-plano" com "Subagente da hora na análise"); um subagente lançado de uma tarefa conta como carta para o envio seguinte.
Estado: coberto

### envios.fila-nao-interrompe-no-fim-do-turno
O envio na fila não vira interrompido no fim do turno.

- Dado uma mensagem na fila
- Quando o turno termina, normal ou com Esc
- Então a carta na fila não é interrompida por fim de turno nem Esc; a tarefa de onde saiu fica ◷ enquanto a carta está na fila, Esc inclusive

Origem: decisão do usuário, 2026-10-24; commit b897cac.
Reescrito: 2026-10-30, decisão do usuário ("a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria"; "A: linha própria sob a tarefa (Recomendado)"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"); a tarefa fica ◷, e não mais ✉, enquanto a carta espera.
Reescrito: 2026-11-04, validado pelo usuário no app ("Funcionou").
Código: draw/layout.ts, draw/svg.ts, draw/icons.ts
Estado: coberto

### envios.pedido-recebido-mostra-carta
A carta de recebimento é a linha do pedido; as tarefas derivadas têm ícone de tarefa.

- Dado uma mensagem de outra sessão que abre um pedido
- Quando o modelo planeja as tarefas dele e as trata
- Então a linha do pedido mostra o ✉ de recebida (azul enquanto há trabalho aberto, verde concluído, cinza interrompido), e as tarefas, em qualquer nível, mostram o ícone comum; um pedido da pessoa não tem carta; o relato de uma sessão que esta abriu, entregue com o turno em curso, não abre pedido, então não tem carta de recebida (pedidos.mensagem-no-meio-do-turno-continua-o-pedido)

Origem: decisão do usuário, 2026-10-24 ("o ícone do 'analisar a tarefa' deveria ser uma carta também"); commit 83f715d.
Reescrito: 2026-10-30, decisão do usuário ("as cartas deveriam representar somente quando uma sessão se comunica com outra… Quando o pedido fosse recebido, ele seria representado por uma carta, e as tarefas derivadas dessa mensagem (pedido) deveriam ter os icones de tarefas, não de cartas"; "Sim, uma carta por mensagem (Recomendado)"; "Azul tratando, verde concluído, cinza interrompido (Recomendado)"); desfaz o ajuste de 2026-10-24 e volta ao pedido original do mesmo dia ("as tarefas partem como subtarefas da tarefa de recebimento").
Reescrito: 2026-11-12, decisão do usuário ("Entra no pedido em curso (Recomendado)"); exceção a "uma carta por mensagem" (2026-10-30): o relato de uma sessão que esta abriu, entregue no meio do turno, continua o pedido em curso, sem linha nem ✉ de recebida. Os testes não mudam.
Código: hooks/prompt-submit.ts, draw/layout.ts
Estado: coberto

### envios.carta-sob-a-tarefa
A carta de envio é uma linha sob a tarefa de onde a mensagem saiu.

- Dado uma mensagem a outra sessão enviada de uma tarefa
- Quando o painel é desenhado
- Então uma linha "✉ Para <sessão>: <mensagem>" aparece sob a tarefa, antes do cartão da sessão, com "na fila" e o tempo de espera, depois "entregue" (ou "não entregue", sem tempo, se a sessão destino for arquivada antes de tomá-la); ela fica fora do x/y, das barras e dos chips, menos o de "aguardando sessão", que só conta a carta na fila; a tarefa segue com o ícone comum e conta

Origem: decisão do usuário, 2026-10-30 ("A: linha própria sob a tarefa (Recomendado)"; "a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria").
Reescrito: 2026-11-12, decisão do usuário ("Cinza \"não entregue\" (Recomendado)"); a linha ganha a palavra "não entregue", sem tempo e fora do chip "aguardando sessão" (envios.destino-arquivado-nao-entregue). Os testes deste cenário não mudam.
Código: draw/layout.ts, draw/svg.ts, draw/icons.ts, hooks/render.tsx
Estado: coberto

### envios.tarefa-aguarda-a-sessao-enquanto-a-carta-esta-na-fila
Enquanto a carta está na fila, a tarefa de onde saiu espera a sessão.

- Dado uma tarefa iniciada com a carta dela na fila
- Quando o turno termina com Esc, e depois a sessão destino toma a mensagem
- Então a tarefa fica ◷ (não ✕) enquanto a carta está azul, e na entrega o painel a conclui sozinho e a carta fica verde

Origem: decisão do usuário, 2026-10-30 ("Não, fica ◷ enquanto a carta está na fila"; "Sim, conclusão automática como hoje").
Código: draw/layout.ts, hooks/sessions.ts
Estado: coberto

### envios.entrega-com-lista-de-sessoes-em-erro
A entrega é confirmada mesmo quando a lista de sessões do app falha.

- Dado uma tarefa com a carta dela na fila
- Quando a lista de sessões do app volta com erro e a sessão destino já publicou que recebeu a mensagem
- Então a carta fica verde, sai do chip "aguardando sessão" e o painel conclui a tarefa, como na entrega com a lista lida

Origem: auditoria 2026-11-10 (carta na fila sem saída: com a lista em erro, o envio nunca era conferido); aplica envios.fica-ate-entrega ("na entrega, verde, e o painel conclui a tarefa que enviou"), sem mudar nenhuma regra.
Código: hooks/sessions.ts
Estado: coberto

### envios.destino-arquivado-nao-entregue
A carta cuja sessão destino foi arquivada antes de tomá-la fica cinza, "não entregue".

- Dado uma tarefa com a carta dela na fila
- Quando a lista de sessões do app mostra a sessão destino arquivada antes de tomar a mensagem
- Então a carta fica cinza com "não entregue", sem tempo, e sai do chip "aguardando sessão"; a tarefa volta a ser comum (no Esc fica ✕, como qualquer outra; o done dela não avisa de carta na fila; concluída, não segura o pedido à vista) e o modelo é avisado uma vez; desarquivada antes de tomá-la, a carta volta a azul "na fila" e a tarefa volta a esperar a sessão; tomada mesmo assim, a carta fica verde e o modelo é avisado da entrega, como em qualquer entrega

Origem: decisão do usuário, 2026-11-12 ("Cinza \"não entregue\" (Recomendado)"), à pergunta da auditoria 2026-11-10 "Carta na fila cujo destino foi arquivado ou sumiu"; limita envios.fica-ate-entrega, envios.fila-nao-interrompe-no-fim-do-turno e envios.tarefa-aguarda-a-sessao-enquanto-a-carta-esta-na-fila à mensagem que ainda pode ser entregue. Só a sessão que a lista do app mostra arquivada: o destino que some da lista (ou a lista em erro) segue "na fila".
Código: hooks/sessions.ts, hooks/tools.ts, draw/layout.ts, draw/svg.ts, draw/icons.ts, text/rules.ts
Estado: coberto

### envios.destino-arquivado-no-app
No app, arquivar a sessão destino com a mensagem na fila deixa a carta cinza "não entregue" e para o tempo da espera.

- Dado uma mensagem na fila para uma sessão real, com o painel aberto
- Quando a sessão destino é arquivada no app antes de tomar a mensagem, e depois desarquivada
- Então em poucos segundos a carta fica cinza com "não entregue", nos dois temas, e o tempo da espera para de contar; desarquivada, a carta volta a azul "na fila" com o tempo de espera

Origem: decisão do usuário, 2026-11-12 ("Cinza \"não entregue\" (Recomendado)"); o que o harness não alcança de envios.destino-arquivado-nao-entregue.
Código: hooks/sessions.ts, draw/layout.ts, draw/svg.ts, draw/icons.ts
Estado: checklist (sessão real arquivada no app; o relógio de 1 s e a pintura não rodam no harness)
