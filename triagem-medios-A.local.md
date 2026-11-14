# Triagem dos achados médios da auditoria, parte A

Data: 2026-11-13. Só leitura: nada foi alterado no repositório, e nenhum teste nem check foi rodado.

- Áreas: "Planejamento e estado das tarefas (plan, start, done)" (6 médios), "Turnos, pedidos e
  perguntas" (12 médios) e "Sessões filhas e cartões" (21 médios). Total: 39 achados.
- Conferido contra o código da branch `fix/pendencias-auditoria`, ponta `1f9e8c1` (igual ao `main`,
  já com os PRs 36 e 37), o catálogo `regras/` e os três arquivos de decisões da orquestradora.
- Os caminhos de arquivo abaixo são relativos a `task-tree/`, salvo `regras/`.

## Resultado

| Classe | Achados |
|---|---|
| Resolvido ou obsoleto | 1 |
| Correção direta | 15 (14 correções: dois achados são a mesma causa) |
| Decisão do usuário | 17 |
| Não confirmado | 6 |

Achados divididos (contados pela parte principal):
- Três achados de decisão têm uma parte que pode ir direto: a contagem dupla no chip de sessões, a
  espera do wrap_up criada antes de a chamada dar certo e a higiene da leitura de filhas arquivadas.
- Dois achados de decisão têm uma parte já resolvida pelo PR 36: a tarefa parada com Esc (segue ✕ até
  o start) e o cartão do subagente em segundo plano (não some mais).
- Um achado de correção direta (classificação do prompt pelo texto) tem uma parte não confirmada.

---

# Planejamento e estado das tarefas (plan, start, done)

## A dobra de uma tarefa é guardada pelo id; id reusado em pedido novo herda a dobra da tarefa antiga

**Classe: correção direta.** Tamanho: pequeno a médio.

- De pé. A chave da dobra é o escopo fixo mais `t:<id>` (`draw/layout.ts:1094` e `1126`); as dobras
  ficam no átomo `collapsed` e `setFold` só acrescenta chaves (`hooks/render.tsx:22-24`); o plan
  renomeia a tarefa antiga para `tag:id` (`hooks/tools.ts:55`) e `renameAnchors` não toca nas dobras
  (`hooks/panel.ts:672-686`); o `/clear` não limpa as dobras (`hooks/session-start.ts:72-78`).
- Comportamento errado no painel: você recolhe o nível 1 "1" de um pedido; no pedido seguinte o
  modelo planeja outro "1" e a tarefa nova nasce recolhida, escondendo o trabalho atual, enquanto a
  antiga (agora histórico) volta aberta. Depois de um `/clear`, o plano novo também herda dobras.
- Correção: quando o plan renomeia um nível 1, levar junto as chaves de dobra dele e das subtarefas
  (a tarefa nova nasce aberta e a antiga fica como você a deixou), e limpar as dobras no `/clear`.
  Preferir renomear as chaves guardadas a mudar a composição da chave: a chave da linha entra na árvore
  do golden, e mudar a composição alteraria os 4 cenários aprovados.
- Não contraria decisão: aplica "se eu quiser, eu mesmo colapso" (nada recolhe sozinho,
  `draw/layout.ts:1043-1044`).
- Arquivos: `hooks/render.tsx` (o átomo), `hooks/tools.ts` ou `hooks/panel.ts`, `hooks/session-start.ts`,
  `regras/pedidos.md` (cenário novo), teste em `tests/pedidos.test.ts` (ou `checklist`, se o kit não
  alcançar o clique da dobra).
- Fora desta correção: dentro do cartão de uma filha a chave também é por id, e a renomeação
  acontece na sessão filha; fica como está.

## Id curto de tarefa fechada colide com as tarefas de histórico renomeadas

**Classe: correção direta.** Tamanho: pequeno.

- De pé. `resolve` casa por `id` ou por `short` em todas as tarefas do grupo (`state/tasks.ts:32-46`), e
  a renomeação do plan troca só o `id`, mantendo o `short` (`hooks/tools.ts:55`).
- Comportamento errado no painel: (a) depois de reusar o id "1" em dois pedidos, `start ["1.1"]` numa
  tarefa concluída responde "é ambíguo, use "ab12:1/1.1" ou "1/1.1"", expondo o id interno do
  histórico; (b) `start ["1.3"]`, quando só o plano antigo tinha 1.3, reabre a tarefa do histórico e os
  pais dela, e o pedido antigo volta ao painel em andamento; (c) com a tarefa atual "1" interrompida
  (subagente que falhou) e uma de histórico concluída, `start ["1"]` reabre a de histórico.
- Correção: as tarefas renomeadas de histórico (id com o prefixo `tag:`) saem do conjunto do id curto e
  passam a responder só pelo id completo; a ordem atual (a aberta vence, depois concluída, depois
  interrompida) não muda.
- Não contraria decisão: mantém a ordem registrada em `state/tasks.ts:34-35` ("a tarefa aberta vence").
  O teste de `arvore.ids-curtos-e-avisos` (`tests/arvore.test.ts:75`) usa dois planos do mesmo pedido,
  sem histórico, e segue valendo.
- Arquivos: `state/tasks.ts`, `tests/arvore.test.ts` (start e done com id curto que só existe no
  histórico), `regras/arvore.md`.

## Nível 1 que fechou sozinho e é replanejado com o mesmo id no mesmo pedido vira duplicata

**Classe: decisão do usuário.**

- De pé: `replanned` exige a tarefa aberta (`hooks/tools.ts:62`), então o nível 1 que fechou sozinho é
  renomeado e o plano novo entra inteiro pendente ao lado.
- Decisão registrada que a correção contraria: `pedidos.nivel1-concluido-e-historico` ("Um nível 1
  concluído fica como histórico"; origem: regra do painel desde a entrada do mod, 465b09e, 2026-10-20,
  sem palavras suas), coberto por teste selado (`tests/pedidos.test.ts:200`), e as regras ao modelo
  dizem o mesmo (`text/rules.ts:46-48`).

**Pergunta:** No mesmo pedido, um nível 1 fecha sozinho porque todos os passos dele ficaram ✓, e o
modelo chama plan de novo com o mesmo id e um passo a mais. O que o painel deve mostrar?

1. **Reabre mantendo os ✓ (Recomendado):** o mesmo nível 1 volta a aberto, os passos concluídos seguem
   ✓ e só o passo novo nasce ○; cartões e cartas seguem sob as tarefas. É o que já acontece com um pai
   abaixo do nível 1. Para refazer um passo, o modelo usa um id novo.
2. **Como hoje:** o nível 1 ✓ fica como histórico e aparece ao lado um segundo nível 1 com o mesmo
   título, todo pendente (por exemplo 0/4); o modelo precisa fechar de novo os passos já feitos.

## start num pai aberto acende a primeira folha sem ela ter sido iniciada, e o cabeçalho diz o contrário da linha

**Classe: decisão do usuário** (escolha de produto; as duas saídas mudam o que aparece).

- De pé: `startTool` só recusa pai concluído (`hooks/tools.ts:216-222`); `begin` marca só o pai
  (`state/tasks.ts:120-133`); `current` acende a primeira folha aberta dele (`draw/layout.ts:683-696`); o
  chip "em andamento" conta folhas com `startedAt` (`hooks/render.tsx:280`), então a folha acesa entra
  como pendente, e no fim do turno ela volta a ○ (o `halt` só olha folha iniciada). `Row.active`
  (`draw/layout.ts:1122`) não é lido por ninguém.
- Regra que toca: `arvore.sem-start-nada-acende` ("sem start, nada aceso", 2026-10-23), que não previu
  o start num pai. A decisão de 2026-11-12 já fala em "pai iniciado diretamente"
  (`turnos.parada-segue-interrompida-ate-o-start`).

**Pergunta:** Quando o modelo dá start numa tarefa que tem subtarefas (o pai), em vez de numa
subtarefa, o que o painel deve fazer?

1. **Inicia a primeira subtarefa aberta dele (Recomendado):** ela fica ◉ de verdade, com o relógio
   desde o start, conta no chip "em andamento" e fica ◷ no fim do turno; a subtarefa seguinte não
   acende sozinha quando a primeira fecha.
2. **Recusa com aviso:** nada acende, e o modelo recebe o aviso para dar start na subtarefa.
3. **Como hoje:** a primeira subtarefa aparece ◉ com o relógio contando desde o plano, o cabeçalho a
   conta como pendente e, no fim do turno, ela volta a ○ como se nada tivesse sido iniciado.

## Os lembretes mostram o id completo ("1/1.2") e o plan espera o id curto: replanejar copiando o id do lembrete duplica o prefixo e perde o estado

**Classe: correção direta.** Tamanho: pequeno.

- De pé. `build` prefixa sempre o id do nível 1 (`state/tasks.ts:15`), sem ver se o prefixo já está lá;
  os lembretes listam o id completo (`openList`, `hooks/panel.ts:307-311`). Ficou mais exposto depois do
  PR 36: o lembrete da mensagem no meio do turno lista as abertas com o id completo e manda replanejar
  "de novo com o nível 1 inteiro" (`text/rules.ts:128-135`).
- Comportamento errado no painel: o modelo replaneja o nível 1 "1" com as subtarefas "1/1.1" e
  "1/1.2", como leu; o painel cria "1/1/1.1" e "1/1/1.2", a tarefa ✓ e a ◉ somem e entram duas ○
  novas; o prefixo cresce a cada replano.
- Correção: no `build`, quando o id de uma subtarefa já começa exatamente por "<id do nível 1>/",
  tirar o prefixo antes de montar (o plan passa a aceitar o id como o painel o mostra).
- Não contraria decisão: aplica `pedidos.replano-preserva-estado` (2026-10-27).
- Arquivos: `state/tasks.ts`, `tests/pedidos.test.ts` (replano no mesmo pedido com os ids completos
  mantém a concluída e a em andamento), `regras/pedidos.md`.

## Não há como o modelo abandonar uma tarefa: os lembretes mandam done no que a mensagem "substitui", que aparece como ✓ concluída

**Classe: decisão do usuário** (recurso novo: estado ou parâmetro, e troca de textos do golden de textos).

- De pé: os três lembretes de mensagem nova mandam fechar com done o que a mensagem substitui
  (`text/rules.ts:122-124`, `132-133` e `166-167`), e o done só sabe concluir (`hooks/tools.ts:151-160`).
- Sem decisão registrada sobre abandono pedido pelo modelo ("pendentes nunca ✕", 2026-10-27, vale para
  o fim do turno).

**Pergunta:** Quando você muda de rumo e o modelo desiste de tarefas que não serão feitas, como elas
devem aparecer no painel?

1. **✕ interrompida, fora do x/y (Recomendado):** o modelo ganha um jeito explícito de cancelar (um
   parâmetro no done ou uma ferramenta), e os lembretes passam a dizer "feche o que foi concluído e
   cancele o que a mensagem substitui"; o painel deixa de mostrar 5 de 5 ✓ com 3 tarefas que não foram
   feitas.
2. **✓ concluída, como hoje:** a tarefa abandonada conta como feita no x/y e, com duas ou mais sem
   start, o modelo ainda recebe o aviso de "etapas fecharam juntas sem start".

---

# Turnos, pedidos e perguntas

## Turno parado com Esc não limpa `brief` nem `recap`: o resumo antigo vira o ↩ do pedido seguinte e cala os avisos de "falta o summary"

**Classe: correção direta.** Tamanho: pequeno.

- De pé. `brief` e `recap` só são zerados dentro do ramo de turno não parado
  (`hooks/turn.ts:121-127`); nenhum outro ponto os zera.
- Comportamento errado no painel: done com resumo "A", Esc antes da mensagem final; no pedido
  seguinte, fechado sem resumo, nenhum aviso de "falta o summary" sai e a linha ↩ do pedido novo mostra
  "A", que também vai ao arquivo publicado e ao cartão desta sessão na mãe.
- Correção: zerar `brief` e `recap` em todo fim de turno do loop principal, também no parado. Não
  zerar no prompt: uma mensagem entregue no meio do turno apagaria o resumo que o done acabou de gravar.
- Arquivos: `hooks/turn.ts`, `tests/turnos.test.ts`, `regras/turnos.md` (cenário novo).

## O request de qualquer plan renomeia o último turno, mesmo quando o plan não é o primeiro da mensagem ou vem depois de um aviso

**Classe: decisão do usuário** (o catálogo não decide qual request vale; `pedidos.titulo-vem-do-request`
só cobre um request).

- De pé: todo plan do loop principal com request não vazio troca o título do último turno
  (`hooks/tools.ts:88-98`). O PR 36 só mitigou o caso da mensagem no meio do turno pelo texto ("sem
  request: o pedido em curso mantém o título", `text/rules.ts:133-135`); o código segue renomeando, e o
  plan depois de aviso de filha ou de retorno de subagente não tem nem o texto.

**Pergunta:** Quando um segundo plan no mesmo pedido (um replano, ou um plan depois do aviso de que
uma filha terminou) traz outro `request`, o título do pedido no painel muda?

1. **Não, vale o primeiro (Recomendado):** o pedido mantém o título que o primeiro plan deu; o seu
   pedido "Auditar o mod" não vira "Relato da auditoria" porque o modelo planejou a conferência do
   relato.
2. **Sim, vale o último, como hoje:** o grupo do pedido passa a mostrar o título do plan mais novo.

## Aviso de permissão é identificado só por agente e ferramenta: chamadas paralelas o tiram cedo, e não há rede de segurança se o fim da chamada não rodar

**Classe: correção direta.** Tamanho: pequeno a médio.

- De pé. A chave da espera é `<agente>:<ferramenta>` (`hooks/permission.ts:14-19`) e o fim de qualquer
  chamada da mesma ferramenta a tira (`hooks/tool-call.ts:217-221`). No fim do turno do loop principal
  só saem as esperas de pergunta e plano (`dropAsked`, `hooks/panel.ts:582-586`), e o prompt seguinte
  preserva a de permissão (`hooks/prompt-submit.ts:100`).
- Comportamento errado no painel: dois Bash no mesmo passo, um liberado por regra e outro pedindo
  permissão; quando o primeiro termina, "Aguardando permissão: Bash" some com o diálogo ainda aberto, e
  na mãe a filha aparece trabalhando enquanto espera você. No sentido inverso, um aviso que ficou
  órfão dura até a próxima chamada da mesma ferramenta.
- Correção: contar as chamadas em curso por agente e ferramenta e tirar o aviso só quando a última
  termina (contador ausente depois de uma recarga vale zero, nunca negativo); como rede de segurança,
  o fim do turno do loop principal tira as esperas de permissão dele (não no prompt: o diálogo pode
  estar aberto com o turno em curso).
- Não contraria decisão: completa `perguntas.permissao-espera`, que só cobre o aviso aparecer.
- Arquivos: `hooks/tool-call.ts`, `hooks/turn.ts`, `hooks/panel.ts`, `tests/perguntas.test.ts`,
  `regras/perguntas.md` (cenários "sai quando a chamada termina" e "duas chamadas paralelas").

## A tarefa iniciada num turno anterior volta a "em andamento" com o relógio correndo em qualquer prompt seguinte, e fica presa se o pedido novo muda de rumo

**Classe: decisão do usuário** (a metade do Esc já está resolvida).

- Resolvido pelo PR 36: depois do Esc, a tarefa segue ✕ até o start nela (`state/tasks.ts:73-79`,
  `draw/layout.ts:84-95`; cenário `turnos.parada-segue-interrompida-ate-o-start`, decisão sua de
  2026-11-12, "Segue ✕ até novo start (Recomendado)"; commit 3d8e9bf).
- De pé, a metade do fim normal: `wake` apaga o fim do turno em todo prompt e em toda chamada de
  ferramenta (`hooks/panel.ts:32-38`), e `current` acende toda folha aberta e iniciada, de qualquer
  pedido (`draw/layout.ts:683-696`). A tarefa que ficou ◷ volta a ◉ antes de qualquer start, com o
  relógio contando o tempo parado.
- É comportamento documentado como intencional (o `wake`) e o cenário `turnos.prompt-seguinte-retoma`
  cobre o start reacender; por isso é pergunta. O teste selado (`tests/turnos.test.ts:135`) só cobre o
  caminho do Esc e não quebra com nenhuma das respostas.

**Pergunta:** Um turno termina normalmente com uma tarefa em andamento, que fica ◷ "Aguardando".
Quando chega a mensagem seguinte, antes de o modelo dar start em qualquer coisa, essa tarefa deve:

1. **Seguir ◷ até o modelo dar start nela (Recomendado):** igual ao que você decidiu para o Esc; o
   relógio fica parado, e se a mensagem nova muda de rumo a tarefa antiga não aparece "em andamento"
   sem ninguém trabalhando nela.
2. **Voltar a ◉ sozinha, como hoje:** ela, o plano e o pedido antigos acendem no prompt, com o relógio
   contando também o tempo em que a sessão ficou parada; se o modelo passar a outro plano, ela fica ◉
   por tempo indefinido.

## Turno sem plano grava a resposta e o resumo ↩ no pedido anterior

**Classe: decisão do usuário** (o catálogo não define o pedido sem tarefa; `turnos.continuacao-sem-start-aguarda`
trata o turno sem tarefa como continuação do plano).

- De pé: a resposta e o resumo vão para o último turno que tem tarefas, não para o turno aberto pelo
  prompt (`hooks/turn.ts:130-141`), e o wrap_up pede o resumo mesmo sem tarefa no pedido
  (`hooks/tool-call.ts:179`).

**Pergunta:** Você faz uma pergunta rápida e o modelo responde sem planejar nenhuma tarefa. Onde vai o
resumo ↩ dessa resposta?

1. **Num pedido próprio só com a linha ↩, quando há resumo; em lugar nenhum, quando não há
   (Recomendado):** o ↩ do pedido anterior, já encerrado, não é sobrescrito; quando a mensagem continua
   o plano anterior (alguma tarefa dele foi mexida no turno), a resposta segue indo para esse pedido.
2. **No pedido anterior, como hoje:** a linha ↩ do pedido anterior passa a mostrar o resumo da
   pergunta nova, e no cartão desta sessão na mãe a resposta antiga some.

## O prompt é classificado pelo texto em qualquer posição e não pela origem do motor; botões do wrap_up, mensagens só com anexo e disparos agendados não têm regra

**Classe: correção direta** para o texto colado; o resto **não confirmado** (depende do app).

- De pé (reproduzido pela leitura): a tag de outra sessão e a marca "[Subagent hand-back]" valem em
  qualquer posição do corpo (`hooks/prompt-submit.ts:31-43`), e `noteReceived` grava como recebida
  qualquer tag citada no texto (`hooks/sessions.ts:91-98`).
- Comportamento errado no painel: você cola no chat um trecho que contém "[Subagent hand-back]" ou a
  tag de mensagem de outra sessão (comum ao discutir este mod): a mensagem não abre pedido, ou abre
  como carta recebida, sem o lembrete de pedido novo; e a tag colada pode confirmar a entrega de uma
  carta alheia (a remetente lê o `received` publicado).
- Correção: ancorar as duas marcas no começo do corpo (depois de tirar os `system-reminder`), em
  `said` e em `noteReceived`. Antes de escrever, conferir nas mensagens reais guardadas nos testes que
  a tag sempre abre o corpo, inclusive quando várias mensagens chegam juntas.
- Tamanho: pequeno. Arquivos: `hooks/prompt-submit.ts`, `hooks/sessions.ts`, `tests/pedidos.test.ts` ou
  `tests/envios.test.ts`, `regras/pedidos.md`.
- Não confirmado, e o que faltou: a origem (`e.origin.kind`) que o app manda no clique de um botão do
  wrap_up e num disparo agendado. Sem esse registro não dá para trocar a classificação pelo texto pela
  origem (o próprio código diz que os avisos do app não vêm com origem distinguível,
  `hooks/prompt-submit.ts:78-80`). O envio só com anexo está no achado próprio, abaixo.

## Comando local (/task-tree, /model e outros) passa pelo prompt.submit como pedido da pessoa

**Classe: não confirmado.**

- Pela leitura, o `promptSubmit` não lê `e.command` (`hooks/prompt-submit.ts`, o arquivo todo), e um
  prompt que não é aviso acorda o painel, tira a escolha pendente, gasta a marca de replanejar e abre
  turno.
- Indício novo a favor: os tipos do kit dizem que o `prompt.submit` recebe a linha de um comando com
  `command` preenchido, e que só o comando que roda como fork não levanta o evento
  (`.claude-plugin/types/claude-code/index.d.ts:9909-9928`).
- O que faltou: saber, no app, se o evento é levantado para um comando que não gera turno do modelo (o
  `/task-tree` do próprio mod, respondido por hook, e o `/model`), e com que origem. Uma linha de
  registro no `promptSubmit` com `e.command?.name` e `e.origin.kind` fecha o caso.
- Se confirmar, a correção é direta e pequena: pular acordar, esperas, marcas e turno para o comando
  que não gera turno, a começar pelo `task-tree` (comando de skill ou de prompt segue abrindo pedido).

## Esc na principal: só a carta na fila poupa a tarefa; sessão filha viva e subagente em segundo plano deixam a tarefa ✕

**Classe: decisão do usuário** (uma parte já resolvida).

- Resolvido pelo PR 36: o cartão do subagente em segundo plano não some mais; ele é desenhado sob a
  tarefa em qualquer estado dela (`draw/layout.ts:1354-1358` e `1368-1375`; commit e4f1dfa).
- De pé: a linha testa "interrompida" antes de "filha trabalhando" (`draw/layout.ts:1073-1078`), então a
  tarefa fica ✕ com o cartão da filha "trabalhando" embaixo e o pai ◉; e o tempo dessa linha ✕ segue
  correndo enquanto a filha trabalha (`draw/layout.ts:1109-1110`, `587-594`).
- Decisão registrada que a correção contraria: `envios.esc-apos-entrega-imediata` (2026-10-28, "a
  mensagem foi entregue; não é interrompida"; reescrito em 2026-10-30: "a tarefa iniciada fica ✕ no
  Esc, como qualquer outra (entregue a mensagem, ela é uma tarefa comum)"). Ela cobre a tarefa cuja
  mensagem foi entregue; não cobre a sessão aberta por start_session nem o subagente em segundo plano.

**Pergunta:** Você aperta Esc na sessão principal, e a tarefa que estava em andamento tem uma sessão
filha trabalhando embaixo dela (ou um subagente em segundo plano). Como essa tarefa deve ficar?

1. **Segue ◉ enquanto a filha trabalha e ◷ enquanto o subagente roda (Recomendado):** como a tarefa
   com carta na fila; o Esc para a principal, não o trabalho delegado. Reescreve a decisão de
   2026-10-28 e 2026-10-30 para toda tarefa com trabalho delegado vivo.
2. **Fica ✕ "interrompida", como hoje:** vale "como qualquer outra"; nesse caso só se corrige o
   relógio, que hoje segue correndo na linha ✕ enquanto a filha trabalha.

## Turno da principal que morre por erro de API, limite de contexto ou recusa é tratado como fim normal

**Classe: decisão do usuário** (estado novo; nenhum cenário define o turno que falha).

- De pé: o fim do turno da principal só lê `isAborted` (`hooks/turn.ts:121`, `148`, `152`); só o
  subagente distingue erro e recusa (`hooks/agents.ts:150`).

**Pergunta:** O turno da sessão morre por erro de API ou por limite de contexto, com uma tarefa em
andamento. Como ela deve aparecer?

1. **✕ "falhou" (Recomendado):** como o subagente que falha; a mensagem seguinte recebe o pedido de
   replanejar, e o cartão desta sessão na mãe indica a falha.
2. **✕ "interrompida":** igual ao Esc, sem palavra própria.
3. **◷ "Aguardando", como hoje:** igual a quando o modelo para de propósito esperando você; na mãe, o
   lembrete diz só que a sessão terminou o turno.

## Fim de turno: o documento diz que a tarefa iniciada vira interrompida; o código e o catálogo a deixam aguardando (◷), e só o Esc interrompe

**Classe: correção direta** (só documentação). Tamanho: pequeno.

- De pé. `DESENVOLVIMENTO.md:250` (tabela: "desenhado interrompido, sem relógio"), `540-557` (parágrafo
  das tarefas abertas de sessão que terminou o turno, com "pai sem nada aberto embaixo vira
  interrompido") e `1277-1278` ainda descrevem a regra anterior; o trecho novo do PR 36 (`573-582`)
  convive com eles.
- Correção: reescrever os três trechos com a regra do catálogo (iniciada ◷; ✕ só com Esc, e até o
  start; tarefa com carta na fila ◷; pai sem nada aberto embaixo ✓) ou apontar para
  `regras/turnos.md`. Não muda regra nem código.
- Arquivo: `DESENVOLVIMENTO.md`.

## Mensagem só com imagem (texto vazio) é classificada como aviso do app e não abre pedido

**Classe: não confirmado.**

- Pela leitura, corpo vazio é aviso do app (`hooks/prompt-submit.ts:35`): não abre pedido, não tira
  "Aguardando sua escolha" e não leva o pedido de replanejar.
- O que faltou: o que o app manda em `e.text` num envio só com imagem (vazio, ou um marcador da
  imagem). Os tipos só dizem que `attachments` existe quando o envio traz item que não é texto
  (`index.d.ts:9939-9942`).
- A guarda é segura por construção e pequena: corpo vazio com `attachments` é pedido, não aviso (se o
  app mandar um marcador no texto, a guarda nunca dispara). Pode entrar junto da correção do texto
  colado, se a orquestradora preferir não esperar o registro no app.

## "Mesmo pedido" no replano é o turno, e mensagem de outra sessão também abre turno: para a orquestradora, o relato de uma filha vira "pedido novo"

**Classe: resolvido.**

- O relato de uma filha entregue no meio do turno já não abre pedido: continua o pedido em curso, e
  o replano guarda o estado (`hooks/prompt-submit.ts:99-131`; decisão sua de 2026-11-12, "Entra no
  pedido em curso (Recomendado)"; cenário `pedidos.mensagem-no-meio-do-turno-continua-o-pedido`; commit
  7ba11cc).
- Os textos ao modelo deixaram de prometer o estado guardado fora do mesmo pedido: a regra, a descrição
  do plan e os dois lembretes de depois do Esc dizem que, numa mensagem seguinte, o id reusado vira
  histórico e mandam seguir com start e done (`text/rules.ts:38-48`, `74-79`, `144-168`; cenário
  `lembretes.estado-guardado-so-no-mesmo-pedido`, coberto).
- O que sobra é a regra em si, mantida no PR 36: a mensagem de outra sessão que chega com o turno
  terminado abre pedido (`envios.pedido-recebido-mostra-carta`, 2026-10-30) e o id reusado vira
  histórico (`pedidos.plano-anterior-vira-historico`, confirmado em 2026-10-27).

---

# Sessões filhas e cartões

## O lembrete "terminou o turno a sessão…" olha só a tarefa em que a filha foi aberta

**Classe: correção direta.** Tamanho: pequeno a médio.

- De pé. O lembrete procura só `c.anchor` entre as tarefas abertas (`hooks/sessions.ts:255-259`); na
  mesma função, o aviso "parou com a tarefa de origem já fechada" já usa a tarefa da última rodada
  (`262-266`, pelo `settle` de `draw/layout.ts:194`).
- Comportamento errado: a filha foi aberta sob a tarefa 3 (já concluída) e depois recebeu mensagem a
  partir da 64.1 (em andamento). Ela termina o turno e o modelo não recebe o lembrete de conferir o
  relato e fechar a 64.1, que fica aberta; o painel já trata a 64.1 como a origem daquela rodada.
- Correção: o lembrete passa a olhar a tarefa da rodada do turno que terminou: a última rodada cuja
  mensagem a filha já tratou (sem envio na fila para ela), senão a tarefa de abertura. Não usar o
  `lastAnchor` cru, que muda no envio, antes de a filha tratar a mensagem.
- Arquivos: `hooks/sessions.ts`, teste em `tests/sessoes.test.ts` ou `tests/lembretes.test.ts`,
  `regras/lembretes.md` (o lembrete não tem cenário hoje).

## Envio a sessão que não é filha (irmã, mãe) cria um cartão fantasma "Sessão…"; envio que falha ainda grava rodada

**Classe: correção direta.** Tamanho: médio.

- De pé. Todo destino com id `local_…` que não está entre as filhas ganha uma entrada "Sessão…"
  trabalhando (`hooks/tool-call.ts:127-136`), antes de se saber se o envio falhou (`148`); a leitura
  seguinte a tira do estado, mas uma sessão sem filhas não publica de novo (`hooks/sessions.ts:57-61`
  e `85`).
- Comportamento errado no painel: a filha manda o sinal à irmã (fluxo comum de sessões em sequência)
  e surge, sob a tarefa do envio, um cartão "Sessão…" trabalhando; no painel da mãe ele aparece dentro
  do cartão da remetente e conta como sessão trabalhando no cabeçalho, até a próxima publicação da
  filha (se o turno dela terminar antes, fica até o turno seguinte). Variante: o SendMessage que falha
  para uma filha existente grava a rodada, e o próximo turno dela vira um cartão sob a tarefa do envio
  que falhou.
- Correção: calcular a falha antes e não tocar nas filhas quando o envio falha; criar a entrada
  provisória só para id que esta sessão abriu (guardar os ids do `recordStart`, ou negar quando a lista
  do host mostra o destino aberto por outra sessão ou ele é quem abriu esta); publicar de novo quando a
  leitura esvazia a lista.
- Não contraria decisão: aplica `sessoes.mensagem-entre-filhas-no-cartao-da-remetente` ("o cartão da
  destinatária não fica dentro do cartão da remetente").
- Arquivos: `hooks/tool-call.ts`, `hooks/sessions.ts`, `tests/envios.test.ts` e `tests/sessoes.test.ts`,
  `regras/sessoes.md`.

## Âncora que sai do plano num replanejamento: três tratamentos diferentes para carta, subagente e cartão de sessão

**Classe: decisão do usuário** (regra nova para o cartão de sessão e o de subagente; você decidiu só o
destino da carta, em `pedidos.replano-mantem-envio-ate-entrega`, 2026-10-27 e 2026-10-30).

- De pé: a carta sobe ao nível 1 do pedido (`draw/layout.ts:1317-1323`); o subagente vai ao fim do grupo
  e sai do recorte ao terminar (`1452` e `818-824`); o cartão da filha fica solto no fim só enquanto
  vivo, sem o nome do pedido, e some ao concluir (`1349`, `1613-1615`), e as tarefas dela saem do x/y
  (`536-541`).

**Pergunta:** O modelo replaneja um nível 1 com subtarefas de ids novos, e a subtarefa de onde uma
sessão filha foi aberta (ou um subagente lançado) sai do plano. Onde fica o cartão?

1. **Sob o nível 1 que continha a subtarefa, como já acontece com a carta (Recomendado):** o cartão
   segue desenhado, vivo ou concluído, e as tarefas da filha seguem contando no x/y do nível 1 e do
   pedido.
2. **Como hoje:** o cartão da filha aparece solto no fim enquanto ela trabalha e some quando conclui,
   com as tarefas dela fora do x/y; o do subagente vai para o fim do grupo e some ao terminar.

## Filha recém-aberta perde a tarefa de origem se a primeira leitura do host ainda não a lista, e refreshChildren grava `children` sem conferir a versão e pode rodar sobreposto

**Classe: correção direta** (dois achados, a mesma causa). Tamanho: médio.

- De pé. A leitura das filhas lê a lista do host e os arquivos e só depois grava, com `set` e sem
  conferir versão (`hooks/sessions.ts:76-79`); o que entrou no meio (a filha recém-registrada por
  `recordStart`, `237-242`, ou a rodada de um envio) não está na lista lida e é descartado
  (`io/host.ts:144`); com a lista vazia, o estado é zerado (`sessions.ts:57-60`). O relógio de 3 s não
  espera a execução anterior (`283`), e a mesma função é chamada de outros três pontos.
- Comportamento errado no painel: (a) a filha recém-aberta perde a tarefa de origem: o cartão vai
  para o fim da lista e, concluído, some; (b) uma leitura mais antiga grava por último: a filha volta
  a aparecer rodando e a leitura seguinte gera um segundo lembrete "terminou o turno" para o mesmo fim.
- O gatilho de a lista do host ainda não trazer a sessão depende do app; a corrida com a leitura em
  curso é confirmada pela leitura do código e não depende dele.
- Correção: uma execução por vez, com "rodar de novo ao terminar"; manter por um prazo curto a entrada
  recém-aberta que a lista ainda não traz, e guardar a ligação dela antes da primeira leitura.
- Arquivos: `hooks/sessions.ts`, `io/host.ts`, `tests/sessoes.test.ts` e `tests/durabilidade.test.ts` (filha
  não listada na abertura), `regras/durabilidade.md` (estende `durabilidade.ligacoes-com-lista-parcial-do-host`).

## Cartão sem âncora some do painel quando a filha conclui, e sem a linha "+N pedidos anteriores" não há como vê-lo

**Classe: decisão do usuário.**

- De pé: no painel principal o recorte existe sempre, então só os cartões soltos vivos são desenhados
  e a linha "+N cartões antigos de sessões" só aparece com o histórico aberto
  (`draw/layout.ts:1613-1617`); sem pedido cortado não há histórico para abrir.
- Decisão registrada que a correção toca: `cabecalho.limite-de-cartoes-antigos` (reescrito em
  2026-11-04: "…deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)"). Ela
  fala de cartões parados "de pedidos antigos"; não cobre o cartão recente nem o painel sem a linha.
- Parte da causa some com as correções que evitam perder a origem (filha recém-aberta, acima).

**Pergunta:** Uma sessão filha sem tarefa de origem (aberta antes do primeiro plan, por exemplo)
conclui tudo. Hoje o cartão dela some na hora e, se nenhum pedido foi cortado, não há linha para
abri-lo. O que fazer?

1. **Fica desenhado no fim do painel enquanto for recente (Recomendado):** o cartão concluído segue à
   vista, como ficaria se tivesse tarefa de origem; os antigos seguem escondidos.
2. **Segue escondido, com a linha "+N cartões antigos de sessões" sempre visível:** o cartão some ao
   concluir, mas a linha aparece sempre que houver algum escondido, e clicar nela o mostra.
3. **Como hoje:** o cartão some ao concluir e fica inacessível enquanto nenhum pedido for cortado.

## Regras de cartão valem só para as filhas diretas: "encerrada", cartão vivo solto e carta na fila no Esc não se aplicam dentro do cartão de uma filha

**Classe: correção direta.** Tamanho: médio a grande.

- De pé. O `settle` ("encerrada") só roda no nível do painel principal (`draw/layout.ts:1299`); dentro
  de um cartão nenhum cartão solto é desenhado, vivo ou não (`1613-1615`, e `1428` para os de pedido
  cortado); o cartão da filha parada é lido sem as cartas dela na fila (`181`); e o x/y do cartão conta
  as netas sem esses cortes (`1226`).
- Comportamento errado no painel (orquestradora → filha → neta): (1) a neta para só com pendentes e a
  origem dela na filha está fechada: no painel da filha ela é "encerrada" e fora da contagem, mas na
  orquestradora as pendentes dela seguem contando no x/y da filha e no cabeçalho; (2) a neta trabalha
  sob um pedido da filha que saiu do trabalho: na filha o cartão é desenhado solto no fim, na
  orquestradora ele não aparece (e as tarefas dele contam); (3) a filha tem uma carta na fila e leva
  Esc: no painel dela a tarefa fica ◷, no cartão dela na orquestradora fica ✕.
- Correção: aplicar o `settle` em todos os níveis com as cartas do painel dono, desenhar os cartões
  vivos soltos também dentro do cartão da mãe deles, e passar ao desenho do cartão parado as cartas
  dele ainda na fila (a tarefa fica ◷, como em `envios.fila-nao-interrompe-no-fim-do-turno`,
  2026-10-30). O x/y do cartão e a linha de status usam o mesmo corte.
- Não contraria decisão: estende a netas `sessoes.filha-parada-com-origem-fechada-sai-da-contagem`
  (2026-11-04) e `sessoes.cartao-vivo-nunca-some` (2026-11-03). A contagem da rodada parada com Esc
  não muda aqui: segue a pergunta sobre a filha parada com Esc, adiante.
- Arquivos: `draw/layout.ts`, `hooks/panel.ts` (status), `tests/sessoes.test.ts` (teste de neta),
  `regras/sessoes.md`. Conferir o golden "filha trabalhando" antes do commit.

## Arquivo da filha ilegível numa leitura zera `waiting`, `aborted` e `ultracode`, mas mantém painel, contexto, modelo, taxa e git

**Classe: não confirmado.**

- A assimetria existe: sem arquivo legível, a espera, a marca de turno parado e o "ultracode" vêm só
  da leitura atual, e o resto cai no valor anterior (`io/host.ts:82` e `154-166`); com a filha já
  parada no host, sairia um lembrete falso de fim de turno.
- O que faltou: evidência de que a leitura pega o arquivo no meio da gravação. O mod registra o caso
  no log de depuração ("arquivo publicado de <id> ignorado: JSON inválido", `io/publish.ts:92-96`), mas
  nesta máquina `~/.claude/debug` está vazio e os logs do app não trazem a frase. O kit não diz se a
  gravação é atômica.
- A tolerância é pequena e segura (manter os três valores anteriores quando o arquivo existe e não deu
  para ler, sem contar a sessão como "terminou o turno"); cabe no lote da leitura das filhas, se a
  orquestradora quiser prevenir sem esperar a evidência.

## Filhas arquivadas e antigas nunca saem: painel inteiro guardado no state, arquivo relido a cada 3 s, tudo republicado aninhado; a lista do host é pedida com limite 100

**Classe: decisão do usuário**, com uma parte de **correção direta** (higiene, sem mudar o painel).

- De pé: a lista é pedida com `limit: 100` e arquivadas incluídas (`io/host.ts:33`); cada leitura lê e
  analisa o arquivo de toda filha listada, arquivada ou não (`io/host.ts:78-97`), compara o estado
  inteiro serializado (`hooks/sessions.ts:76-79`) e publica as netas sem corte de profundidade
  (`io/publish.ts:137`).
- Parte direta (tamanho médio; `io/host.ts`, `hooks/sessions.ts`, `io/publish.ts`, `tests/sessoes.test.ts`):
  não reler o arquivo de sessão arquivada enquanto ela seguir arquivada; ao publicar, cortar as filhas
  além da profundidade que o desenho segue (quem publica mantém os níveis que a mãe dele ainda desce);
  registrar no log quando a lista vier com 100 linhas. Nada disso muda o que o painel mostra.
- Decisão registrada que a poda contraria: `sessoes.filha-arquivada-interrompe` (origem: regra do
  painel desde a entrada do mod, "Arquivada fica, como histórico").

**Pergunta:** Uma sessão filha arquivada há muito tempo precisa continuar com todas as tarefas dela
no painel da mãe?

1. **Vira uma linha com nome e contagem depois que o pedido dela sai do trabalho atual
   (Recomendado):** o histórico fica resumido, e uma orquestradora que dura dias deixa de carregar e
   reler o painel inteiro de cada filha antiga.
2. **Continua com todas as tarefas, como hoje:** o cartão arquivado abre com tudo o que a filha fez; o
   custo de leitura e o tamanho do painel publicado crescem com cada filha aberta, sem teto.

## Cartão de rodada descartada é desenhado como "trabalhando" ou "parada" e conta como sessão no cabeçalho: a mesma filha aparece em dois cartões sem dizer qual vale

**Classe: decisão do usuário**, com uma parte de **correção direta** (a contagem dupla).

- De pé: todo cartão com tarefa aberta de uma sessão rodando é marcado como rodando
  (`draw/layout.ts:474`); o cartão não testa se a rodada foi descartada ao escolher a palavra e o estado
  (`1222-1225`, `1249`); o chip de sessões conta as linhas vivas (`hooks/render.tsx:286-288`).
- Parte direta (pequena; `draw/layout.ts`, `tests/sessoes.test.ts`, `regras/sessoes.md`): o chip de
  sessões do cabeçalho conta uma sessão uma vez só, pelo cartão da rodada atual; hoje pode mostrar duas
  sessões trabalhando para uma. Não há regra a favor da contagem dupla.
- A palavra do cartão descartado mexe na lista de palavras decidida
  (`sessoes.palavra-de-estado-do-cartao`, 2026-11-04) e em `sessoes.um-cartao-por-mensagem` (2026-10-21).

**Pergunta:** Você manda duas mensagens à mesma filha, de tarefas diferentes, e ela larga uma tarefa
aberta da primeira ao passar à segunda. O painel mostra dois cartões com o mesmo nome. Como deve
aparecer o cartão da rodada largada?

1. **Com palavra própria, "substituída", em cinza e fora do chip de sessões (Recomendado):** fica
   claro qual cartão vale; as tarefas dele seguem desenhadas e fora da contagem, como hoje.
2. **Some para dentro de "+N pedidos anteriores":** só o cartão da rodada atual fica à vista.
3. **Como hoje:** aparece "parada", ou trabalhando enquanto a filha roda, igual ao cartão que vale.

## O que o arquivo publicado diz não tem validade: filha morta com espera aberta fica "aguardando", e neta fica "trabalhando" dentro de sessão intermediária arquivada ou morta

**Classe: não confirmado.**

- Pela leitura, a espera vem só do arquivo (`io/host.ts:83` e `154`), ninguém lê a hora do arquivo, o
  cartão arquivado mantém as netas como foram publicadas, valendo no desenho e no relógio
  (`draw/layout.ts:179` e `835-839`), e o mod não registra `session.end` (`hooks/register.tsx`).
- O que faltou, tudo do app: (1) se o host lista a sessão como rodando enquanto uma pergunta ou
  permissão está aberta (se lista parada, ignorar a espera de sessão parada apagaria um "aguardando"
  verdadeiro); (2) se o processo de uma filha arquivada ou do app fechado morre sem publicar de novo;
  (3) se `session.end` é levantado nesses casos.
- Ressalva à proposta: tratar as netas como paradas quando a sessão intermediária "não está viva" só é
  seguro para a arquivada. Uma filha orquestradora parada à espera do relato, com o processo vivo,
  segue publicando a neta que trabalha de verdade.

## Tarefa da mãe com `done` e filha ainda trabalhando: o documento cita uma decisão ("vale como concluído") oposta à do catálogo e do código (segue ◉)

**Classe: correção direta** (documentação e origem do cenário). Tamanho: pequeno.

- De pé. `DESENVOLVIMENTO.md:363-372` e `1287-1292` descrevem a tarefa concluída ✓ com contagem
  própria; o código, o teste e o cenário `sessoes.filha-trabalhando-mantem-pais-em-andamento` mantêm a
  tarefa e os pais ◉ (`draw/layout.ts:551-556`, `tests/sessoes.test.ts`).
- As datas resolvem qual frase vale, sem pergunta: "um done explícito da mãe deve valer como
  concluído" é do commit a818dae, de 2026-10-23; "as linhas pai anteriores somente deveriam ficar como
  concluídas, quando as filhas fossem concluídas" é do commit 8637626, de 2026-10-24, que a desfaz. As
  duas estão no histórico do repositório (`git log -S`).
- Correção: reescrever os dois trechos do documento com a regra do catálogo; no cenário, trocar a
  origem "commit d956e11" (que não existe mais) pelo commit 8637626 com as suas palavras, e dizer que
  desfaz a frase de 2026-10-23.
- Arquivos: `DESENVOLVIMENTO.md`, `regras/sessoes.md`.

## Turno digitado pelo usuário na filha é sempre tratado como a rodada mais antiga: cartão da frente errado e rodada mais nova descartada

**Classe: correção direta.** Tamanho: médio.

- De pé. O turno digitado na filha recebe chave negativa (`draw/layout.ts:404-407`), as partes são
  ordenadas pela chave e a rodada da frente é a última com tarefa iniciada, senão a de maior chave
  (`430-437`): sem tarefa iniciada, a frente é sempre a rodada da mãe.
- Comportamento errado no painel: a mãe manda uma mensagem (rodada toda ✓); depois você digita direto
  na filha, ela conclui uma tarefa, deixa outra pendente e termina o turno. O cartão "pedido do usuário
  na filha", que é o trabalho mais recente, vira rodada descartada: as tarefas dele saem do cabeçalho e
  dos chips, e o pedido onde ele está deixa de ser mantido à vista. O mesmo acontece em todo intervalo
  entre um done e o start seguinte desse turno.
- Correção: escolher a rodada da frente pelo instante em que cada parte começou, não pela chave; as
  chaves ficam como estão (a dobra e a posição do cartão dependem delas).
- Não contraria decisão; cumpre duas que o código descumpre: `sessoes.rodada-descartada-fora-da-contagem`
  ("a rodada descartada é a anterior, não a que está trabalhando", 2026-10-28) e
  `sessoes.turno-proprio-da-filha-no-pedido-vigente` (2026-11-03).
- Arquivos: `draw/layout.ts`, `tests/sessoes.test.ts` (mensagem da mãe, depois turno próprio com uma ✓
  e uma pendente, filha parada; e o intervalo entre done e start com a filha rodando), `regras/sessoes.md`.

## Todo wrap_up com ask vira espera "Aguardando sua escolha", mesmo quando falha, quando o app não mostra a pergunta ou quando ela não bloqueia

**Classe: decisão do usuário**, com uma parte de **correção direta**.

- De pé: a espera é criada antes da chamada, sem olhar o resultado nem `blocked`
  (`hooks/tool-call.ts:79-88` e `215-221`).
- Parte direta (pequena; `hooks/tool-call.ts`, `tests/perguntas.test.ts`, `regras/perguntas.md`): criar a
  espera depois da chamada e só se ela não falhou; se o resultado disser que a pergunta não foi
  mostrada, não criar. Hoje, um wrap_up que dá erro deixa "Aguardando sua escolha" no painel e a filha
  "aguardando" na mãe, sem pergunta nenhuma na tela. O teste selado
  (`tests/perguntas.test.ts:121`) usa uma chamada que dá certo e segue valendo.
- A outra parte muda o que esse teste e o cenário `perguntas.escolha-do-wrapup-ate-proxima-mensagem`
  (regra desde a entrada do mod) afirmam.

**Pergunta:** Uma sessão filha termina o turno com uma pergunta opcional no wrap_up (por exemplo
"Fazer commit?", sem marcar que o trabalho parou à espera). Enquanto você não responde, como ela
aparece na orquestradora?

1. **Só a pergunta que bloqueia o trabalho conta como espera (Recomendado):** a pergunta opcional
   aparece só como palavra no cartão; a tarefa de origem não fica ◉ com o relógio correndo, e o
   lembrete de "terminou o turno" sai normalmente.
2. **Toda pergunta vira "Aguardando sua escolha", como hoje:** o cartão fica "aguardando", a tarefa de
   origem e os pais seguem ◉ com o relógio correndo, e o lembrete de fim de turno não sai até alguém
   mandar mensagem à filha.

## Sessões que nascem sem um start_session com id (cartão own_initiative clicado, hand_off_to_session) não têm âncora nem cenário

**Classe: não confirmado.**

- Pela leitura, só o start_session cujo resultado traz o id `local_…` grava a origem
  (`hooks/sessions.ts:225-227`); uma sessão que apareça na lista sem essa chamada fica sem origem
  (`io/host.ts:162-165`), solta no fim enquanto viva e fora do desenho ao concluir.
- O que faltou, do app: se a sessão aberta pelo clique no cartão proposto (e a do hand-off) aparece
  na lista como aberta por esta sessão, e o que o resultado da proposta traz para casar com a linha do
  host.
- Confirmado, vira pergunta: a filha aberta por cartão fica sob a tarefa em andamento quando o cartão
  foi proposto, ou no fim do pedido vigente quando você clicou; o hand-off pede pergunta própria sobre
  as tarefas que ficam abertas na mãe.

## Duas regras se contradizem para a filha parada com Esc que tem pendentes: "o cabeçalho as conta" e "saem do cabeçalho"

**Classe: decisão do usuário.**

- De pé, no catálogo. O código descarta a rodada inteira (`draw/layout.ts:156-161` e `497-507`), e o
  PR 36 reforçou essa leitura em dois cenários novos (`sessoes.filha-parada-com-esc-sem-pendente` e
  `sessoes.filha-parada-com-esc-segue-descartada-ate-o-start`, este com a sua decisão de 2026-11-12).
  Nenhum teste afirma a contagem de uma filha parada com Esc que tem ✓, iniciada e pendentes.
- As duas decisões suas que se cruzam: `sessoes.rodada-descartada-fora-da-contagem` (2026-10-24, "as
  tarefas dessa sessão foram descartadas"; 2026-10-28) e `turnos.pendentes-seguem-pendentes`
  (2026-10-27, "pendentes nunca ✕", com "na principal e nas filhas" e "o cabeçalho as conta"); e
  `sessoes.filha-parada-pendentes-seguem-pendentes` diz que as pendentes da filha entram no chip, com a
  iniciada ✕ "se o turno foi interrompido".
- A auditoria recomendava contar; depois dela, o PR 36 firmou o descarte em dois cenários, um deles
  com decisão sua. Por isso a recomendação aqui é manter e acertar o texto.

**Pergunta:** Você para uma sessão filha com Esc. Ela tinha 2 tarefas concluídas, 1 em andamento e 2
pendentes. No painel dela o cabeçalho diz "2 de 4". No painel da orquestradora, o que essas tarefas
valem?

1. **A rodada inteira sai da contagem, como hoje (Recomendado):** o cartão segue desenhado com a
   palavra "parada", mas contribui 0 de 0 para o cabeçalho e para o x/y da tarefa de origem, até a
   filha dar start de novo na tarefa parada. Os dois cenários que dizem "o cabeçalho as conta" ganham a
   exceção escrita.
2. **As concluídas e as pendentes seguem contando, como no painel dela:** só a tarefa parada (✕) sai;
   o cabeçalho da orquestradora mostra as mesmas "2 de 4". Reescreve a decisão de 2026-10-24 para a
   filha parada com Esc e os dois cenários do PR 36.

## /clear numa filha apaga da mãe todo o trabalho dela (os ✓ saem da contagem) e o cartão vira "concluída" vazio, sem cenário

**Classe: decisão do usuário** (sem cenário nem decisão; `durabilidade.clear-esvazia` cobre só o painel
da própria sessão).

- De pé: o `/clear` publica o grupo principal vazio (`hooks/session-start.ts:72-78`), o painel vazio
  substitui o anterior na mãe (`io/host.ts:62` e `166`) e o cartão sem tarefas diz "concluída"
  (`draw/layout.ts:1225`).

**Pergunta:** Você dá /clear numa sessão filha que já tinha feito 5 de 5 tarefas. O que acontece com
o cartão dela no painel da mãe?

1. **Mantém o que ela já tinha feito, como histórico (Recomendado):** o x/y da tarefa de origem e o
   cabeçalho da mãe não encolhem, e o trabalho que a filha fizer depois aparece num cartão novo.
2. **Esvazia junto com a filha, como hoje:** em 3 segundos o cartão perde as tarefas e as respostas, o
   x/y da origem e o cabeçalho encolhem, e o cartão fica "concluída" sem nada dentro.

## O cálculo das quebras de cartão (breaks) ainda cresce com a quarta ou quinta potência do número de irmãs que trocam mensagens entre si

**Classe: não confirmado.**

- A estrutura é a descrita: a chave do cache leva o caminho (`draw/layout.ts:284-319`), e três
  chamadores criam um cache novo por filha (`hooks/render.tsx:216`, `draw/layout.ts:770`,
  `hooks/sessions.ts:264`).
- O que faltou: medir com 8 a 10 irmãs em malha. Com as cadeias lineares e em anel de hoje o custo é
  baixo, e não há relato de travamento desde a correção do anel.
- Se a medida mostrar problema, começar pelo que não muda resultado (um cache por desenho nos três
  chamadores); o teto de níveis muda onde cai o cartão de mensagem de irmã e pede cenário.

## No cartão da filha parada, a tarefa ◷ para no último carimbo do painel publicado: 0:00 ou tempo cortado

**Classe: correção direta.** Tamanho: médio.

- De pé. O cartão da filha parada para o relógio no maior início ou fim das tarefas dela
  (`draw/layout.ts:180-181`); o arquivo publicado não leva o fim do turno (`io/publish.ts:131-147`).
- Comportamento errado no painel: a filha dá start em X às 10:00, trabalha 20 minutos sem outro start
  nem done e encerra o turno com X aberta. No painel dela X aparece ◷ 20:00; no cartão dela na
  orquestradora, ◷ 0:00 (ou 5:00, se houve um done de outra tarefa às 10:05). O tempo do cartão e o do
  pedido da mãe herdam o corte.
- Correção: publicar o fim do turno num campo opcional (sem subir a versão do arquivo), levá-lo até o
  cartão e usá-lo como o instante em que o relógio parou; o último carimbo fica como reserva para
  arquivos de versões antigas. O campo entra na comparação que decide publicar e nos arquivos de
  exemplo dos formatos publicados.
- Não contraria decisão: cumpre `turnos.iniciada-aguarda-no-fim` ("◷ com o relógio parado").
- Arquivos: `types/index.d.ts` (núcleo: afeta todos os cenários na matriz de impacto), `io/publish.ts`,
  `io/host.ts`, `hooks/panel.ts`, `draw/layout.ts`, `tests/fixtures/publicados.ts`, `tests/durabilidade.test.ts`,
  `tests/sessoes.test.ts`, `regras/sessoes.md`. O golden "filha trabalhando" não deve mudar (a filha
  está viva); conferir.

## Tarefa concluída com filha embaixo: o tempo corre enquanto a filha trabalha e regride quando ela para

**Classe: decisão do usuário** (definição do tempo; nenhum cenário fala do tempo dessa linha).

- De pé: as tarefas da filha só entram no tempo se a tarefa de origem não está concluída
  (`draw/layout.ts:539-541` e `567`), mas com a filha trabalhando o tempo é "agora menos o início"
  (`587-594`); o x/y da mesma linha conta as folhas da filha nos dois momentos.

**Pergunta:** A orquestradora manda uma mensagem a partir da tarefa T, que é concluída em 3 segundos
(na entrega); a filha trabalha 10 minutos. Hoje T mostra o tempo correndo até 10:03 e, quando a filha
para, volta a 0:03. Qual tempo T e o pedido devem mostrar?

1. **O tempo inclui o trabalho das filhas abertas a partir dela, mesmo depois de concluída
   (Recomendado):** T fica em 10:03 quando a filha para; o número não regride e combina com o x/y, que
   já conta as tarefas da filha.
2. **Só o tempo próprio, até o done:** T mostra 0:03 também enquanto a filha trabalha; o relógio dessa
   linha não corre.
3. **Como hoje:** corre enquanto a filha trabalha e volta a 0:03 quando ela para.

## Cada turno aberto direto na filha vira um cartão separado e nunca é fundido; e "digitado pelo usuário" é qualquer prompt que não seja mensagem de sessão

**Classe: decisão do usuário**; a segunda metade é **não confirmada**.

- De pé: cada turno próprio é uma parte e um cartão (`draw/layout.ts:404-407`), todos com o mesmo
  título (`1234`).
- Já resolvido pelo PR 36, e reduz a frequência: o turno de abertura da filha não é mais "pedido do
  usuário na filha" (`sessoes.turno-de-abertura-da-filha-sob-a-origem`, commit fbe86b4), e a mensagem
  digitada no meio do turno não abre turno (2026-11-12).
- Decisão registrada que a fusão contraria: `sessoes.turno-proprio-da-filha-no-pedido-vigente`
  (2026-11-03, "No pedido vigente da orquestradora (Recomendado)"), que desenha um cartão por turno.
- Não confirmado: decidir "digitado" pela origem do prompt. Hoje é todo prompt que abre turno e não
  vem de outra sessão (`hooks/prompt-submit.ts:137`); faltam as origens que o app manda para tarefa
  agendada, plugin e Remote Control (o mesmo registro pedido nos achados da classificação do prompt).

**Pergunta:** Você digita duas vezes direto numa sessão filha, uma depois da outra. Hoje o painel da
mãe mostra dois cartões separados com o mesmo título, "<nome> · pedido do usuário na filha". Como deve
ficar?

1. **Um cartão só naquele ponto, com uma linha de pedido por turno (Recomendado):** os turnos
   digitados entram no cartão que a sessão já tem ali; cartão novo só quando o pedido vigente da mãe é
   outro. Muda a decisão de 2026-11-03.
2. **Um cartão por turno, como hoje:** cada vez que você digita na filha nasce um cartão, todos com o
   mesmo título.

---

# Correções diretas, em lotes

Cada lote reúne o que mexe no mesmo trecho e pode ir num mesmo commit; a regra do projeto de um
commit por item continua valendo dentro do lote, se a orquestradora preferir. Ordem sugerida: primeiro
as pequenas e isoladas, cobertas pelo harness; depois as de leitura das filhas; por último as de
`draw/layout.ts`, que pedem conferência do golden, e a documentação.

1. **Ids no plan, start e done** (`state/tasks.ts`; `npm run impacto -- state/tasks.ts`)
   - o plan aceita o id completo que os lembretes mostram, sem duplicar o prefixo;
   - o id curto não alcança as tarefas de histórico renomeadas.
2. **Fim do turno** (`hooks/turn.ts`, `hooks/tool-call.ts`, `hooks/panel.ts`)
   - o turno parado com Esc também zera o resumo e o recap;
   - o aviso de permissão só sai quando a última chamada daquela ferramenta termina, e o fim do turno
     tira o que sobrou;
   - a espera do wrap_up só é criada depois de a chamada dar certo (parte direta do achado do wrap_up).
3. **Lembrete de filha que terminou o turno** (`hooks/sessions.ts`): olhar a tarefa da rodada do
   turno que terminou.
4. **Classificação do prompt** (`hooks/prompt-submit.ts`, `hooks/sessions.ts`): marcas de outra
   sessão e de retorno de subagente só no começo do corpo. Opcional no mesmo lote, por serem guardas
   seguras: corpo vazio com anexo é pedido; o comando `task-tree` não mexe no painel.
5. **Leitura das filhas** (`hooks/sessions.ts`, `io/host.ts`, `hooks/tool-call.ts`, `io/publish.ts`)
   - uma execução por vez e a filha recém-aberta mantida (os dois achados da mesma causa);
   - sem cartão fantasma para destino que não é filha nem rodada gravada em envio que falhou;
   - higiene: não reler arquivada, cortar a profundidade ao publicar, registrar as 100 linhas (parte
     direta do achado das filhas arquivadas). Opcional: tolerar o arquivo ilegível.
6. **Rodadas e cartões** (`draw/layout.ts`; conferir o golden antes de cada commit)
   - a rodada da frente escolhida pelo tempo (turno digitado na filha);
   - o chip de sessões conta uma sessão uma vez (parte direta do achado da rodada descartada);
   - as regras de cartão valendo dentro do cartão de uma filha (netas).
7. **Fim do turno no arquivo publicado** (`types/index.d.ts`, `io/publish.ts`, `io/host.ts`,
   `hooks/panel.ts`, `draw/layout.ts`): o tempo da tarefa ◷ no cartão da filha parada.
8. **Dobras** (`hooks/render.tsx`, `hooks/tools.ts` ou `hooks/panel.ts`, `hooks/session-start.ts`): o id
   reusado não herda a dobra; o `/clear` limpa as dobras.
9. **Documentação** (`DESENVOLVIMENTO.md`, `regras/sessoes.md`)
   - fim de turno: iniciada ◷, ✕ só com Esc;
   - done da mãe com filha trabalhando: a regra de 2026-10-24 e a origem do cenário.

# Perguntas ao usuário

Na ordem das áreas; o texto completo e as opções estão em cada achado acima.

1. Nível 1 que fechou sozinho e recebe plan com o mesmo id e um passo a mais, no mesmo pedido: reabre
   mantendo os ✓ (Recomendado) ou fica como histórico com um segundo nível 1 pendente ao lado.
2. start numa tarefa que tem subtarefas: inicia a primeira subtarefa aberta (Recomendado), recusa com
   aviso, ou como hoje.
3. Tarefa de que o modelo desiste porque você mudou de rumo: ✕ fora do x/y, com um jeito de cancelar
   (Recomendado), ou ✓ como hoje.
4. Segundo plan do mesmo pedido com outro `request`: o título não muda (Recomendado) ou vale o último.
5. Depois de um fim normal de turno, a tarefa ◷ na mensagem seguinte: segue ◷ até o start
   (Recomendado) ou volta a ◉ sozinha.
6. Pedido respondido sem nenhuma tarefa: ↩ num pedido próprio quando há resumo (Recomendado) ou no
   pedido anterior.
7. Esc na principal com filha trabalhando ou subagente em segundo plano sob a tarefa: segue ◉ ou ◷
   (Recomendado) ou fica ✕.
8. Turno que morre por erro de API ou limite de contexto: ✕ "falhou" (Recomendado), ✕
   "interrompida", ou ◷ como hoje.
9. Subtarefa de origem que sai do plano num replano: o cartão sobe ao nível 1, como a carta
   (Recomendado), ou fica como hoje.
10. Cartão sem tarefa de origem que concluiu: fica no fim enquanto recente (Recomendado), escondido
    com linha sempre visível, ou como hoje.
11. Filha arquivada antiga: linha com nome e contagem (Recomendado) ou todas as tarefas, como hoje.
12. Cartão da rodada que a filha largou: palavra "substituída", cinza e fora do chip (Recomendado),
    some para "+N pedidos anteriores", ou como hoje.
13. Pergunta opcional no wrap_up de uma filha: só a que bloqueia conta como espera (Recomendado) ou
    toda pergunta, como hoje.
14. Filha parada com Esc com ✓ e pendentes: a rodada inteira fora da contagem, como hoje
    (Recomendado), ou ✓ e pendentes contando.
15. /clear numa filha: o cartão mantém o histórico (Recomendado) ou esvazia junto.
16. Tempo da tarefa concluída com filha embaixo: inclui o trabalho da filha (Recomendado), só o tempo
    próprio, ou como hoje.
17. Turnos digitados direto na filha: um cartão só naquele ponto (Recomendado) ou um por turno.

Dependências entre as respostas:
- A 3 (cancelar tarefa) e a 5 (◷ até o start) tratam do mesmo sintoma, a tarefa antiga presa quando
  você muda de rumo; a 5 resolve o desenho, a 3 dá ao modelo o jeito de encerrar.
- A 7 e a 14 tocam a decisão de 2026-11-12 ("Segue ✕ até novo start"): vale respondê-las juntas.
- A 10 perde parte do motivo com o lote 5 (a filha recém-aberta deixa de perder a origem).

# Não confirmados e o que falta

| Achado | O que falta |
|---|---|
| Comando local passa pelo prompt.submit | registrar no app `e.command?.name` e `e.origin.kind` num `/task-tree` e num `/model` com o turno parado |
| Mensagem só com imagem | o que chega em `e.text` num envio só com imagem |
| Arquivo da filha ilegível numa leitura | evidência de leitura truncada (o log de depuração não existe nesta máquina) |
| Arquivo publicado sem validade (filha morta, neta em sessão arquivada) | se o host lista rodando a sessão com pergunta aberta; se o processo morre sem publicar; se `session.end` é levantado |
| Sessões sem start_session com id (cartão clicado, hand-off) | se a lista do host as traz como abertas por esta sessão e o que o resultado da proposta traz |
| Custo das quebras de cartão com irmãs em malha | medida com 8 a 10 irmãs |

Partes não confirmadas de outros achados: a origem do clique no botão do wrap_up e do disparo
agendado (classificação do prompt), e as origens que deveriam contar como "digitado na filha".

Um registro só resolve quatro deles: uma linha de depuração no `promptSubmit` com a origem, o nome do
comando, a quantidade de anexos, a presença de `turnId` e se o texto veio vazio, lida depois de um
`/task-tree`, um `/model`, um envio só com imagem, um clique em botão do wrap_up e um disparo agendado.
