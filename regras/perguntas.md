# Perguntas

As esperas de pergunta, plano e escolha.

### perguntas.sem-tarefa-recusada
A pergunta sem tarefa aberta é recusada.

- Dado nenhuma tarefa aberta
- Quando o modelo chama AskUserQuestion
- Então a chamada é recusada e o painel não mostra espera

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Estado: coberto

### perguntas.espera-sob-a-tarefa
A pergunta aberta aparece sob a tarefa, que segue em andamento.

- Dado uma tarefa ◉
- Quando a pergunta está aberta
- Então aparece ◷ "Aguardando sua resposta" logo abaixo dela, e ela segue ◉

Origem: decisão do usuário, 2026-10-26; commit 309f9be.
Estado: coberto

### perguntas.resposta-por-opcao-tira-espera
A resposta por opção tira a espera.

- Dado uma pergunta aberta sob uma tarefa ◉
- Quando a pessoa escolhe uma opção
- Então a espera some e a tarefa segue ◉

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Estado: coberto

### perguntas.resposta-pelo-chat-tira-espera
A resposta pelo chat tira a espera na hora.

- Dado uma pergunta aberta sob uma tarefa ◉
- Quando a pessoa responde pelo chat, sem escolher opção
- Então a espera some na hora, antes da mensagem dela chegar, e a tarefa segue ◉

Origem: decisão do usuário, 2026-10-27; commit cf5ea53.
Estado: coberto

### perguntas.exitplanmode-espera
O ExitPlanMode mostra a espera da aprovação do plano.

- Dado uma tarefa aberta
- Quando ExitPlanMode está aberto
- Então aparece "Aguardando aprovação do plano" até a resposta

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Estado: coberto

### perguntas.escolha-do-wrapup-ate-proxima-mensagem
A escolha do wrap_up fica até a próxima mensagem.

- Dado um wrap_up com pergunta (ask)
- Quando o turno termina
- Então "Aguardando sua escolha" fica até a próxima mensagem da pessoa

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Estado: coberto

### perguntas.permissao-espera
O pedido de permissão aparece como espera.

- Dado uma ferramenta que pede permissão (exceto pergunta e plano)
- Quando o app pede a permissão
- Então aparece "Aguardando permissão: <ferramenta>"

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20); o hook passou para hooks/permission.ts no commit c442523, 2026-10-22 ("hooks em arquivos próprios").
Estado: pendente (perguntas)
