# Turnos

O fim do turno, normal ou com Esc, e a mensagem seguinte.

Código da área: draw/layout.ts, hooks/turn.ts, hooks/panel.ts, hooks/prompt-submit.ts

### turnos.iniciada-aguarda-no-fim
A tarefa iniciada e aberta aguarda no fim do turno.

- Dado uma tarefa iniciada e aberta
- Quando o turno termina normalmente
- Então ela fica ◷ com o relógio parado, e o pai e o pedido ◷; salvo a tarefa cujo trabalho era só subagentes, todos terminados e nada mais em execução nela, que reflete o fim deles (subagentes.pai-conclui-no-fim-do-turno)

Origem: decisão do usuário, 2026-10-27; commit 95b1a21.
Reescrito: 2026-11-09, decisão do usuário ("falta só corrigir as tarefas pai, quando um agente é concluido com sucesso, o pai sempre deve refletir seu status, não ficar pendente se não tiver nada em execucao"; "Fecha de fato (Recomendado)").
Estado: coberto

### turnos.pendentes-seguem-pendentes
As pendentes seguem pendentes no fim do turno, na principal e nas filhas.

- Dado tarefas nunca iniciadas
- Quando o turno termina, normal ou com Esc
- Então elas seguem ○, nunca ✕, e o cabeçalho as conta

Origem: decisão do usuário, 2026-10-27 (desfaz "reaproveitar o interrompida", 2026-10-24, edb959f); commit d57807e.
Estado: coberto

### turnos.pai-e-pedido-aguardam-no-fim
No fim do turno, o pai aberto e o pedido aguardam.

- Dado algo concluído ou aguardando embaixo de um pai aberto
- Quando o turno termina
- Então o pai e o pedido ficam ◷

Origem: "Pai aguardando", decisão do usuário, 2026-10-20 ("nas tarefas que estao aguardando e ja tem alguma tarefa concluida, marque os pais como aguardando"); commit 465b09e.
Estado: coberto

### turnos.esc-interrompe-so-a-iniciada
O Esc interrompe só a tarefa iniciada.

- Dado uma tarefa iniciada e outras pendentes
- Quando a pessoa para o turno (Esc)
- Então só a iniciada fica ✕; as pendentes seguem ○; o pai com pendentes e nada feito embaixo fica ○; a iniciada com trabalho delegado vivo embaixo não é interrompida (turnos.esc-com-trabalho-delegado-vivo)

Origem: decisão do usuário, 2026-10-27; commit d57807e.
Reescrito: 2026-11-04, decisão do usuário ("todos os subitens estão concluidos ou interrompidos, mas a tarefa pai está como em andamento, ela deveria estar concluida tambem"; pai com só ✕ embaixo: "Fica ✓").
Reescrito: 2026-11-14, decisão do usuário ("Segue ◉/◷ (Recomendado)").
Estado: coberto

### turnos.prompt-seguinte-retoma
A mensagem seguinte retoma o trabalho.

- Dado um turno terminado, normal ou com Esc
- Quando chega a mensagem seguinte e o modelo chama start
- Então a tarefa iniciada acende ◉; a que o Esc parou segue ✕ até o start nela (turnos.parada-segue-interrompida-ate-o-start), e com esse start nada fica ✕; a que o fim normal deixou ◷ segue ◷ até o start nela (turnos.aguardando-segue-ate-o-start)

Origem: commit 55a2dd1, 2026-10-23.
Reescrito: 2026-11-12, decisão do usuário ("Segue ✕ até novo start (Recomendado)"); desfaz "nada fica ✕" para a tarefa parada com Esc em que o modelo ainda não deu start: antes, o prompt seguinte a reacendia sozinho.
Reescrito: 2026-11-14, decisão do usuário ("Seguir ◷ até o start (Recomendado)"); antes, o prompt seguinte reacendia sozinho a tarefa que o fim normal deixara ◷. O teste não muda.
Estado: coberto

### turnos.parada-segue-interrompida-ate-o-start
A tarefa parada com Esc segue interrompida até o modelo dar start nela.

- Dado uma tarefa iniciada e aberta quando a pessoa para o turno (Esc), ✕ desde então
- Quando chega um prompt que não abre pedido (aviso do app, hand-back de subagente, notificação de tarefa em segundo plano) e o turno dele termina, ou uma mensagem da pessoa em que o modelo dá start em outra tarefa
- Então a parada segue ✕ e fora da contagem (no cabeçalho e na sessão inteira); não acende, o relógio dela não corre e o fim desses turnos não a deixa ◷; o pai e o pedido seguem como o Esc os deixou; só o start nela a reacende ◉ (ela volta a contar e, no fim do turno, aguarda como qualquer outra), e o done a conclui; o replano no mesmo pedido que a mantém a mantém ✕; o start num pai inicia a primeira subtarefa aberta dele (arvore.start-no-pai-inicia-a-primeira-subtarefa): parada com Esc, ela segue ✕ como qualquer outra, e o start de novo no pai a retoma; a marca da parada vai no painel publicado até esse start; a tarefa com carta na fila segue ◷ enquanto a carta espera (envios.fila-nao-interrompe-no-fim-do-turno)

Origem: decisão do usuário, 2026-11-12 ("Segue ✕ até novo start (Recomendado)"), sobre o achado da auditoria de 2026-11-10 (depois do Esc, um aviso automático ou o start em outra tarefa reacendia a parada: ◉ no prompt, relógio correndo, ◷ no fim do turno).
Código: state/tasks.ts
Reescrito: 2026-11-14, decisão do usuário ("Inicia a 1ª subtarefa (Recomendado)"); desfaz "o pai iniciado diretamente": o start num pai passa a iniciar a primeira subtarefa aberta, que o Esc deixa ✕.
Estado: coberto

### turnos.pedido-anterior-parado-aguarda
Um pedido anterior parado aguarda enquanto o novo está em andamento.

- Dado um pedido anterior com algo feito e algo aberto
- Quando um pedido novo está em andamento
- Então o anterior e o seu plano ficam ◷ e o novo ◉

Origem: decisão do usuário, 2026-10-27, sobre a regra de 2026-10-20; commit a201198.
Estado: coberto

### turnos.continuacao-sem-start-aguarda
Um prompt que continua o plano, antes do start, deixa o pai aguardando.

- Dado um turno terminado com algo feito no plano
- Quando chega uma mensagem que continua o plano e ainda não houve start
- Então o pai e o pedido ficam ◷ até o start

Origem: decisão do usuário, 2026-10-27; commit a201198.
Estado: coberto

### turnos.pai-com-filha-concluida-nunca-interrompido
Pai com filha concluída nunca fica interrompido.

- Dado um pai com uma filha ✓
- Quando o resto embaixo fica ✕ (Esc ou subagente que termina)
- Então o pai fica ✓, nunca ✕; ◷ só enquanto algo embaixo segue aberto

Origem: decisão do usuário ("se existem tarefas concluidas como filhas, o pai nunca pode ficar como interrompido"); commit 95b1a21.
Reescrito: 2026-11-04, decisão do usuário ("todos os subitens estão concluidos ou interrompidos, mas a tarefa pai está como em andamento, ela deveria estar concluida tambem"; pai com só ✕ embaixo: "Fica ✓").
Estado: coberto

### turnos.subagente-que-termina-interrompe
O subagente que termina deixa interrompido o que ficou aberto.

- Dado um subagente com tarefas abertas no grupo dele
- Quando ele termina
- Então o que ele deixou aberto fica ✕, e o grupo segue desenhado, mesmo lançado sem tarefa de origem

Origem: regra do painel desde a entrada do mod, 2026-10-20 (465b09e).
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)"); sem visão completa, o grupo sem origem sumia.
Código: hooks/tools.ts
Estado: coberto

### turnos.prompt-sem-turno
O hand-back de subagente não abre pedido.

- Dado um hand-back de subagente (<agent-message> com "[Subagent hand-back]")
- Quando o prompt chega
- Então não abre pedido, e o plano seguinte entra no pedido atual

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Estado: coberto

### turnos.notificacao-de-tarefa-sem-turno
A notificação de tarefa em segundo plano não abre pedido.

- Dado uma notificação de tarefa em segundo plano (origem task-notification)
- Quando o prompt chega
- Então não abre pedido, e o plano seguinte entra no pedido atual

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Estado: coberto

### turnos.resumo-sem-resposta-final
O resumo do done vira a linha ↩ mesmo sem texto final no turno.

- Dado um done com summary
- Quando o turno termina sem texto final e sem wrap_up (o modelo para logo depois de uma ferramenta)
- Então a linha ↩ mostra o resumo, e ele vai ao arquivo publicado

Origem: regra do painel ("a linha ↩ só existe com resumo"; o summary "é a linha ↩", text/rules.ts; commit 3f06a32, 2026-10-21); bug achado na análise de 2026-10-29.
Estado: coberto

### turnos.resumo-sem-seta-duplicada
O ↩ que o resumo já traz não se repete.

- Dado um done com summary que começa com "↩"
- Quando o turno termina
- Então a linha da resposta mostra um ↩ só, antes do resumo

Origem: achado da sessão orquestradora no app, 2026-11-09 (a linha aparecia "↩ ↩").
Código: hooks/tools.ts
Estado: coberto

### turnos.resumo-de-turno-parado-nao-passa-adiante
O resumo de um turno parado com Esc não passa ao pedido seguinte.

- Dado um done com summary (ou um wrap_up com recap) num turno que a pessoa para com Esc antes do fim
- Quando o pedido seguinte termina, com ou sem resumo próprio
- Então a linha ↩ do pedido seguinte mostra só o resumo dele (nenhuma, sem resumo), o done final sem summary avisa a falta, e o resumo antigo não vai ao arquivo publicado

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: o resumo e o recap só eram zerados no fim normal); aplica turnos.resumo-sem-resposta-final ("o summary é a linha ↩" do turno dele), sem mudar nenhuma regra.
Código: hooks/tools.ts, hooks/tool-call.ts
Estado: coberto

### turnos.aguardando-segue-ate-o-start
A tarefa que o fim normal do turno deixou aguardando segue aguardando até o modelo dar start nela.

- Dado uma tarefa iniciada e aberta quando o turno termina normalmente, ◷ desde então
- Quando chega a mensagem seguinte, ou um prompt que não abre pedido (aviso do app, hand-back, notificação), ou o modelo dá start em outra tarefa, ou a pessoa para com Esc um turno em que ela não recebeu start
- Então ela segue ◷, com o tempo parado no fim do turno, o pai e o pedido como estavam, no chip "aguardando" e fora do "em andamento"; só o start nela a reacende ◉, e o done a conclui sem aviso de falta de start; com uma sessão filha trabalhando sob ela, segue ◉ enquanto a filha trabalha (sessoes.filha-trabalhando-mantem-pais-em-andamento); o estado vai no painel publicado, e o cartão desta sessão na mãe mostra o mesmo

Origem: decisão do usuário, 2026-11-14 ("Seguir ◷ até o start (Recomendado)"), sobre o achado da auditoria de 2026-11-10 (a tarefa ◷ voltava a ◉ em qualquer prompt, com o relógio contando o tempo parado). Estende a decisão de 2026-11-12 do Esc ("Segue ✕ até novo start (Recomendado)") ao fim normal.
Código: state/tasks.ts, hooks/tools.ts, text/rules.ts
Estado: coberto

### turnos.pedido-sem-tarefa-tem-o-seu-resumo
O pedido respondido sem tarefa mostra o resumo dele numa linha própria, e não troca o do pedido anterior.

- Dado um pedido anterior encerrado, com o seu ↩, e uma mensagem nova que o modelo responde sem planejar tarefa
- Quando o turno termina, com resumo (o summary do done) ou sem
- Então, com resumo, aparece a linha do pedido novo (o começo da mensagem, ✓, sem contagem nem tempo) com a linha ↩ embaixo, na ordem dos pedidos; sem resumo, nada aparece; o ↩ e a resposta do pedido anterior não mudam; quando a mensagem continua o plano anterior (start, done ou plan numa tarefa dele no turno), o resumo vai para esse pedido; o pedido só com resumo sai de vista com os anteriores ("+N pedidos anteriores") e não conta no cabeçalho; no cartão desta sessão na mãe, cada ↩ segue no seu lugar

Origem: decisão do usuário, 2026-11-14 ("Pedido próprio (Recomendado)"), sobre o achado da auditoria de 2026-11-10 (a resposta de um turno sem plano era gravada no último pedido com tarefas).
Estado: coberto

### turnos.turno-que-falha-deixa-falhou
O turno que morre por erro deixa a tarefa em andamento ✕ "falhou", até o start nela.

- Dado uma tarefa iniciada e aberta
- Quando o turno da sessão termina por erro de API, limite de contexto ou recusa (não por Esc)
- Então ela fica ✕ com a palavra "falhou", fora da contagem, como a parada com Esc: segue assim nos turnos seguintes até o start nela (que tira a palavra) ou o done (que a conclui); as pendentes seguem ○; a mensagem seguinte pede o replano (lembretes.replanejar-apos-turno-que-falhou); o cartão desta sessão na mãe diz "falhou" (sessoes.palavra-de-estado-do-cartao)

Origem: decisão do usuário, 2026-11-14 ("✕ \"falhou\" (Recomendado)"), sobre o achado da auditoria de 2026-11-10 (o turno que morria por erro era tratado como fim normal, ◷). Aplica ao erro a decisão de 2026-11-12 do Esc ("Segue ✕ até novo start (Recomendado)").
Código: state/tasks.ts, state/durability.ts, text/rules.ts
Estado: coberto

### turnos.esc-com-trabalho-delegado-vivo
O Esc não interrompe a tarefa que tem trabalho delegado vivo embaixo.

- Dado uma tarefa iniciada com uma sessão filha trabalhando sob ela (a rodada atual da filha) ou um subagente ainda rodando lançado dela
- Quando a pessoa para o turno (Esc)
- Então ela segue ◉ enquanto a filha trabalha, com o tempo correndo, e ◷ enquanto o subagente roda, como a tarefa com carta na fila (envios.fila-nao-interrompe-no-fim-do-turno); quando a filha para, a tarefa fica ✕ até o start nela (turnos.parada-segue-interrompida-ate-o-start); quando o subagente termina, ela fecha como no fim normal; o mesmo dentro do cartão de uma filha; sem trabalho delegado vivo, o Esc a interrompe (turnos.esc-interrompe-so-a-iniciada)

Origem: decisão do usuário, 2026-11-14 ("Segue ◉/◷ (Recomendado)": "o Esc para a principal, não o trabalho delegado"). Reescreve, para a tarefa com trabalho delegado vivo, a decisão de 2026-10-28 e 2026-10-30 ("a tarefa iniciada fica ✕ no Esc, como qualquer outra").
Código: hooks/render.tsx, hooks/agents.ts
Estado: coberto
