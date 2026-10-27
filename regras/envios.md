# Envios

As mensagens a outras sessões (✉).

### envios.fica-ate-entrega
O ✉ fica na tarefa até a entrega.

- Dado uma tarefa de onde saiu uma mensagem a outra sessão
- Quando a tarefa é concluída antes da entrega
- Então o ✉ segue nela até a outra sessão receber

Origem: decisão do usuário, 2026-10-23; commit 109b92d.
Estado: pendente (envios)

### envios.cor-por-estado
O ✉ mantém o ícone e muda só a cor.

- Dado uma tarefa de mensagem
- Quando a mensagem está na fila, é entregue ou é interrompida
- Então o ✉ fica azul, verde ou cinza, sem trocar de ícone

Origem: decisão do usuário ("mantenha o ícone e troque somente a cor"), 2026-10-24; commit 8eb801c.
Estado: pendente (envios)

### envios.ancora-no-lote-recente
O envio vai ao lote recente de starts sem envio.

- Dado vários starts recentes sem envio e tarefas antigas
- Quando sai uma mensagem
- Então ela vai ao lote recente; à tarefa antiga só depois; nunca à que tem pergunta aberta

Origem: commit 26adf08, 2026-10-24.
Estado: pendente (envios)

### envios.sem-tarefa-em-andamento-ancora-na-ultima-iniciada
Sem tarefa em andamento, o envio vai à última iniciada.

- Dado nenhuma tarefa em andamento
- Quando sai uma mensagem
- Então ela fica na última tarefa iniciada

Origem: decisão do usuário, 2026-10-23; commit b742294.
Estado: pendente (envios)

### envios.fila-nao-interrompe-no-fim-do-turno
O envio na fila não vira interrompido no fim do turno.

- Dado uma mensagem na fila
- Quando o turno termina
- Então a tarefa segue com ✉, não ✕

Origem: commit b897cac, 2026-10-24.
Estado: pendente (envios)

### envios.mensagens-juntas-vao-a-ultima
Mensagens entregues juntas: o cartão vai à tarefa da última.

- Dado várias mensagens à mesma sessão entregues juntas
- Quando o turno dela começa
- Então o cartão do turno fica na tarefa da última mensagem

Origem: commit 8b67366, 2026-10-23.
Estado: pendente (envios)

### envios.nivel1-recebido-mostra-carta
O nível 1 aberto por mensagem recebida mostra a carta.

- Dado uma mensagem de outra sessão que abre um pedido
- Quando o modelo planeja o nível 1 dele
- Então o nível 1 mostra o ✉ de recebida, na cor do estado

Origem: decisão do usuário ("o ícone do 'analisar a tarefa' deveria ser uma carta também"), 2026-10-24; commit 83f715d.
Estado: pendente (envios)
