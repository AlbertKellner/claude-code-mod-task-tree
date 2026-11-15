# Perguntas

As esperas de pergunta, plano e escolha.

Código da área: hooks/tool-call.ts, hooks/panel.ts, draw/layout.ts, hooks/prompt-submit.ts, hooks/turn.ts

### perguntas.sem-tarefa-recusada
A pergunta sem tarefa aberta do pedido atual, nem tarefa em andamento, é recusada.

- Dado nenhuma tarefa aberta do pedido atual e nenhuma tarefa em andamento (uma tarefa só pendente de um pedido anterior não conta; uma dele reaberta com start conta)
- Quando o modelo chama AskUserQuestion
- Então a chamada é recusada, com o pedido de planejar ou dar start antes, e o painel não mostra espera; o ExitPlanMode e a escolha do wrap_up não são recusados

Origem: regra do painel desde a entrada do mod (85744cb, 2026-10-20).
Código: text/rules.ts
Reescrito: 2026-11-15, decisão do usuário de 2026-11-14 ("Não (Recomendado)"): um passo ○ de um pedido anterior não libera a pergunta de um pedido novo.
Estado: coberto

### perguntas.espera-sob-a-tarefa
A pergunta aberta aparece sob a tarefa, que segue em andamento.

- Dado uma tarefa ◉
- Quando a pergunta está aberta
- Então aparece ◷ "Aguardando sua resposta" logo abaixo dela, e ela segue ◉

Origem: decisão do usuário, 2026-10-26; commit ebc0f19.
Estado: coberto

### perguntas.espera-sob-a-pendente
Sem tarefa em andamento, a espera fica sob a tarefa do pedido, não solta no fim.

- Dado tarefas abertas e nenhuma em andamento
- Quando o modelo pergunta (AskUserQuestion), pede a aprovação de um plano (ExitPlanMode) ou termina o turno com a escolha do wrap_up
- Então o aviso de espera aparece sob a tarefa pendente do pedido atual, a mesma que uma carta escolheria; sem pendente, sob a última tarefa iniciada do pedido; a tarefa segue ○ (ou ✓), sem acender nem mudar a contagem; com uma tarefa em andamento, o aviso fica sob ela

Origem: decisão do usuário, 2026-11-14 ("Pendurar na pendente (Recomendado)"); mantém perguntas.espera-sob-a-tarefa.
Código: hooks/panel.ts
Estado: coberto

### perguntas.resposta-por-opcao-tira-espera
A resposta por opção tira a espera.

- Dado uma pergunta aberta sob uma tarefa ◉
- Quando a pessoa escolhe uma opção
- Então a espera some e a tarefa segue ◉

Origem: regra do painel desde a entrada do mod (85744cb, 2026-10-20).
Estado: coberto

### perguntas.resposta-pelo-chat-tira-espera
A resposta pelo chat tira a espera na hora.

- Dado uma pergunta aberta sob uma tarefa ◉
- Quando a pessoa responde pelo chat, sem escolher opção
- Então a espera some na hora, antes da mensagem dela chegar, e a tarefa segue ◉

Origem: decisão do usuário, 2026-10-27; commit e5f5f2d.
Estado: coberto

### perguntas.exitplanmode-espera
O ExitPlanMode mostra a espera da aprovação do plano.

- Dado uma tarefa aberta
- Quando ExitPlanMode está aberto
- Então aparece "Aguardando aprovação do plano" até a resposta

Origem: regra do painel desde a entrada do mod (85744cb, 2026-10-20).
Estado: coberto

### perguntas.mensagem-no-meio-do-turno-mantem-espera
A mensagem que chega com o turno em curso não tira a espera da pergunta ou do plano que segue aberto.

- Dado uma pergunta (AskUserQuestion) ou uma aprovação de plano (ExitPlanMode) aberta sob uma tarefa ◉
- Quando chega, com o turno em curso, uma mensagem de outra sessão ou uma que a pessoa digitou por cima do turno
- Então a espera segue até a resposta, e a tarefa segue ◉; a escolha do wrap_up e a permissão seguem como antes

Origem: auditoria 2026-11-10 (mensagem entregue no meio do turno derrubava a pergunta aberta); aplica perguntas.espera-sob-a-tarefa e perguntas.exitplanmode-espera ("até a resposta"), sem mudar quando a mensagem abre o seu pedido (pedidos.uma-mensagem-um-pedido).
Código: hooks/prompt-submit.ts
Estado: coberto

### perguntas.escolha-do-wrapup-ate-proxima-mensagem
A escolha do wrap_up fica até a próxima mensagem.

- Dado um wrap_up com pergunta (ask)
- Quando o turno termina
- Então "Aguardando sua escolha" fica até a próxima mensagem da pessoa

Origem: regra do painel desde a entrada do mod (85744cb, 2026-10-20); confirmada pelo usuário em 2026-11-14 ("Toda pergunta espera"): a pergunta opcional, que não bloqueia o trabalho, também fica como espera.
Estado: coberto

### perguntas.permissao-espera
O pedido de permissão aparece como espera.

- Dado uma ferramenta que pede permissão (exceto pergunta e plano)
- Quando o app pede a permissão
- Então aparece "Aguardando permissão: <ferramenta>"

Origem: regra do painel desde a entrada do mod (85744cb, 2026-10-20); o hook passou para hooks/permission.ts no commit 013f2b1, 2026-10-22 ("hooks em arquivos próprios").
Código: hooks/permission.ts
Estado: coberto

### perguntas.permissao-sai-com-a-ultima-chamada
O aviso de permissão fica enquanto houver chamada daquela ferramenta em curso, e não sobrevive ao turno.

- Dado "Aguardando permissão: <ferramenta>" no painel
- Quando termina uma chamada dessa ferramenta com outra do mesmo agente ainda em curso; quando termina a última; quando o turno do loop principal termina com o aviso ainda lá
- Então o aviso fica no primeiro caso e some nos outros dois; a mensagem seguinte não o tira (o diálogo pode estar aberto com o turno em curso)

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: o fim de qualquer chamada da mesma ferramenta tirava o aviso, e um aviso órfão durava até a chamada seguinte); completa perguntas.permissao-espera, que só cobre o aviso aparecer.
Código: hooks/turn.ts, hooks/permission.ts
Estado: coberto

### perguntas.wrapup-que-falha-nao-espera
O wrap_up com pergunta que falha não vira espera.

- Dado um wrap_up com pergunta (ask)
- Quando a chamada falha
- Então o painel não mostra "Aguardando sua escolha", e a espera que já havia fica como estava

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: a espera era criada antes de a chamada dar certo); aplica perguntas.escolha-do-wrapup-ate-proxima-mensagem, sem mudá-la.
Estado: coberto

### perguntas.falha-de-um-passo-nao-pula-a-recusa
A falha de um passo acessório do painel não deixa passar a pergunta sem tarefa.

- Dado nenhuma tarefa aberta do pedido atual e nenhuma em andamento
- Quando o modelo chama AskUserQuestion e um passo acessório do painel falha antes da pergunta
- Então a chamada é recusada como em perguntas.sem-tarefa-recusada

Origem: auditoria 2026-11-10; aplica perguntas.sem-tarefa-recusada, sem mudar nenhuma regra.
Código: hooks/tool-call.ts
Estado: coberto
