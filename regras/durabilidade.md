# Durabilidade

O painel depois de reinício e recarga.

Código da área: state/durability.ts, hooks/panel.ts, hooks/session-start.ts

### durabilidade.reinicio-restaura-do-store
O reinício e a retomada restauram o painel do store.

- Dado um painel salvo no store
- Quando um processo novo roda o session.start, ou a sessão é retomada (resume) com outro painel no state
- Então o painel volta como estava no store (títulos, estados e números), com o trabalho da sessão retomada, e o start seguinte age sobre ele; um trabalho sem nenhuma tarefa presente não vale, e o painel nunca fica vazio por isso

Origem: regra do painel desde a entrada do mod (commit 85744cb); tabela de durabilidade, commit fe8354e, 2026-10-22.
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)"); sem visão completa, o trabalho antigo deixava o painel vazio na retomada.
Estado: coberto

### durabilidade.respawn-sem-session-start
Num processo novo sem session.start, o painel volta no primeiro uso, e o store não encolhe.

- Dado o painel no store e um processo novo que não rodou o session.start
- Quando o painel é desenhado e o modelo chama start e done
- Então o painel aparece inteiro, o trabalho atual volta, e o store não encolhe

Origem: commits 7c7ade7 e 2cef003, 2026-10-22.
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)").
Estado: coberto

### durabilidade.fim-do-turno-sobrevive-ao-reinicio
O fim do turno sobrevive ao reinício.

- Dado um turno que terminou (normal ou com Esc) com uma tarefa iniciada e aberta
- Quando um processo novo desenha o painel (session.start, respawn sem ele, ou retomada)
- Então nada fica ◉: a iniciada fica ◷ (✕ se o turno foi parado), o pai fica ◷, e o relógio não anda até o start nela

Origem: decisões do usuário de 2026-10-27 (◉ só no caminho da última iniciada no turno atual; no fim do turno, a iniciada aguarda) aplicadas ao reinício; achado da tarefa 7, 2026-10-28.
Reescrito: 2026-11-14, decisão do usuário ("Seguir ◷ até o start (Recomendado)"); antes, o relógio voltava a andar no próximo pedido. Os testes não mudam.
Código: hooks/turn.ts, hooks/sessions.ts, hooks/render.tsx
Estado: coberto

### durabilidade.parada-com-esc-sobrevive-ao-reinicio
A tarefa parada com Esc segue interrompida num processo novo.

- Dado uma tarefa parada com Esc e, depois, um turno que não abriu pedido terminado normalmente
- Quando um processo novo desenha o painel (session.start)
- Então a parada segue ✕ e nada fica ◉; o pedido seguinte com start em outra tarefa não a reacende, e o start nela sim (turnos.parada-segue-interrompida-ate-o-start)

Origem: decisão do usuário, 2026-11-12 ("Segue ✕ até novo start (Recomendado)"), aplicada ao reinício: a marca da parada fica na própria tarefa, que o store guarda com o painel.
Código: hooks/turn.ts, state/tasks.ts, draw/layout.ts
Estado: coberto

### durabilidade.clear-esvazia
O /clear esvazia o painel.

- Dado um painel com tarefas
- Quando a pessoa usa /clear
- Então o painel fica "Nenhuma tarefa planejada."; as linhas recolhidas pela pessoa são esquecidas: o plano seguinte nasce aberto

Origem: regra do painel desde a entrada do mod (commit 85744cb, 2026-10-20).
Estado: coberto

### durabilidade.dobras-voltam-no-processo-novo
As linhas que a pessoa recolheu ou abriu voltam como ela deixou num processo novo.

- Dado tarefas, pedidos ou cartões recolhidos pela pessoa e um "+N pedidos anteriores" aberto por ela
- Quando o processo da sessão é refeito (/model, respawn do worker, reabrir o app) ou a sessão é retomada
- Então o painel volta com as mesmas linhas recolhidas e abertas (na retomada, as da sessão retomada, ou nenhuma); o /clear segue limpando tudo (durabilidade.clear-esvazia); a sessão que volta do arquivo publicado (fora das 30 do store) volta no padrão; a primeira escrita depois de um respawn (um clique, um plan que reusa um id) parte do que estava guardado, e o que ela tinha recolhido antes de uma recarga do mod é guardado na publicação seguinte

Origem: decisão do usuário, 2026-11-15 ("Sim, guardado por sessão (Recomendado)").
Código: hooks/render.tsx, hooks/panel.ts, hooks/tools.ts
Reescrito: 2026-11-15, texto: as dobras de antes de uma recarga do mod são guardadas na publicação seguinte, e a primeira escrita depois de um respawn não as perde (revisão do lote, 2026-11-15); nenhuma regra muda e os testes existentes não mudam.
Estado: coberto

### durabilidade.painel-guardado-de-forma-desconhecida-e-ignorado
O painel guardado tem versão, e um dado de forma desconhecida é ignorado em vez de derrubar o painel.

- Dado o painel guardado de uma sessão (o do store, ou o do state que atravessou uma recarga) numa versão que este código não conhece, ou fora do formato
- Quando o painel é trazido de volta (processo novo, retomada, primeiro uso depois de uma recarga, também quando esse primeiro uso é um /clear)
- Então o dado é ignorado, o log de depuração diz o motivo uma vez, e o painel vem da outra cópia válida ou começa vazio; as ferramentas e o desenho seguem funcionando; o painel guardado da forma anterior, sem versão, segue lido; o que o /clear guarda no histórico é o painel conferido

Origem: decisão do usuário, 2026-11-15 ("Versão e leitura conferida (Recomendado)").
Código: hooks/session-start.ts, io/log.ts
Reescrito: 2026-11-15, texto: a versão do painel do state é gravada junto com ele, e o /clear confere o painel antes de guardá-lo no histórico (revisão do lote, 2026-11-15); nenhuma regra muda e os testes existentes não mudam.
Estado: coberto

### durabilidade.formatos-antigos-do-publicado
Os formatos antigos do arquivo publicado são lidos.

- Dado um arquivo publicado por outra versão do mod (os formatos de referência guardados com os testes: os 8 primeiros, de antes da versão do arquivo até a primeira com ela, e os que entraram depois, com taxa, pasta sem git, parada com Esc, ultracode, subagente e o fim do turno)
- Quando o painel lê a sessão filha
- Então o cartão aparece, sem erro, com as tarefas que o formato traz

Origem: contrato do arquivo publicado, commit 7905b37, 2026-10-22 ("Já existiram 8 formatos", DESENVOLVIMENTO).
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)"); o teste só deixa de escolher a visão ou abre a linha.
Reescrito: 2026-11-15, texto: a lista de referência ganha os formatos que entraram depois dos 8 primeiros. A regra e o teste dos 8 não mudam.
Código: io/publish.ts, io/host.ts
Estado: coberto

### durabilidade.publicado-fora-do-formato-nao-derruba
Um elemento fora do formato no arquivo de uma filha sai só ele: o cartão e o painel seguem.

- Dado o arquivo publicado de uma sessão filha (ou o painel de uma neta dentro dele) com um grupo sem lista de tarefas, uma tarefa sem lista de subtarefas ou sem id, ou um envio sem destino
- Quando o painel lê a filha, desenha, conta, publica e responde plan, start e done
- Então o elemento ruim fica de fora e o resto do arquivo é usado: o cartão da filha aparece com as tarefas boas, o painel não vira a linha de erro, as ferramentas respondem e esta sessão segue publicando; o log de depuração diz uma vez, por sessão, o que ficou de fora

Origem: auditoria 2026-11-10 (triagem de 2026-11-15: só o envelope do arquivo era conferido, e um elemento ruim derrubava o painel inteiro, as ferramentas e a publicação); estende durabilidade.formatos-antigos-do-publicado, sem mudá-la.
Código: io/publish.ts, io/host.ts
Estado: coberto

### durabilidade.id-proprio-sobrevive-a-recarga
O id da própria sessão sobrevive à recarga do mod.

- Dado o id desta sessão já lido do app
- Quando o mod recarrega a quente (módulo novo, state mantido) e o app demora ou falha em responder o id de novo
- Então o painel segue sendo publicado e os cartões seguem divididos em rodadas com o id guardado, sem esperar o app

Origem: auditoria 2026-11-10 (triagem de 2026-11-15: o id era variável do módulo, pedido de novo ao app a cada recarga).
Código: hooks/render.tsx, hooks/sessions.ts
Estado: coberto

### durabilidade.recarga-mantem-painel-ligacoes-e-resumo
A recarga a quente mantém o painel e as ligações.

- Dado um painel com cartões ligados a tarefas
- Quando o mod recarrega a quente (módulo novo, state mantido, sem session.start)
- Então o painel e os cartões seguem iguais (o resumo do done na recarga segue em durabilidade.resumo-do-done-na-recarga)

Origem: bugs achados no teste visual do usuário, 2026-10-21/22; commits 23b7002, 2a6e86d e 027b231.
Reescrito: 2026-11-15, decisão do usuário de 2026-11-14 ("Tirar, basta o ↩ (Recomendado)"): o recap do wrap_up deixa de ser guardado; a resposta do turno no painel é só o resumo ↩. Saem os dois testes do recap na recarga.
Estado: coberto

### durabilidade.ligacoes-com-lista-parcial-do-host
A filha que a lista do host deixa de fora volta sob a mesma tarefa.

- Dado filhas ligadas a tarefas e uma lista do host que deixa uma delas de fora
- Quando a lista volta a listá-la
- Então o cartão volta sob a mesma tarefa

Origem: commit 027b231, 2026-10-22.
Código: hooks/sessions.ts, io/host.ts
Estado: coberto

### durabilidade.resumo-do-done-na-recarga
O resumo do done chega à resposta do turno, mesmo com uma recarga no meio.

- Dado um done com summary e uma recarga a quente antes do fim do turno
- Quando o turno termina
- Então o resumo aparece como ↩ no cartão desta sessão, na sessão que a abriu

Origem: commits 23b7002, 2026-10-21, e 2a6e86d; o ↩ sem resposta final foi corrigido na análise de 2026-10-29.
Código: hooks/turn.ts, hooks/tools.ts
Estado: coberto

### durabilidade.clear-publica-limpo
Depois do /clear, o arquivo publicado da sessão sai sem espera e sem cartas.

- Dado uma sessão com uma espera aberta (a escolha do wrap_up) e uma carta na fila
- Quando a pessoa usa /clear
- Então o painel fica "Nenhuma tarefa planejada." e o que a sessão publica para a que a abriu já não diz que ela espera nem traz as cartas: o cartão dela na mãe não fica "aguardando"

Origem: auditoria 2026-11-10 (o /clear publicava antes de zerar as esperas e as cartas); aplica durabilidade.clear-esvazia, sem mudar nenhuma regra.
Código: io/publish.ts
Estado: coberto

### durabilidade.retomada-nao-herda-a-sessao-anterior
A retomada não herda o painel, as esperas nem o resumo da sessão anterior do mesmo processo.

- Dado um painel de outra sessão no state, com uma espera aberta e um resumo do done ainda não usado
- Quando uma sessão é retomada (resume) nesse processo
- Então o painel é o guardado para a sessão retomada ou, sem painel guardado, "Nenhuma tarefa planejada."; as esperas, o resumo e o recap da anterior não aparecem nem são gravados sob a retomada

Origem: auditoria 2026-11-10 (a retomada sem cópia no store mantinha o painel anterior); estende durabilidade.reinicio-restaura-do-store, sem mudar nenhuma regra.
Estado: coberto

### durabilidade.turno-em-curso-no-reinicio-fica-interrompido
O app fechado, ou o processo morto, no meio de um turno deixa a tarefa em andamento interrompida.

- Dado um turno em curso com uma tarefa iniciada e aberta, e o processo que morre sem terminar o turno (o app fechado, o processo morto)
- Quando um processo novo abre a sessão (session.start, ou a retomada dela)
- Então a tarefa que estava em andamento aparece ✕ "interrompida", fora do x/y, com o relógio parado no último instante que o painel conhece; as pendentes seguem ○ e nada fica ◉; ela só volta a andamento com start nela, e o done a conclui sem start; a mensagem seguinte traz o pedido de replanejar, como depois do Esc; o processo que volta sem session.start, com o turno ainda vivo, segue em andamento

Origem: decisão do usuário, 2026-11-14 ("✕ interrompida"), à pergunta "Se o app fechar, ou o processo morrer, no meio de um turno, como deve aparecer, ao reabrir, a tarefa que estava em andamento?"; aplica turnos.parada-segue-interrompida-ate-o-start.
Código: hooks/turn.ts, state/tasks.ts, draw/layout.ts
Estado: coberto

### durabilidade.recarga-nao-funde-as-ligacoes
Depois de uma recarga do mod, as cartas e os cartões são os que o painel já tinha.

- Dado cartas e cartões ligados a tarefas, e uma mudança neles que ainda não foi ao store (o lembrete de recebimento dado, a carta que um plan descartou, a tarefa renomeada por um plan)
- Quando o mod recarrega a quente (módulo novo, state mantido) e o painel volta a ser gravado
- Então cada tarefa segue com as mesmas cartas e cartões: nenhuma linha repetida, nenhuma carta de volta, e o lembrete de recebimento não sai de novo; num processo novo (state vazio), as ligações voltam do store antes da primeira escrita delas

Origem: auditoria 2026-11-10 (a primeira gravação depois da recarga fundia o store por cima do state); aplica durabilidade.recarga-mantem-painel-ligacoes-e-resumo, sem mudar nenhuma regra.
Código: hooks/tool-call.ts, hooks/prompt-submit.ts, hooks/sessions.ts, hooks/agents.ts
Estado: coberto

### durabilidade.clear-tira-os-cartoes-das-filhas
Depois do /clear, os cartões das filhas abertas antes somem e não voltam.

- Dado uma sessão que abriu sessões filhas, com os cartões sob as tarefas
- Quando a pessoa usa /clear nela
- Então os cartões somem na hora, com o resto do painel, e não voltam nas leituras seguintes: nem soltos no fim, nem sob uma tarefa nova que reuse o id da antiga; não somam no cabeçalho nem no x/y e não deixam tarefa em andamento; a filha segue trabalhando sem cartão nesta sessão, também depois de uma recarga do mod; uma mensagem nova a ela mostra só a carta; uma sessão aberta depois do /clear aparece normalmente

Origem: decisão do usuário, 2026-11-14 ("Some na hora"), à pergunta "Depois de um /clear numa sessão que abriu sessões filhas, o que acontece com o cartão de uma filha aberta antes do /clear?".
Código: hooks/sessions.ts, hooks/tool-call.ts, io/host.ts
Estado: coberto

### durabilidade.store-cheio-nao-perde-em-silencio
O store cheio não deixa de salvar o painel em silêncio.

- Dado o store do mod no teto, com registros de sessões que já saíram da lista e chaves de versões antigas
- Quando uma gravação do painel, do trabalho, do fim do turno ou das ligações falha
- Então o mod apaga essas sobras e grava de novo; se ainda falhar, o painel segue certo na tela, o log de depuração diz qual gravação falhou (uma vez por motivo) e o /task-tree diz que o painel não está sendo salvo; a sessão cujos registros foram apagados por outra os grava de novo na escrita seguinte

Origem: auditoria 2026-11-10 (passado o teto de 4 MiB, nada mais era salvo e nada avisava); sem mudar nenhuma regra.
Código: hooks/command.ts, io/log.ts
Estado: coberto

### durabilidade.publicado-de-sessao-que-nao-existe-e-esvaziado
O arquivo publicado de uma sessão que o app não lista mais é esvaziado.

- Dado a pasta dos arquivos publicados com o arquivo de uma sessão que não existe mais no app, parado há mais de um dia
- Quando um processo novo abre uma sessão no app desktop
- Então esse arquivo é regravado vazio; o de uma sessão que o app lista (arquivada inclusive), o desta sessão e o gravado há pouco ficam como estão; com a lista do app em erro, incompleta ou sem a confirmação de que a sessão não existe, nada é esvaziado

Origem: decisão do usuário, 2026-11-14 ("Enxugar e esvaziar (Recomendado)").
Código: hooks/sessions.ts, io/host.ts, io/publish.ts
Estado: coberto

### durabilidade.painel-volta-do-arquivo-publicado
O painel de uma sessão parada há muito tempo volta inteiro enquanto a sessão existir no app.

- Dado uma sessão do app desktop cujo painel já saiu do store (só as 30 que gravaram por último ficam lá) e que ainda existe no app
- Quando um processo novo a abre (session.start, ou o primeiro uso sem ele)
- Então o painel volta do arquivo que ela mesma publicou: pedidos, estados, trabalho atual, cartas, cartões das filhas sob as mesmas tarefas e o fim do turno como estava (a tarefa que ele deixou ◷ segue ◷ num aviso do app, até o start nela); ele volta ao store, e o cartão dela na sessão que a abriu mantém o histórico; com o painel no store, vale o do store; fora do app desktop valem as 30 últimas

Origem: decisão do usuário, 2026-11-14 ("Enquanto a sessão existir (Recomendado)"), à pergunta "Por quanto tempo o painel de uma sessão parada deve ser guardado?".
Reescrito: 2026-11-14, decisão do usuário ("Seguir ◷ até o start (Recomendado)"); a tarefa que o fim do turno deixou ◷ aparecia ◉ no aviso do app que abre o processo novo; o teste sem session.start passa a esperá-la aguardando.
Código: io/publish.ts, io/host.ts
Estado: coberto

### durabilidade.painel-fechado-reabre-so-na-mensagem
O painel que a pessoa fechou só reabre na próxima mensagem dela, em processo novo ou com /task-tree.

- Dado o painel de tarefas fechado pela pessoa
- Quando o modelo planeja ou replaneja, um subagente planeja, chega mensagem de outra sessão ou aviso do app, ou o mod recarrega
- Então o painel segue fechado; ele volta quando a pessoa escreve a próxima mensagem na sessão, quando um processo novo abre a sessão, ou com /task-tree

Origem: decisão do usuário, 2026-11-14 ("Só na sua mensagem (Recomendado)"), à pergunta "Quando você fecha o painel de tarefas, ele deve reabrir sozinho?".
Código: hooks/tools.ts, hooks/prompt-submit.ts, hooks/command.ts
Estado: coberto

### durabilidade.filha-recem-aberta-ainda-nao-listada
A filha recém-aberta que a lista do host ainda não traz mantém a tarefa de origem.

- Dado uma sessão filha aberta de uma tarefa, que a lista do host ainda não lista
- Quando o painel relê as sessões, e depois a lista passa a trazê-la
- Então, enquanto é recente, ela segue no painel como sessão iniciando, sob a tarefa de origem; quando a lista a traz, o cartão dela fica sob a mesma tarefa; a ligação vai ao store antes da primeira leitura

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: a primeira leitura descartava a filha recém-registrada e a ligação dela); estende durabilidade.ligacoes-com-lista-parcial-do-host à filha que ainda não foi listada nenhuma vez.
Código: hooks/sessions.ts, io/host.ts
Estado: coberto

### durabilidade.recibo-usado-sobrevive-a-recarga
Depois de uma recarga do mod ou de um reinício, o recibo já usado não confirma outra mensagem.

- Dado duas mensagens na fila da mesma sessão, de duas tarefas, e a sessão já tomou a primeira (tarefa 1 ✓, carta 1 verde, carta 2 azul)
- Quando o mod é recarregado (um arquivo salvo) ou o processo reinicia, e a lista é lida de novo
- Então a carta 2 segue azul e a tarefa 2 segue aberta até a sessão tomar a segunda mensagem; o modelo não recebe "recebimento confirmado" por ela

Origem: auditoria 2026-11-10 (os recibos usados eram variável do módulo); aplica envios.fica-ate-entrega ("a carta fica azul até a entrega"), sem mudar nenhuma regra.
Código: hooks/sessions.ts
Estado: coberto

### durabilidade.status-nao-segura-a-gravacao
A linha de status embaixo da caixa de mensagem nunca impede o painel de ser salvo e publicado.

- Dado uma falha ao calcular ou ao mostrar a linha "Tarefas d/n"
- Quando plan, start, done ou qualquer outra mudança grava o painel
- Então o painel é salvo no store e publicado antes; a falha do status fica no log de depuração e a ferramenta responde normalmente; o status é tentado de novo na mudança seguinte

Origem: auditoria 2026-11-10 (triagem de 2026-11-15: o status era calculado antes de salvar e publicar, sem proteção); sem mudar nenhuma regra.
Estado: coberto

### durabilidade.fim-do-turno-registrado-mesmo-com-falha
O fim do turno é registrado, e o pedido abre, mesmo quando um passo acessório falha.

- Dado, no fim de um subagente, uma falha na lista de agentes do app ou num passo do fim dele (o cartão, as esperas, as tarefas abertas); no fim do turno do loop principal, uma falha num passo acessório (limpar o resumo, tirar as esperas, fechar pelos subagentes, pôr em espera, publicar); ou, numa mensagem que chega, uma falha num passo acessório (guardar o nome da sessão que a mandou, as mensagens recebidas, os lembretes)
- Quando o turno do subagente ou do loop principal termina, ou a mensagem chega
- Então a falha fica no log de depuração (uma vez por passo e motivo) e os outros passos rodam: o subagente que termina deixa interrompido o que deixou aberto e o cartão dele sai de "trabalhando"; o fim do turno do loop principal é gravado (a tarefa iniciada fica ◷ e o arquivo publicado traz o fim e o ↩); a mensagem abre o pedido

Origem: auditoria 2026-11-10 (triagem de 2026-11-15: uma falha no começo do fim do turno deixava o painel em andamento e a sessão de cima sem o fim); sem mudar nenhuma regra (turnos.subagente-que-termina-interrompe). Estendido no mesmo dia ao fim do turno do loop principal e à mensagem que abre o pedido (auditoria 2026-11-10: nos hooks do prompt e do fim do turno, um passo acessório que lançava cancelava os essenciais seguintes, sem registro), sem mudar nenhuma regra.
Código: hooks/turn.ts, hooks/agents.ts, hooks/prompt-submit.ts, io/log.ts
Estado: coberto

### durabilidade.plan-publica-o-trabalho-novo
O que a sessão publica depois de um plan ou de um start já traz o trabalho e as ligações novas.

- Dado uma sessão com um pedido anterior concluído (com ou sem sessão aberta de uma tarefa dele)
- Quando o modelo planeja o pedido novo, reusando ou não o id da tarefa antiga, ou inicia uma tarefa de um pedido antigo com tudo fechado
- Então o arquivo que a sessão publica nesse mesmo passo traz o trabalho novo e as sessões ligadas à tarefa antiga renomeada: na sessão que a abriu, o cartão mostra o pedido novo sem esperar o próximo done

Origem: auditoria 2026-11-10 (o plan publicava antes de renomear as ligações e de gravar o trabalho); aplica sessoes.publicado-enxuto e pedidos.plano-anterior-vira-historico, sem mudar nenhuma regra.
Código: hooks/tools.ts, io/publish.ts
Estado: coberto

### durabilidade.publicacoes-em-ordem
Uma publicação do painel por vez: a mais velha não grava por último.

- Dado uma publicação do painel ainda em curso (disparada pelo ultracode, pela troca de modelo, pela taxa ou pelo comando)
- Quando o painel muda e é publicado de novo antes de ela terminar
- Então o arquivo publicado termina com o estado mais novo

Origem: auditoria 2026-11-10 (duas publicações em curso gravavam fora de ordem).
Código: io/publish.ts, hooks/turn.ts
Estado: coberto

### durabilidade.comando-diz-o-que-o-app-respondeu
O /task-tree abre o painel e diz o que o app respondeu.

- Dado o painel fora da tela
- Quando a pessoa roda /task-tree
- Então o painel é aberto com foco e a resposta diz "Painel de tarefas aberto", os painéis que o app lista (cada um "na frente", "aba atrás de outra" ou "não desenhado") e o tamanho do desenho; se o app não o põe na tela, diz "O app não pôs o painel na tela" com o motivo

Origem: regra do painel, a confirmar (auditoria de 2026-11-10; achados baixos, 2026-11-15).
Código: hooks/command.ts
Estado: coberto

### durabilidade.recarga-no-meio-do-turno-mantem-o-tempo
A recarga no meio do turno não zera o tempo da tarefa em andamento.

- Dado uma tarefa ◉ há algum tempo
- Quando o mod recarrega a quente no meio do turno
- Então ela segue ◉, o pai e o pedido também, e o tempo dela conta do start, não da recarga

Origem: regra do painel, a confirmar (auditoria de 2026-11-10; achados baixos, 2026-11-15).
Estado: coberto

### durabilidade.recarga-com-subagente-vivo
O subagente que trabalha durante a recarga segue no cartão, e o fim dele é registrado.

- Dado um subagente trabalhando, com o cartão sob a tarefa
- Quando o mod recarrega a quente
- Então o cartão segue "trabalhando" sob a mesma tarefa; quando ele termina, o cartão diz "concluído" e a tarefa segue a regra de sempre (subagentes.pai-conclui-no-fim-do-turno); quantas chamadas o cartão conta depois da recarga está em subagentes.contagem-de-chamadas-segue-na-recarga

Origem: regra do painel, a confirmar (auditoria de 2026-11-10; achados baixos, 2026-11-15).
Estado: coberto

### durabilidade.recarga-com-espera-aberta
A espera de pergunta aberta na recarga segue no painel e sai como sempre.

- Dado "Aguardando sua resposta" sob uma tarefa ◉
- Quando o mod recarrega a quente com a pergunta ainda aberta
- Então a espera segue desenhada sob a mesma tarefa, e sai com a mensagem seguinte da pessoa ou com o fim do turno

Origem: regra do painel, a confirmar (auditoria de 2026-11-10; achados baixos, 2026-11-15).
Estado: coberto
