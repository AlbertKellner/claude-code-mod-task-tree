# Subagente "trabalhando" ou "em segundo plano" para sempre (rodada 2, PR #36)

Diff principal pronto: `correcao-r2-subagente-sem-fim.diff` (nesta pasta), sobre `c62ee43` + `correcao-r2-subagente-neto.diff`.
`npm run check` na cópia: todas as etapas ok (206 testes, 0 falhas; regressão: 200 testes de HEAD contra o
código novo, 0 falharam). Golden não muda. Nenhum teste existente muda. Não toca `turn.ts`, `layout.ts` nem
`tasks.ts`.

BLOQUEIO parcial: os agentes de workflow ficam como estão (o app não os lista e nenhum critério é seguro sem
decisão). Pergunta e opções na seção "Bloqueio"; a opção recomendada já está pronta e testada em
`correcao-r2-subagente-sem-fim-workflow-opcional.diff` (aplica por cima do principal; check ok, 209 testes).

## Decisão do usuário

2026-11-12, "Sim, entra nesta rodada (Recomendado)", para a opção descrita como: "O cartão vivo é conferido
contra a lista de agentes do app. Os agentes de workflow, que não aparecem nessa lista, usam outro critério.
O órfão vira "interrompido" com o tempo parado, e a tarefa de origem pode fechar."
(`orq-decisoes-altos.local.md`, "Achados novos").

## Causa confirmada

- O único fim de um cartão de subagente é o `turn.complete` dele (`subEnd`, `hooks/agents.ts`). Se esse evento
  não chega, `sub.state` fica `running` ou `background` para sempre.
- Ele não chega quando: o processo reinicia (app, `/model`, retomada) e o painel volta do store
  (`keptGroups`, `hooks/panel.ts`, devolve `sub` como estava; só as tarefas do subagente são interrompidas);
  o app para o subagente sem entregar o fim; ou o próprio hook do fim falha antes de `subEnd`.
- Efeitos, todos de `subLive(sub)`: o cartão diz "trabalhando"/"em segundo plano" com o tempo
  `agora - lançamento` crescendo a cada desenho; a pílula conta 1 subagente; `settleBySubs` pula a tarefa de
  origem enquanto houver um vivo; `trimToWork` mantém o grupo à vista; a sessão mãe mostra o mesmo no cartão
  da filha. Desde `e4f1dfa` o cartão é desenhado também sob tarefa ✓.
- Reproduzido no harness: três dos testes novos falham com o código da base (37 passam, 3 falham) e passam
  com a correção.

## Correção

### O que muda

1. `hooks/agents.ts`, função nova `checkSubs($)`: confere os cartões vivos contra `$.agent.list()`.
   - Agente fora da lista: o cartão fica "interrompido".
   - Agente listado como terminado: o cartão fica com o fim que a lista diz (`completed` → "concluído",
     `failed` → "falhou", `killed` → "interrompido"). Ver "Pontos para avaliar", item 1.
   - `end` (onde o tempo para) = o último sinal do subagente que o cartão registrou (campo novo `seen`), ou o
     lançamento quando não há nenhum. Não é a hora da conferência: depois de um reinício de horas, o cartão
     não mostra horas de trabalho que não houve.
   - No mesmo passo: a ferramenta em uso sai do cartão, as tarefas que o subagente deixou abertas ficam
     interrompidas e as esperas dele (pergunta, plano) saem, como em qualquer fim (`turnComplete` faz o mesmo).
   - Com o turno da sessão já terminado, chama `settleBySubs`: a tarefa de origem reflete o fim (✕
     "interrompida", ✕ "falhou" ou ✓), como já acontece quando um subagente em segundo plano termina depois
     do turno. Com o turno em curso, ela fecha no fim do turno, pela regra de sempre.
   - Um `turn.complete` que chegue depois grava o fim verdadeiro por cima (`subEnd` não olha o estado atual).
2. `hooks/agents.ts`, `subStep` e `subTool`: as gravações do cartão que já existem passam a levar `seen`
   (a hora). Nenhuma gravação nova.
3. `types/index.d.ts`: `Sub.seen?: number` e o comentário.
4. `hooks/sessions.ts`, `refreshChildren`: chama `checkSubs($)` no começo, antes da lista de sessões (que pode
   sair cedo fora do app ou com erro). Uma falha da conferência não derruba a releitura (`.catch`).

### Quando roda e quanto custa

- Na releitura das sessões (`refreshChildren`): o poll de 3 s, o `session.start`, um `start_session`, e as
  chamadas e os prompts do loop principal quando a última releitura tem mais de 3 s. O poll roda também fora
  do app desktop e com o turno parado.
- Não roda no fim do turno. Como o encerramento exige duas conferências (abaixo), uma chamada no
  `turnComplete` só anteciparia a primeira; o poll fecha o cartão em 3 a 6 s e a tarefa de origem logo em
  seguida. Assim o diff não toca `turn.ts`.
- Custo por releitura: uma leitura de `groups` no state. O `$.agent.list()` só é chamado quando existe cartão
  vivo que não é de workflow. O state só é escrito quando um cartão é de fato encerrado.
- Depois de um reinício, o cartão órfão ainda aparece vivo por 3 a 6 s (até a segunda conferência).

### O que protege um cartão vivo de verdade

- Só encerra o agente visto como ausente (ou terminado) em duas conferências separadas por 3 s ou mais
  (`SUB_CONFIRM`). Uma leitura só não basta: cobre o recém-lançado que ainda não entrou na lista e uma lista
  lida na hora errada. Se a conferência seguinte volta a achá-lo, a contagem recomeça.
- `$.agent.list()` lança, ou não devolve uma lista: nada é encerrado.
- Listado sem `status` (app anterior; é também o que os stubs do kit devolvem): conta como vivo.
- Listado com qualquer estado que não seja `completed`, `failed` ou `killed` (`pending`, `running`, `waiting`,
  `idle`, ou um estado novo): vivo.
- Volta do worker de hooks sem reinício do app: o painel vem do store, o app segue listando o subagente como
  rodando, o cartão fica vivo. Por isso `keptGroups` não foi alterado (ajuste da verificação da auditoria).
- Agente de workflow (`sub.run`) e tudo o que foi lançado por um (cadeia de `parent`): fora da conferência.
- Subagente de outra sessão: os grupos do state são só os desta sessão. Numa retomada, os grupos passam a ser
  os da sessão retomada e os agentes dela não estão na lista do processo novo: encerrar é o correto.
- Sem relógio: nada é encerrado.
- A memória das faltas é do módulo: uma recarga a quente só atrasa em uma conferência.

### Pontos para a orquestradora avaliar

1. Fim conforme a lista. A decisão diz que o órfão vira "interrompido". Para o agente fora da lista é o que o
   diff faz. Para o agente que a lista traz como `completed` ou `failed`, o diff usa o fim que a lista diz:
   chamar de interrompido um subagente que o app diz concluído fecharia a tarefa de origem como ✕ sem motivo.
   Para seguir só a letra ("interrompido" sempre): em `checkSubs`, trocar
   `ENDED[String(info.status)]` por `(ENDED[String(info.status)] !== undefined ? 'interrupted' : undefined)`;
   no teste "com o turno terminado…", esperar "interrompido" em "Explore: dois" e `interrompida` em "Outra";
   tirar do cenário o trecho entre parênteses sobre o fim que a lista diz; selar de novo esse teste. Recomendo
   manter como está.
2. Campo novo `seen` no cartão. Sem ele não há "último tempo conhecido": o state só guarda o lançamento.
   Cartões gravados antes desta versão (os dois casos reais da auditoria) não têm `seen` e param no
   lançamento (tempo "0:00").
3. `task-tree/DESENVOLVIMENTO.md` não foi editado (as correções anteriores da rodada também não o editaram).

## Bloqueio: agentes de workflow

O app não lista os agentes de workflow, então a conferência pela lista não serve. A decisão do usuário diz
que eles "usam outro critério", sem dizer qual. Os dois critérios da auditoria:

- Fim do run: a ferramenta Workflow responde na hora (`status: "async_launched"`, com `taskId` e `runId`) e o
  fim vem depois, como aviso de tarefa em segundo plano. O código não mostra o que chega ao mod nesse aviso;
  precisaria de um ensaio no app antes de implementar.
- Tempo sem chamadas: implementável hoje, mas não garante "nunca encerrar um vivo": um agente preso numa
  única chamada mais longa que o limite seria dado como interrompido.

Como nenhum é seguro sem decisão, o diff principal deixa os de workflow como estão (seguem vivos até o fim
deles chegar ou um `/clear`), com teste que protege isso.

Pergunta ao usuário: "Como encerrar o cartão de um agente de workflow cujo fim não chega?"

1. Tempo sem sinal, 30 minutos (Recomendado): sem chamada nem passo dele, nem de nada vivo que ele lançou,
   por 30 minutos, o cartão fica "interrompido" com o tempo parado no último sinal. Risco: uma chamada única
   de mais de 30 minutos é lida como sem sinal; o fim real, quando chega, corrige o cartão, mas a tarefa de
   origem já fechada não reabre. Pronto em `correcao-r2-subagente-sem-fim-workflow-opcional.diff`.
2. Fim do run pelo aviso do app: exige antes um ensaio no app para ver o que o aviso entrega ao mod.
3. Deixar como está: o cartão de workflow órfão segue vivo.

### O diff opcional (opção 1)

- Aplica por cima do principal. `hooks/agents.ts`: constante `SUB_IDLE` (30 min) e, em `checkSubs`, o
  encerramento por silêncio para quem é de workflow; a falha da lista deixa de sair da função e passa a pular
  só a parte da lista. `regras/subagentes.md`: cenário novo
  `subagentes.workflow-sem-sinal-vira-interrompido` e dois ajustes de texto nos cenários do diff principal.
  Três testes novos (trio com store: grava; 20 minutos depois segue vivo; 31 minutos depois "interrompido" e
  a tarefa de origem ✕).
- Check na cópia com os dois diffs: todas as etapas ok (209 testes, 0 falhas; regressão 200, 0 falharam).
- Antes do commit: trocar `<AAAA-MM-DD>` e `<palavras do usuário>` no comentário de `agents.ts` e na origem
  do cenário, e selar de novo os três testes com as palavras dele (comandos abaixo).
- Se o usuário escolher outro limite, é a constante `SUB_IDLE`, o "30 minutos" dos textos e os tempos dos
  testes 2/3 e 3/3.

## Catálogo (`regras/subagentes.md`, no fim do arquivo)

- Novo `subagentes.sem-fim-vira-interrompido`, `Estado: coberto`, `Código: hooks/sessions.ts`. Traz o caso do
  subagente em segundo plano com reinício. Aplica `subagentes.pai-reflete-falha-ou-interrupcao` e
  `subagentes.pai-conclui-no-fim-do-turno` ao fim dado pela lista, sem mudar nenhuma delas.
- Novo `subagentes.vivo-de-verdade-segue-vivo`, `Estado: coberto`, `Código: hooks/sessions.ts`: o que nunca
  encerra um cartão.
- Novo `subagentes.sem-fim-no-app`, `Estado: checklist (reinício real do app e /model com subagente em
  segundo plano)`.
- Nenhum cenário reescrito. `subagentes.cartao-fica-com-a-origem-fechada` não foi tocado.

## Testes (`task-tree/tests/subagentes.test.ts`, no fim do arquivo)

Apoio local no arquivo de teste (o kit não muda, sem selo de kit): `listaDoApp(on, ids)` registra
`agent.spawn` e um `agent.list` que o teste controla (lista com `status`, lista que falha).

1. `subagente em segundo plano e o processo novo, 1/3: o cartão vivo vai ao store`
2. `subagente em segundo plano e o processo novo, 2/3: o worker de hooks volta com ele ainda listado como rodando, e o cartão segue vivo`
3. `subagente em segundo plano e o processo novo, 3/3: o app reiniciado não o lista mais, e o cartão fica "interrompido", com o tempo parado e fora da pílula`
   (uma hora depois; o tempo do cartão fica em 0:02, o último sinal, e não anda mais)
4. `com o turno terminado, o subagente que o app passa a listar como parado ou concluído encerra o cartão, e a tarefa de origem reflete o fim`
5. `o cartão vivo não é encerrado quando a lista do app falha, vem sem o estado, ou uma só releitura deu pela falta dele`
6. `os agentes de um workflow e o que um deles lança, que o app não lista, não são encerrados pela lista`

Sem a correção falham o 3, o 4 e o 5 (a última asserção); o 1, o 2 e o 6 protegem o cartão vivo e passam
antes e depois. O 6 falha se a proteção do lançado por agente de workflow sair (conferido por mutação).
O trio depende da ordem dos testes no arquivo, como os pares de `durabilidade.test.ts`.

### Selos (tipo novo)

O diff já traz os seis em `regras/selos.json`. Se colidir nesse arquivo, aplicar sem ele
(`git apply --exclude=regras/selos.json correcao-r2-subagente-sem-fim.diff`) e selar, no Git Bash:

```bash
M='decisão do usuário, 2026-11-12: "Sim, entra nesta rodada (Recomendado)" (o cartão vivo é conferido contra a lista de agentes do app; o órfão vira "interrompido" com o tempo parado)'
F='task-tree/tests/subagentes.test.ts'
npm run regras:selar -- "$F"'::subagente em segundo plano e o processo novo, 1/3: o cartão vivo vai ao store' --tipo novo --motivo "$M"
npm run regras:selar -- "$F"'::subagente em segundo plano e o processo novo, 2/3: o worker de hooks volta com ele ainda listado como rodando, e o cartão segue vivo' --tipo novo --motivo "$M"
npm run regras:selar -- "$F"'::subagente em segundo plano e o processo novo, 3/3: o app reiniciado não o lista mais, e o cartão fica "interrompido", com o tempo parado e fora da pílula' --tipo novo --motivo "$M"
npm run regras:selar -- "$F"'::com o turno terminado, o subagente que o app passa a listar como parado ou concluído encerra o cartão, e a tarefa de origem reflete o fim' --tipo novo --motivo "$M"
npm run regras:selar -- "$F"'::o cartão vivo não é encerrado quando a lista do app falha, vem sem o estado, ou uma só releitura deu pela falta dele' --tipo novo --motivo "$M"
npm run regras:selar -- "$F"'::os agentes de um workflow e o que um deles lança, que o app não lista, não são encerrados pela lista' --tipo novo --motivo "$M"
```

Alternativa de uma linha, se só estes estiverem sem selo: `node scripts/selos.mjs --novos --motivo "$M"`.

Selos do diff opcional (trocar os marcadores pelas palavras e pela data do usuário):

```bash
M='decisão do usuário, <AAAA-MM-DD>: "<palavras do usuário>" (agentes de workflow: tempo sem sinal)'
F='task-tree/tests/subagentes.test.ts'
npm run regras:selar -- "$F"'::agentes de workflow e o processo novo, 1/3: os cartões vivos vão ao store' --tipo novo --motivo "$M"
npm run regras:selar -- "$F"'::agentes de workflow e o processo novo, 2/3: com sinal há 20 minutos, os cartões seguem vivos' --tipo novo --motivo "$M"
npm run regras:selar -- "$F"'::agentes de workflow e o processo novo, 3/3: sem sinal há mais de 30 minutos, os cartões ficam "interrompido" e a tarefa de origem reflete o fim' --tipo novo --motivo "$M"
```

## Passos da implementação

1. `git apply correcao-r2-subagente-sem-fim.diff` na raiz, de uma vez (três arquivos do mod:
   `hooks/agents.ts`, `hooks/sessions.ts`, `types/index.d.ts`; `sessions.ts` importa `checkSubs` de
   `agents.ts`, então os dois precisam chegar juntos para a recarga a quente não falhar).
2. Se `selos.json` colidiu, os comandos acima.
3. `npm run check`.
4. Commit local só dos seis arquivos (`git commit -- regras/selos.json regras/subagentes.md
   task-tree/hooks/agents.ts task-tree/hooks/sessions.ts task-tree/types/index.d.ts
   task-tree/tests/subagentes.test.ts`). Título sugerido:
   `fix(task-tree): cartão de subagente cujo fim não chega é encerrado pela lista de agentes do app`.
5. Com a resposta do usuário sobre os agentes de workflow, se for a opção 1: aplicar o diff opcional, trocar
   os marcadores, selar, check e commit à parte.

## Resultado na cópia (binário 2.1.321)

- Base conferida antes da mudança: `npm run check` ok, 200 testes.
- `npm run check` com o diff principal: ok regras (140 cobertas, 0 pendentes, 18 checklist; mapa 140 com
  código, 0 avisos), ok travas, ok selos (206 testes, 3 arquivos do kit, 4 desenhos), ok validate do
  marketplace, ok validate do mod, ok tsc, ok plugin test (206 pass, 0 fail), ok regressao (200 testes de HEAD
  contra o código novo, 0 falharam).
- `npm run testes:alterados`: "Testes existentes alterados desde HEAD: nenhum"; novos: os seis acima.
- `npm run impacto`: arquivos do mod tocados `hooks/agents.ts`, `hooks/sessions.ts`, `types/index.d.ts`;
  núcleo tocado (`types/index.d.ts`), então todos os cenários cobertos entram (144 afetados; o check roda
  todos); checklist do app: o inteiro, com `subagentes.sem-fim-no-app` novo; golden: os quatro desenhos no
  mapa, e os quatro testes de golden passam sem mudança; fora do mapa: nenhum.
- O diff foi aplicado com `git apply` num clone novo em `c62ee43` + diff do subagente neto e o resultado é
  idêntico ao da cópia validada; o opcional também, por cima.
- Base mais nova: ao terminar, o repositório real estava em `9636242` (depois de `c62ee43` entraram o
  subagente neto, a carta "não entregue" e o corte acima de 600 KB). Num clone novo nesse commit o diff
  principal aplica inteiro, `selos.json` incluído, e o `npm run check` passa: 213 testes, 0 falhas; regressão
  207 testes de HEAD contra o código novo, 0 falharam. O opcional não foi ensaiado sobre `9636242`.
- Na cópia o `validate` não gerou `task-tree/.claude-plugin/types/`; copiei a pasta do repositório.
- Os testes novos levaram de 0,6 a 1,2 s cada no check (limite de 5 s).

## Riscos e o que fica fora

- Agentes de workflow: ver "Bloqueio".
- Subagente dentro do cartão de uma filha: quem confere é a filha, enquanto o processo dela roda. Uma filha
  cujo processo morreu e não voltou continua publicando o cartão vivo, e a mãe o desenha assim até a filha
  rodar de novo. Corrigir isso na mãe é regra de desenho, fora desta decisão.
- `keptGroups` segue interrompendo as tarefas abertas dos subagentes em toda volta do store, inclusive na
  volta do worker com o subagente ainda rodando. Já era assim; não mudei.
- Cartão encerrado e agente retomado depois por mensagem (mesmo id): o cartão não volta a "trabalhando";
  recebe o fim verdadeiro quando ele termina. Já era assim para qualquer cartão terminado.
- Tarefa reaberta com start depois do último sinal do subagente órfão: o fim dele cai antes da reabertura e
  não conta para a tarefa, que fica como o turno a deixou em vez de fechar ✕
  (`subagentes.reaberta-nao-fecha-pelo-subagente-antigo`).
- O que só o app mostra: o que `$.agent.list()` devolve depois de um reinício real, de `/model` e de uma
  parada pelo app, e quanto tempo o app mantém a linha de um subagente terminado. O harness simula a lista.

## Checklist do app (`subagentes.sem-fim-no-app`)

- Lançar um subagente em segundo plano de longa duração, fechar e reabrir o app: em alguns segundos o cartão
  diz "interrompido", o tempo não anda mais e a pílula deixa de contá-lo; com o turno terminado e a tarefa de
  origem ainda aberta, ela fica ✕ "interrompida".
- Repetir trocando o modelo com `/model`, e parando o subagente pelo app.
- Salvar um arquivo do mod (recarga a quente) com um subagente rodando: o cartão segue "trabalhando" ou
  "em segundo plano".
- Lançar um subagente e olhar os primeiros segundos: o cartão não pisca para "interrompido".

## Arquivos que o diff principal toca

- `task-tree/hooks/agents.ts` (imports; `seen` em `subStep` e `subTool`; `checkSubs` novo, entre `subEnd` e
  `settleBySubs`);
- `task-tree/hooks/sessions.ts` (um import e três linhas no começo de `refreshChildren`);
- `task-tree/types/index.d.ts` (`Sub.seen` e o comentário de `Group`/`Sub`);
- `task-tree/tests/subagentes.test.ts` (três imports ampliados; apoio e seis testes no fim);
- `regras/subagentes.md` (três cenários no fim);
- `regras/selos.json` (seis selos novos).

O opcional toca `hooks/agents.ts`, `tests/subagentes.test.ts`, `regras/subagentes.md` e `regras/selos.json`.

## Colisão com o item seguinte (parada com Esc segue ✕ até o start)

- Texto: nenhum arquivo em comum entre `turn.ts`/`layout.ts`/`tasks.ts` e este diff. Colide só em
  `regras/selos.json` (comandos acima) e, se o item seguinte declarar algo perto de `Sub` em
  `types/index.d.ts`, nesse trecho.
- Comportamento: `settleBySubs` passa a ser chamado também pelo poll com o turno terminado (antes, só pelo fim
  do turno e pelo fim de um subagente), inclusive depois de um Esc, como `subEnd` já faz. Ele fecha a tarefa
  de origem com `status: 'interrupted'` de verdade e `started` apagado. Se o item seguinte guardar uma lista
  de tarefas paradas pelo Esc, uma tarefa dessa lista pode ser fechada por aqui: convém a lista ignorar (ou
  soltar) a tarefa que já não está aberta.
- `checkSubs` usa `interrupt` e `subLive` de `draw/layout.ts` sem alterá-los: se o item seguinte mudar a
  assinatura de `interrupt`, ajustar a chamada em `checkSubs` (`g.tasks.map(interrupt(end))`).
