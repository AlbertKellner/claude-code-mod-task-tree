# Envios

As mensagens a outras sessões (✉).

Código da área: hooks/tool-call.ts, hooks/sessions.ts, hooks/panel.ts, state/tasks.ts

### envios.fica-ate-entrega
O ✉ fica na tarefa até a entrega.

- Dado uma tarefa de onde saiu uma mensagem a outra sessão, ainda na fila
- Quando a tarefa é concluída antes da entrega
- Então a carta ✉ fica azul na linha sob a tarefa até a entrega, mesmo com a tarefa concluída; na entrega, verde, e o painel conclui a tarefa que enviou, quando nada mais está em execução nela (envios.entrega-espera-o-que-ainda-roda-na-tarefa); se a sessão destino for arquivada antes de tomar a mensagem, vale envios.destino-arquivado-nao-entregue; se o subagente destino parar antes de recebê-la, vale envios.subagente-parado-nao-entregue

Origem: decisão do usuário, 2026-10-23 ("não mostre como interrompida, deixe como mensagem até ela ser entregue"); commit b9dacde.
Reescrito: 2026-10-30, decisão do usuário ("a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria"; "A: linha própria sob a tarefa (Recomendado)"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"); a carta é uma linha própria sob a tarefa.
Reescrito: 2026-11-04, validado pelo usuário no app ("Funcionou").
Reescrito: 2026-11-12, decisão do usuário ("Cinza \"não entregue\" (Recomendado)"); a carta só fica azul até a entrega enquanto a mensagem ainda pode ser entregue: com a sessão destino arquivada antes de tomá-la, fica cinza "não entregue" (envios.destino-arquivado-nao-entregue). Os testes deste cenário não mudam.
Reescrito: 2026-11-13, decisão do usuário ("Cinza \"não entregue\" (Recomendado)"); o mesmo cinza "não entregue" vale para a carta ao subagente que para antes de recebê-la (envios.subagente-parado-nao-entregue). Os testes deste cenário não mudam.
Reescrito: 2026-11-14, texto: a entrega só conclui a tarefa quando nada mais está em execução nela (auditoria 2026-11-10); nenhuma regra muda e os testes existentes não mudam.
Reescrito: 2026-11-15, decisão do usuário de 2026-11-15 ("Cada uma gasta o seu (Recomendado)"): a mensagem na fila depois de uma entrega imediata à mesma sessão só é confirmada pelo segundo recebimento (envios.entrega-imediata-gasta-o-seu-recebimento); o teste da entrega imediata seguida de fila passa a publicar dois recebimentos.
Estado: coberto

### envios.entrega-imediata-fica-verde
A entrega imediata aparece entregue na hora, e a tarefa segue em andamento até o done.

- Dado uma tarefa em andamento de onde sai uma mensagem
- Quando o app responde que a sessão destino já começou a tratá-la ("its turn has started")
- Então a carta fica verde na hora, e a tarefa segue em andamento até o done

Origem: decisão do usuário, 2026-10-28 (sobre "✉ até o destino começar a tratar", 2026-10-21, commit 50c4459; o ✉ "para sinalizar que essa etapa esta em andamento").
Reescrito: 2026-10-30, decisão do usuário ("a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria"; "A: linha própria sob a tarefa (Recomendado)"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"); a carta é a linha sob a tarefa.
Reescrito: 2026-11-04, validado pelo usuário no app ("Funcionou").
Reescrito: 2026-11-15, decisão do usuário de 2026-11-15 ("Cada uma gasta o seu (Recomendado)"): a mensagem na fila depois de uma entrega imediata à mesma sessão só é confirmada pelo segundo recebimento (envios.entrega-imediata-gasta-o-seu-recebimento); o teste da entrega imediata seguida de fila passa a publicar dois recebimentos.
Estado: coberto

### envios.esc-apos-entrega-imediata
Depois de uma entrega imediata, o fim do turno e o Esc não interrompem a mensagem.

- Dado uma tarefa de mensagem em andamento cuja mensagem foi entregue na hora
- Quando o turno em que ela está em andamento termina, normal ou com Esc
- Então a carta segue verde; a tarefa iniciada fica ✕ no Esc, como qualquer outra (entregue a mensagem, ela é uma tarefa comum), salvo enquanto a sessão destino segue trabalhando sob ela (turnos.esc-com-trabalho-delegado-vivo); no cartão que a sessão mãe desenha dessa filha, parada com Esc ou arquivada, a carta já entregue também segue verde

Origem: decisão do usuário, 2026-10-28 ("a mensagem foi entregue; não é interrompida"; o ✉ verde igual com a tarefa aberta ou concluída está bom).
Reescrito: 2026-10-30, decisão do usuário ("a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria"; "A: linha própria sob a tarefa (Recomendado)"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"); só a carta ficava verde no Esc; a tarefa passa a ser tratada como qualquer outra.
Reescrito: 2026-11-04, validado pelo usuário no app ("Funcionou").
Reescrito: 2026-11-14, decisão do usuário ("Seguir ◷ até o start (Recomendado)"); a tarefa que um fim normal deixou ◷ não é interrompida por um Esc posterior sem start nela; o teste passa a dar start antes do Esc.
Reescrito: 2026-11-14, decisão do usuário ("Segue ◉/◷ (Recomendado)"); com a sessão destino trabalhando sob a tarefa, o Esc não a interrompe; o destino do teste passa a parado.
Reescrito: 2026-11-14, texto: o cartão da filha parada mostra a carta como o painel dela (auditoria 2026-11-10); nenhuma regra muda e os testes existentes não mudam.
Código: draw/layout.ts, draw/svg.ts, draw/icons.ts
Estado: coberto

### envios.cor-por-estado
O ✉ mantém o ícone e muda só a cor.

- Dado uma tarefa de mensagem
- Quando a mensagem está na fila, é entregue, fica num plano interrompido ou não é entregue (a sessão destino arquivada antes de tomá-la, ou o subagente parado antes de recebê-la)
- Então a carta muda só de cor (azul na fila, verde entregue, cinza quando a tarefa de onde saiu foi interrompida por um plano novo, desde o plan e também depois da entrega, ou quando não é entregue); a tarefa tem o ícone comum e conta; a tarefa que fecha ✕ pelo fim de um subagente não muda a cor da carta já entregue dela

Origem: decisão do usuário, 2026-10-24 ("mantenha o ícone e troque somente a cor"); commit 95e577a.
Reescrito: 2026-10-30, decisão do usuário ("a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria"; "A: linha própria sob a tarefa (Recomendado)"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"); a cor é da carta, não da tarefa.
Reescrito: 2026-11-04, validado pelo usuário no app ("Funcionou").
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)"); o teste só deixa de escolher a visão ou abre a linha.
Reescrito: 2026-11-12, decisão do usuário ("Sim, fica à vista (Recomendado)"); a carta do plano abandonado por um pedido novo que reusa o id segue à vista, sob a tarefa de origem, enquanto a sessão trabalha ou a carta está na fila (pedidos.id-reusado-segura-pedido-com-sessao-viva); desfaz, para esse caso, "Ficam em '+N pedidos anteriores'": o teste deixa de abrir a linha. A cor não muda.
Reescrito: 2026-11-13, decisão do usuário ("Cinza \"não entregue\" (Recomendado)"); o cinza "não entregue" vale também para o subagente parado antes de recebê-la (envios.subagente-parado-nao-entregue). Os testes deste cenário não mudam.
Reescrito: 2026-11-12, decisão do usuário ("Cinza \"não entregue\" (Recomendado)"); o cinza vale também para a carta não entregue, com a palavra "não entregue" no lugar de "interrompida" (envios.destino-arquivado-nao-entregue). Os testes deste cenário não mudam.
Reescrito: 2026-11-14, texto alinhado ao teste e à decisão de 2026-11-12 ("Cinza já no plan (Recomendado)"); nenhuma regra muda e os testes não mudam.
Reescrito: 2026-11-14, texto: a tarefa ✕ pelo fim de um subagente não deixa cinza a carta já entregue (auditoria 2026-11-10); nenhuma regra muda e os testes existentes não mudam.
Código: draw/layout.ts, draw/svg.ts, draw/icons.ts
Estado: coberto

### envios.aviso-da-entrega-diz-o-que-o-painel-fez
O aviso da entrega só diz que o painel concluiu a tarefa quando ela ficou concluída.

- Dado uma carta na fila
- Quando a sessão destino toma a mensagem e o modelo recebe o aviso "recebimento confirmado"
- Então o aviso diz que o painel concluiu a tarefa do envio só quando ela está ✓; se ela foi interrompida por um plano novo, saiu do plano ou segue aberta (subtarefa aberta, ou algo ainda em execução nela), diz que o painel não a concluiu e que o modelo a fecha quando o trabalho terminar

Origem: auditoria 2026-11-10 (o lembrete "recebimento confirmado" dizia "o painel já concluiu a tarefa do envio" sem ter concluído); aplica envios.fica-ate-entrega, sem mudar nenhuma regra.
Código: text/rules.ts
Estado: coberto

### envios.ancora-no-lote-recente
O envio vai ao lote recente de starts sem envio.

- Dado várias tarefas em andamento, umas iniciadas agora e outras antes, e talvez uma com pergunta aberta
- Quando sai uma mensagem
- Então ela vai à primeira do lote recente ainda sem envio; à tarefa antiga só depois; nunca à que tem pergunta aberta

Origem: decisão do usuário, 2026-10-24; commit fdc1db6.
Reescrito: 2026-10-30, decisão do usuário ("a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria"; "A: linha própria sob a tarefa (Recomendado)"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"); a carta aparece sob a tarefa escolhida.
Reescrito: 2026-11-04, validado pelo usuário no app ("Funcionou").
Reescrito: 2026-11-15, texto: o "nunca à que tem pergunta aberta" vale em todos os casos, com a exceção da tarefa única (envios.nunca-na-tarefa-da-pergunta; auditoria 2026-11-10); nenhuma regra muda e os testes existentes não mudam.
Estado: coberto

### envios.sem-andamento-vai-a-pendente-planejada-por-ultimo
Sem nada em andamento, o envio vai às pendentes planejadas por último, pela ordem.

- Dado nada em andamento no pedido atual, que já tem plano (sem plano: envios.antes-do-plan-fica-solta-e-o-plan-adota)
- Quando sai uma mensagem
- Então ela vai, nesta ordem: à pendente cujo título casa com o nome da sessão destino (envios.carta-pelo-nome-da-sessao); senão, entre as pendentes do plan mais recente do pedido, à primeira na ordem do plano ainda sem carta, sessão ou subagente; todas já com um deles, à última delas; sem nenhuma pendente, à tarefa iniciada por último, mesmo concluída; sem nenhuma iniciada, ao último nível 1 do pedido

Origem: decisão do usuário, 2026-10-23 ("Várias pendentes: a última planejada. Nenhuma pendente: última iniciada"); commits db0c11e e 8a8d51d.
Reescrito: 2026-10-30, decisão do usuário ("a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria"; "A: linha própria sob a tarefa (Recomendado)"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"); a carta aparece sob a tarefa escolhida.
Reescrito: 2026-11-04, validado pelo usuário no app ("Funcionou").
Reescrito: 2026-11-09, decisão do usuário ("em paralelo, a sessõ de pesquisa na WEB abriu na tarefa errada"; "Pelo nome"): com várias pendentes planejadas juntas, o envio vai à primeira delas ainda sem carta, na ordem do plano (antes, à última), depois de tentar o nome da sessão (envios.carta-pelo-nome-da-sessao).
Reescrito: 2026-11-14, decisão do usuário ("Sim, o plan adota (Recomendado)"): vale para o pedido que já tem plano.
Reescrito: 2026-11-14, texto completado com a ordem que o código já segue (auditoria 2026-11-10: o corpo dizia só "a pendente planejada por último"); nenhuma regra muda e os testes existentes não mudam.
Estado: coberto

### envios.com-andamento-fica-sob-a-tarefa-em-andamento
Com uma tarefa em andamento, a carta e o cartão ficam sob ela, não sob o passo planejado depois.

- Dado uma tarefa em andamento (◉) e um passo novo pendente (○) planejado depois do start dela, no mesmo pedido
- Quando sai uma mensagem, abre uma sessão ou é lançado um subagente
- Então a carta e o cartão ficam sob a tarefa em andamento; o passo novo segue ○ até o start nele e não fecha sozinho na entrega (quem fecha é a tarefa do envio)

Origem: decisão do usuário, 2026-11-14 ("Sob a em andamento (Recomendado)"); desfaz o pedido registrado no DESENVOLVIMENTO.md ("o segundo painel de implementacao deveria estar abaixo da tarefa de tooltip completo, foi ele quem enviou a mensagem de solicitação"), que mandava a carta para o passo planejado depois do start.
Código: hooks/agents.ts
Estado: coberto

### envios.carta-pelo-nome-da-sessao
A carta vai à tarefa cujo título casa com o nome da sessão destino.

- Dado várias tarefas candidatas (pendentes sem nada em andamento, ou várias em andamento)
- Quando sai uma mensagem, ou abre uma sessão, cujo nome casa com o título de uma única candidata (sem acento, sem hífen e sem diferença de maiúsculas: o título contém o nome, o nome contém o começo do título antes de ":", ou uma palavra do nome, com 4 letras ou mais, é palavra do título)
- Então a carta e o cartão ficam sob essa tarefa; sem casamento único, vale a ordem: a primeira pendente planejada junto ainda sem carta; o título da sessão nova e a descrição e o tipo de um subagente são frases livres: só levam o cartão a uma tarefa quando o título dela contém a frase inteira, em palavras inteiras, ou a frase contém o começo do título; uma palavra em comum não decide

Origem: decisão do usuário, 2026-11-09 ("em paralelo, a sessõ de pesquisa na WEB abriu na tarefa errada"; "Pelo nome").
Código: hooks/tool-call.ts, hooks/sessions.ts, hooks/agents.ts
Reescrito: 2026-11-09, decisão do usuário ("Sim, por palavra (Recomendado)"): casa também quando uma palavra do nome, com 4 letras ou mais, é palavra do título de uma única candidata ("analise-plano" com "Subagente da hora na análise"); um subagente lançado de uma tarefa conta como carta para o envio seguinte.
Reescrito: 2026-11-14, decisão do usuário ("Só no nome (Recomendado)"): o casamento por uma palavra vale só para o nome da sessão (o destino da mensagem, o nome da sessão aberta); para o título da sessão e para a descrição e o tipo do subagente, só a frase inteira. Os testes deste cenário não mudam.
Estado: coberto

### envios.fila-nao-interrompe-no-fim-do-turno
O envio na fila não vira interrompido no fim do turno.

- Dado uma mensagem na fila
- Quando o turno termina, normal ou com Esc
- Então a carta na fila não é interrompida por fim de turno nem Esc; a tarefa de onde saiu fica ◷ enquanto a carta está na fila, Esc inclusive

Origem: decisão do usuário, 2026-10-24; commit 93df998.
Reescrito: 2026-10-30, decisão do usuário ("a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria"; "A: linha própria sob a tarefa (Recomendado)"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"); a tarefa fica ◷, e não mais ✉, enquanto a carta espera.
Reescrito: 2026-11-04, validado pelo usuário no app ("Funcionou").
Código: draw/layout.ts, draw/svg.ts, draw/icons.ts
Estado: coberto

### envios.pedido-recebido-mostra-carta
A carta de recebimento é a linha do pedido; as tarefas derivadas têm ícone de tarefa.

- Dado uma mensagem de outra sessão que abre um pedido
- Quando o modelo planeja as tarefas dele e as trata
- Então a linha do pedido mostra o ✉ de recebida (azul enquanto há trabalho aberto, verde concluído, cinza interrompido), e as tarefas, em qualquer nível, mostram o ícone comum; um pedido da pessoa não tem carta; o relato de uma sessão que esta abriu, entregue com o turno em curso, não abre pedido, então não tem carta de recebida (pedidos.mensagem-no-meio-do-turno-continua-o-pedido)

Origem: decisão do usuário, 2026-10-24 ("o ícone do 'analisar a tarefa' deveria ser uma carta também"); commit 527b5fb.
Reescrito: 2026-10-30, decisão do usuário ("as cartas deveriam representar somente quando uma sessão se comunica com outra… Quando o pedido fosse recebido, ele seria representado por uma carta, e as tarefas derivadas dessa mensagem (pedido) deveriam ter os icones de tarefas, não de cartas"; "Sim, uma carta por mensagem (Recomendado)"; "Azul tratando, verde concluído, cinza interrompido (Recomendado)"); desfaz o ajuste de 2026-10-24 e volta ao pedido original do mesmo dia ("as tarefas partem como subtarefas da tarefa de recebimento").
Reescrito: 2026-11-12, decisão do usuário ("Entra no pedido em curso (Recomendado)"); exceção a "uma carta por mensagem" (2026-10-30): o relato de uma sessão que esta abriu, entregue no meio do turno, continua o pedido em curso, sem linha nem ✉ de recebida. Os testes não mudam.
Código: hooks/prompt-submit.ts, draw/layout.ts
Estado: coberto

### envios.carta-mostra-o-nome-do-destino
A carta diz o nome da sessão destino, também quando ela não é filha desta sessão.

- Dado uma mensagem enviada pelo id a uma sessão que não é filha de quem envia (a mãe, uma irmã)
- Quando a carta é desenhada, no painel de quem enviou ou no cartão dela na sessão mãe
- Então ela diz "Para <nome>: …" com o nome que a lista de sessões do app ou a mensagem recebida dessa sessão informaram; no cartão da filha, o destino que é a própria sessão que desenha aparece com o nome dela, quando o app o informa; sem nome conhecido, os oito primeiros caracteres do id, como antes

Origem: auditoria 2026-11-10 (irmã e mãe apareciam como 8 caracteres do id); aplica envios.carta-sob-a-tarefa ("Para <sessão>: <mensagem>"), sem mudar nenhuma regra.
Código: draw/layout.ts, hooks/render.tsx, hooks/prompt-submit.ts
Estado: coberto

### envios.carta-sob-a-tarefa
A carta de envio é uma linha sob a tarefa de onde a mensagem saiu.

- Dado uma mensagem a outra sessão enviada de uma tarefa
- Quando o painel é desenhado
- Então uma linha "✉ Para <sessão>: <mensagem>" aparece sob a tarefa, antes do cartão da sessão, com "na fila" e o tempo de espera, depois "entregue" (ou "não entregue", sem tempo, se a sessão destino for arquivada antes de tomá-la ou o subagente destino parar antes de recebê-la); ela fica fora do x/y, das barras e dos chips, menos o de "aguardando sessão", que só conta a carta na fila; a tarefa segue com o ícone comum e conta

Origem: decisão do usuário, 2026-10-30 ("A: linha própria sob a tarefa (Recomendado)"; "a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria").
Reescrito: 2026-11-12, decisão do usuário ("Cinza \"não entregue\" (Recomendado)"); a linha ganha a palavra "não entregue", sem tempo e fora do chip "aguardando sessão" (envios.destino-arquivado-nao-entregue). Os testes deste cenário não mudam.
Reescrito: 2026-11-13, decisão do usuário ("Cinza \"não entregue\" (Recomendado)"); "não entregue" também quando o subagente destino para antes de recebê-la (envios.subagente-parado-nao-entregue). Os testes deste cenário não mudam.
Reescrito: 2026-11-15, decisão do usuário de 2026-11-15 ("Uma carta por mensagem (Recomendado)"): a linha é uma por mensagem (envios.uma-carta-por-mensagem). Os testes deste cenário não mudam.
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

### envios.subagente-parado-nao-entregue
A carta para um subagente que para antes de recebê-la fica cinza, "não entregue".

- Dado uma tarefa com a carta dela na fila para um subagente desta sessão
- Quando o subagente termina sem recebê-la (Esc, TaskStop, falha, fim sem ser retomado com ela, ou o cartão encerrado pela lista do app)
- Então em poucos segundos a carta fica cinza com "não entregue", sem tempo, e sai do chip "aguardando sessão"; a tarefa volta a ser comum (no Esc fica ✕; o done dela não avisa de fila; concluída, não segura o pedido à vista; com o turno terminado, reflete o fim do subagente lançado dela) e o modelo é avisado uma vez; recebida depois (retomado com ela), a carta fica verde e o modelo é avisado da entrega

Origem: decisão do usuário, 2026-11-13 ("Cinza \"não entregue\" (Recomendado)"), à pendência "carta para subagente parado antes de receber"; aplica envios.destino-arquivado-nao-entregue ao subagente e limita envios.fica-ate-entrega, envios.fila-nao-interrompe-no-fim-do-turno e envios.tarefa-aguarda-a-sessao-enquanto-a-carta-esta-na-fila à mensagem que ainda pode ser entregue.
Código: hooks/agents.ts, text/rules.ts
Estado: coberto

### envios.subagente-recebe-fica-verde
A carta para um subagente fica verde quando ele a recebe.

- Dado uma tarefa com a carta dela na fila para um subagente desta sessão
- Quando ele a recebe na rodada seguinte de ferramentas, ou termina antes e o app o retoma com ela
- Então a carta fica verde, "entregue", sem tempo e fora do chip; o painel conclui a tarefa de onde ela saiu, salvo se dela ainda roda um subagente: aí ela fecha com o fim dele; o modelo é avisado da entrega uma vez

Origem: análise da pendência 1, 2026-11-14 (a entrega a um subagente nunca era conferida, e a carta ficava azul mesmo recebida); aplica envios.fica-ate-entrega ("na entrega, verde, e o painel conclui a tarefa que enviou") e subagentes.um-rodando-mantem-o-pai, sem mudar nenhuma delas.
Código: hooks/agents.ts, text/rules.ts
Estado: coberto

### envios.subagente-no-app
No app, a carta para um subagente real fica verde ao ser recebida e cinza "não entregue" quando ele para antes.

- Dado uma mensagem na fila para um subagente real em segundo plano
- Quando ele a recebe; noutra vez, é parado com TaskStop (ou Esc) antes da rodada seguinte; noutra, termina antes e é retomado
- Então verde nos casos de recebimento e retomada, sem passar por cinza; cinza "não entregue" em poucos segundos no parado; nos dois temas, com o tempo parado

Origem: decisão do usuário, 2026-11-13 ("Cinza \"não entregue\" (Recomendado)"); o que o harness não alcança de envios.subagente-parado-nao-entregue e envios.subagente-recebe-fica-verde.
Código: hooks/agents.ts
Estado: checklist (subagente real, o motor e o relógio de 1 s não rodam no harness)

### envios.envio-que-falha-nao-deixa-rastro
O envio que falha não deixa carta nem rodada.

- Dado uma mensagem a uma sessão filha cujo envio falha
- Quando a filha abre o turno seguinte
- Então não há carta do envio que falhou, e as tarefas do turno seguinte seguem no cartão em que a filha já estava, não num cartão novo sob a tarefa do envio

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: a rodada era gravada antes de saber se o envio falhou); aplica sessoes.um-cartao-por-mensagem, sem mudá-la.
Estado: coberto

### envios.antes-do-plan-fica-solta-e-o-plan-adota
A carta enviada antes do plan do pedido fica solta no fim, e o plan do pedido a adota.

- Dado um pedido novo ainda sem plano, com ou sem tarefas abertas de pedidos anteriores, e nada em andamento
- Quando o modelo manda uma mensagem a outra sessão, e depois planeja o pedido
- Então, até o plan, a carta fica no fim do painel, fora de qualquer tarefa, e nenhuma tarefa de pedido anterior ganha carta nem fecha na entrega; no primeiro plan do pedido, a carta passa para a tarefa dele escolhida como em qualquer envio (o nome da sessão, senão a primeira pendente ainda sem carta) e fica lá; a tarefa que a adotou não fecha sozinha na entrega

Origem: decisão do usuário, 2026-11-14 ("Sim, o plan adota (Recomendado)"), sobre os achados da auditoria de 2026-11-10 (a carta ia a uma pendente do pedido anterior, que fechava sozinha). Refina "envio feito sem tarefa em andamento ancora na última iniciada do pedido atual" (2026-10-23) para o pedido ainda sem tarefas.
Código: hooks/tools.ts, draw/layout.ts, text/rules.ts
Estado: coberto

### envios.entrega-espera-o-que-ainda-roda-na-tarefa
A entrega só conclui a tarefa quando nada mais está em execução nela.

- Dado uma tarefa com a carta dela na fila e, ainda, um subagente lançado dela rodando, outra carta dela na fila ou uma pergunta aberta nela
- Quando a sessão (ou o subagente) destino toma a carta
- Então a carta fica verde e a tarefa segue aberta; ela fecha quando o último termina: pelo fim do subagente (refletindo o fim dele), pela entrega da outra carta, ou pelo done do modelo depois da resposta; a sessão que tomou a carta e segue trabalhando não segura a conclusão (o desenho mantém a linha ◉ enquanto ela trabalha)

Origem: auditoria 2026-11-10 (os dois fechamentos automáticos usavam condições diferentes); aplica subagentes.um-rodando-mantem-o-pai ("até o último terminar (e a carta ser entregue)") e envios.tarefa-aguarda-a-sessao-enquanto-a-carta-esta-na-fila, sem mudar a decisão de 2026-10-30 ("Sim, conclusão automática como hoje").
Código: hooks/agents.ts, draw/layout.ts
Estado: coberto

### envios.carta-uma-vez-no-cartao-da-origem
Cada carta aparece uma vez: no cartão e no pedido da tarefa de onde saiu.

- Dado uma filha com mais de um cartão que mandou uma mensagem, ou uma carta na fila cuja tarefa saiu do plano num replano
- Quando o painel é desenhado
- Então a carta da filha aparece só no cartão que tem a tarefa de origem (sem ela, no do turno em que foi enviada), e o chip "aguardando sessão" a conta uma vez; a carta cuja tarefa saiu do plano pende do nível 1 do pedido em que foi enviada, nunca de outro pedido, e esse pedido segue à vista enquanto ela está na fila; com o pedido dela em "+N pedidos anteriores", ela fica lá com ele

Origem: auditoria 2026-11-10 (a carta se repetia em todos os cartões de rodada, e a carta órfã de replano passava ao pedido novo); aplica envios.carta-sob-a-tarefa, pedidos.replano-mantem-envio-ate-entrega e a decisão de 2026-11-12 ("Sim, fica à vista (Recomendado)"), sem mudar nenhuma regra.
Código: draw/layout.ts
Estado: coberto

### envios.aviso-de-envio-na-fila
O envio que fica na fila pede para manter a tarefa do envio em andamento.

- Dado uma tarefa em andamento
- Quando o modelo manda uma mensagem que fica na fila (a outra sessão ou a um subagente)
- Então o resultado diz que a mensagem ficou na fila, cita a tarefa do envio e pede para mantê-la em andamento; para um subagente, diz que é para o subagente; na entrega imediata, não diz

Origem: cenário criado por decisão do usuário, 2026-11-14 ("Cenário por texto (Recomendado)"): o teste confere quando o texto sai e os trechos essenciais; a redação segue livre.
Estado: coberto

### envios.done-com-carta-na-fila
O done que fecha a tarefa de uma carta ainda na fila avisa.

- Dado uma tarefa com uma carta ainda na fila
- Quando o modelo fecha a tarefa com done
- Então o resultado avisa que a mensagem ainda está na fila, sem confirmação de recebimento; com a carta entregue, não avisa

Origem: cenário criado por decisão do usuário, 2026-11-14 ("Cenário por texto (Recomendado)"): o teste confere quando o texto sai e os trechos essenciais; a redação segue livre.
Código: hooks/tools.ts
Estado: coberto

### envios.carta-na-fila-nao-sai-pelo-teto
A carta na fila não sai do painel por causa de envios mais novos.

- Dado uma tarefa com a carta dela na fila e, depois, 20 ou mais mensagens novas já entregues
- Quando o painel é desenhado
- Então a carta na fila segue sob a tarefa, azul, e a tarefa segue esperando a entrega; do painel só saem, pelas mais antigas, cartas já entregues (ou não entregues) de que o modelo já foi avisado

Origem: auditoria 2026-11-10 (o teto de 20 envios cortava por posição); aplica envios.fica-ate-entrega, sem mudar nenhuma regra.
Código: draw/layout.ts
Estado: coberto

### envios.marca-de-entrega-na-carta-certa
A entrega marca a carta da mensagem que foi entregue, mesmo com outra mensagem saindo na mesma hora.

- Dado uma carta na fila, com o recebimento dela já publicado pela sessão destino
- Quando o modelo manda outra mensagem da mesma tarefa à mesma sessão enquanto o painel relê as sessões
- Então a carta nova segue azul, "na fila", e a tarefa segue aberta; a marca "entregue" nunca cai em outra carta

Origem: auditoria 2026-11-10 (as marcas eram aplicadas pelo índice de uma leitura antiga); aplica envios.fica-ate-entrega, sem mudar nenhuma regra.
Código: hooks/agents.ts, draw/layout.ts
Estado: coberto

### envios.falha-de-um-passo-nao-perde-a-carta
A falha de um passo acessório do painel não perde a carta do envio.

- Dado uma tarefa em andamento
- Quando o modelo manda uma mensagem e um passo acessório do painel falha na mesma chamada (o relógio, a releitura das sessões, uma leitura de estado)
- Então a carta aparece sob a tarefa, o resultado traz o aviso de fila, e a falha fica no log de depuração, uma vez por passo e motivo

Origem: auditoria 2026-11-10 (o tool.call genérico não isolava os passos); regra do painel, sem decisão nova.
Estado: coberto

### envios.nunca-na-tarefa-da-pergunta
A carta e o cartão não vão para a tarefa com pergunta aberta enquanto houver outra tarefa do pedido para recebê-los.

- Dado uma tarefa com uma pergunta, um plano a aprovar ou a escolha do fim do turno aberta nela, seja a única em andamento, a iniciada por último, ou a que o fim do turno deixou aguardando
- Quando sai uma mensagem, abre uma sessão ou é lançado um subagente
- Então a carta e o cartão vão, nesta ordem, à tarefa em andamento iniciada por último que não pergunta; senão à pendente escolhida como no envio sem nada em andamento (envios.sem-andamento-vai-a-pendente-planejada-por-ultimo), sem contar a tarefa da pergunta; senão à última iniciada do pedido que não pergunta; senão ao último nível 1 do pedido que não pergunta; só quando a tarefa da pergunta é a única do pedido eles ficam nela

Origem: auditoria 2026-11-10 (a regra só valia com duas em andamento); aplica envios.ancora-no-lote-recente ("nunca à que tem pergunta aberta", decisão do usuário, 2026-10-24), sem mudar nenhuma regra.
Código: hooks/agents.ts, hooks/tools.ts
Estado: coberto

### envios.uma-carta-por-mensagem
Cada mensagem tem a sua carta, mesmo da mesma tarefa à mesma sessão.

- Dado uma tarefa de onde saem duas mensagens à mesma sessão ocupada
- Quando a sessão toma a primeira, e depois a segunda
- Então há duas linhas ✉ sob a tarefa, cada uma com o seu texto; cada uma fica verde na sua entrega; a tarefa só fecha na entrega da última (envios.entrega-espera-o-que-ainda-roda-na-tarefa)

Origem: decisão do usuário, 2026-11-15 ("Uma carta por mensagem (Recomendado)"); completa "A: linha própria sob a tarefa (Recomendado)" (2026-10-30), que não dizia se a linha era por mensagem.
Código: draw/layout.ts, hooks/agents.ts, hooks/tools.ts
Estado: coberto

### envios.entrega-imediata-gasta-o-seu-recebimento
Cada mensagem gasta o seu recebimento: o da entregue na hora não confirma a seguinte.

- Dado uma mensagem entregue na hora e outra, depois, na fila da mesma sessão
- Quando a sessão publica o primeiro recebimento depois do segundo envio; e depois o segundo
- Então o primeiro é o da mensagem entregue na hora e nada muda no painel; a carta da fila fica verde, e a tarefa dela fecha, só no segundo

Origem: decisão do usuário, 2026-11-15 ("Cada uma gasta o seu (Recomendado)"), sobre o achado da auditoria de 2026-11-10; risco aceito: se o destino nunca publicar o primeiro recebimento, a segunda carta segue azul.
Código: types/index.d.ts
Estado: coberto
