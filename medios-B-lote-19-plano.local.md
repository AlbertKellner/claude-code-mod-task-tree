# Lote 19: o tempo da tarefa conta só com o turno em curso

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit (uma
decisão). É o maior lote da triagem B: mexe no modelo do tempo. O golden `principal` muda.

## 1. O que cobre

- Achado: "O cronômetro da tarefa retomada soma o tempo parado entre turnos".
- Decisão 26 (B), 2026-11-14: "Só com turno em curso (Recomendado)". Texto da opção: "a tarefa retoma de
  5:00; o tempo parado entre os turnos (e depois de um Esc) não entra, nem no pai, no pedido, no
  cabeçalho ou no cartão da filha visto pela mãe."

## 2. Causa confirmada na ponta

- `draw/layout.ts:119-123` (`elapsed`): o tempo de uma tarefa é o fim (ou agora) menos o primeiro start.
  `span` (`:112-118`), `timeSpan` (`:590-594`), `stillSpan` (`:576-583`) e `sessionTime` (`:613-621`)
  medem do primeiro start ao último fim (ou agora) de uma lista: o pai, o pedido, o cartão, o cabeçalho.
- `state/tasks.ts:120-134` (`begin`): o start numa tarefa aberta mantém o primeiro start e apaga o fim
  (`startedAt: t.startedAt ?? now, endedAt: undefined`); vale para a tarefa que o Esc parou.
- O fim do turno só para o relógio na cópia do desenho (`halt`, `draw/layout.ts:57-73`): no state a
  tarefa iniciada segue sem fim, e no prompt seguinte o relógio dela volta a correr desde o primeiro
  start.

No painel: start às 10:00, o turno termina às 10:05 (◷, 5:00); "continue" às 14:00: a linha mostra
4:00:05 e contando, e o pai, o pedido e o cabeçalho inflam igual. Escrito no código. Não havia regra.

## 3. O que muda

O modelo, em duas peças:

A. Os intervalos parados da sessão. O grupo principal ganha uma lista de intervalos (início e fim) em
   que a sessão esteve parada: o turno terminado e nada vivo (nenhuma sessão filha viva, nenhuma carta na
   fila, nenhum subagente vivo: a mesma condição que desliga o relógio de 1 s, `anyRunning` em
   `hooks/sessions.ts`). O último pode estar aberto (sem fim): vale até agora.
   - Abre: no fim do turno do loop principal (`hooks/turn.ts`, depois de gravar o fim do turno), se nada
     está vivo; ou depois, quando a releitura das sessões (`refreshChildren`, a cada 3 s), o fim de um
     subagente ou a entrega de uma carta deixam a sessão sem nada vivo com o turno terminado.
   - Fecha: no `wake` (`hooks/panel.ts:32-38`, todo prompt e toda chamada do loop principal), e quando
     algo volta a ficar vivo sem prompt (uma filha que volta a trabalhar).
   - Uma função só decide ("deveria estar parada?" contra "há intervalo aberto?") e só grava nas
     transições. A lista vive no grupo principal (campo opcional novo em `Group`, `types/index.d.ts`):
     vai ao store e ao arquivo publicado com os grupos, sem chave nova de state. Guardar no máximo os
     últimos 500 intervalos.
B. A pausa própria da tarefa. `TaskNode` ganha um campo opcional com os milissegundos em que a tarefa
   ficou parada com o turno em curso: a tarefa aberta que tem fim marcado (a que o Esc parou) e recebe
   start de novo soma a ele o tempo entre a parada e esse start, menos o que os intervalos da peça A já
   cobrem nesse trecho. `begin` (`state/tasks.ts`) faz a soma (recebe a lista da peça A); `carry` (o
   replano que guarda o estado) leva o campo junto com os outros.

O cálculo, em `draw/layout.ts`:

- Uma função pequena: quanto dos intervalos parados cai dentro de um trecho [de, até] (o aberto vale até
  o fim do trecho).
- `elapsed` (a folha): o trecho de hoje, menos os intervalos parados dentro dele, menos a pausa própria.
- `span`, `timeSpan`, `stillSpan`, `sessionTime` (pai, pedido, cartão, cabeçalho): o trecho de hoje,
  menos os intervalos parados dentro dele. A pausa própria de uma folha não entra aqui (o pedido seguia
  em curso em outra tarefa).
- Quais intervalos: as linhas do painel desta sessão usam os desta sessão; as linhas de dentro do cartão
  de uma filha (e o tempo do cabeçalho do cartão) usam os que a filha publicou. A linha desta sessão que
  soma tarefas de uma filha embaixo usa os desta sessão. Os grupos de subagente não têm intervalos: o
  tempo do cartão do subagente segue do lançamento ao fim.
- `hooks/render.tsx`: o tempo do cabeçalho (o do lote 18) passa os intervalos desta sessão.
- `hooks/tools.ts` (`startTool`): passa os intervalos a `begin`.

O que não muda: a tarefa concluída e reaberta com start recomeça do zero, como hoje (`begin`, ramo da
fechada); os estados e ícones; painéis e arquivos publicados antigos, sem os campos, contam como hoje
(nada é recalculado para trás).

No painel: start às 10:00, fim do turno às 10:05; "continue" às 14:00 e a tarefa segue de 5:00 (5:05
cinco segundos depois); o pai, o pedido e o cabeçalho também. Esc às 10:05, mensagem às 14:00, start na
tarefa parada às 14:10: ela retoma de 5:00; o pedido conta 15:00 (os dez minutos de turno em curso
entram no pedido, não na tarefa). No cartão de uma filha, os tempos seguem os turnos da filha.

## 4. Impacto

`npm run impacto -- task-tree/types/index.d.ts task-tree/state/tasks.ts task-tree/draw/layout.ts
task-tree/hooks/turn.ts task-tree/hooks/panel.ts task-tree/hooks/sessions.ts task-tree/hooks/tools.ts
task-tree/hooks/render.tsx`: todos os cenários (núcleo). Golden pelo mapa: os quatro; muda o `principal`
(seção 8).

## 5. Testes

Novos, em `tests/turnos.test.ts` (o tempo de uma linha é lido no fim do texto dela; o do cabeçalho, como
no lote 18):

1. "a tarefa que atravessa turnos conta só o tempo com o turno em curso, e o pai, o pedido e o cabeçalho
   também". Cenário novo `turnos.tempo-so-com-o-turno-em-curso`. Roteiro: `fixar` com `relogio`; pedido;
   plan com o nível 1 "Plano A" e a folha "Um"; start; `relogio.advance(300_000)`; fim do turno. Afirma
   "5:00" em "Um". `relogio.advance(4 * 3_600_000)`; `pedido($, 'continue')`; `relogio.advance(5000)`.
   Afirma "5:05" em "Um", em "Plano A", na linha do pedido e no cabeçalho. Falha hoje: 4:05:05.
2. "depois do Esc, a tarefa retoma do tempo em que parou quando recebe start de novo". Mesmo cenário e
   `turnos.parada-segue-interrompida-ate-o-start`. Roteiro: plan com "Um" e "Dois"; start em "Um";
   avança 5 min; `esc`; avança 1 h; pedido; start em "Dois"; avança 10 min; start em "Um"; avança 5 s.
   Afirma: "Um" mostra 5:05; a linha do pedido, 15:05. Falha hoje: "Um" com 1:15:05.
3. "no cartão da filha, o tempo parado entre os turnos dela não entra". Mesmo cenário. Roteiro: uma
   filha com o arquivo publicado escrito à mão (o campo `publicado` do kit): uma tarefa iniciada em
   `AGORA - 3_900_000` (65 min antes) e concluída em `AGORA`, e, no grupo principal, um intervalo parado
   de `AGORA - 3_780_000` a `AGORA - 180_000` (60 min parados: 2 min de trabalho antes e 3 depois).
   Afirma: a linha da tarefa no cartão mostra 5:00. Falha hoje: 1:05:00.
4. "com a filha trabalhando depois do fim do turno, o intervalo parado só começa quando ela para". Mesmo
   cenário e `cabecalho.tempo-para-no-fim-do-turno`. Roteiro: filha aberta e trabalhando; fim do turno;
   avança 10 min (cabeçalho contando); a filha para (`rodando = false`) e um `aviso` relê a lista;
   avança 1 h; pedido; avança 5 s. Afirma: o tempo do cabeçalho inclui os 10 min em que a filha trabalhou
   e não inclui a hora parada. (O `aviso` abre um turno; o roteiro termina esse turno com `fimDoTurno`
   antes de avançar a hora.)

Testes existentes: o golden `principal` muda (seção 8). Se outro teste coberto afirmar um tempo que
incluía intervalo parado, ele muda por esta decisão: o cenário dele ganha `Reescrito: 2026-11-14, decisão
do usuário ("Só com turno em curso (Recomendado)")` e o teste é selado `--tipo decisao`. Com o relógio
parado da maioria dos testes (tudo em `AGORA`), os tempos não mudam.

## 6. Catálogo e selos

`regras/turnos.md`, cenário novo:

- `### turnos.tempo-so-com-o-turno-em-curso`
- Título: "O tempo de uma tarefa que atravessa turnos conta só o tempo com o turno em curso."
- Dado uma tarefa iniciada num turno, que termina (ou é parado com Esc), e retomada mais tarde
- Quando a mensagem seguinte chega (e, depois do Esc, quando a tarefa recebe start de novo)
- Então a tarefa retoma do tempo em que parou; o tempo em que a sessão ficou parada entre os turnos não
  entra na tarefa, no pai, no pedido nem no cabeçalho; depois do Esc, o tempo até o start nela também
  não entra na tarefa (entra no pedido, se o turno estava em curso); no cartão de uma filha, vale o
  mesmo pelos turnos da filha; enquanto uma sessão filha trabalha, uma carta está na fila ou um
  subagente roda, a sessão não está parada
- `Origem: decisão do usuário, 2026-11-14 ("Só com turno em curso (Recomendado)").`
- `Código: state/tasks.ts, hooks/sessions.ts, hooks/tools.ts`
- `Estado: coberto`

Textos tocados, cada um com `Reescrito: 2026-11-14, decisão do usuário ("Só com turno em curso
(Recomendado)"): …; os testes deste cenário não mudam.`:

- `turnos.prompt-seguinte-retoma`: no Então, acrescentar "; o tempo retoma de onde parou
  (turnos.tempo-so-com-o-turno-em-curso)".
- `regras/visual.md`, `visual.desenho-principal`: `Reescrito: 2026-11-14, decisão do usuário ("Só com
  turno em curso (Recomendado)"): o tempo do cabeçalho do cenário deixa de contar o segundo parado entre
  os dois pedidos; o golden é regravado ("Validar só no fim (Recomendado)") e validado pelo usuário no
  app no fim.`

Selos (`novo`) para os quatro testes, motivo "decisão do usuário, 2026-11-14: Só com turno em curso
(Recomendado)". Forma:

    npm run regras:selar -- "task-tree/tests/turnos.test.ts::a tarefa que atravessa turnos conta só o tempo com o turno em curso, e o pai, o pedido e o cabeçalho também" --tipo novo --motivo "decisão do usuário, 2026-11-14: Só com turno em curso (Recomendado)"
    npm run golden:aprovar -- principal --motivo "\"Validar só no fim (Recomendado)\", 2026-11-14"

## 7. Documentação

`DESENVOLVIMENTO.md`: uma subseção nova em "Como é hoje", perto de "Desenho" (o tempo: de onde vem, os
intervalos parados, a pausa própria, quais intervalos cada linha usa); em "Arquivo publicado (versão 1)",
o campo novo do grupo principal; em "Estado e durabilidade", que os intervalos vivem nos grupos. Os
comentários dos tipos (`types/index.d.ts`) para os dois campos. `CLAUDE.md`: no "Checklist do app",
"tempo das linhas e do cabeçalho ao retomar depois de horas".

## 8. Golden

Muda o `principal`: entre o Esc do primeiro pedido e o segundo pedido o relógio anda 1 s com a sessão
parada; esse segundo sai do tempo do cabeçalho (0:01, depois do lote 18, passa a 0:00). As linhas do
cenário já mostravam 0:00 e não devem mudar. Os outros três não mudam (`envios`: carta na fila, a sessão
não está parada; `filha` e `subagente`: turno em curso). O implementador confere que a diferença é só o
tempo do cabeçalho.

## 9. Checklist do app

Tarefa iniciada, fim do turno, horas depois "continue": a linha retoma do tempo anterior. Esc, depois
start na tarefa parada: retoma. Cartão de filha real que ficou parada entre mensagens: o tempo das
tarefas dela não inclui a espera.

## 10. Dependências e conflitos

Este lote é o que mais cruza com as outras triagens: os três mexem nas mesmas funções de tempo de
`draw/layout.ts` (`elapsed`, `span`, `timeSpan`, `stillSpan`, `timeOf`) e em `rows` e `turnRows`.

- Depois dos lotes 15 (relógio com subagente vivo) e 18 (tempo do cabeçalho).
- Triagem A, decisão 5 ("Seguir ◷ até o start (Recomendado)", tarefa ◷ depois do fim normal): se A
  passar a guardar no state o fim da tarefa no fim normal do turno (como o Esc já faz), a pausa própria
  da peça B deste lote passa a valer também para ela, sem mudança: `begin` soma o trecho até o start.
- Triagem A, decisão 17 ("Só o próprio": o tempo da tarefa concluída com filha embaixo vai só até o
  done) e triagem C, decisão 44 ("Do primeiro start (Recomendado)", base do tempo de pai e pedido):
  mudam de onde a onde o trecho é medido; este lote só desconta, de qualquer trecho, os intervalos
  parados. O segundo a entrar aplica o desconto ao trecho que o primeiro definiu.
- Triagem C, decisão 35 ("Enxugar e esvaziar (Recomendado)", arquivos publicados): o campo dos
  intervalos do grupo principal precisa continuar no arquivo publicado (o cartão da filha depende dele).
  Decisão 33 ("✕ interrompida", app fechado no meio do turno): um processo que morre não fecha nem abre
  intervalo; no processo novo, o fim do turno volta do store e a primeira decisão da função da peça A
  abre o intervalo a partir de então. C deve conferir esse caso.

## 11. Bloqueio

Nenhum. Dois pontos de leitura, sem bloquear:

- "Parada" foi definido como turno terminado e nada vivo, para casar com a decisão 25 ("com sessão filha
  trabalhando ou carta na fila, segue contando"). O tempo da linha de uma tarefa desta sessão não corre
  nesse período de qualquer jeito (o fim do turno para o relógio dela); o que segue contando é o pai, o
  pedido e o cabeçalho.
- A tarefa concluída e reaberta com start segue recomeçando do zero (não foi perguntado).
