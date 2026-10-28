# Turnos

O fim do turno, normal ou com Esc, e a mensagem seguinte.

### turnos.iniciada-aguarda-no-fim
A tarefa iniciada e aberta aguarda no fim do turno.

- Dado uma tarefa iniciada e aberta
- Quando o turno termina normalmente
- Então ela fica ◷ com o relógio parado, e o pai e o pedido ◷

Origem: decisão do usuário, 2026-10-27; commit 95b1a21.
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
- Então só a iniciada fica ✕; as pendentes seguem ○; o pai sem nada feito embaixo fica ○

Origem: decisão do usuário, 2026-10-27; commit d57807e.
Estado: coberto

### turnos.prompt-seguinte-retoma
A mensagem seguinte retoma o trabalho.

- Dado um turno terminado, normal ou com Esc
- Quando chega a mensagem seguinte e o modelo chama start
- Então nada fica ✕ e a tarefa iniciada acende ◉

Origem: commit 55a2dd1, 2026-10-23.
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
- Então o pai fica ◷, nunca ✕

Origem: decisão do usuário ("se existem tarefas concluidas como filhas, o pai nunca pode ficar como interrompido"); commit 95b1a21.
Estado: coberto

### turnos.subagente-que-termina-interrompe
O subagente que termina deixa interrompido o que ficou aberto.

- Dado um subagente com tarefas abertas no grupo dele
- Quando ele termina
- Então o que ele deixou aberto fica ✕

Origem: regra do painel desde a entrada do mod, 2026-10-20 (465b09e).
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
