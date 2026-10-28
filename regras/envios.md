# Envios

As mensagens a outras sessões (✉).

### envios.fica-ate-entrega
O ✉ fica na tarefa até a entrega.

- Dado uma tarefa de onde saiu uma mensagem a outra sessão, ainda na fila
- Quando a tarefa é concluída antes da entrega
- Então o ✉ segue nela, no lugar do ✓, até a outra sessão receber

Origem: decisão do usuário, 2026-10-23 ("não mostre como interrompida, deixe como mensagem até ela ser entregue"); commit 109b92d.
Estado: coberto

### envios.entrega-imediata-aparece-como
Como aparece a mensagem entregue na hora.

- Dado uma mensagem que o app entrega na hora (a outra sessão "começou a tratar")
- Quando o painel é desenhado antes de a outra sessão publicar que a recebeu
- Então o ✉ aparece conforme a decisão do usuário: verde "entregue" ou azul "na fila" até a recepção

Origem: dúvida em aberto com o usuário, 2026-10-28.
Estado: pendente (envios: aguardando decisão do usuário)

### envios.cor-por-estado
O ✉ mantém o ícone e muda só a cor.

- Dado uma tarefa de mensagem
- Quando a mensagem está na fila, é entregue ou fica num plano interrompido
- Então o ✉ fica azul "na fila", verde "entregue" ou cinza "interrompida", sem trocar de ícone

Origem: decisão do usuário, 2026-10-24 ("mantenha o ícone e troque somente a cor"); commit 8eb801c.
Estado: coberto

### envios.ancora-no-lote-recente
O envio vai ao lote recente de starts sem envio.

- Dado várias tarefas em andamento, umas iniciadas agora e outras antes, e talvez uma com pergunta aberta
- Quando sai uma mensagem
- Então ela vai à primeira do lote recente ainda sem envio; à tarefa antiga só depois; nunca à que tem pergunta aberta

Origem: decisão do usuário, 2026-10-24; commit 26adf08.
Estado: coberto

### envios.sem-andamento-vai-a-pendente-planejada-por-ultimo
Sem nada em andamento, o envio vai à pendente planejada por último.

- Dado nada em andamento no pedido atual
- Quando sai uma mensagem
- Então ela vai à pendente planejada por último; sem pendente, à última iniciada

Origem: decisão do usuário, 2026-10-23 ("Várias pendentes: a última planejada. Nenhuma pendente: última iniciada"); commits b742294 e 5f3df6e.
Estado: coberto

### envios.fila-nao-interrompe-no-fim-do-turno
O envio na fila não vira interrompido no fim do turno.

- Dado uma mensagem na fila
- Quando o turno termina, normal ou com Esc
- Então a tarefa segue com o ✉ azul, não ✕

Origem: decisão do usuário, 2026-10-24; commit b897cac.
Estado: coberto

### envios.nivel1-recebido-mostra-carta
O nível 1 aberto por mensagem recebida mostra a carta.

- Dado uma mensagem de outra sessão que abre um pedido
- Quando o modelo planeja o nível 1 dele e depois o conclui
- Então o nível 1 mostra o ✉ de recebida, azul enquanto aberto e verde concluído

Origem: decisão do usuário, 2026-10-24 ("o ícone do 'analisar a tarefa' deveria ser uma carta também"); commit 83f715d.
Estado: coberto
