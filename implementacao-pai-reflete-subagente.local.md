# Implementação: tarefa pai reflete o subagente (2026-11-09)

Sem commit. Check verde: 156 testes, regressão ok; golden igual (os 3 aprovados passaram; "subagente" segue sem desenho aprovado).

## O que mudou
- hooks/agents.ts: settleBySubs. No fim do turno principal (não parado) e no fim de subagente depois do turno, a folha aberta (iniciada ou pendente) cujos subagentes terminaram todos, sem sessão viva, carta na fila nem pergunta aberta nela, fecha: ✓ se todos concluídos; ✕ "falhou" se algum falhou; ✕ "interrompida" se algum foi interrompido (vale o pior). Pais pela regra de sempre (settle).
- types: TaskNode.failed; draw/layout.ts: a palavra "falhou" no lugar de "interrompida" quando failed.
- hooks/turn.ts: chama settleBySubs depois de gravar turnEnded.
- Catálogo: subagentes.pai-conclui-no-fim-do-turno, subagentes.pai-reflete-falha-ou-interrupcao, subagentes.um-rodando-mantem-o-pai (novos); Reescrito em turnos.iniciada-aguarda-no-fim.
- Testes novos (selados): 5 em subagentes.test.ts. Nenhum teste existente mudou.

## Observação
- Com a tarefa ✓, o cartão do subagente some com ela: é a regra que já valia para os grupos (só sob tarefa aberta). Não mudei.

## Não verificado
- O app: a tarefa fechando no fim do turno real, e a palavra "falhou" desenhada.

## npm run testes:alterados
```
Testes existentes alterados desde HEAD: nenhum

Novos: task-tree/tests/envios.test.ts::com duas em andamento, a carta vai à tarefa com uma palavra do nome da sessão; palavra das duas, pela ordem | task-tree/tests/golden.test.ts::golden: subagente | task-tree/tests/subagentes.test.ts::lançado um subagente, o cartão aparece sob a tarefa em andamento, com o modelo e "trabalhando" | task-tree/tests/subagentes.test.ts::sem usar o painel, o cartão mostra a ferramenta em uso e quantas chamadas fez | task-tree/tests/subagentes.test.ts::o subagente que usa o painel mostra as tarefas dele no cartão | task-tree/tests/subagentes.test.ts::terminado, o cartão segue com "concluído"; com erro, "falhou"; parado, "interrompido" | task-tree/tests/subagentes.test.ts::mais de três lançados juntos ficam num cartão de grupo, uma linha por agente; três, cada um no seu | task-tree/tests/subagentes.test.ts::os agentes de um workflow ficam num cartão "Workflow · N agentes" | task-tree/tests/subagentes.test.ts::o subagente não entra no "d de n" e ganha a pílula de subagentes | task-tree/tests/subagentes.test.ts::o subagente de uma filha aparece dentro do cartão dela | task-tree/tests/subagentes.test.ts::com duas em andamento, o subagente vai à primeira e a carta seguinte à segunda | task-tree/tests/subagentes.test.ts::sem nada em andamento, o cartão vai à pendente do pedido atual | task-tree/tests/subagentes.test.ts::o subagente concluído fecha a tarefa de onde saiu no fim do turno; o pai e a contagem seguem | task-tree/tests/subagentes.test.ts::lançado de uma pendente (sem start), o subagente concluído fecha a pendente também | task-tree/tests/subagentes.test.ts::com um ainda rodando, a tarefa não fecha; o último, terminando depois do turno, a fecha | task-tree/tests/subagentes.test.ts::com uma carta na fila na mesma tarefa, o subagente concluído não a fecha | task-tree/tests/subagentes.test.ts::o subagente que falhou deixa a tarefa ✕ "falhou"; o interrompido, ✕ "interrompida"; misto, o pior
```

## npm run impacto
```
Arquivos do mod tocados: draw/layout.ts, draw/svg.ts, hooks/panel.ts, hooks/register.tsx, hooks/render.tsx, hooks/sessions.ts, hooks/tool-call.ts, hooks/turn.ts, types/index.d.ts, hooks/agents.ts
Núcleo tocado (hooks/register.tsx, hooks/render.tsx, types/index.d.ts): todos os cenários cobertos (o check roda todos)
Cenários afetados (128):
  arvore.pai-fecha-com-os-filhos                                 coberto   task-tree/tests/arvore.test.ts: 1 teste
  arvore.start-reabre-pais                                       coberto   task-tree/tests/arvore.test.ts: 1 teste
  arvore.start-recusa-pai-concluido                              coberto   task-tree/tests/arvore.test.ts: 1 teste
  arvore.sem-start-nada-acende                                   coberto   task-tree/tests/turnos.test.ts: 1 teste
  arvore.pai-em-andamento-no-caminho-da-ultima-iniciada          coberto   task-tree/tests/arvore.test.ts: 1 teste
  arvore.ids-curtos-e-avisos                                     coberto   task-tree/tests/arvore.test.ts: 1 teste
  arvore.done-sem-summary-e-varias-sem-start                     coberto   task-tree/tests/arvore.test.ts: 1 teste
  arvore.plan-recusa-ids-repetidos                               coberto   task-tree/tests/arvore.test.ts: 1 teste
  arvore.pai-fecha-com-nada-aberto-embaixo                       coberto   task-tree/tests/pedidos.test.ts: 3 testes
  cabecalho.numeros-somam-o-desenhado                            coberto   task-tree/tests/cabecalho.test.ts: 1 teste
  cabecalho.resumida-exclui-pedido-finalizado                    coberto   task-tree/tests/cabecalho.test.ts: 1 teste
  cabecalho.resumida-limpa-so-com-tudo-concluido                 coberto   task-tree/tests/cabecalho.test.ts: 1 teste
  cabecalho.interrompida-fora-do-total                           coberto   task-tree/tests/cabecalho.test.ts: 1 teste
  cabecalho.chips-contam-folhas                                  coberto   task-tree/tests/cabecalho.test.ts: 1 teste
  cabecalho.aviso-de-painel-grande-volta                         checklist —
  cabecalho.limites-de-linhas                                    coberto   task-tree/tests/cabecalho.test.ts: 1 teste; task-tree/tests/sessoes.test.ts: 1 teste
  cabecalho.limite-de-cartoes-antigos                            coberto   task-tree/tests/cabecalho.test.ts: 1 teste
  cabecalho.limite-de-linhas-do-desenho                          coberto   task-tree/tests/cabecalho.test.ts: 2 testes
  cabecalho.titulo-e-a-ultima-iniciada                           coberto   task-tree/tests/cabecalho.test.ts: 1 teste
  cabecalho.titulo-desempata-pela-ordem-do-start                 coberto   task-tree/tests/cabecalho.test.ts: 1 teste
  cabecalho.historico-abre-com-clique                            coberto   task-tree/tests/cabecalho.test.ts: 1 teste
  cabecalho.historico-guarda-o-que-saiu                          coberto   task-tree/tests/sessoes.test.ts: 1 teste
  durabilidade.reinicio-restaura-do-store                        coberto   task-tree/tests/durabilidade.test.ts: 4 testes
  durabilidade.respawn-sem-session-start                         coberto   task-tree/tests/durabilidade.test.ts: 2 testes
  durabilidade.fim-do-turno-sobrevive-ao-reinicio                coberto   task-tree/tests/durabilidade.test.ts: 6 testes
  durabilidade.clear-esvazia                                     coberto   task-tree/tests/durabilidade.test.ts: 1 teste
  durabilidade.formatos-antigos-do-publicado                     coberto   task-tree/tests/durabilidade.test.ts: 1 teste
  durabilidade.recarga-mantem-painel-ligacoes-e-resumo           coberto   task-tree/tests/durabilidade.test.ts: 6 testes
  durabilidade.ligacoes-com-lista-parcial-do-host                coberto   task-tree/tests/durabilidade.test.ts: 1 teste
  durabilidade.resumo-do-done-na-recarga                         coberto   task-tree/tests/durabilidade.test.ts: 2 testes
  envios.fica-ate-entrega                                        coberto   task-tree/tests/envios.test.ts: 2 testes
  envios.entrega-imediata-fica-verde                             coberto   task-tree/tests/envios.test.ts: 2 testes
  envios.esc-apos-entrega-imediata                               coberto   task-tree/tests/envios.test.ts: 1 teste
  envios.cor-por-estado                                          coberto   task-tree/tests/envios.test.ts: 2 testes
  envios.ancora-no-lote-recente                                  coberto   task-tree/tests/envios.test.ts: 3 testes
  envios.sem-andamento-vai-a-pendente-planejada-por-ultimo       coberto   task-tree/tests/envios.test.ts: 2 testes
  envios.carta-pelo-nome-da-sessao                               coberto   task-tree/tests/envios.test.ts: 3 testes
  envios.fila-nao-interrompe-no-fim-do-turno                     coberto   task-tree/tests/envios.test.ts: 1 teste
  envios.pedido-recebido-mostra-carta                            coberto   task-tree/tests/envios.test.ts: 3 testes
  envios.carta-sob-a-tarefa                                      coberto   task-tree/tests/envios.test.ts: 1 teste
  envios.tarefa-aguarda-a-sessao-enquanto-a-carta-esta-na-fila   coberto   task-tree/tests/envios.test.ts: 1 teste
  fumaca.plan-mostra-tarefa                                      coberto   task-tree/tests/fumaca.test.ts: 1 teste
  lembretes.replanejar-apos-esc-pessoa                           coberto   task-tree/tests/lembretes.test.ts: 1 teste
  lembretes.fim-normal-lista-abertas                             coberto   task-tree/tests/lembretes.test.ts: 1 teste
  lembretes.outra-sessao-apos-esc                                coberto   task-tree/tests/lembretes.test.ts: 1 teste
  lembretes.esc-sem-abertas                                      coberto   task-tree/tests/lembretes.test.ts: 1 teste
  lembretes.replanejar-vale-uma-vez                              coberto   task-tree/tests/lembretes.test.ts: 1 teste
  lembretes.primeira-chamada-sem-plano                           coberto   task-tree/tests/lembretes.test.ts: 1 teste
  lembretes.regras-no-prompt-de-sistema                          coberto   task-tree/tests/lembretes.test.ts: 1 teste
  pedidos.titulo-vem-do-request                                  coberto   task-tree/tests/pedidos.test.ts: 1 teste
  pedidos.uma-mensagem-um-pedido                                 coberto   task-tree/tests/pedidos.test.ts: 1 teste
  pedidos.aviso-do-app-nao-abre-pedido                           coberto   task-tree/tests/pedidos.test.ts: 1 teste
  pedidos.replano-no-lugar                                       coberto   task-tree/tests/pedidos.test.ts: 1 teste
  pedidos.replano-preserva-estado                                coberto   task-tree/tests/pedidos.test.ts: 4 testes
  pedidos.replano-mantem-envio-ate-entrega                       coberto   task-tree/tests/envios.test.ts: 1 teste
  pedidos.plano-anterior-vira-historico                          coberto   task-tree/tests/pedidos.test.ts: 1 teste
  pedidos.nivel1-concluido-e-historico                           coberto   task-tree/tests/pedidos.test.ts: 1 teste
  pedidos.rodada-descartada-nao-segura-a-visao                   coberto   task-tree/tests/sessoes.test.ts: 1 teste
  pedidos.resumida-mantem-anteriores-com-algo-aberto             coberto   task-tree/tests/cabecalho.test.ts: 1 teste
  perguntas.sem-tarefa-recusada                                  coberto   task-tree/tests/perguntas.test.ts: 1 teste
  perguntas.espera-sob-a-tarefa                                  coberto   task-tree/tests/perguntas.test.ts: 1 teste
  perguntas.resposta-por-opcao-tira-espera                       coberto   task-tree/tests/perguntas.test.ts: 1 teste
  perguntas.resposta-pelo-chat-tira-espera                       coberto   task-tree/tests/perguntas.test.ts: 1 teste
  perguntas.exitplanmode-espera                                  coberto   task-tree/tests/perguntas.test.ts: 1 teste
  perguntas.escolha-do-wrapup-ate-proxima-mensagem               coberto   task-tree/tests/perguntas.test.ts: 1 teste
  perguntas.permissao-espera                                     coberto   task-tree/tests/perguntas.test.ts: 1 teste
  sessoes.cartao-sob-a-tarefa-de-origem                          coberto   task-tree/tests/sessoes.test.ts: 2 testes
  sessoes.palavra-de-estado-do-cartao                            coberto   task-tree/tests/sessoes.test.ts: 4 testes
  sessoes.um-cartao-por-mensagem                                 coberto   task-tree/tests/sessoes.test.ts: 1 teste
  sessoes.cadeia-sem-cartao-dentro-de-cartao                     coberto   task-tree/tests/sessoes.test.ts: 1 teste
  sessoes.mensagem-entre-filhas-no-cartao-da-remetente           coberto   task-tree/tests/sessoes.test.ts: 1 teste
  sessoes.filha-trabalhando-mantem-pais-em-andamento             coberto   task-tree/tests/sessoes.test.ts: 1 teste
  sessoes.filha-parada-com-origem-fechada-sai-da-contagem        coberto   task-tree/tests/sessoes.test.ts: 7 testes
  sessoes.filha-parada-pendentes-seguem-pendentes                coberto   task-tree/tests/sessoes.test.ts: 1 teste
  sessoes.filha-arquivada-interrompe                             coberto   task-tree/tests/sessoes.test.ts: 1 teste
  sessoes.rodada-descartada-fora-da-contagem                     coberto   task-tree/tests/sessoes.test.ts: 2 testes
  sessoes.rodada-descartada-fora-da-contagem-do-pai              coberto   task-tree/tests/sessoes.test.ts: 1 teste
  sessoes.busto-so-no-pai                                        coberto   task-tree/tests/sessoes.test.ts: 1 teste
  sessoes.pasta-sem-git                                          coberto   task-tree/tests/sessoes.test.ts: 1 teste
  sessoes.toks-e-repo-branch-no-cartao                           coberto   task-tree/tests/sessoes.test.ts: 1 teste
  sessoes.mensagens-juntas-vao-a-ultima                          coberto   task-tree/tests/sessoes.test.ts: 1 teste
  sessoes.pedido-recebido-aparece-no-cartao                      coberto   task-tree/tests/sessoes.test.ts: 1 teste
  sessoes.turno-proprio-da-filha-no-pedido-vigente               coberto   task-tree/tests/sessoes.test.ts: 2 testes
  sessoes.cartao-vivo-nunca-some                                 coberto   task-tree/tests/sessoes.test.ts: 1 teste
  subagentes.cartao-desde-o-lancamento                           coberto   task-tree/tests/subagentes.test.ts: 3 testes
  subagentes.cartao-mostra-modelo-e-estado                       coberto   task-tree/tests/subagentes.test.ts: 2 testes
  subagentes.corpo-e-as-tarefas-ou-a-ferramenta                  coberto   task-tree/tests/subagentes.test.ts: 2 testes
  subagentes.terminado-segue-cartao                              coberto   task-tree/tests/subagentes.test.ts: 1 teste
  subagentes.varios-juntos-num-cartao-de-grupo                   coberto   task-tree/tests/subagentes.test.ts: 2 testes
  subagentes.fora-da-contagem                                    coberto   task-tree/tests/subagentes.test.ts: 1 teste
  subagentes.na-filha                                            coberto   task-tree/tests/subagentes.test.ts: 1 teste
  subagentes.cartao-no-app                                       checklist —
  subagentes.pai-conclui-no-fim-do-turno                         coberto   task-tree/tests/subagentes.test.ts: 3 testes
  subagentes.pai-reflete-falha-ou-interrupcao                    coberto   task-tree/tests/subagentes.test.ts: 1 teste
  subagentes.um-rodando-mantem-o-pai                             coberto   task-tree/tests/subagentes.test.ts: 2 testes
  turnos.iniciada-aguarda-no-fim                                 coberto   task-tree/tests/turnos.test.ts: 2 testes
  turnos.pendentes-seguem-pendentes                              coberto   task-tree/tests/turnos.test.ts: 3 testes
  turnos.pai-e-pedido-aguardam-no-fim                            coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.esc-interrompe-so-a-iniciada                            coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.prompt-seguinte-retoma                                  coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.pedido-anterior-parado-aguarda                          coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.continuacao-sem-start-aguarda                           coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.pai-com-filha-concluida-nunca-interrompido              coberto   task-tree/tests/pedidos.test.ts: 1 teste
  turnos.subagente-que-termina-interrompe                        coberto   task-tree/tests/turnos.test.ts: 2 testes
  turnos.prompt-sem-turno                                        coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.notificacao-de-tarefa-sem-turno                         coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.resumo-sem-resposta-final                               coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.resumo-sem-seta-duplicada                               coberto   task-tree/tests/turnos.test.ts: 1 teste
  visual.largura-real                                            checklist —
  visual.cliques-no-icone-e-no-anel                              checklist —
  visual.tooltip                                                 coberto   task-tree/tests/visual.test.ts: 1 teste
  visual.titulo-sem-contagem-vai-ate-o-tempo                     coberto   task-tree/tests/visual.test.ts: 3 testes
  visual.animacao-de-linha-nova                                  checklist —
  visual.cores-dos-temas                                         checklist —
  visual.cabecalho-em-cartao                                     checklist —
  visual.status-embaixo-da-caixa                                 checklist —
  visual.cartao-modelo-e-esforco                                 checklist —
  visual.cartao-posicao-de-toks-e-repo                           checklist —
  visual.cartoes-ordem-e-espera                                  checklist —
  visual.recarga-real-e-respawn                                  checklist —
  visual.cabecalho-barra-e-chips-desenhados                      checklist —
  visual.golden-gera-desenho                                     coberto   task-tree/tests/golden.test.ts: 4 testes
  visual.desenho-principal                                       coberto   task-tree/tests/golden.test.ts: 1 teste
  visual.desenho-cartao-filha                                    coberto   task-tree/tests/golden.test.ts: 1 teste
  visual.desenho-envios                                          coberto   task-tree/tests/golden.test.ts: 1 teste
  visual.desenho-subagente                                       coberto   task-tree/tests/golden.test.ts: 1 teste
  visual.faixa-de-estado-geral                                   coberto   task-tree/tests/visual.test.ts: 2 testes
  visual.secao-sem-traco                                         checklist —
Checklist do app: cabecalho.aviso-de-painel-grande-volta, subagentes.cartao-no-app, visual.largura-real, visual.cliques-no-icone-e-no-anel, visual.animacao-de-linha-nova, visual.cores-dos-temas, visual.cabecalho-em-cartao, visual.status-embaixo-da-caixa, visual.cartao-modelo-e-esforco, visual.cartao-posicao-de-toks-e-repo, visual.cartoes-ordem-e-espera, visual.recarga-real-e-respawn, visual.cabecalho-barra-e-chips-desenhados, visual.secao-sem-traco
Golden: visual.desenho-principal, visual.desenho-cartao-filha, visual.desenho-envios, visual.desenho-subagente
Fora do mapa: nenhum
O impacto orienta o que ler, citar e validar no app; o check roda todos os testes.
```
