# Subagentes

O cartão de cada subagente, da raiz ou de dentro de uma sessão filha.

Código da área: hooks/agents.ts, draw/layout.ts

### subagentes.cartao-desde-o-lancamento
Lançado um subagente, o cartão dele aparece, mesmo sem ele usar o painel.

- Dado uma tarefa em andamento
- Quando o modelo lança um subagente
- Então o cartão aparece embaixo dessa tarefa, com "tipo: descrição"

Origem: decisão do usuário, 2026-11-09 ("Quero uma nova funcionalidade, parecida com o card de sessão filha, mas par sub agentes. Quero que seja criado um card que mostre a execução de um sub agente na raiz, ou dentro de uma sessão filha."; "Cartão + grupo (Recomendado)").
Reescrito: 2026-11-09, decisão do usuário ("Vai à pendente (Recomendado)"): a tarefa do cartão segue a regra da carta; com várias em andamento, a primeira do lote ainda sem carta nem cartão, na ordem dos starts; sem nada em andamento, a pendente do pedido atual; um lançamento conta como uso da tarefa para a carta seguinte.
Estado: coberto

### subagentes.cartao-mostra-modelo-e-estado
O cartão traz o modelo, o esforço e a palavra de estado.

- Dado um subagente lançado
- Quando ele roda, termina, falha ou é interrompido
- Então o cartão diz o modelo e o esforço e "trabalhando", "em segundo plano", "concluído", "falhou" ou "interrompido"

Origem: decisão do usuário, 2026-11-09 ("Cartão + grupo (Recomendado)").
Estado: coberto

### subagentes.corpo-e-as-tarefas-ou-a-ferramenta
Com tarefas, o cartão mostra as tarefas dele; sem tarefas, a ferramenta em uso.

- Dado um subagente rodando
- Quando ele chama ferramentas sem usar o painel
- Então uma linha do cartão diz a ferramenta atual e quantas chamadas fez; com plan, as tarefas dele, como hoje

Origem: decisão do usuário, 2026-11-09 ("Cartão + grupo (Recomendado)").
Código: hooks/tool-call.ts
Estado: coberto

### subagentes.terminado-segue-cartao
Terminado, o cartão segue como cartão, com a palavra de estado.

- Dado um subagente rodando
- Quando ele termina
- Então o cartão fica, com "concluído" (ou "falhou", "interrompido"), sem linha de resultado; o ícone de dobrar segue como nos outros cartões

Origem: decisão do usuário, 2026-11-09: "Fecha ao terminar" não foi escolhido (opção não escolhida = não fazer).
Código: hooks/turn.ts
Estado: coberto

### subagentes.varios-juntos-num-cartao-de-grupo
Workflow, ou mais de três subagentes lançados juntos, ficam num cartão de grupo.

- Dado vários subagentes lançados da mesma tarefa
- Quando são mais de três lançados juntos, ou do mesmo workflow
- Então um cartão só, "N subagentes" (ou "Workflow · N agentes"), com uma linha por agente

Origem: decisão do usuário, 2026-11-09 ("Cartão + grupo (Recomendado)").
Estado: coberto

### subagentes.fora-da-contagem
O subagente não entra no "d de n" e ganha a pílula "N subagentes".

- Dado subagentes rodando sem usar o painel
- Quando o cabeçalho é desenhado
- Então o "d de n" não muda, e a pílula diz quantos subagentes estão rodando

Origem: decisão do usuário, 2026-11-09 ("Fora da contagem").
Código: draw/svg.ts, hooks/render.tsx
Estado: coberto

### subagentes.na-filha
O subagente de uma sessão filha aparece no cartão dela.

- Dado uma filha que lançou um subagente
- Quando a sessão que a abriu desenha o cartão dela
- Então o cartão do subagente aparece dentro do cartão da filha

Origem: decisão do usuário, 2026-11-09 ("na raiz, ou dentro de uma sessão filha").
Código: io/publish.ts
Estado: coberto

### subagentes.cartao-no-app
O cartão no app: cores nos dois temas, modelo e ferramenta de um subagente real.

- Dado um subagente real lançado na raiz e outro numa filha real
- Quando o painel é desenhado no app
- Então o cartão aparece com a moldura, o estado e a ferramenta, nos dois temas

Origem: decisão do usuário, 2026-11-09 ("Cartão + grupo (Recomendado)").
Estado: checklist (subagente real no app)

### subagentes.pai-conclui-no-fim-do-turno
A tarefa de onde saíram subagentes, todos concluídos, fica ✓ quando nada mais está em execução.

- Dado uma tarefa sem subtarefas, iniciada ou pendente, com um ou mais subagentes lançados dela, todos "concluído", e nada mais em execução nela (nenhum subagente rodando, nenhuma sessão filha viva, nenhuma carta na fila, nenhuma pergunta aberta)
- Quando o turno termina (ou o último subagente em segundo plano termina depois do turno)
- Então a tarefa fica ✓ sozinha, com o tempo parado no fim do último subagente; o pai e o pedido seguem a regra de sempre; o x/y conta a tarefa; o cartão segue "concluído" e fora da contagem; um `done` do modelo depois disso só acrescenta o resumo

Origem: decisão do usuário, 2026-11-09 ("falta só corrigir as tarefas pai, quando um agente é concluido com sucesso, o pai sempre deve refletir seu status, não ficar pendente se não tiver nada em execucao"; "Fecha de fato (Recomendado)"; para a pendente sem start: "Fecha também").
Código: hooks/turn.ts
Estado: coberto

### subagentes.pai-reflete-falha-ou-interrupcao
A tarefa de onde saiu um subagente que falhou ou foi interrompido reflete esse fim.

- Dado uma tarefa cujos subagentes terminaram, algum deles "falhou" ou "interrompido", e nada mais em execução nela
- Quando o turno termina
- Então a tarefa fica ✕, com "falhou" se um falhou, senão "interrompida"; com fins mistos vale o pior (falhou, depois interrompido, depois concluído), derivado das respostas acima

Origem: decisão do usuário, 2026-11-09 ("falta só corrigir as tarefas pai, quando um agente é concluido com sucesso, o pai sempre deve refletir seu status, não ficar pendente se não tiver nada em execucao"; "interrompido se é interrompido, falha se ele falhou").
Código: draw/layout.ts
Estado: coberto

### subagentes.um-rodando-mantem-o-pai
Com um subagente ainda rodando, a tarefa de onde saiu não fecha.

- Dado uma tarefa com um subagente concluído e outro rodando, ou com uma carta na fila
- Quando o turno termina
- Então a tarefa não fecha e o x/y não muda até o último terminar (e a carta ser entregue)

Origem: decisão do usuário, 2026-11-09 ("falta só corrigir as tarefas pai, quando um agente é concluido com sucesso, o pai sempre deve refletir seu status, não ficar pendente se não tiver nada em execucao").
Estado: coberto

### subagentes.id-reusado-nao-herda-cartao
Um plano que reusa o id de uma tarefa com subagente não herda o cartão dele.

- Dado uma tarefa de onde saiu um subagente (o cartão sob ela), fechada, ou aberta de um pedido anterior
- Quando um plan com o mesmo id a renomeia (pedido novo, nível 1 concluído, ou o replano de um subagente sobre as tarefas dele)
- Então o cartão fica com a cópia antiga, como o da sessão e a carta; não aparece sob a tarefa nova, que no fim do turno segue como o turno a deixou, sem fechar pelo subagente antigo

Origem: auditoria 2026-11-10 (plano que reusa um id não renomeia a âncora dos grupos de subagente); aplica subagentes.cartao-desde-o-lancamento ("o cartão aparece embaixo dessa tarefa") e pedidos.plano-anterior-vira-historico, como a renomeação já fazia com sessões, cartas e lançamentos, sem mudar subagentes.pai-conclui-no-fim-do-turno.
Código: hooks/tools.ts, hooks/panel.ts
Estado: coberto

### subagentes.cartao-fica-com-a-origem-fechada
Fechada a tarefa de onde saiu o subagente, o cartão dele segue embaixo dela.

- Dado uma tarefa de onde saiu um subagente, à vista no trabalho atual
- Quando ela fecha: sozinha no fim do turno, pelo `done` do modelo (com o subagente concluído ou ainda em segundo plano), ou já fechada quando o lançamento vai a ela
- Então o cartão segue sob a tarefa ✓, com a palavra de estado dele ("concluído", "em segundo plano"…) e fora da contagem; rodando, segue na pílula "N subagentes"; sai junto com o pedido da tarefa, quando ele sai do trabalho ("+N pedidos anteriores"), como o cartão da sessão e a carta

Fora deste cenário: o subagente vivo sob um pedido que já saiu do trabalho segue sem ser desenhado solto no fim (depende de o cartão vivo terminar quando o fim do subagente não chega).

Origem: auditoria 2026-11-10 (o cartão do subagente some quando a tarefa de origem fecha); aplica subagentes.terminado-segue-cartao ("Fecha ao terminar" não foi escolhido: o cartão fica), subagentes.pai-conclui-no-fim-do-turno ("o cartão segue 'concluído' e fora da contagem", "Fecha de fato (Recomendado)", "Fecha também"), subagentes.cartao-desde-o-lancamento e subagentes.fora-da-contagem, sem mudar nenhuma delas.
Código: draw/layout.ts
Estado: coberto
