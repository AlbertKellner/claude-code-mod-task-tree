# Implementação: toks/s como o Savvy (2026-11-10)

Commit 8688fab na feat/toks-como-savvy (de origin/main), hook verde: 160 testes, regressão ok. Golden igual. Sem push.

## O que mudou
- hooks/turn.ts: turnStep itera os chunks; speedOf(tokens, ms) com MIN_TOKENS 20, MIN_MS 500, MAX_TOKS 1000; o número é o do último passo válido; saem samples/rateOf/RATE_WINDOW; fim do turno não mexe no número (fica aceso, live).
- hooks/agents.ts: subStep recebe o toks já medido; sai a média por agente; THROTTLE mantido.
- regras/taxa.md (área nova): velocidade-de-geracao, filtros, fim-do-turno-fica-aceso, subagente-mesma-medida.
- Kit: passos(on, relogio) em ambiente.ts (turn.step com stream; o harness exige as quatro contagens no usage). Selado.
- Nenhum cenário ou teste selado protegia o esmaecido: nenhum Reescrito necessário.

## Não verificado
- No app, lado a lado com o Savvy. Filhas com o mod antigo publicam live:false até recarregar (esmaecidas).

## npm run testes:alterados
```
Testes existentes alterados desde a base do PR (origin/): nenhum

Novos: task-tree/tests/taxa.test.ts::o toks/s conta só do primeiro chunk ao stop | task-tree/tests/taxa.test.ts::o número é o do último passo válido; poucos tokens, pouco tempo ou rápido demais não o mudam | task-tree/tests/taxa.test.ts::no fim do turno o último número fica aceso, sem "(último turno)" | task-tree/tests/taxa.test.ts::o cartão de subagente mostra a velocidade dele pela mesma regra
```

## npm run impacto -- --base origin/main
```
Arquivos do mod tocados: hooks/agents.ts, hooks/turn.ts
Cenários afetados (37):
  durabilidade.fim-do-turno-sobrevive-ao-reinicio     coberto   task-tree/tests/durabilidade.test.ts: 6 testes
  durabilidade.resumo-do-done-na-recarga              coberto   task-tree/tests/durabilidade.test.ts: 2 testes
  lembretes.replanejar-apos-esc-pessoa                coberto   task-tree/tests/lembretes.test.ts: 1 teste
  lembretes.fim-normal-lista-abertas                  coberto   task-tree/tests/lembretes.test.ts: 1 teste
  lembretes.outra-sessao-apos-esc                     coberto   task-tree/tests/lembretes.test.ts: 1 teste
  lembretes.esc-sem-abertas                           coberto   task-tree/tests/lembretes.test.ts: 1 teste
  lembretes.replanejar-vale-uma-vez                   coberto   task-tree/tests/lembretes.test.ts: 1 teste
  lembretes.primeira-chamada-sem-plano                coberto   task-tree/tests/lembretes.test.ts: 1 teste
  lembretes.regras-no-prompt-de-sistema               coberto   task-tree/tests/lembretes.test.ts: 1 teste
  subagentes.cartao-desde-o-lancamento                coberto   task-tree/tests/subagentes.test.ts: 3 testes
  subagentes.cartao-mostra-modelo-e-estado            coberto   task-tree/tests/subagentes.test.ts: 2 testes
  subagentes.corpo-e-as-tarefas-ou-a-ferramenta       coberto   task-tree/tests/subagentes.test.ts: 2 testes
  subagentes.terminado-segue-cartao                   coberto   task-tree/tests/subagentes.test.ts: 1 teste
  subagentes.varios-juntos-num-cartao-de-grupo        coberto   task-tree/tests/subagentes.test.ts: 2 testes
  subagentes.fora-da-contagem                         coberto   task-tree/tests/subagentes.test.ts: 1 teste
  subagentes.na-filha                                 coberto   task-tree/tests/subagentes.test.ts: 1 teste
  subagentes.cartao-no-app                            checklist —
  subagentes.pai-conclui-no-fim-do-turno              coberto   task-tree/tests/subagentes.test.ts: 3 testes
  subagentes.pai-reflete-falha-ou-interrupcao         coberto   task-tree/tests/subagentes.test.ts: 1 teste
  subagentes.um-rodando-mantem-o-pai                  coberto   task-tree/tests/subagentes.test.ts: 2 testes
  taxa.velocidade-de-geracao                          coberto   task-tree/tests/taxa.test.ts: 2 testes
  taxa.filtros                                        coberto   task-tree/tests/taxa.test.ts: 1 teste
  taxa.fim-do-turno-fica-aceso                        coberto   task-tree/tests/taxa.test.ts: 1 teste
  taxa.subagente-mesma-medida                         coberto   task-tree/tests/taxa.test.ts: 1 teste
  turnos.iniciada-aguarda-no-fim                      coberto   task-tree/tests/turnos.test.ts: 2 testes
  turnos.pendentes-seguem-pendentes                   coberto   task-tree/tests/turnos.test.ts: 3 testes
  turnos.pai-e-pedido-aguardam-no-fim                 coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.esc-interrompe-so-a-iniciada                 coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.prompt-seguinte-retoma                       coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.pedido-anterior-parado-aguarda               coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.continuacao-sem-start-aguarda                coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.pai-com-filha-concluida-nunca-interrompido   coberto   task-tree/tests/pedidos.test.ts: 1 teste
  turnos.subagente-que-termina-interrompe             coberto   task-tree/tests/turnos.test.ts: 2 testes
  turnos.prompt-sem-turno                             coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.notificacao-de-tarefa-sem-turno              coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.resumo-sem-resposta-final                    coberto   task-tree/tests/turnos.test.ts: 1 teste
  turnos.resumo-sem-seta-duplicada                    coberto   task-tree/tests/turnos.test.ts: 1 teste
Checklist do app: subagentes.cartao-no-app
Golden: nenhum cenário
Fora do mapa: nenhum
O impacto orienta o que ler, citar e validar no app; o check roda todos os testes.
```
