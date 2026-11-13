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

### subagentes.reaberta-nao-fecha-pelo-subagente-antigo
Reaberta com start, a tarefa não fecha de novo pelos subagentes que terminaram antes.

- Dado uma tarefa fechada (✓ sozinha pelo fim dos subagentes, ✕ "falhou", ou pelo `done` do modelo) com subagentes já terminados embaixo
- Quando o modelo a reabre com start (e a replaneja no mesmo pedido ou não) e o turno termina, normal ou com Esc
- Então os subagentes que terminaram antes do start não contam: sem subagente novo, ela fica ◷ como toda iniciada no fim do turno (com Esc, ✕ "interrompida", sem o "falhou" de antes); com um subagente que termina depois do start, reflete o fim dele, como sempre; os cartões antigos seguem embaixo dela

Também: a tarefa (pendente ou iniciada) cujo subagente terminou antes do primeiro start dela não foi reaberta e segue fechando no fim do turno ("Fecha também").

Fora deste cenário: um subagente que falha e outro que conclui, na mesma abertura da tarefa (segue valendo o pior); o fim de um subagente depois do Esc.

Origem: auditoria 2026-11-10 (o fechamento automático olha subagentes de turnos anteriores); aplica turnos.iniciada-aguarda-no-fim ("salvo a tarefa cujo trabalho era só subagentes") e subagentes.pai-conclui-no-fim-do-turno ("Fecha de fato (Recomendado)", "Fecha também") ao fim que já foi refletido, sem mudar nenhuma delas nem subagentes.pai-reflete-falha-ou-interrupcao.
Código: state/tasks.ts
Estado: coberto

### subagentes.lancado-antes-da-tarefa-nao-conta
Um subagente lançado antes de a tarefa ser planejada não a fecha.

- Dado um painel gravado por uma versão anterior, em que o cartão de um subagente do pedido anterior ficou com o id que um plano novo reusou (antes de a âncora ser renomeada com a tarefa)
- Quando o turno termina com a tarefa nova aberta
- Então ela segue como o turno a deixou, sem fechar pelo subagente lançado antes de ela ser planejada

Fora deste cenário: nesse painel antigo, o cartão segue desenhado sob a tarefa nova.

Origem: auditoria 2026-11-10 (o fechamento automático olha subagentes de turnos anteriores; a defesa por tempo para os dados já gravados, proposta com a correção da âncora); aplica subagentes.id-reusado-nao-herda-cartao ("sem fechar pelo subagente antigo") ao que já estava gravado.
Estado: coberto

### subagentes.lancados-juntos-se-veem
Subagentes lançados juntos, na mesma mensagem, ficam como se tivessem sido lançados um depois do outro.

- Dado uma tarefa em andamento, ou mais de uma
- Quando o modelo lança vários subagentes na mesma mensagem e os lançamentos correm juntos (cada um lê o painel antes de outro gravar), com o relógio andando entre eles
- Então o resultado é o de lançá-los em série: mais de três da mesma tarefa ficam num cartão de grupo "N subagentes"; com várias em andamento, cada lançamento vai à tarefa que receberia depois do anterior (dois lançados juntos, dois em andamento: um cartão em cada); e um painel gravado ou um cartão de filha publicado por versão anterior, com um lote por lançamento, também junta no cartão de grupo os lançados a até 3 s um do outro

Fora deste cenário: o lote com mais lançamentos que tarefas em andamento, e o workflow com várias tarefas em andamento (segue a regra de hoje, a de lançá-los em série; ficarem todos num cartão de grupo só é pergunta em aberto da auditoria).

Origem: auditoria 2026-11-10 (subagentes lançados em paralelo não se enxergam, e o cartão de grupo não se forma); aplica subagentes.varios-juntos-num-cartao-de-grupo ("Cartão + grupo (Recomendado)") e subagentes.cartao-desde-o-lancamento ("Vai à pendente (Recomendado)") aos lançamentos simultâneos, sem mudar nenhuma delas.
Estado: coberto

### subagentes.lancados-juntos-no-app
Lançados juntos no app, os subagentes ficam como em série.

- Dado uma tarefa em andamento numa sessão real
- Quando o modelo lança quatro ou mais subagentes na mesma mensagem (e, noutra vez, dois com duas tarefas em andamento)
- Então aparece um cartão "N subagentes" com todos (com duas em andamento, um cartão em cada), sem cartões soltos

Origem: auditoria 2026-11-10 (dados reais: 4 lançamentos em 45 ms com 4 lotes; 10 em 850 ms com 3 lotes); o teste simula a corrida com as leituras presas, não a ordem real dos hooks do app.
Estado: checklist (subagentes reais lançados juntos no app)

### subagentes.neto-segue-o-cartao-de-quem-o-lancou
O cartão do subagente lançado por outro subagente fica no cartão de quem o lançou, também depois de terminar.

- Dado um subagente à vista no painel, da raiz ou de uma sessão filha, que lança outro subagente
- Quando o subagente lançado termina; e, depois, quando o pedido de quem o lançou sai do trabalho
- Então o cartão dele segue dentro do cartão de quem o lançou, com a palavra de estado ("concluído"…): sob a tarefa de onde foi lançado, ou no fim do cartão quando quem o lançou não tem tarefas; e sai junto com esse cartão, sem ficar solto no fim do painel nem ir para uma tarefa da sessão que tenha o mesmo id

Fora deste cenário: a tarefa de quem o lançou fechar (ou não) pelo fim dele; o subagente lançado por um agente de um cartão de grupo, que só aparece com a linha desse agente aberta; o subagente ainda rodando depois que o cartão de quem o lançou saiu do trabalho.

Origem: auditoria 2026-11-10 / rodada de correções (o cartão do subagente lançado por outro subagente some quando ele termina); decisão do usuário, 2026-11-12 ("Cartão do subagente neto": "Fazer o cartão do subagente neto aparecer depois que ele termina, como acontece com os outros subagentes"); aplica subagentes.terminado-segue-cartao, subagentes.cartao-desde-o-lancamento ("o cartão aparece embaixo dessa tarefa") e subagentes.cartao-fica-com-a-origem-fechada ("sai junto com o pedido da tarefa") ao subagente de outro subagente, sem mudar nenhuma delas.
Estado: coberto

### subagentes.neto-no-app
No app, o cartão do subagente lançado por outro subagente segue depois que ele termina.

- Dado uma sessão real em que um subagente lança outro (uma vez com tarefas no painel, outra sem)
- Quando o subagente lançado termina e, depois, quando quem o lançou termina
- Então o cartão dele segue dentro do cartão de quem o lançou, "concluído", sob a tarefa de onde saiu (ou no fim do cartão); com um pedido novo, os dois cartões saem juntos

Origem: decisão do usuário, 2026-11-12 ("Fazer o cartão do subagente neto aparecer depois que ele termina, como acontece com os outros subagentes"); o teste simula o lançamento a partir de outro subagente, não um subagente real lançando outro.
Estado: checklist (subagente real lançando outro no app)

### subagentes.sem-fim-vira-interrompido
O cartão vivo de um subagente cujo fim não chegou é encerrado pela lista de agentes do app.

- Dado um subagente com o cartão "trabalhando" ou "em segundo plano" cujo fim não chegou ao painel: o processo reiniciou (o app, `/model`, uma retomada) e o painel voltou do store com o cartão vivo; ou o app o parou, ou o deu por terminado, sem o fim chegar
- Quando a releitura de 3 s (a mesma das sessões) não o acha na lista de agentes do app, ou o acha listado como terminado, em duas releituras seguidas
- Então o cartão fica "interrompido" (listado como terminado, com o fim que a lista diz: "concluído", "falhou" ou "interrompido"), com o tempo parado no último sinal dele (a última chamada ou passo que o cartão registrou; sem nenhum, o lançamento); sai da pílula "N subagentes"; o que ele deixou aberto fica interrompido, como em qualquer fim; e, com o turno terminado, a tarefa de onde saiu reflete esse fim (✕ "interrompida", ✕ "falhou" ou ✓), se nada mais está em execução nela. Um fim que chegue depois vale sobre este

Fora deste cenário: os agentes de workflow e o que eles lançam (o app não os lista: ver subagentes.workflow-sem-sinal-vira-interrompido); o cartão gravado por versão anterior, sem o último sinal, para no lançamento; o subagente de uma sessão filha é conferido pela filha, enquanto o processo dela roda.

Origem: auditoria 2026-11-10 (subagente fica "trabalhando" ou "em segundo plano" para sempre quando o fim dele não chega); decisão do usuário, 2026-11-12 ("Sim, entra nesta rodada (Recomendado)", para "O cartão vivo é conferido contra a lista de agentes do app. Os agentes de workflow, que não aparecem nessa lista, usam outro critério. O órfão vira "interrompido" com o tempo parado, e a tarefa de origem pode fechar."); aplica subagentes.pai-reflete-falha-ou-interrupcao e subagentes.pai-conclui-no-fim-do-turno ao fim dado pela lista, sem mudar nenhuma delas.
Código: hooks/sessions.ts
Estado: coberto

### subagentes.vivo-de-verdade-segue-vivo
Um subagente que ainda roda nunca tem o cartão encerrado pela conferência.

- Dado um subagente rodando, com o cartão "trabalhando" ou "em segundo plano"
- Quando o worker de hooks volta sem reinício do app (o painel vem do store e o app segue listando o subagente como rodando, à espera ou ocioso); ou a lista do app falha, vem sem o estado, ou uma só releitura não o acha (recém-lançado, lista lida na hora errada) e a seguinte volta a achá-lo; ou ele é um agente de workflow, ou foi lançado por um, que a lista não traz, e deu sinal há menos de 30 minutos
- Então o cartão segue vivo, na pílula "N subagentes", e a tarefa de onde saiu não fecha por ele

Origem: auditoria 2026-11-10, ajuste da verificação (o worker de hooks pode voltar com os subagentes ainda rodando no motor; os agentes de workflow não são listados); decisão do usuário, 2026-11-12 ("Sim, entra nesta rodada (Recomendado)": "O cartão vivo é conferido contra a lista de agentes do app. Os agentes de workflow, que não aparecem nessa lista, usam outro critério.").
Código: hooks/sessions.ts
Estado: coberto

### subagentes.workflow-sem-sinal-vira-interrompido
O cartão vivo de um agente de workflow sem sinal há 30 minutos é encerrado.

- Dado um agente de workflow (ou um subagente lançado por ele), que o app não lista, com o cartão "trabalhando" ou "em segundo plano"
- Quando passam 30 minutos sem chamada nem passo dele, nem de nada ainda vivo que ele lançou (o processo reiniciou, o run foi parado, a tentativa travou)
- Então o cartão fica "interrompido", com o tempo parado no último sinal dele, sai da pílula, e a tarefa de onde saiu reflete o fim como em subagentes.sem-fim-vira-interrompido; com sinal há menos de 30 minutos, segue vivo

Fora deste cenário: uma chamada única que dure mais de 30 minutos é lida como sem sinal (o fim real, quando chega, vale sobre este; a tarefa de origem já fechada não reabre).

Origem: auditoria 2026-11-10, ajuste da verificação ("para eles usar outro critério (fim do run, ou tempo sem chamadas)"); decisão do usuário, 2026-11-12 ("30 minutos sem sinal (Recomendado)").
Código: hooks/sessions.ts
Estado: coberto

### subagentes.sem-fim-no-app
No app, o cartão do subagente que morreu com o processo fica "interrompido"; o que segue rodando, não.

- Dado uma sessão real com um subagente em segundo plano de longa duração, o cartão dele sob a tarefa de origem
- Quando o app é fechado e reaberto (e, noutra vez, o modelo é trocado com `/model`, e o subagente é parado pelo app) com o subagente ainda rodando
- Então, em alguns segundos, o cartão diz "interrompido", com o tempo parado, e a pílula deixa de contá-lo; um subagente que segue rodando depois de uma recarga do mod continua "em segundo plano" ou "trabalhando"

Origem: decisão do usuário, 2026-11-12 ("Sim, entra nesta rodada (Recomendado)"); o teste simula a lista de agentes do app, não o reinício real nem o que o app lista depois dele.
Estado: checklist (reinício real do app e /model com subagente em segundo plano)
