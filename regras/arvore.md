# Árvore

Tarefas, pais e filhos: estados, start, done e ids.

Código da área: state/tasks.ts, hooks/tools.ts

### arvore.pai-fecha-com-os-filhos
Um pai fecha sozinho quando todas as filhas fecham.

- Dado um pai com filhas, algumas com filhas também
- Quando todas as folhas são concluídas com done
- Então o pai e os ancestrais ficam ✓ sem done próprio, e o último done não traz avisos

Origem: regra do painel desde a entrada do mod, 2026-10-20 (465b09e).
Estado: coberto

### arvore.start-reabre-pais
start numa tarefa concluída reabre ela e os pais.

- Dado uma árvore toda concluída
- Quando o modelo chama start numa folha
- Então ela, o pai e o nível 1 voltam a ◉, e as irmãs seguem ✓

Origem: regra do painel desde a entrada do mod, 2026-10-20 (465b09e).
Estado: coberto

### arvore.start-recusa-pai-concluido
start num pai concluído é recusado.

- Dado um pai ✓ com filhas (as filhas ✓ ou ✕)
- Quando o modelo chama start nele
- Então a resposta recusa, diz que ela já foi concluída (o pai fechado é ✓ no painel, também com as filhas ✕) e os dois caminhos (start nas subtarefas a refazer, que reabre os pais, ou replanejar com ids novos), e nada muda no painel

Origem: regra do painel desde a entrada do mod, 2026-10-20 (465b09e); texto da recusa completado na auditoria de 2026-11-10.
Código: text/rules.ts
Estado: coberto

### arvore.start-no-pai-inicia-a-primeira-subtarefa
start numa tarefa aberta com subtarefas inicia a primeira subtarefa aberta dela.

- Dado um pai aberto com subtarefas abertas
- Quando o modelo chama start no pai
- Então a primeira subtarefa aberta, na ordem do plano, fica ◉ de verdade: o relógio conta desde o start, ela entra no chip "em andamento", fica ◷ no fim do turno e ✕ no Esc; o pai e o pedido ficam ◉ pelo caminho; a resposta do start diz qual foi iniciada; quando ela fecha, a seguinte segue ○ até o start dela; o pai fechado com subtarefas segue recusado (arvore.start-recusa-pai-concluido)

Origem: decisão do usuário, 2026-11-14 ("Inicia a 1ª subtarefa (Recomendado)"), sobre o achado da auditoria de 2026-11-10 (a folha acendia sem início: relógio desde o plano, fora do chip, ○ no fim do turno).
Código: draw/layout.ts, text/rules.ts
Estado: coberto

### arvore.sem-start-nada-acende
Sem start, nada fica em andamento.

- Dado um plano novo
- Quando nenhum start foi chamado
- Então todas as tarefas, o pai e o pedido ficam ○; salvo a tarefa com sessão filha trabalhando (sessoes.filha-trabalhando-mantem-pais-em-andamento) ou com subagente rodando (subagentes.tarefa-em-andamento-com-subagente-rodando)

Origem: decisão do usuário, 2026-10-23 ("sem start, nada aceso"); commit b742294.
Código: draw/layout.ts
Reescrito: 2026-11-14, decisão do usuário ("Sim, ◉ como a filha (Recomendado)"): exceção para a tarefa com subagente rodando. O teste deste cenário não muda.
Estado: coberto

### arvore.pai-em-andamento-no-caminho-da-ultima-iniciada
O pai aberto fica em andamento no caminho da última tarefa iniciada no turno.

- Dado start e done numa filha, sem outro start, no mesmo turno
- Quando o painel é desenhado
- Então o pai e o pedido aparecem ◉ (não ◷), e o chip "em andamento" não conta o pai; planos parados de pedidos anteriores seguem ◷

Origem: decisão do usuário, 2026-10-27 ("pai aberto deve mostrar ◉ em andamento"), sobre "Pai aguardando" de 2026-10-20; commit a201198.
Código: draw/layout.ts
Estado: coberto

### arvore.ids-curtos-e-avisos
Ids curtos e os avisos de id ambíguo, inexistente ou de outro agente.

- Dado ids repetidos entre planos de níveis 1 diferentes
- Quando o modelo chama start ou done com um id curto ambíguo, inexistente ou de outro agente
- Então a resposta avisa cada caso, e o id completo ("D/1.2") resolve

Origem: regra do painel desde a entrada do mod, 2026-10-20 (465b09e).
Estado: coberto

### arvore.done-sem-summary-e-varias-sem-start
Avisos do done: sem summary no fim e etapas fechadas juntas sem start.

- Dado o último done do pedido sem summary (também quando o único resumo dado veio antes de um plan do mesmo turno), ou várias tarefas fechadas de uma vez sem start
- Quando o done responde
- Então a resposta traz o aviso correspondente; o do summary diz que só vale se aquele done foi o último passo do turno

Origem: commit 9c054f8, 2026-10-21 ("avisa quando etapas fecham juntas sem start"); o aviso de falta de summary, commit 3f06a32, 2026-10-21 ("↩ mostra só o resumo escrito pela própria sessão"); o aviso no meio do turno e o resumo de antes do plan, auditoria 2026-11-10.
Código: text/rules.ts
Estado: coberto

### arvore.plan-recusa-ids-repetidos
plan com ids repetidos é recusado.

- Dado um plano com o mesmo id em duas tarefas
- Quando o modelo chama plan
- Então a resposta é um erro com os ids repetidos, e nada muda no painel

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Estado: coberto

### arvore.pai-fecha-com-nada-aberto-embaixo
Pai e pedido sem nada aberto embaixo ficam ✓.

- Dado um pai (tarefa, nível 1 ou pedido) com todas as folhas ✓ ou ✕, em qualquer mistura, inclusive só ✕
- Quando o painel é desenhado (depois de Esc, de subagente que terminou, de replano com o mesmo id em pedido novo, de filha parada ou arquivada)
- Então o pai e os ancestrais ficam ✓, a folha ✕ segue ✕ e fora do x/y; ◷ fica para o pai com algo ainda aberto embaixo

Origem: decisão do usuário, 2026-11-04 ("todos os subitens estão concluidos ou interrompidos, mas a tarefa pai está como em andamento, ela deveria estar concluida tambem"; pai com só ✕ embaixo: "Fica ✓"); mantém "se existem tarefas concluidas como filhas, o pai nunca pode ficar como interrompido" (95b1a21).
Código: draw/layout.ts, state/tasks.ts
Estado: coberto

### arvore.id-curto-nao-alcanca-o-historico
O id curto de start e done não alcança as tarefas de histórico.

- Dado um nível 1 de um pedido anterior que virou histórico porque um plan novo reusou o id dele
- Quando o modelo chama start ou done com um id curto que as duas cópias têm, ou que só a de histórico tem
- Então vale a tarefa do plano atual (sem aviso de ambíguo); o id que só existe no histórico "não existe"; a tarefa de histórico só responde pelo id completo

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: o id curto reabria tarefa de histórico e expunha o id interno); aplica arvore.ids-curtos-e-avisos ("a tarefa aberta vence") e pedidos.plano-anterior-vira-historico, sem mudar nenhuma das duas.
Estado: coberto

### arvore.cancelar-tarefa-abandonada
A tarefa de que o modelo desiste é cancelada: ✕ interrompida, fora do x/y.

- Dado tarefas abertas que não serão feitas (o usuário mudou de rumo, o plano mudou)
- Quando o modelo chama done passando os ids delas em `cancel`
- Então cada uma, com o que está aberto abaixo dela, fica ✕ "interrompida", fora do x/y e das barras e no chip "interrompidas"; o que já estava ✓ segue ✓; o pai sem nada aberto embaixo fica ✓ (arvore.pai-fecha-com-nada-aberto-embaixo); a resposta diz quantas foram canceladas, sem o aviso de etapas fechadas juntas; o id já fechado, inexistente, ambíguo ou de outro agente é avisado; start numa folha cancelada a reabre

Origem: decisão do usuário, 2026-11-14 ("✕ fora do x/y (Recomendado)"), sobre o achado da auditoria de 2026-11-10 (o modelo só podia concluir, e a tarefa abandonada aparecia ✓ e contava como feita).
Código: hooks/session-start.ts, draw/layout.ts, text/rules.ts
Estado: coberto

### arvore.done-em-interrompida-indica-o-start
O done numa tarefa interrompida não a conclui, e diz que o start a reabre.

- Dado uma tarefa ✕ (interrompida pelo fim de um subagente, ou histórico de um pedido anterior)
- Quando o modelo chama done nela
- Então a resposta avisa que ela foi interrompida, que o done não a conclui e que o start nela a retoma; nada muda no painel

Origem: auditoria 2026-11-10 (o aviso dizia só "foi interrompida").
Código: text/rules.ts
Estado: coberto
