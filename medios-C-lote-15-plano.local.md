# Lote 15 (triagem C): textos que dizem o que o painel não faz

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

Três achados de mesma causa (texto ao modelo que não bate com o painel) e mesmos arquivos; correção
direta, um commit, só texto e mensagem de recusa:
- "Textos que o modelo lê prometem tooltip com a resposta inteira e 'a primeira frase da resposta' sem
  summary; o painel não faz nenhum dos dois" (a pergunta que sobra é a decisão 38, lote 16).
- "Refazer um pai concluído: três textos diferentes, a recusa do start não diz 'ids novos' e chama de
  'concluída' uma tarefa interrompida".
- "O modelo não é avisado quando o painel fecha ou marca ✕ a tarefa pelos subagentes, e as regras do
  prompt ainda descrevem o comportamento antigo", só na parte da regra escrita (a nota e o done em
  tarefa ✕ são o lote 19).
- Junto, a parte direta do achado da recusa da pergunta: o comentário do modo plano.

Já resolvido e fora: o cabeçalho de `text/rules.ts` que citava teste e golden de textos (PR 38).

## 2. Causa confirmada na ponta

- Escrito, `text/rules.ts:35-37` (regras) e `95-97` (descrição do `summary`): "com a resposta inteira
  no tooltip. Sem ele, o painel usa a primeira frase da resposta" e "a resposta inteira fica no
  tooltip". `hooks/turn.ts:121-141`: sem summary não há linha ↩ (`hasBrief`, `draw/layout.ts:983`); o
  tooltip saiu por decisão de 2026-11-09 (`visual.tooltip`).
- Escrito, comentários que repetem o engano: `text/rules.ts:9-10`, `hooks/turn.ts:27-29` e `128-129`,
  `hooks/tools.ts:176`, `draw/layout.ts:908` e `976-978`.
- Escrito, três textos para o mesmo caso: `text/rules.ts:47-48` ("replaneje o nível 1 com ids novos"),
  `101-102` ("replaneje o nível 1 com plan") e `hooks/tools.ts:216-217` (a recusa "já foi concluída e
  tem subtarefas: replaneje o nível 1 com plan", também para a tarefa interrompida: a condição é
  `status !== 'open'`). O caminho que funciona sem replano (start nas subtarefas, que reabre os pais,
  `state/tasks.ts:120-134`) não aparece na recusa.
- Escrito, `text/rules.ts:63-64`: "Subagentes que usam o painel ganham um grupo próprio". O cartão
  existe desde o lançamento (`hooks/agents.ts:64-99`) e a tarefa de origem fecha sozinha no fim do
  turno (`settleBySubs`, `hooks/agents.ts:267-308`; decisões de 2026-11-09).
- Escrito, `hooks/tool-call.ts:53-54`: o comentário diz que o ExitPlanMode passa porque "plan mode may
  hold the panel's tools"; o documento diz que o ExitPlanMode livre é o desenho original.

## 3. O que muda

`text/rules.ts` (todo texto novo ao modelo fica aqui):
- Regras, item do summary: "…: é a linha ↩ do painel. Sem ele, o pedido fica sem linha ↩."
- Descrição do `summary`: "… É a linha ↩ do painel; sem ele, o pedido fica sem linha ↩."
- Um texto só para refazer um pai fechado, usado nos três lugares: "para refazer um pai concluído,
  chame start nas subtarefas a refazer (isso reabre os pais), ou replaneje com ids novos". Nas regras
  (linhas 47-48) e na descrição do `start` (101-102) entra essa frase; a recusa vira uma função daqui,
  com o id e o estado real: `"<id>" já foi concluída e tem subtarefas: …` ou `"<id>" foi interrompida
  e tem subtarefas: …`, seguida da mesma frase. O trecho "já foi concluída e tem subtarefas" fica (o
  teste existente o confere).
- Regra dos subagentes (linhas 63-64), texto novo: "Cada subagente lançado (Agent) aparece como um
  cartão embaixo da tarefa em andamento no lançamento, com o estado dele; as tarefas que ele planejar
  ficam dentro do cartão. Cada agente só mexe no próprio grupo; o que ele deixar aberto ao terminar
  vira interrompido. Quando todos os subagentes lançados de uma tarefa terminam e o turno acaba, o
  painel fecha a tarefa sozinho: concluída se todos concluíram, interrompida se algum falhou ou foi
  parado; para refazê-la, chame start nela."
- Comentário das linhas 9-10: a linha ↩ é o `summary` do done; sem ele não há linha.

`hooks/tools.ts`: a recusa do start usa a função de `text/rules.ts` com o estado da tarefa; o
comentário da linha 176 é corrigido. `hooks/turn.ts`, `draw/layout.ts`, `hooks/tool-call.ts`: só os
comentários citados.

Em termos do painel: nada muda no desenho. O modelo deixa de contar com um resumo automático (passa a
mandar o summary), recebe na recusa o caminho que funciona, e lê a regra dos subagentes como o painel
se comporta.

## 4. Impacto

`npm run impacto -- text/rules.ts hooks/tools.ts hooks/turn.ts hooks/tool-call.ts draw/layout.ts`:
154 cenários e o golden inteiro, por causa dos comentários em `draw/layout.ts` e `hooks/turn.ts`. A
mudança de comportamento está só em `text/rules.ts` e `hooks/tools.ts`: 44 cenários (pedidos 14,
lembretes 11, árvore 9). Checklist: nada novo.

## 5. Testes de verificação

`tests/lembretes.test.ts` (lendo as regras pelo `prompt.compose` e as descrições pelo `tool.register`,
como os testes das linhas 152-184 já fazem):
- "as regras e a descrição do summary dizem que sem summary o pedido fica sem linha ↩". Regra:
  `lembretes.resumo-e-a-linha-de-resposta`. Afirma, nas regras e na descrição do `summary` (o
  `inputSchema` do `done` capturado no `tool.register`): contém "sem linha ↩"; não contém "tooltip"
  nem "primeira frase". Falha hoje: os dois textos têm "tooltip".
- "as regras dizem que o subagente tem cartão desde o lançamento e que a tarefa fecha sozinha". Regra:
  `lembretes.regra-dos-subagentes`. Afirma nas regras: "aparece como um cartão", "fecha a tarefa
  sozinho", "chame start nela"; não contém "Subagentes que usam o painel". Falha hoje.

`tests/arvore.test.ts`:
- "a recusa do start num pai fechado diz o estado e os dois caminhos". Regra:
  `arvore.start-recusa-pai-concluido`. (1) Pai concluído: a recusa contém "já foi concluída e tem
  subtarefas", "start nas subtarefas" e "ids novos". (2) Pai interrompido: um subagente (`subagente`
  do kit) planeja um pai com filhas e termina (`fimDoSubagente`: o que ficou aberto vira
  interrompido); o start dele no pai responde "foi interrompida e tem subtarefas", sem "já foi
  concluída". Falha hoje: a recusa não diz os caminhos e chama a interrompida de concluída.
- "as regras, a descrição do start e a recusa dizem o mesmo para refazer um pai". Mesma regra: as
  três contêm "chame start nas subtarefas a refazer" e "ids novos". Falha hoje.
- Teste existente "start reabre os pais de uma tarefa concluída e recusa tarefa concluída com
  subtarefas": não muda (os dois trechos que confere ficam).

## 6. Catálogo e selos

`regras/arvore.md`, `arvore.start-recusa-pai-concluido` (texto do "Então" completado; não é decisão
nova, não leva `Reescrito:`): "Então a resposta recusa, diz o estado real dela (concluída ou
interrompida) e os dois caminhos (start nas subtarefas a refazer, que reabre os pais, ou replanejar
com ids novos), e nada muda no painel". A `Origem:` ganha "; texto da recusa completado na auditoria
de 2026-11-10" e o cenário ganha `Código: text/rules.ts`.

`regras/lembretes.md`, novos, `coberto`:

```markdown
### lembretes.resumo-e-a-linha-de-resposta
Os textos ao modelo dizem que a linha ↩ é o summary do done, e que sem ele não há linha ↩.

- Dado as regras do painel e a descrição do summary do done
- Quando o modelo os lê
- Então eles dizem que o summary é a linha ↩ do painel e que, sem ele, o pedido fica sem linha ↩; não prometem tooltip nem resumo tirado da resposta

Origem: auditoria 2026-11-10 (os textos prometiam tooltip e a primeira frase da resposta); aplica visual.tooltip (2026-11-09) e turnos.resumo-sem-resposta-final.
Código: hooks/session-start.ts
Estado: coberto

### lembretes.regra-dos-subagentes
As regras do painel descrevem o cartão do subagente e o fechamento da tarefa pelos subagentes.

- Dado as regras do painel no prompt de sistema
- Quando o modelo as lê
- Então elas dizem que cada subagente lançado tem um cartão sob a tarefa do lançamento, que o que ele deixa aberto vira interrompido, que a tarefa fecha sozinha quando todos terminam e o turno acaba (concluída, ou interrompida se algum falhou ou foi parado) e que o start nela a reabre

Origem: auditoria 2026-11-10 (a regra dizia só "ganham um grupo próprio"); aplica subagentes.cartao-desde-o-lancamento, subagentes.pai-conclui-no-fim-do-turno e subagentes.pai-reflete-falha-ou-interrupcao (decisões de 2026-11-09).
Estado: coberto
```

Selos: `npm run regras:selar -- "task-tree/tests/<arquivo>::<nome>" --tipo novo --motivo "auditoria: textos ao modelo iguais ao painel"`, um por teste novo.

## 7. Documentação

Os comentários citados. `DESENVOLVIMENTO.md`, "Textos para o modelo": no lote 30.

## 8. Golden

Não muda (em `draw/layout.ts` só comentário).

## 9. Checklist do app

Nada a ver na tela. Conferência de uso: num pedido real, o modelo manda o summary no último done.

## 10. Dependências e conflitos

- Primeiro dos lotes de `text/rules.ts` e `hooks/tools.ts` da triagem C (15 a 24): em sequência.
- Triagem A, lote 02 (nível 1 concluído reabre no replano do mesmo pedido) e lote 04 (start num pai
  aberto inicia a primeira subtarefa): mudam as mesmas frases das regras e da descrição do `start`
  (linhas 46-48 e 98-102). A frase única daqui vale para o pai fechado; quem vier depois junta com a
  regra nova do pai aberto e do replano.
- Triagem A, lote 14 (o plan adota carta e cartão criados antes; "as regras pedem planejar antes de
  abrir sessão ou lançar subagente") e triagem B, lotes 08 (relançar depois de falha), 09 (fim depois
  do Esc) e 15 (tarefa com subagente rodando em andamento): tocam a mesma regra dos subagentes. O
  texto daqui descreve o comportamento da ponta; cada um desses lotes ajusta a frase que muda.
- Triagem B, lotes 01 e 02: outras frases de `text/rules.ts` (envios).
- Lote 16 daqui tira o campo da resposta inteira, cujos comentários este lote corrige.

## 11. Bloqueio

Nenhum.
