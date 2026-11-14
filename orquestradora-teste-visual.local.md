# Teste visual passo a passo (2026-10-23) — bugs anotados para corrigir ao final

Prints em C:\Users\<usuario>\AppData\Local\Temp\claude\C--Users-<usuario>-Git-Pessoal-claude-code-mod-task-tree\381f26f2-893a-491b-ac56-ea3301fc6f30\images\

## Passo 1 (print 52)
- O: no fim do turno, passos pendentes (nunca iniciados) viraram "interrompida". Só tarefas em andamento deveriam. (já enviado à correção)
- Cabeçalho: título "Passo 2" (nunca iniciado) e "2 de 2" com 7 tarefas na visão.

## Passo 2 (prints 53–56)
- P1: durante o processamento, a resumida mostrou um pedido antigo já finalizado ("Por que 3 tarefas em andamento ao mesmo tempo") com 5 cartões antigos (correcao-regressao ×4, governanca) — sessões que não deviam aparecer; sumiram depois, conforme as tarefas andaram.
- P2: o cartão da docs-task-tree ("Passo 2 filha", mensagem enviada pela tarefa "Passo 2") apareceu sob "Passo 3: duas sessões em paralelo".
- P3: "Passo 3" apareceu concluído (✓ 1/1) sem nunca ter sido iniciado nem fechado.
- P4: o cartão da correção (mensagem do bug O, enviada quando nenhuma tarefa estava em andamento, antes do start do Passo 2) apareceu sob "Passo 2".
- P5: cabeçalho "Passo 4: duas sessões em sequência" (nunca iniciado), "17 de 17 · 100%" e depois "7 de 12 · 58%"; "2 interrompidas" contando Passo 4 e 5 pendentes.

## Passo 3 (prints 57–58)
- P6 (confirma P2/P4): o cartão da correcao-regressao NÃO devia estar sob "Passo 2". A mensagem do bug O foi enviada sem nenhuma tarefa em andamento (antes do start do Passo 2); o Passo 2 mandou mensagem só à docs. E o cartão "Passo 2 filha" da docs, que é do Passo 2, está sob o Passo 3 (ao lado dos cartões Paralelo A/B, que são do Passo 3). Os cartões parecem deslocados uma tarefa para baixo (âncora = tarefa seguinte, ou a tarefa em andamento quando a entrega/turno começa, em vez da que enviou).
- P7: "Passo 4: duas sessões em sequência" aparece em andamento (◉, relógio 3:30) sem nunca ter sido iniciado; no print anterior estava pendente (○).
- Paralelo A e B: os dois cartões no mesmo nível, andando juntos — correto.

## Passo 4 (print 59)
- P8: durante a edição da correção (bug O), o app avisou "reload failed" em hooks/prompt-submit.ts linha 20 `await wake($)` ($ passado a função não declarada no topo nem importada de arquivo do mod); a versão anterior ficou carregada e em seguida recarregou com "11 hooks" (eram 14?). Edição no clone deixa o mod num estado intermediário visível ao usuário.

## Passo 4 resultado (prints 60–61)
- Correto: sob "Passo 4" os cartões docs ("Sequência 1" + "Avisar a svg-task-tree") e depois svg ("Sequência 2"), no mesmo nível, na ordem de execução, sem aninhar; ↩ certos.
- Correto (já com a correção do bug O em andamento no clone): "Passo 5" segue pendente (○), não interrompida; título do cabeçalho "Passo 4" = última iniciada.
- Persistem P2/P6: "Passo 2 filha" (docs) sob o Passo 3; cartão da correção sob o Passo 2.
- Novo P9: o nível 1 "Teste passo a passo com prints" mostra um ícone de relógio (🕒) em vez de ◉/✓ — conferir o que esse estado significa (sem fechamento/aguardando?) e se é o esperado para um pedido com tarefa pendente ao fim do turno.

## Passo 5 (prints 62–63)
- REGRA do usuário (substitui a anterior de "guardar só os níveis 1 com algo aberto"): "as tarefas concluídas deveriam ficar do jeito que estão até todas as tarefas estarem concluídas, só então o painel seria resetado com um novo turno; senão, as tarefas vão sendo adicionadas no painel". Ou seja, na resumida: mensagem nova + alguma tarefa ainda aberta em qualquer pedido à vista → NADA sai (concluídas incluídas), o pedido novo é acrescentado embaixo; só quando tudo à vista está concluído a mensagem nova limpa o painel.
- P10: ao "pode seguir", o pedido concluído "Erro de recarga do plugin" (e outros concluídos) sumiu, embora o "Passo 5" ainda estivesse aberto.
- P11: o plano do passo 5 reusou o id "e5" de um nível 1 aberto do pedido anterior: o antigo ficou como "✕ Passo 5 … interrompida" no pedido antigo e o novo nasceu no pedido "Teste passo 5" (comportamento da regra "plan em mensagem nova vai para o pedido novo"). Depois (print 63) aparece um "Passo 5" em andamento (◉ 7:56) sem filhas sob o pedido antigo, e o pedido novo some de vista — dois "Passo 5" disputando o mesmo id; conferir.
- P12: no print 62 o ✉ não aparece em "Mensagem 2/3 na fila" (estão ○) — a orquestradora ainda não as tinha iniciado no momento do print (aceitável); conferir no print final.

## Depois do passo 5 (prints 64–66)
- P13: o pedido "Teste passo 5: lote para sessão ocupada" (com Ocupar/Mensagem 2/Mensagem 3) e os cartões do lote (svg "Lote: ocupado" e "Lote: mensagens 2 e 3") não aparecem em lugar nenhum; só o "✕ Passo 5 … interrompida" antigo.
- P14: o cartão da docs "Hunks do quinto pedido" mostra a subtarefa "Ler o código e o doc" como interrompida dentro de uma tarefa concluída 1/1 (conferir contagem).
- Processo: a correção do bug O seguiu durante o teste porque a orquestradora a mandou no passo 1 (antes da regra "corrigir só no final"); pausada agora.

## Passo 5 do zero (prints 67–68)
- Correto: o cartão "Lote: ocupado" (mensagem 1) aparece sob "Ocupar a svg-task-tree (mensagem 1)", com O1 em andamento.
- Correto pela regra do lote: no pedido anterior "Repetir o passo 5 de novo", o turno da svg que juntou as mensagens dele ficou sob "Mensagem 3 na fila" (a última).
- P15: esse cartão do pedido anterior é de um turno que eu INTERROMPI (stop), mas mostra "Lote: ocupado"/O1 em andamento (◉ 0:59) e "Lote: mensagens 2 e 3" pendente; turno interrompido devia deixar essas tarefas como interrompidas, sem relógio.
- P16: depois (print 68) o pedido anterior sumiu, embora o cartão dele tivesse tarefas abertas (regra: nada sai enquanto houver algo aberto).
- P17: "Mensagem 2/3 na fila" aparecem ✓ concluídas logo após o envio, sem ✉ pendente: a orquestradora chamou done nelas logo após o SendMessage (fluxo natural). O painel devia manter o ✉ até a entrega mesmo com done explícito (não depender de o modelo deixar a tarefa aberta).

## Fim do passo 5 (print 69)
- P18: o pedido "Passo 5 do zero" e o cartão do lote ("Lote: mensagens 2 e 3", que devia ficar sob "Mensagem 3 na fila") NÃO aparecem nas tarefas depois que a svg terminou ("Lote ok"); o painel mostra pedidos mais antigos ("Parar e reverter…", "O passo 5 está correto?") e não o último.
- P19: título do cabeçalho voltou a ser uma tarefa muito antiga: "Abrir a sessão de correção (Fable, esforço médio) e conferir modelo" (5 de 12 · 42%).
- P20: aparecem sob "Reverter o commit 16062cc (governança)" cartões de trabalho que a orquestradora não pediu (correção: "Análise dos bugs do teste visual, sem implementar"; governança: "Registrar o bug e pedir a nova análise…", interrompida) — provavelmente pedidos digitados pelo usuário direto nessas sessões; o cartão cai na última tarefa da mãe que falou com a sessão.
