# Árvore

Tarefas, pais e filhos: estados, start, done e ids.

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

- Dado um pai ✓ com filhas
- Quando o modelo chama start nele
- Então a resposta recusa e manda replanejar o nível 1, e nada muda no painel

Origem: regra do painel desde a entrada do mod, 2026-10-20 (465b09e).
Estado: coberto

### arvore.sem-start-nada-acende
Sem start, nada fica em andamento.

- Dado um plano novo
- Quando nenhum start foi chamado
- Então todas as tarefas, o pai e o pedido ficam ○

Origem: decisão do usuário, 2026-10-23 ("sem start, nada aceso"); commit b742294.
Estado: coberto

### arvore.pai-em-andamento-no-caminho-da-ultima-iniciada
O pai aberto fica em andamento no caminho da última tarefa iniciada no turno.

- Dado start e done numa filha, sem outro start, no mesmo turno
- Quando o painel é desenhado
- Então o pai e o pedido aparecem ◉ (não ◷), e o chip "em andamento" não conta o pai; planos parados de pedidos anteriores seguem ◷

Origem: decisão do usuário, 2026-10-27 ("pai aberto deve mostrar ◉ em andamento"), sobre "Pai aguardando" de 2026-10-20; commit a201198.
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

- Dado o último done do pedido sem summary, ou várias tarefas fechadas de uma vez sem start
- Quando o done responde
- Então a resposta traz o aviso correspondente

Origem: commit 9c054f8, 2026-10-21 ("avisa quando etapas fecham juntas sem start"); o aviso de falta de summary, commit 3f06a32, 2026-10-21 ("↩ mostra só o resumo escrito pela própria sessão").
Estado: coberto

### arvore.plan-recusa-ids-repetidos
plan com ids repetidos é recusado.

- Dado um plano com o mesmo id em duas tarefas
- Quando o modelo chama plan
- Então a resposta é um erro com os ids repetidos, e nada muda no painel

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Estado: coberto
