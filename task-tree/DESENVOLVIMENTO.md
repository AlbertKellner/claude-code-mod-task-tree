# Desenvolvendo o task-tree

Notas para quem mantém o mod. Quem só usa não precisa disto: as regras de uso vão para o
modelo pelo próprio mod (seção `task-tree:regras` do prompt de sistema, lembretes e descrições
das ferramentas). Princípio do repositório (ver "Comportamento dos mods" no
[CLAUDE.md](../CLAUDE.md)): regra nova de uso do painel entra no `RULES` e, onde couber, nos
contextos dos hooks; nunca na memória do Claude Code nem num CLAUDE.md da máquina.

## Como é hoje

Esta parte descreve o mod como o código está: escrita na fase 5 sobre a `main` `152da41` (fim da
fase 4) e atualizada na fase 6, parte A (branch `perf/fase-6-desempenho`, dez commits de desempenho
sem mudança de desenho; ver "Desempenho (fase 6, parte A)"). Cada afirmação foi conferida contra os
arquivos citados; os números de linhas são os de `wc -l` em `152da41`, para dar a ordem de grandeza. As notas de cada fase, com os
pedidos do usuário e os motivos de cada decisão, estão em "Decisões (histórico)", no fim.

### Módulos

Pasta `task-tree/`, carregada como plugin (`.claude-plugin/plugin.json`: nome `task-tree`, versão
`0.7.4`, `types: ./types/index.d.ts`). `hooks/hooks.json` aponta um módulo só: `./register.tsx`.

Quem recebe `$` (o engine) e quem não recebe:

- **Hooks** (`hooks/`), os únicos que registram hooks e que leem e gravam `$.state`:
  - `register.tsx` (31 linhas): só registra os 14 hooks, cada um pelo nome de uma função importada.
  - `panel.ts` (490): o estado do painel e como os hooks o mudam: as 14 chaves de `$.state` que este
    arquivo usa, `change`/`replace`/`persist`, os `ensure*` (volta do store sem `session.start`),
    `publishPanel`, `showPane`, `addWait`/`dropWaits`/`dropAsked`, a visão (`setView`/`restoreView`),
    o trabalho atual (`nothingOpen`/`startsWork`/`setWork`/`joinWork`; trabalho novo por turno, com `goingOn` de `draw/layout.ts`), as ligações
    (`keptLinks`/`saveLinks`/`restoreLinks`/`restoreWork`, e `renameAnchors`, que as renomeia junto
    com uma tarefa fechada renomeada pelo `plan`), `selfId`/`knownId`, `lastBrief`/`lastRecap`,
    `reminders`, `drawn`, `actions`/`act`, `DRAW_LIMIT`, `PANE`.
  - `sessions.ts` (233): as sessões que esta abriu: `refreshChildren` (os quatro passos de
    `io/host.ts`), `noteReceived`, `watchSends`, `takenNote`, `refreshStale`, `recordStart`,
    `endedNote`, os relógios (`ticker`/`tick`/`keepTime`, `POLL`/`poller`/`watchSessions`,
    `anyRunning`) e `openSession`.
  - `session-start.ts` (80): `sessionStart` (registra o comando e as três ferramentas, traz o painel
    do store, abre o pane, lê as sessões) e `classicSessionStart` (`/clear` e `resume`).
  - `prompt-submit.ts` (98): `said` (classificação pura do prompt), `promptSubmit`, `promptCompose`,
    `NO_TURN`.
  - `command.ts` (34): `commandRun` (`/task-tree [resumida|completa]`).
  - `tools.ts` (208): `planTool`, `doneTool`, `startTool` e os schemas (`node`, `level`).
  - `permission.ts` (22): `permissionRequest`.
  - `turn.ts` (87): `brief` (pura), `turnStep`, `turnComplete`.
  - `tool-call.ts` (211): o `tool.call` genérico em handlers por responsabilidade (`launch`, `asked`,
    `wrapUpAsk`, `sentMessage`, `sessionNotes`, `wrapUpOpen`, `reminder`) e o hook `toolCall`.
  - `render.tsx` (332): `render` (o pane nas duas superfícies: `drawDesktop`, `drawTerminal`), `press`,
    o atom `folds` e `setFold`.
- **IO** (`io/`), o que fala com o mundo fora do engine, com `$` só onde precisa:
  - `publish.ts` (137): o arquivo publicado: `PUBLISHED_VERSION`, `parsePublished` (pura), `waitFile`,
    `readPublished`, `publishWait`, o tipo `Publication`.
  - `host.ts` (156): a leitura das sessões filhas em quatro passos: `parseSessions` (pura),
    `listSessions`, `mineOf` (pura), `panelOf` (pura), `readFiles`, `engineText` (pura), `engineOf`
    (com o cache `engineSeen`), `deriveChildren` (pura).
  - `log.ts` (6): `debug($, texto)`, uma linha no log de depuração que nunca falha.
- **Estado** (`state/`):
  - `durability.ts` (167): a tabela de durabilidade `TABLE` e o que a lê (`rowOf`, `restoredAt`,
    `storeKey`, `STATE_KEYS`, `STORES`, `LINK_KEYS`), o conjunto `loaded`, `merge`/`current`,
    `Link`/`linkOf`, e o acesso ao store (`loadStore`, `saveStore`, `saveGroups`, `KEEP`): os únicos
    helpers fora de `hooks/` e `io/` que recebem `$`.
  - `tasks.ts` (107): as edições puras da árvore: `build`, `duplicates`, `resolve`, `edit`, `finish`,
    `fillStarts`/`fill`, `settle`, `begin`.
- **Desenho** (`draw/`), puro, sem `$`:
  - `layout.ts` (932): `layout(model, choices, now, ownId): Row[]` e os auxiliares de modelo que os hooks
    também usam (`MAIN`, `flat`, `count`, `total`, `atWork`, `current`, `split`/`breaks`/`unsent`/`resolveAnchor`, `goingOn`, `rawPanel`, `panelOf`,
    `trimToWork`, `limitRows`, `guides`, `frames`, `labelCols`, `running`, `sessionTime` etc.) e as
    constantes `DEEP` = 3, `SHOWN_TURNS` = 3, `SHOWN_CARD_TURNS` = 3, `MAX_ROWS` = 400,
    `WAIT_ORIGIN` = 10 000 ms, `REPLY` = "resposta" (exportada, mas o desenho não a usa mais: a linha ↩
    só existe com resumo, `hasBrief`).
  - `geometry.ts` (154): a geometria do desktop em px e células (`CELL` = 8, `col`, `lineWidth`,
    alturas, `overBox`, `overlay`, `overlays`, `spanOf`, `crossings`).
  - `svg.ts` (420): os construtores de SVG e os glifos do terminal (`GLYPH`, `prefix`, `clockText`,
    `slim`, `fit`/`textW`, `contextRing`, `branch`, `icon`, `rowSvg`, `labelSvg`, `headerSvg`,
    `chips`, `rowAlt`, `RING_LABEL`).
- **Textos** (`text/rules.ts`, 178): tudo o que o mod escreve para o modelo (`RULES`, `COMMAND`,
  `TOOLS`, `PROMPT`, `ASK`, `DONE`, `WRAP_UP`, `SEND`, `UNPLANNED`, `SESSION`) e `BRIEF` = 120.
- **Tipos** (`types/index.d.ts`, 145): `TaskNode`, `Turn`, `Group`, `Launch`, `Wait`, `Panel`,
  `Published`, `Child`, `Send`, `LegacyNode` e o contrato `PluginState['task-tree']` (as 16 chaves de
  `$.state`).
- **Testes** (`tests/`): ver "Testes e como rodá-los".
- `.claude-plugin/types/`: tipos gerados pelo engine em cada máquina; não versionar.

Regra de dependência que o código segue: `draw/`, `state/tasks.ts` e `text/` importam só `../types`
e uns aos outros (sem `$`); `io/` e `state/durability.ts` recebem `$` em funções de topo; `hooks/`
importa de todos e é o único lugar com `$.state.get/set` (chave literal em cada arquivo, ver "Limites
do kit"). Não há import circular entre `hooks/panel.ts` e `hooks/sessions.ts`: `sessions.ts` importa
de `panel.ts`, e `panel.ts` não importa de `sessions.ts`.

### Os 14 hooks

Na ordem de `register.tsx`:

| Evento | Filtro | Função (arquivo) | O que faz |
|---|---|---|---|
| `session.start` | | `sessionStart` (session-start.ts) | registra `/task-tree` e as ferramentas `plan`, `done`, `start`; `adopt` (lista legada), `restore` do store se o state está vazio, `restoreView`, `restoreWork`, `restoreLinks`; abre o pane; `refreshChildren` e `watchSessions` |
| `classic.SessionStart` | | `classicSessionStart` (session-start.ts) | `clear`: esvazia grupos, `waits`, `sends` e `work`; `resume`: `restore` do store |
| `prompt.submit` | | `promptSubmit` (prompt-submit.ts) | guarda `received`; reabre o pane num prompt da pessoa; prompt que continua o pedido (`NO_TURN`, aviso do app, hand-back) só ganha os lembretes curtos; os outros abrem turno, tiram a pergunta aberta, zeram `reminders` e levam os lembretes (sessão que terminou, mensagem tomada, tarefas abertas, pedido); no pedido da pessoa e no de outra sessão, zera `turnEnded` (`wake`: o que o turno anterior deixou em andamento volta a estar em andamento) |
| `prompt.compose` | | `promptCompose` (prompt-submit.ts) | com `mcp__task-tree__plan` entre as ferramentas, acrescenta a seção `task-tree:regras` (`RULES`) ao prompt de sistema |
| `command.run` | `task-tree` | `commandRun` (command.ts) | troca a visão (`resumida`/`completa`), abre o pane com pedido, publica e responde o diagnóstico (painéis e tamanho do desenho) |
| `tool.call` | `mcp__task-tree__plan` | `planTool` (tools.ts) | `build` + `duplicates`; substitui no lugar (e no turno dele) um nível 1 aberto com o mesmo id só se for do pedido aberto agora (o último turno); um aberto de pedido anterior é interrompido e renomeado (`<tag>:id`) e fica no pedido antigo como histórico, e o novo vai para o turno novo; renomeia um fechado que colide (`<tag>:id`) e, com eles, as ligações das sessões, dos `launches` e dos `sends` que apontavam para ele (`renameAnchors`), põe os níveis 1 no turno atual (que `request` renomeia), tira os `sends` do que foi replanejado, junta ao trabalho atual, ou começa o trabalho novo numa mensagem nova, mantendo só os níveis 1 anteriores ainda abertos (`startsWork`/`joinWork`/`goingOn`), abre o pane |
| `tool.call` | `mcp__task-tree__done` | `doneTool` (tools.ts) | grava `summary` em `brief`; `resolve` + `fillStarts` + `finish` + `settle` por id; avisos: inexistente, de outro agente, ambíguo, interrompida, mensagem na fila, falta o `summary`, etapas fechadas juntas sem `start`; NÃO tira mais os `sends` das tarefas fechadas: o ✉ fica até a entrega (`watchSends`), mesmo com `done` logo depois do `SendMessage` |
| `tool.call` | `mcp__task-tree__start` | `startTool` (tools.ts) | `resolve` + `begin` (reabre pais; recusa pai concluído com filhos); `joinWork`; `keepTime` |
| `classic.PermissionRequest` | | `permissionRequest` (permission.ts) | um aviso `permission` por ferramenta, exceto `AskUserQuestion` e `ExitPlanMode` |
| `turn.step` | | `turnStep` (turn.ts) | publica `engine` (`engineText(model, effort)`) quando muda |
| `turn.complete` | | `turnComplete` (turn.ts) | tira pergunta/plano do agente; no loop principal grava no último turno com tarefas o `reply` (recap do `wrap_up`, senão `answer`, até 600 caracteres) e o `brief`, zera `recap` e `brief`, publica; um subagente que não é teammate tem o que deixou aberto interrompido; no loop principal grava `turnEnded` (a hora do fim do turno) |
| `tool.call` | (genérico) | `toolCall` (tool-call.ts) | ver "Fluxo de dados" |
| `ui.press` | | `press` (render.tsx) | responde pela chave do botão com a ação mais recente (`actions`) |
| `ui.render` | `Pane`, `task-tree` | `render` (render.tsx) | religa os relógios (`keepTime`, `watchSessions`) e desenha; ver "Desenho" |

Os três `tool.call` das ferramentas do painel respondem sem chamar `next`: o genérico não roda para
elas (por isso cada uma marca `reminders.planned` por conta própria).

### Fluxo de dados

**Toda escrita do painel passa por `change($, fn)`** (`hooks/panel.ts`): `ensureGroups`, `ensureView`,
`ensureWork` (volta do store se o módulo ainda não a fez), `adopt` (a lista legada `tasks` entra no
grupo principal uma vez), `update(groupsState, fn)` sobre `withMain(grupos)` e `persist`: `showStatus`
(`$.ui.status` "Tarefas d/n", chamado só quando o texto muda: `lastStatus`, variável do módulo),
`saveGroups` (store `session:<uuid>` e a lista `sessions`, as `KEEP` = 30 mais novas) e
`publishPanel`. `replace` grava direto e persiste (resume, `/clear`).

**O `tool.call` genérico** (`hooks/tool-call.ts`), em torno de `Call = { agent, e, sentAt, r }`:

1. Antes da chamada: `launch` (uma chamada `Agent`/`Task` grava em `launches` a tarefa em andamento do
   laço que lançou, com a descrição; o grupo do subagente a reclama em `identify`); `asked` (uma
   `AskUserQuestion` do loop principal sem tarefa aberta é recusada com `deny`; senão a pergunta ou o
   `ExitPlanMode` vira um aviso enquanto `next(e)` roda, e a resposta volta com `ASK.answered` ou
   `ASK.inChat`); `wrapUpAsk` (um `mcp__ccd_turn__wrap_up` grava o `recap` no state e, com `ask`, o
   aviso `choice`, chave `<agente>:wrap_up:ask`).
2. `sentAt` é lido antes de um `SendMessage`; a chamada roda; o aviso `<agente>:<tool>` sai.
3. Só no loop principal, depois da chamada: `keepTime`, `watchSessions`, `refreshStale` (a lista do
   host de novo, se tem mais de `POLL` ms); um `mcp__ccd_session__start_session` passa por
   `recordStart` (o id `local_…` do resultado entra em `children` com a tarefa em andamento como
   `anchor`); então, por nome e nesta ordem, `sentMessage` (grava a rodada em `Child.rounds` e
   `lastAnchor`, o envio em `sends`, e avisa se ficou na fila), `sessionNotes` (`endedNote`,
   `takenNote`), `wrapUpOpen` (falta o resumo; tarefas abertas) e, por último, `reminder` (a primeira
   chamada sem plano aberto e cada 10ª depois dela ganham `UNPLANNED`).

**Um prompt** (`hooks/prompt-submit.ts`): `said(text)` tira os `<system-reminder>` e classifica em
mensagem de outra sessão (`peer`, `<cross-session-message`), volta de subagente (`handback`), aviso
do app (`notice`: corpo vazio ou `<side-sessions-event>`) ou pedido. `noteReceived` guarda `from`/`at`
das mensagens de outras sessões (os últimos 20) e publica. Um prompt de origem `NO_TURN`
(`task-notification`, `observer`, `observer-activity`, `auto-continuation`, `unclassified`), um aviso
ou um hand-back não abre turno: leva só `endedNote`, `takenNote` e um lembrete curto (`PROMPT.handback`,
`.background` ou `.notice`). Os outros (a pessoa, outra sessão) tiram a pergunta aberta do loop
principal, zeram `reminders.unplanned`/`planned`, abrem um turno (`openTurn`: título com até 60
caracteres da mensagem sem tags; turnos sem tarefa são descartados, por um `Set` dos turnos das
tarefas), releem a lista se está velha e
levam `PROMPT.open` (as tarefas abertas antes; com `answeredInChat`, "esta mensagem é a resposta") e
`PROMPT.request`.

**As sessões filhas** (`hooks/sessions.ts` + `io/host.ts`): `refreshChildren` roda no
`session.start`, a cada `POLL` = 3 000 ms (`watchSessions`, recriado a cada chamada e prompt do loop
principal porque a recarga do mod cancela o intervalo), depois de um `start_session`, num aviso do
app e quando a lista está velha (`refreshStale`). Passos: (1) `listSessions` (`list_sessions` com
`linked: true, include_archived: true, limit: 100`; falha vai para `childrenError`, mostrada só no app
desktop, `inDesktopApp`, e gravada só quando o texto muda); `watchSends` antes de qualquer retorno
(destino que publica `received`: cada envio pendente, do mais antigo ao mais novo, casa com a SUA
mensagem recebida desta sessão, a mais antiga ainda não casada com `at` ≥ envio, uma vez só
(`usedReceipts`); destino sem `received`: um turno dele depois do envio, senão
parada-depois-rodando; um envio confirmado fecha a tarefa de origem se ela está aberta
sem subtarefa aberta); lista vazia zera `children` (uma vez, não a cada poll); `mineOf` (as linhas
cujo `startedBy` é um id que a lista não traz, o desta sessão); (2) `readFiles` (cada arquivo
publicado por `readPublished`; o modelo por `engineOf` quando o arquivo não o traz, cache de 60 s);
(3) `deriveChildren` (as filhas a partir das linhas, dos arquivos, das conhecidas antes e das
ligações do store por `keptLink`; `ended` = as que corriam ou esperavam e pararam, exceto
`starting`); `children` só é gravado no state quando a lista derivada difere da atual (JSON): o poll
sem novidade, o de sempre a cada 3 s, não faz o valor inteiro cruzar para o host nem redesenha;
(4) `showStatus` e `publishPanel`; `keepTime`.

**Relógios**: `ticker` (`$.clock.every(1000)`, `tick` invalida o `ui.render` enquanto `running`; cancela
quando nada roda) e `poller` (3 s). Os dois são variáveis de módulo: uma recarga os perde e a próxima
chamada, prompt, `start` ou desenho do pane os recria. O desenho (`ui.render`) chama `keepTime($)` e
`watchSessions($)` logo depois dos `ensure*` (as notas de `ticker` e `poller` em
`state/durability.ts` dizem o mesmo): o app desenha o pane quando o mod carrega, e cada
edição salva do clone recarrega o mod em todas as sessões, então sem esse religamento uma tarefa
cronometrando ficava com o pane parado até o próximo evento (trocar de visão redesenhava). Os dois
não fazem nada se já estão ligados; o de 1 s só liga enquanto algo roda; o kit recusa só
`$.state.set` durante o desenho, não `$.clock.every`.
Como todo desenho chama `keepTime`, ele tem no máximo um relógio de 1 s: a marca `starting` (variável de
módulo de `hooks/sessions.ts`) é ligada antes do primeiro `await`, desligada no `finally`, e o
`keepTime` sai cedo com `ticker || starting` e confere `ticker` de novo depois dos `await`
(`anyRunning`, `stamp`). Sem ela, desenhos ao mesmo tempo criavam cada um o seu `$.clock.every(1000)` e
só o último ficava guardado para cancelar: os outros redesenhavam o painel a cada segundo, sem parar, em
rajadas que trocavam os `Button` debaixo do ponteiro, e o clique se perdia (sintoma do usuário: "preciso
clicar algumas vezes no icone para a acao acontecer, é bem demorado", em qualquer ícone). Conferido: as
chaves dos `Button` são estáveis (`fold:<chave da linha>`, `open:<id da sessão>`), só o relógio chama
`$.ui.invalidate`, e o poll de 3 s só grava o estado quando ele muda. Falta conferir no app se o clique
pega de primeira.

**Publicação** (`publishPanel` em `hooks/panel.ts` → `publishWait` em `io/publish.ts`): pedida a cada
`persist`, aviso, `received`, `engine`, fim de turno, poll com filhas e `/task-tree`; o arquivo só é
gravado quando o corpo muda, e o registro de ligações (`saveLinks`, antes de cada publicação) só vai
ao store quando muda (`lastLinks`). Ver "Arquivo publicado".

### Estado e durabilidade

Três camadas guardam dados, e cada uma morre num momento: `$.state` sobrevive à recarga a quente do
mod (salvar um arquivo) e morre com o processo (crash do hooks worker, `/model`, reinício do app);
`$.store` sobrevive a tudo, com chave por sessão (`<prefixo>:<uuid do $.session.id()>`); uma variável
de módulo morre na recarga. Como a recarga não roda `session.start`, e um processo que reiniciou sem
ele parte de state vazio, o que vive no store volta também no primeiro uso depois (`loaded`, em
`state/durability.ts`; `ensureGroups`/`ensureView`/`ensureWork` e `saveLinks`→`restoreLinks` em
`hooks/panel.ts`).

A tabela `TABLE` de `state/durability.ts` diz, por chave: onde vive (`lives`), o prefixo do store
(`store`; `field` quando é um campo do registro `links`), como a cópia do store encontra o state
(`merge`), quantas entradas ficam (`keep`), quando volta (`restoredAt`). `tests/durabilidade.test.ts`
a põe à prova linha a linha e falha numa chave de state ou prefixo de store sem linha.

| Chave | Vive | Store | Fusão | Volta em | O que é |
|---|---|---|---|---|---|
| `groups` | state+store | `session` | current | start, resume, first-use | os grupos (tarefas, turnos, respostas); no resume o store substitui; subagentes voltam com o aberto interrompido |
| `tasks` | state | | none | | legado: a lista única de antes dos grupos, movida para o grupo principal uma vez (`adopt`) |
| `view` | state+store | `view` | current | start, first-use | a visão (`summary`, padrão de sessão nova, ou `full`); vai ao store só no clique (`setView`) |
| `work` | state+store | `work` | current | start, first-use | os níveis 1 do trabalho atual (a visão resumida) |
| `children` | state+store | `links` (campo) | fill | start, first-save | as sessões abertas por esta, como o host lista; o store guarda só as ligações (`Link`: id, name, title, anchor, lastAnchor, rounds), também de sessões que o host deixou de listar (`keptLinks`) |
| `sends` | state+store | `links` (campo) | union | start, first-save | mensagens a outras sessões ainda não tomadas |
| `received` | state+store | `links` (campo) | union, 20 | start, first-save | mensagens de outras sessões recebidas |
| `launches` | state+store | `links` (campo) | union, 20 | start, first-save | chamadas `Agent` ainda não reclamadas por um grupo |
| `waits` | state | | none | | o que espera a pessoa (pergunta, plano, permissão, `choice` do wrap_up) |
| `engine` | state | | none | | modelo e esforço do loop principal, publicados |
| `ended` | state | | none | | sessões cujo turno terminou, até o lembrete |
| `childrenError` | state | | none | | por que a lista do host falhou |
| `brief` | state | | none | | o `summary` do `done` até o fim do turno |
| `recap` | state | | none | | o `recap` do `wrap_up` até o fim do turno |
| `collapsed` | state | | none | | as linhas que a pessoa recolheu ou abriu (atom `folds`) |
| `turnEnded` | state | | none | | a hora em que o turno desta sessão terminou, até o próximo prompt (então `null`): o que ela deixou aberto é desenhado interrompido, sem relógio |
| `sessions` | store | `sessions` | none | | as sessões com painel guardado, a atual primeiro, `KEEP` = 30 |

Fusões: `current` (o state vence; o store só com state vazio), `fill` (cada sessão do state ganha
do store o `anchor`, `lastAnchor` e `rounds` que não tem; state vazio pega o store inteiro), `union`
(as entradas do store que o state não tem vêm primeiro, depois as do state, cortadas em `keep`),
`replace` (o store substitui, usado no resume), `none`.

Variáveis de módulo com linha na tabela (recarga as zera): `loaded`, `keptLinks`, `ownId`,
`refreshedAt`, `drawSize`/`drawRows`/`renderError` (hoje os campos de `drawn` em `hooks/panel.ts`),
`actions`, `ticker`, `poller`, `starting` (a marca do `keepTime`, em `hooks/sessions.ts`, sem linha na tabela), `engineSeen` (em `io/host.ts`), `unplanned, planned, answeredInChat`
(hoje `reminders` em `hooks/panel.ts`) e, da fase 6, `lastPublished, lastLinks, lastStatus` (o último
arquivo publicado por caminho, sem relógios nem `panes`; o último registro de ligações gravado; o
último texto do status: cada um só é escrito de novo quando muda, e uma recarga escreve cada um uma
vez a mais, sem dano), `home` (a pasta do usuário, pedida ao host uma vez por módulo) e
`usedReceipts` (as mensagens recebidas por outras sessões que já casaram com um envio desta, chave
`<id da sessão>|<at>`; uma recarga recomeça). Duas linhas
sobraram da fase 2 e não têm mais variável no código: `drawNow` e `breaksMemo` (o `layout()` recebe
`now` e cria um `BreaksMemo` por desenho).

Quem traz do store e quando: `session.start` (`restore` se o state não tem grupos, `restoreView`,
`restoreWork`, `restoreLinks`); `resume` (`restore`, que substitui); primeiro uso (`ensureGroups`,
`ensureView`, `ensureWork`, chamados em `change`, `publishPanel`, `nothingOpen` e no `ui.render`, que
não pode gravar e usa o valor devolvido); primeira gravação das ligações (`saveLinks` chama
`restoreLinks` antes). O `ensure*` só marca `loaded` quando o state recebeu o valor.

### Arquivo publicado (versão 1)

Cada sessão escreve `~/.claude/task-tree-waits/<id local_…>.json` (`waitFile`: `USERPROFILE`, senão
`HOME`, pedidos ao host uma vez por módulo e guardados em `home`; fora do app desktop não há id e nada
é publicado). A sessão que a abriu lê o arquivo para desenhar o cartão dela. É o contrato entre
sessões, que podem rodar versões diferentes do mod.

O que `publishWait($, id, publicação)` escreve, nesta ordem de chaves (`satisfies Published`):
`version` (= `PUBLISHED_VERSION` = 1), `waiting` (há aviso), `at`, `tasks` (o grupo principal, para
leitores antigos), `groups`, `waits`, `children`, `context` (`{ percent, at }` de `$.session.usage()`),
`engine`, `panes` (`$.ui.panes()`: id, `isPlaced`, `isShown`), `renderError`, `drawSize`, `rows`,
`work`, `received`, `sends` (só os não tomados). `JSON.stringify` omite o que está `undefined`.
`publishPanel` junta tudo do state (sete `$.state.get`) e de `drawn`, e qualquer falha vai só ao log.

Gravado só quando muda (fase 6): `publishWait` monta o corpo sem `at`, `context.at` e `panes`, compara
o JSON dele mais o `percent` do contexto com o último publicado para o caminho (`lastPublished`,
`Map` do módulo) e volta sem gravar quando é igual; `$.ui.panes()` e `$.clock.now()` só são pedidos
quando vai gravar. Ninguém lê o `at` do arquivo (os `at` que importam, dos turnos e das mensagens,
estão dentro do painel); o relógio ou os painéis sozinhos não contam como mudança, uma espera nova
conta. O formato não mudou: os mesmos campos, na mesma ordem, `PUBLISHED_VERSION` 1.

Leitura: `parsePublished(texto)` (pura) devolve `{ ok }` normalizado ou `{ error }`: JSON inválido,
não-objeto, ou `version` presente e ≠ 1. Normaliza: listas só se são listas (`waits` e `children`
vazias por padrão), `waiting` só `=== true`, `context` só com `percent` e `at` numéricos, `engine` só
string não vazia, `work` mapeado a string; `panes`, `drawSize` e `rows` não saem na leitura (são para
olhar o arquivo à mão). `readPublished($, id)` lê, valida e diz uma vez por sessão e motivo no log
("task-tree: arquivo publicado de <id> ignorado: <motivo>"); arquivo inválido vale como ausente. Um
arquivo de antes de `version` é lido como está; `panelOf` (io/host.ts) aceita `groups` ou, de versões
antigas, só `tasks`. `tests/fixtures/publicados.ts` guarda um arquivo real de cada um dos 8 formatos já
escritos (do `{ waiting, at }` ao de versão 1), e `tests/publicado-versoes.test.ts` lê todos.

### Textos para o modelo

`text/rules.ts` concentra tudo o que o modelo lê do mod; o golden `tests/golden/textos.ts` (23
textos) os fixa letra por letra. `RULES` vai ao prompt de sistema (seção `task-tree:regras`, escopo
`session`) em todo pedido que oferece a ferramenta `plan`; `COMMAND` e `TOOLS` são as descrições
registradas no `session.start`; `PROMPT` os contextos do `prompt.submit`; `ASK`, `DONE`, `WRAP_UP`,
`SEND`, `UNPLANNED` e `SESSION` os avisos nos resultados das ferramentas. O limite do resumo ↩ é um só,
`BRIEF` = 120, interpolado em cada texto que o cita. Os resultados das ferramentas ("Plano exibido…",
"Concluídas: d/n…", "Em andamento: …") e os textos do desenho (`alt`, rótulos) ficam fora dele.

### Desenho

`ui.render` (`hooks/render.tsx`) lê o state uma vez (grupos, visão e trabalho com os `ensure*`, avisos,
sessões, erro da lista, envios pendentes, `folds`), monta o `Model` e chama `layout()`
(`draw/layout.ts`, puro): `panel()` percorre os grupos, os turnos (`turnRows`), as tarefas (`rows`),
os cartões das sessões (`session`, cada uma dividida por mensagem em `split`) e os grupos de
subagente (`draw`), nas duas visões (a resumida é `trimToWork` do painel). `limitRows` corta em
`MAX_ROWS` = 400. Daí `Row[]`: profundidade, tom (`open`, `current`, `done`, `interrupted`, `wait`,
`running`, `archived`, `agent`, `section`, `sent`, `paused`, `reply`), título, contagem, tempo,
`fold`, `card`, `session`, `ring`, `engine`, `nodes` (as tarefas que a linha representa, para o
cabeçalho somar só o que está desenhado). O cabeçalho é calculado no render a partir das linhas
(`count` dos `nodes`, `sessionTime`, `chips`); o total da sessão inteira vai no `alt`.

O que a fase 6 (parte A) mudou nesse caminho, sem mudar uma linha nem um byte do desenho:

- `layout()` monta as linhas numa passada só, com as escolhas da pessoa desde o início; a passada
  sem escolhas com resultado descartado (herança do render antigo, que tirava dela os chips) saiu:
  os chips vêm dos `nodes` das linhas desenhadas, e o memo dos `breaks` que ela preenchia era o mesmo.
- Cabeçalho (`render.tsx`): o id da tarefa acesa (`current(mainTasks).lit[0]`) é calculado uma vez,
  fora do `find` (dentro dele, `current` percorria a árvore inteira uma vez por nível 1). Correção
  seguinte (título do cabeçalho): o título é o nível 1 que contém a tarefa iniciada por último, a
  âncora de `current()` (a mesma tarefa sob a qual vai um aviso de espera); sem nenhuma em andamento, o
  nível 1 da tarefa iniciada por último (`startedLast`, concluída ou não; o título é o do passo
  iniciado por último); senão o ÚLTIMO nível 1 com sessão viva embaixo (era o primeiro: nomeava uma
  tarefa de muitos pedidos antes; o título de tarefa muito antiga que o teste visual achou ficou
  fechado com isso); senão a primeira aberta. O título vinha de `current(mainTasks).lit[0]`, o primeiro das tarefas acesas,
  ordenadas da iniciada há mais tempo para a mais recente, e uma tarefa que um pedido antigo deixou
  aberta e iniciada ganhava da atual. Os números do cabeçalho não mudam: seguem a soma das linhas
  desenhadas na visão (ver "Cabeçalho por visão" no histórico). Teste:
  `tests/cabecalho-tarefa-atual.test.ts` (2).
  Regra dos números, confirmada por testes sem mudança de código (nas palavras do usuário: "deve somar
  as tarefas que estão sendo mostradas na listagem. a visão resumida mostra somente informacoes dessa
  visao" e "as colapsada, mas que estao nessa visao, tambem entram"): cada visão conta as tarefas que
  ela inclui, inclusive as recolhidas (cartão, tarefa ou pedido recolhido pela pessoa), porque o
  `Row.nodes` da linha recolhida leva o que está embaixo, cartões inclusive, via `Work.cards`. Fica de
  fora o que a visão não inclui: na resumida, os pedidos finalizados de turnos anteriores e, dentro de
  um cartão, o que o corte do cartão para o trabalho atual dele tira (`trimToWork` recursivo); na
  completa, o que o limite corta ("+N pedidos anteriores", "+N cartões antigos"). Testes, em
  `layout.test.ts`: "recolher cartões e tarefas não muda os números, nas duas visões" (estado real, cada
  dobra de uma vez e depois todas) e "a resumida deixa de fora o pedido finalizado e o cartão dele; a
  completa conta os dois" (modelo pequeno: completa 5/6, resumida 1/2, e com tudo recolhido os números
  se mantêm).
- `split()` devolve um cartão já cortado (`c.part` definido, os da visão resumida) antes de calcular
  `breaks`; dentro, a parte de cada turno (`partOfTurn`), as tarefas e o `flat` de cada parte
  (`tasksByPart`, `flatIn`) e a parte de cada tarefa (`partOfTask`, usada por `holder`) ficam em mapas
  montados uma vez por chamada; o dono de cada agente (`ownerOf`) é lembrado; `turns` e `work` dos
  cartões são filtrados por `Set`.
- Os pedidos (turnos) com tarefa de nível 1 são achados por um `Set` dos turnos das tarefas (no
  `panel()`, para os cartões antigos, e em `openTurn`): uma passada por lista, não uma pelas tarefas
  por turno.
- `atWork` roda uma vez por tarefa e passada: dentro de `body`, um `WeakMap` por tarefa guarda o
  `Work` que `turnRows` (soma do pedido) e `rows` (a linha da tarefa) pedem.
- Tarefa da mãe concluída com `done` (decisão do usuário: "um done explícito da mãe deve valer como
  concluído; o progresso das filhas fica no cartão delas"): `atWork(t, sessions, level)` só soma ao d/n,
  ao tempo e ao `busy` (que deixa a tarefa em andamento) as sessões abertas numa tarefa não concluída; a
  subárvore de uma tarefa `done` fica de fora (`open(k)` = `[]` se `k.status === 'done'`, senão `[k.id,
  ...filhos]`). Antes, uma tarefa concluída com uma filha ainda trabalhando aparecia ◉ "3/4", com o
  tempo correndo; agora aparece ✓ com a contagem própria (ex.: "✓ Investigar ⑂ 2/2 0:05"), e o cartão da
  filha mostra o estado e a contagem dela. Uma tarefa aberta continua em andamento e somando as tarefas
  da sessão. O pedido (`turnRows`) com todas as tarefas concluídas com `done` fica concluído (e ✕ se
  alguma tarefa em qualquer nível foi interrompida) e não soma
  as sessões. `Work` ganhou dois campos: `live` (há sessão viva em qualquer ponto abaixo; `trimToWork` o
  usa para manter na resumida o nível 1 com sessão trabalhando, o corte da completa em `layout()` mantém
  o pedido com sessão viva, e o título do cabeçalho sem tarefa acesa usa o primeiro nível 1 com sessão
  viva abaixo) e `cards` (todas as tarefas das sessões abaixo, inclusive as de baixo de tarefa
  concluída: é o que o `Row.nodes` de uma linha recolhida, tarefa ou pedido, soma, então recolher não
  muda o cabeçalho). `any` continua marcando o ⑂. O cabeçalho segue somando os nós das linhas
  desenhadas, os cartões inclusive. Testes: `tests/mae-concluida.test.ts` (2).
- `fit` (`svg.ts`) é linear no título: acumula a largura do que fica com os mesmos termos e na
  mesma ordem de `textW` (mesma soma em ponto flutuante, mesmo corte) em vez de medir o prefixo
  inteiro a cada caractere; `em(ch)` lembra a largura de cada caractere num `Map` do módulo.
- `slim` (`svg.ts`) guarda a folha `<style>` por conjunto de classes num `Map` do módulo (chave: os
  atributos `class` na ordem em que aparecem, lidos numa passada; o `Map` é esvaziado ao passar de
  1 000 entradas); as linhas de um mesmo tipo compartilham a folha.

Âncoras e ids reutilizados (correção depois da fase 6, branch `fix/cartoes-na-tarefa-errada`): os
planos reutilizam ids de nível 1 ("1", "2", "3") a cada pedido, e o `plan` renomeia a tarefa fechada
cujo id o plano novo toma (`<tag>:id`). As ligações das sessões guardavam o id curto e passavam a
apontar para a tarefa nova: numa pergunta simples da orquestradora, sem envio de mensagem, os cartões
das filhas de pedidos anteriores apareciam sob a tarefa do turno atual. Dois pontos:

- Raiz, `renameAnchors($, ids, tag)` em `hooks/panel.ts`, chamada pelo `planTool` logo depois de
  renomear: toda âncora `a` com `a === id` ou `a` começando por `id/` vira `tag:a`, em `children`
  (`anchor`, `lastAnchor`, `rounds[].anchor`), `launches` (`anchor`), `sends` (`anchor`) e na cópia do
  módulo `keptLinks` (para a próxima gravação das ligações levar os ids renomeados).
- Dados antigos, `resolveAnchor(owner, anchor, at)` em `draw/layout.ts` (pura): para estados já
  publicados ou guardados antes da regra, uma âncora é resolvida pela tarefa que tinha aquele id no
  momento `at`: só quando a tarefa que hoje tem o id foi planejada depois do momento (`plannedAt > at`)
  e existe uma renomeada (`*:id`, um só prefixo) planejada antes, a âncora passa a ser a última dessas;
  em qualquer outro caso (tarefa do id planejada antes, sem `plannedAt`, sem renomeada) fica como está.
  Usada em `breaks` (as rodadas da própria sessão pelo `at` de cada rodada; a âncora de uma irmã pelo
  início do trabalho dela, `begins`) e em `split` (o `anchor` do cartão pelo início do trabalho da
  sessão; o `lastAnchor` pela última rodada, senão pelo início).

Teste: `tests/cartoes-ancora.test.ts` (3): dois de layout com tarefas renomeadas (`ab12:1`, `cd34:1`,
uma e duas renomeações do mesmo id) e um pelas ferramentas (`plan` "1" → sessão aberta nela → `done`
→ pedido novo com `plan` "1" → o cartão fica na tarefa velha). Goldens e orçamento iguais.

Cartões no lugar certo (série de correções seguinte; regra do usuário: "se existirem tarefas em
andamento, essas tarefas devem continuar sendo mostradas"; todo cartão aparece desde o primeiro
desenho sob a tarefa que mandou a mensagem, aberto, e só o clique da pessoa o recolhe, com a escolha
mantida), em `draw/layout.ts`:

- A chave de recolher do cartão k > 0 é `s:<id>#<partAt>`, com `partAt` o `at` da rodada (campo novo
  `Child.partAt`, "Drawn only", gravado por `split`); a parte 0 segue `s:<id>`. Antes era o índice da
  rodada: as rodadas ficam nas últimas 20 e, no teto, cada mensagem nova descarta a mais antiga e
  desloca todos os índices, e o recolhimento passava para outro cartão (um cartão novo vinha
  recolhido). As escolhas antigas com `#<índice>` deixam de valer uma vez.
- Resumida (`trimToWork`): um nível 1 com sessão trabalhando embaixo (`atWork(t, children, level).live`)
  fica no recorte, com o seu pedido. O `cut()` não realoca mais a âncora de cartão nenhum: só divide
  as sessões em cartões (`split`) e passa a `trimToWork`, e cada cartão fica sob a tarefa que mandou
  a mensagem, como na completa (antes, um cartão sem parte ia para a tarefa da última mensagem,
  `lastAnchor`, se ela estivesse no trabalho, ou solto no fim da lista se a sessão estava viva).
  Princípio, nas palavras do usuário: "a visão completa parece mais correta que a resumida"; a
  resumida é a completa sem os pedidos finalizados de turnos anteriores e nunca reposiciona cartão.
  `lastAnchor` continua gravado e publicado, mas o desenho não o usa mais para posicionar. Com isso
  o cartão de uma sessão viva, que sumia da completa (pedido de origem fora dos 3 últimos) e ia para
  o fim da resumida, aparece sob a tarefa de origem nas duas visões.
- Completa: o corte dos 3 últimos pedidos (`SHOWN_TURNS`) mantém também o pedido cujo nível 1 tem
  sessão trabalhando embaixo (`work(t).live`), como já mantinha o que tem algo aberto.
- Turno em lote (regra do usuário: "concordo com a opcao 1", com o princípio dele: "quero ver as tarefas
  lineares andando de cima pra baixo. as paralelas vão andar fora de ordem, normal, mas as lineares
  precisam seguir uma linha do tempo"): mensagens enfileiradas para uma sessão ocupada são entregues de
  uma vez e abrem um único turno dela; o trabalho só começa depois da última, então o cartão desse turno
  fica sob a tarefa da ÚLTIMA mensagem do lote, e as tarefas ✉ das anteriores fecham com a entrega, sem
  cartão. Em `split`, na parte de cada turno (`partOfTurn`), os turnos da sessão são percorridos em
  ordem de tempo: um turno que recebeu mensagens desta sessão (o `received` publicado por ela tem
  recebimento desta sessão com `at` depois do turno anterior e até o turno) vai para a rodada da ÚLTIMA
  mensagem desta sessão enviada desde o turno anterior (rodada não-irmã com `at` depois do turno
  anterior e até o turno); qualquer outro turno (aberto por uma irmã, ou mais antigo do que os 20 que o
  `received` guarda) vai para a última rodada antes dele, como antes. Sob uma mesma tarefa, os cartões
  seguem a hora em que cada sessão começou a trabalhar. (Regra substituída: na série anterior o cartão
  do lote ia para a tarefa da PRIMEIRA mensagem; o caso real que a derrubou: "uma rodada basta" e o bug
  dos cliques foram entregues juntos, o cartão com o trabalho apareceu sob a primeira e o pedido dos
  cliques ficou sem cartão.)
- Teste: `tests/cartoes-lugar.test.ts` (8, incluindo as três do lote: "quatro mensagens na fila
  entregues juntas: o cartão do turno vai para a tarefa da última", "o caso real: "uma rodada basta" e
  o bug dos cliques entregues juntos: o trabalho fica sob o pedido dos cliques" e "uma mensagem por turno: cada
  cartão sob a tarefa da sua mensagem", além de "sessão sem rodadas: o cartão não muda de lugar
  na resumida" e "estado real: cada cartão da resumida está sob a mesma linha que na completa");
  `layout.test.ts`, `task-tree.test.ts` e
  `resumida-turno.test.ts` foram atualizados (e, em `task-tree.test.ts`, "mensagem à filha numa
  tarefa do trabalho atual: a resumida não muda o cartão de lugar") para a regra nova. O orçamento cresceu 84 bytes nas
  quatro medidas (chaves dos botões mais longas), dentro da folga.
- Cadeia de sessões em sequência (regra do usuário: "quando uma tarefa chama uma sessão, o painel não
  deve ficar dentro de outro. Ele deveria ficar na sequencia que será executado"). Na série anterior, a
  mensagem de uma irmã S para C passou a ficar dentro do cartão de S (`via`/`nest`/`alive`); isso foi
  retirado: no print do usuário apareciam três cartões, um dentro do outro (correção ⊃ governança ⊃
  correção). Saíram de `draw/layout.ts` `nest()`, `alive()`, o campo `via` de `Child`
  (`types/index.d.ts`) e os campos `from`/`task` do `Break`; `atWork` volta a usar `live(c)` para `busy`
  e `live`. As partes de uma cadeia ficam sob a tarefa da mãe que a iniciou, no mesmo nível, uma depois
  da outra, na ordem em que o trabalho de cada uma começou (`inOrder`, por `begins`); nenhum cartão fica
  dentro de outro na cadeia. No estado real, "+N cartões antigos de sessões" volta de +4 para +41; o
  golden `real-completa` mudou só nessa linha. Testes: `cadeia-irmas.test.ts` (2: mãe → correção →
  governança → correção: os três cartões sob a tarefa da mãe, no mesmo nível, na ordem em que rodaram,
  nas duas visões e com a tarefa da mãe em andamento; a ordem é a da execução, não a das sessões na
  lista) e `cartoes-resumida.test.ts` (1: sem escolha do usuário, nenhum cartão aparece recolhido ou sem
  linhas embaixo, no estado real e nas duas visões); `layout.test.ts` espera o cartão de docs depois do
  de impl, no mesmo nível, sob a tarefa 15, e "+41 cartões antigos".

Pai de ✉ e linha ↩ (série de correções seguinte), em `draw/layout.ts`:

- Pai de tarefa ✉: um nível 1 cuja subtarefa espera a entrega de uma mensagem (✉, envio pendente
  ancorado nela) aparecia como não iniciado (○) quando a tarefa acesa era outra (a que mandou foi
  planejada e enviada sem `start`). `rows` dá o tom `current` a uma tarefa aberta com filhas quando
  alguma tarefa embaixo dela espera uma sessão (`waitingBelow(t, pending)`, exportada), e `turnRows`
  dá `current` ao pedido nesse caso; sem envio pendente, nada muda.
- Linha ↩: só aparece com resumo (`hasBrief(u)`, exportada: `brief` não vazio), no pedido
  (`turnRows`) e nos turnos do cartão; sem resumo, não há linha. A resposta nunca aparece cortada, e
  o marcador "resposta" (`REPLY`) não é mais desenhado (a constante continua exportada). Regras do
  usuário: antes, "quero que seja um resumo da resposta, super curto"; agora, a linha ↩ só aparece
  com texto de verdade. No estado real, o pedido 71 (sem resumo) perdeu a linha "Resposta: resposta"
  e a camada de tooltip dela: os goldens `real-completa` e `real-resumida` foram regravados (só isso
  mudou nos SVG) e o orçamento caiu uma linha e ~220 bytes por desenho (terminal 11 519/11 637,
  desktop 44 999/45 761), dentro da folga.
- Testes: `tests/envio-e-resposta.test.ts` (4); `layout.test.ts` (contagens do estado real 28 → 27 e
  27 → 26, ↩ do pedido 71, ↩ por turno), `cartoes-ancora.test.ts` e `task-tree.test.ts` atualizados.

✉ até a entrega e pedido ✕ (regras do usuário depois do teste visual: o painel mantém o ✉ até a entrega
mesmo com `done` explícito na tarefa de envio, "não depender de o modelo deixar a tarefa aberta"; e
pedido com tarefa interrompida e nada aberto fica ✕, não ✓). Sintomas: "Mensagem 2/3 na fila" apareciam
✓ logo após o envio, sem ✉, porque a orquestradora deu `done` logo depois do `SendMessage`; o cartão da
docs mostrava "✓ 1/1" com a subtarefa "Ler o código e o doc" interrompida dentro.
- `hooks/tools.ts`, `doneTool`: deixou de apagar os `sends` das tarefas fechadas (o aviso `DONE.queued`
  continua). Um id reusado por plano novo renomeia a tarefa antiga e o `send` dela junto
  (`renameAnchors`) ou apaga os dois (tarefa replanejada), então não sobra ✉ em id reaproveitado.
- `draw/layout.ts`, `rows()`: `waitsOn` vale para qualquer tarefa não interrompida (era só `open`),
  então a tarefa concluída com envio pendente tem tom `sent` (✉) até a entrega; `watchSends` marca o
  envio como `taken` na entrega e, como a tarefa já está concluída, não a fecha de novo. O tom de uma
  tarefa `done` com alguma descendente interrompida passa a ser `interrupted` (✕). Em `turnRows`, o
  pedido com tudo fechado e alguma tarefa interrompida (em qualquer nível, `flat`) é `interrupted` (era
  só quando TODAS eram); só concluídas continua ✓.
- Testes: `tests/envio-done.test.ts` (2: a tarefa de envio concluída com `done` logo depois de mandar
  continua ✉ até a entrega e, entregue, fica ✓: plan, start, `SendMessage` na fila, `done` → ✉; a sessão
  para e volta a rodar → ✓; e: tudo fechado e uma interrompida, o pedido é ✕, não ✓; só concluídas, ✓,
  inclusive interrompida dentro de uma tarefa concluída). Nenhum golden muda.

Sem start, nada aceso (decisão do usuário depois do teste visual: "sem start, nada aceso; envio feito
sem tarefa em andamento ancora na ÚLTIMA INICIADA do pedido atual (mesmo concluída); sem nenhuma
iniciada, no fim do pedido"): uma tarefa só está em andamento depois que o modelo chama `start`.
Sintomas do teste visual: o cartão da mensagem mandada antes do `start` do Passo 2 ficava sob "Passo 2";
o cartão "Passo 2 filha" (mandado pelo Passo 2, já concluído) ficava sob "Passo 3"; "Passo 3" aparecia ✓
1/1 sem `start` (a entrega fechava a tarefa errada); "Passo 4" ficava ◉ com relógio sem `start`; o
título do cabeçalho era "Passo 2"/"Passo 4", nunca iniciados. Causa comum: `current()` acendia a
primeira tarefa aberta quando nada estava iniciado, e `sendAnchor`, `recordStart`, o título e o tom das
linhas herdavam isso.
- `draw/layout.ts`: `current(list)`, com nenhuma iniciada, devolve `{ lit: [], anchor: undefined }`
  (antes, o caminho de `firstOpen`). `startedLast(list)` (nova, exportada) devolve a tarefa com
  `startedAt` mais recente, concluída ou não; num empate (pai e filha começam juntos) vence a que vem
  depois na árvore, a filha.
- `hooks/panel.ts`, `sendAnchor(list)`: sem tarefa em andamento, devolve `startedLast` das tarefas do
  pedido atual (o último turno com tarefas, `t.turn` máximo), senão o último nível 1 desse pedido; a
  regra "planejada depois da em andamento e sem `start`" continua quando há tarefa em andamento.
  `recordStart` (`hooks/sessions.ts`) usa `sendAnchor` para a âncora da sessão aberta (era
  `current().anchor`).
- `hooks/render.tsx`, título: ver o bullet do cabeçalho acima. O texto da ferramenta `start`
  (`text/rules.ts`, golden `textos.ts`) deixou de dizer que o painel destaca a primeira aberta: "sem
  nenhuma marcada, nenhuma tarefa aparece em andamento".
- Efeitos no desenho: sem `start` nada fica ◉; uma folha pendente é ○ sem relógio; um pai aberto com
  algo concluído embaixo e nada aceso fica ◷ ("Aguardando"); um pedido sem nada aceso fica "Pedido
  aberto" (○) ou ◷. O chip "● N em andamento" continua contando as folhas abertas (◉ e ○).
- Testes: `tests/sem-start.test.ts` (6: plano sem `start` não acende nada e o chip conta as folhas;
  entre duas tarefas a seguinte não acende nem cronometra e o título é o da iniciada por último;
  mensagem depois de concluir A e antes de iniciar B sai de A, cartão sob A; sessão aberta nesse
  intervalo fica sob A; sem nenhuma iniciada, a mensagem sai da última tarefa do pedido, cartões no fim
  dele; a última iniciada é a do pedido atual, não a de pedido anterior). Atualizados: ~30 expectativas
  ◉ → ○/◷ em `task-tree.test.ts` (títulos "sem start, nada fica em andamento…" e "com a marcada
  concluída, nada volta a acender…") e `limite-linhas.test.ts`; goldens regravados: `basico`,
  `basico-concluido` (o título do cabeçalho passa a ser o da última iniciada, com tooltip), `retomada`,
  `real-completa` e `real-resumida` (título do cabeçalho).

Tarefas abertas de uma sessão que terminou o turno (série 3; regra: o painel independe de quem o usa):
quando a sessão termina o turno, o que estava em andamento (iniciado e não fechado) deixa de contar como
em andamento: aparece interrompido (não concluído, sem fechamento), sem relógio correndo, e sai de "N em
andamento". As tarefas pendentes (nunca iniciadas) continuam pendentes e contam, porque o plano continua
no próximo turno. Sintoma do usuário: o cartão docs-task-tree dizia "parada", mas a tarefa "Hunks do bug
dos cliques" e a subtarefa "Ler o código e o doc" apareciam em andamento (◉) com o relógio correndo.
Vale para qualquer sessão, a principal inclusive. Regressão corrigida em seguida (print do usuário): a
orquestradora planejou 5 passos, fez só o passo 1 e encerrou o turno esperando o usuário, e os passos 2
a 5 viraram "✕ interrompida" ("4 interrompidas"), com o cabeçalho em "Passo 2 · 2 de 2 · 100%".
- `draw/layout.ts`: `rawPanel(c)` devolve o painel publicado sem mudança; `panelOf(c)` aplica
  `halt(undefined)`, só no desenho, às tarefas de uma sessão que não está trabalhando (não `live(c)` e
  não `starting`, recém-aberta); a arquivada continua com `interrupt` e com as `waits` apagadas.
  `halt(at)` (exportada; substitui `interrupt` nos dois casos de turno terminado, a filha parada e a
  própria sessão): folha aberta e iniciada (`started` ou `startedAt`) vira interrompida, com o relógio
  parado em `at`; folha nunca iniciada fica pendente; pai aberto com subtarefas ainda abertas fica
  aberto, sem `started` e com `endedAt` = `stop(t, at)` (o relógio não corre); pai sem nada aberto
  embaixo vira interrompido. Não há marca de grupo parado: sem `start` nada acende (ver "Sem start, nada
  aceso"), então o painel parado não precisa de uma. No `session()`, `parked` (o rótulo "parada") olha
  `rawPanel`, então o rótulo se mantém. O `Model` ganhou `ended?: number`: com ele, `layout()` aplica
  `halt(ended)` ao grupo principal.
- Estado novo `turnEnded` (`number | null`, `types/index.d.ts`, linha em `TABLE`, vive em `state`):
  `hooks/turn.ts` (`turnComplete`, sem `agentId`) grava a hora no fim do turno da principal; `wake($)`
  (em `hooks/panel.ts`) zera `turnEnded` (grava `null`) e é chamada no `prompt.submit`, no início do
  `toolCall` da principal (`hooks/tool-call.ts`) e em `planTool`, `doneTool` e `startTool`
  (`hooks/tools.ts`): assim um `start` depois do fim do turno reacende a tarefa; `hooks/render.tsx`
  passa o valor ao layout como `ended` (o título do cabeçalho com o turno terminado é o do grupo A, ver
  "Sem start, nada aceso"); `anyRunning` (`hooks/sessions.ts`) ignora as tarefas da própria sessão com o
  turno terminado, e o relógio de 1 s para.
- Efeitos: uma filha parada com tarefa em andamento passa a ter essa tarefa fora do total (ex.: "3 de 4"
  → "3 de 3 · 100%" num teste antigo); os goldens `filha-parada` e `filha-recolhida` mudaram ("Em
  andamento: Trabalho da filha" → "Interrompida: Trabalho da filha").
- Testes: `tests/sessao-parada.test.ts` (5: parada, a tarefa e a subtarefa em andamento saem do "em
  andamento" e uma pendente fica `open` e entra na conta (1 de 3); trabalhando, seguem em andamento; a
  própria sessão, depois do fim do turno a tarefa em andamento não fica acesa e volta com o próximo
  pedido; cinco passos, só o primeiro feito: ○ Passo 2..5, título "Passo 1", "2 de 6", e depois do
  próximo pedido um `start` no Passo 2 o acende; uma tarefa interrompida pelo fim do turno volta com
  `start`); `durabilidade.test.ts`: a semente de `turnEnded` (os 4 cenários da chave) e o cenário D (a
  recarga mantém o valor e a primeira chamada da principal o zera); em `task-tree.test.ts` a contagem
  com a filha parada ficou "3 de 3 · 100%". Nenhum golden mudou por este item.

- **Desktop** (`e.surface === 'desktop'` e `Svg` no `ui`): `drawDesktop`: o cabeçalho (`headerSvg`) e
  cada linha (`rowSvg`/`labelSvg`) são um `Svg` com `alt`, com os `Box` que `overlays` manda por cima:
  o `Button` de recolher sobre o ícone (rótulo um espaço em), o de abrir a sessão sobre o anel
  (`RING_LABEL`, 4 células pela direita) e a camada de tooltip (`hoverLayer`) sobre um nome cortado. A
  largura é `lineWidth(bodyColumns)` = `clamp(240, colunas × 8 − 8, 900)`. Cada SVG leva só as regras
  CSS que usa (`slim`), claro e escuro.
- **Terminal** (sem `Svg`): `drawTerminal`: um `Text` por linha, guias `│ ├─ └─`, glifo por tom
  (`GLYPH`), o glifo como `Button` quando a linha recolhe; os botões de visão `[≡] ▤`.
- Um desenho acima de `DRAW_LIMIT` = 600 KB vira uma linha de aviso; um que lança exceção vira uma
  linha de erro e publica `renderError`. `drawn` guarda tamanho, linhas e erro do último desenho.
- `ui.press` responde pela chave (`fold:<chave>`, `open:<id>`, `view:<summary|full>`) com a ação que o
  último desenho registrou em `actions` (`act`).

### Desempenho (fase 6, parte A)

Dez commits, um por item, na branch `perf/fase-6-desempenho` (`4038e45` … `d1916f2`), com a regra de
que nenhuma linha, byte ou texto do desenho muda: goldens do SVG e dos textos, orçamento e
`layout.test.ts` idênticos em todos. O que cada um mudou está nas seções "Fluxo de dados" (poll,
status, ligações), "Estado e durabilidade" (as variáveis de módulo novas), "Arquivo publicado"
(gravado só quando muda) e "Desenho" (layout, cabeçalho, `split`, `atWork`, `fit`, `slim`). As
medidas abaixo são da bancada `docs/analises/medicoes/fase6/run6.sh` (mesma máquina, medianas; a
cópia oficial do `patch6.mjs` em `docs/analises/` ainda ancora no texto antigo em 6 trechos e precisa
ser atualizada para rodar sobre este código); as metas vêm do relatório de desempenho
`docs/analises/06-performance-fase-6.md`. Nenhum número deve ser alterado sem remedir.

| Medida | Antes | Depois | Meta |
|---|---|---|---|
| Cabeçalho, caso real / 1 000 níveis 1 / 3 000 | 2,2 ms / 185 / 2 200 | 0,1 / 1,2 / 3,0 | ≤ 2 ms a 1 000, ≤ 6 a 3 000 ✓ |
| `layout()` real completa / resumida | 8,9 / 7,8 ms | 4,2–5,8 / 2,8–3,9 | real ≤ 5 ✓ (mín 3,0) |
| `layout()` O2500 completa | 57,7 ms | 17,6 | ≤ 20 ✓ (na última rodada; 26 numa rodada carregada) |
| `breaks` por desenho, resumida real | 323 (310 recálculos) | 154 (= completa) | ≤ completa + cartões ✓ |
| Poll real sem mudança: parede | 45–60 ms (24,5 sem o hook) | 9–12 ms | ≤ 25 ✓ |
| Poll real sem mudança: bytes gravados / `store.set` / idas ao host | 220 KB / 1 / 20 | 0 KB / 0 / 8 | 0 / 0 / ≤ 12 ✓ |
| `state.set` de `children` por poll sem mudança | 1 | 0 | 0 ✓ |
| `layout()` T3000 completa (3 000 pedidos) | 64,8 ms | 10,4 | ≤ 16 ✓ |
| `fit`, 400 linhas a 40 colunas | 10,2 ms | 0,8 | ≤ 1,5 ✓ |
| `slim`, 400 linhas | 2,7 ms | 0,5 | ≤ 0,5 ✓ |
| `rowSvg`, 400 linhas a 40 colunas / real | 18,1 / 1,5 ms | 2,9 / 0,5 | |
| `split`, filha com 500 pedidos e 20 rodadas / 200 e 20 / reais | 18,2 / 6,8 / 0,5–0,7 ms | 1,1 / 0,4 / 0,2–0,5 | ≤ 2 ✓ / ≲ 1 ✓ / ≤ 0,3 (4 de 5) |
| `atWork` por passada, 3 000 níveis 1 | 12 000 (6 000 após a passada única) | 3 000 | ≤ 1 por nível 1 ✓ |
| Desenho real inteiro no kit, completa / resumida (terminal) | 17 / 17 ms | 11 / 8 | |

Artefato pré-existente, deixado para a parte B (relógio): o host do `orcamento.test.ts` devolve
`t += 1000` a cada `clock.now`, então em 2 de 14 rodadas os tamanhos saíram ±14/16 bytes (tempo
decorrido desenhado), dentro da folga de 1,5×.

### Testes e como rodá-los

Use o binário da mesma versão do Claude Code que roda a sessão (o app desktop traz o dele; no
Windows, em `%APPDATA%\Claude\claude-code\<versão>\<hash>\claude.exe`). Da raiz do repositório:

```
claude plugin validate .
claude plugin validate task-tree
claude plugin test task-tree
```

O primeiro confere o `marketplace.json` da raiz; os outros, o mod. A suíte tem 381 testes em 27
arquivos (316 na fase 4, etapa 3; 9 novos na fase 6, parte A; 3 na correção das âncoras; 4 na correção da visão resumida; 4 na do plano em pedido novo; 4 na de limpeza da resumida e do casamento dos envios; 5 nos cartões no lugar certo; 2 no relógio religado pelo desenho; 2 no turno em lote; 4 no pai de ✉ e na linha ↩; 2 no título do cabeçalho; 2 na tarefa da mãe concluída; 2 na regra do cabeçalho com recolhidos; 2 nas conversas entre irmãs em sequência; 1 nos cartões abertos sem escolha; 1 no relógio único; 1 no lote de mensagens entregues juntas; 5 na sessão parada; 4 do `turnEnded` na tabela de durabilidade; 6 em sem start, nada aceso; 2 no ✉ com done e no pedido ✕); rode-a sozinha, sem outra ao mesmo
tempo, e, numa falha, guarde a saída inteira. Cada teste do kit é um módulo novo com `$.state` vazio
e tem 5 s.

| Arquivo | Testes | O que cobre |
|---|---|---|
| `task-tree.test.ts` | 168 | o painel desenhado e os resultados das ferramentas: ids, replanejar, visão, dobras, tempos, cartões, avisos, sessões, mensagens, turnos, ↩; o cabeçalho com 300 níveis 1 (fase 6) |
| `durabilidade.test.ts` | 67 | a tabela: 4 cenários por chave de state (plantar; reinício com `session.start`; sem; recarga a quente), `sessions`, sanidade, "chave sem linha" |
| `layout.test.ts` | 18 | `layout()` direto, com o fixture real e modelos pequenos: pedidos desenhados, cartões, ↩, cabeçalho, resumida, ordem, cadeias, ✉, corte; os cartões e as linhas de uma filha funda fixados (fase 6); o cabeçalho com cartões e tarefas recolhidos, nas duas visões, e a resumida sem o pedido finalizado e o cartão dele |
| `host.test.ts` | 13 | os passos de `io/host.ts` com `$` falso ou entradas puras, inclusive a lista parcial |
| `reinicio.test.ts` | 11 | reinício do processo (com e sem `session.start`) e recarga a quente, com o fixture real; `KNOWN` (vazio) para bugs futuros |
| `hooks-puros.test.ts` | 11 | `said`, `brief` e as edições de `state/tasks.ts`; `fit` contra a regra antiga, em todos os títulos, tamanhos e larguras (fase 6) |
| `publicado.test.ts` | 11 | escrita e leitura do arquivo publicado: válido, parcial, vazio, antigo, outra versão, corrompido, `watchSends`; publicar só quando muda: dois polls sem mudança não gravam arquivo, store nem status, o relógio e os painéis não contam, uma espera nova conta (fase 6) |
| `svg-golden.test.ts` | 7 | 12 cenários de SVG contra `golden/svg.ts` |
| `textos.test.ts` | 7 | os textos contra `golden/textos.ts`, e o limite 120 |
| `sobreposicao.test.ts` | 6 | nenhum par de `Box` se cruza numa linha (`overlays`, `crossings`) |
| `limite-linhas.test.ts` | 4 | `limitRows`: 400 linhas, blocos antigos contados, `rows`/`drawSize` publicados |
| `orcamento.test.ts` | 4 | tamanho do desenho com o fixture real, terminal/desktop × resumida/completa, até 1,5 × a `BASELINE` |
| `publicado-versoes.test.ts` | 4 | um arquivo de cada formato já publicado (`fixtures/publicados.ts`) |
| `resumida-turno.test.ts` | 4 | visão resumida: o pedido novo aparece sozinho apesar de filha parada com folha aberta; pedido anterior aberto continua e o concluído sai; sessão viva sob tarefa concluída aparece no fim; no mesmo pedido o plano soma |
| `sessao-parada.test.ts` | 5 | sessão que terminou o turno: o que estava em andamento aparece interrompido, sem relógio e fora do "em andamento", e as pendentes seguem pendentes e contam (a filha parada e a própria sessão); trabalhando, seguem em andamento; o próximo pedido ou um `start` reacende; cinco passos com só o primeiro feito: o título é o do passo iniciado por último |
| `relogio-recarga.test.ts` | 3 | recarga com tarefa cronometrando: o desenho pede `clock.every(1000)` sem outro evento; sem nada cronometrando, não pede; desenhos ao mesmo tempo (terminal e desktop juntos) ligam um relógio de 1 s só |
| `mae-concluida.test.ts` | 2 | tarefa da mãe concluída com `done` com filha ainda trabalhando: a tarefa e o pedido aparecem concluídos, sem somar as tarefas da sessão, e o cartão mostra o progresso dela; tarefa aberta com a sessão trabalhando continua em andamento e somando |
| `sem-start.test.ts` | 6 | sem `start`, nada aceso (plano, entre tarefas, título do cabeçalho pela iniciada por último); a mensagem sai da última iniciada do pedido atual, mesmo concluída, e sem nenhuma iniciada, do fim do pedido; a sessão aberta nesse intervalo fica sob a mesma tarefa |
| `cabecalho-tarefa-atual.test.ts` | 2 | o título do cabeçalho é a tarefa iniciada por último: uma iniciada e deixada aberta num pedido antigo não o toma (nas duas visões); sem nenhuma iniciada, é a primeira aberta |
| `envio-done.test.ts` | 2 | a tarefa de envio concluída com `done` logo depois de mandar continua ✉ até a entrega e depois fica ✓; pedido com tudo fechado e uma tarefa interrompida é ✕ (e só concluídas, ✓) |
| `envio-e-resposta.test.ts` | 4 | pai de tarefa ✉ em andamento (e, sem envio, ainda aberto); pedido e cartão sem `summary` sem linha ↩, com `summary` a linha traz o resumo |
| `cadeia-irmas.test.ts` | 2 | cadeia de sessões: mãe → correção → governança → correção, os três cartões sob a tarefa da mãe, no mesmo nível, na ordem em que rodaram (nas duas visões); a ordem é a da execução, não a das sessões na lista |
| `cartoes-resumida.test.ts` | 1 | sem escolha do usuário, nenhum cartão aparece recolhido ou sem linhas embaixo, no estado real e nas duas visões |
| `cartoes-lugar.test.ts` | 8 | o recolhimento fica com o cartão no teto de 20 rodadas (chave por `partAt`); resumida com o cartão sob a tarefa de origem; completa com o pedido da sessão trabalhando à vista além dos 3 últimos; sessão sem rodadas não muda de lugar na resumida; estado real: cada cartão da resumida sob a mesma linha que na completa; quatro mensagens na fila entregues juntas: o cartão do turno vai para a tarefa da última; o caso real, "uma rodada basta" e o bug dos cliques entregues juntos: o trabalho fica sob o pedido dos cliques; uma mensagem por turno: cada cartão sob a tarefa da sua |
| `resumida-limpeza.test.ts` | 4 | a visão resumida só limpa com tudo finalizado (tarefa em andamento e tarefa com ✉ pendente continuam à vista); duas mensagens na fila para a mesma sessão, ela recebe uma: só a primeira tarefa fecha |
| `plano-pedido-novo.test.ts` | 4 | plano em pedido novo: o "1" novo fica sob o pedido novo (completa, resumida, estado publicado) e o aberto do pedido antigo é interrompido e renomeado; no mesmo pedido, replanejar continua substituindo no lugar |
| `cartoes-ancora.test.ts` | 3 | cartões ficam na tarefa que mandou a mensagem quando o `plan` reutiliza o id dela (`renameAnchors`, `resolveAnchor`) |

Fixtures e goldens:

- `tests/fixtures/orquestradora-real.ts` (`REAL`): o estado real de uma orquestradora (97 níveis 1 em
  70 pedidos, 5 filhas), anonimizado por `docs/analises/medicoes/gen-fixture.mjs`; não editar à mão.
- `tests/fixtures/publicados.ts` (`PUBLISHED_FILES`): os 8 formatos do arquivo publicado.
- `tests/golden/svg.ts` (`GOLDEN`, gerado): um `Svg` por linha, 12 cenários. Mudança intencional de
  SVG ou de `alt`: `node task-tree/tests/golden/atualizar.mjs [claude.exe]` (copia `task-tree/` para
  uma pasta temporária só com o teste do golden, roda `claude plugin test`, recolhe as linhas
  `GOLDEN-NEW` e funde no arquivo); a aprovação é o diff do git.
- `tests/golden/textos.ts` (`TEXTOS`): quando o teste difere, imprime `TEXTOS-NEW <json>` para colar.
- `BASELINE` em `orcamento.test.ts` (HEAD 6d79470, kit 2.1.308, 100 colunas): terminal resumida 11 671
  bytes/29 linhas, completa 11 789/30; desktop resumida 47 416/28 linhas/30 Svg, completa 48 174/29/31.
  Para refazer, rode o teste e copie a linha `ORCAMENTO` do log.

Regras dos testes: o que muda linhas vai em `layout.test.ts`, o que muda pixels no golden do SVG, o
que muda texto no golden dos textos; chave nova de state ou store ganha linha em `TABLE`; formato
novo do arquivo publicado ganha um arquivo em `publicados.ts` e sobe `PUBLISHED_VERSION`. Não afirmam
tempo de parede; a leitura de fundo das filhas é esperada pelo fato (`settled()`, em
`orcamento.test.ts` e no golden do estado real), não por `setTimeout` fixo; sobram esperas fixas em
`durabilidade.test.ts` (150 ms), `reinicio.test.ts` (150 ms) e `task-tree.test.ts` (20/50 ms e um laço
de até 200 ms).

O kit nos testes: o host é simulado por `on('…')` (`clock.now`, `clock.every` negado, `env.get`,
`session.id`, `store.*`, `fs.*`, `mcp.call`, `tool.call` de outras ferramentas); o painel é lido por
`$.ui.mount` + `ui.drawn()`/`findAll` + `unmount`, e os cliques por `ui.press({ key })`; o
`agentId` de subagente vai no argumento da ferramenta; `$.prompt.submit` aceita `origin` e `isMeta`;
`$.turn.complete` exige `answer`, `durationMs`, `isAborted`, `turnId`. O kit não expõe `$.state`
(os testes de durabilidade o espelham com hooks `state.get`/`state.set` abaixo do kit), não importa
`fs` nem vê `process.env` (por isso o golden é atualizado por um script de fora), não tem skip/todo
(`known()`/`KNOWN` em `reinicio.test.ts`) e não simula subagente nem o respawn real do worker.

### Limites do kit

Confirmados no `claude plugin validate`; o código está escrito em volta deles:

1. Um hook é uma função literal ou o nome de uma função, que pode vir de outro arquivo do módulo;
   `on('x', hookOf())` é recusado.
2. `$.state.get/set` exige a chave `{ plugin, key }` literal no arquivo que chama (ou numa `const`
   dele, que não pode ser exportada nem importada). Por isso cada arquivo de `hooks/` declara as
   chaves que usa, `hooks/panel.ts` não as exporta e o `stateOf` de `state/durability.ts` não serve
   para chamar `$.state` (o teste de durabilidade é que confere a correspondência com a tabela).
3. Uma função que recebe `$` tem de estar declarada no topo do arquivo e não pode ter o nome de uma
   variável atribuída em outro lugar; `$` não vai para uma variável de laço (os handlers de
   `tool-call.ts` são chamados pelo nome).
4. O engine recusa o módulo inteiro e segue com a versão anterior quando uma dessas regras falha.
5. Um `$.state.set` de dentro do `ui.render` não vinga: o render usa o valor que `ensure*` devolve.
6. Desestruturar um `Set` pode virar `set[0]` na compilação; use arrays.
7. Uma ferramenta registrada no `session.start` só aparece a partir do próximo prompt; a recarga
   depois de uma edição pode atrasar.

### O que só é verificável no app

Nada disto é coberto pelos testes do kit; só uma sessão real no app desktop mostra:

- O painel na tela: o pane aberto sem pedido só é posto com 144 colunas ou mais (110 com pedido);
  `showPane` o reabre num prompt da pessoa; `/task-tree` responde o que o app disse.
- Os cliques: se o `Button` sobre o ícone e sobre o anel acertam o alvo nos dois temas e em todas as
  larguras (o teste de sobreposição confere células, não pixels); se o clique na troca de desenho
  ainda chega (`ui.press` por chave); o realce do botão nativo; o toast de `open_session_in` recusado.
- O tooltip da camada `hoverLayer` e se a linha pisca a cada segundo.
- A recarga a quente real e o respawn do hooks worker (o kit só os simula: módulo novo com state
  semeado ou vazio).
- As sessões filhas de verdade: `list_sessions`, `get_session`, os arquivos publicados por versões
  diferentes do mod, o `startedBy`, a latência entre a publicação de uma filha e a releitura de 3 s.
- `turn.step` (modelo e esforço): o kit não tem implementação base para o evento em stream.
- O `wrap_up` com `ask` do app e os avisos `<side-sessions-event>`.
- O tamanho real do desenho que o app aceita (o teste mede o JSON que o kit devolve, não o que o app
  renderiza).
- O `$.ui.status` embaixo da caixa de mensagem.

## Decisões (histórico)

As notas abaixo são o texto anterior deste arquivo, por fase, na íntegra (só os títulos desceram um
nível): os pedidos do usuário citados palavra por palavra, as decisões e os motivos, as medições e as
armadilhas de cada mudança. Onde dizem "no `register.tsx`", a função está hoje num dos arquivos de
`task-tree/hooks/` (ver "Módulos"). Os códigos entre parênteses (R6, H3.2 etc.) são os itens dos
relatórios de análise em `docs/analises/`.
### Estrutura

- `.claude-plugin/plugin.json`: manifesto (nome, versão, `types`).
- `hooks/hooks.json` e `hooks/register.tsx`: o módulo de hooks. Desde a fase 4 (etapa 3) o `register.tsx` tem ~31 linhas e só registra os 14 hooks, cada um pelo nome de uma função importada; o resto vive em um arquivo por responsabilidade (ver "Arquivos de hook"). `hooks.json` segue com um módulo só (`./register.tsx`).
- `draw/layout.ts`: o layout do painel (R12, fase 3, etapa 1): `layout(model, choices, now, ownId): Row[]`, função de topo e pura: não lê nada além dos argumentos (etapa 2). Saíram o relógio de módulo `drawNow` (`split(c, sisters, me, owner, now, memo)` recebe o `now`), o `WeakMap` de módulo `breaksMemo` (agora um `BreaksMemo` por desenho, criado por `newBreaksMemo()` no `layout()` e passado a `split`/`breaks`; chave explícita de `hits`: `lista|me|caminho|id|parte`, a mesma partição de antes) e o mapa lateral `sendsAt` (o `panel` calcula `pending` e o passa como parâmetro a `rows`/`turnRows`; só o grupo principal manda mensagens, os escopos de subagente recebem `[]`). `Model` = `{ groups, waits, children, sends (só as não tomadas), view, work }`; `Choices` = o atom `folds`. Leva junto os auxiliares puros de modelo que o `register.tsx` também usa (`count`, `total`, `split`, `atWork`, `trimToWork`, `limitRows`, `MAX_ROWS`, `SHOWN_TURNS`, `Row`, `Tone` etc.), exportados daqui. Só importa `../types`: sem import circular e sem `$`.
- `draw/geometry.ts`: a geometria do desenho num só lugar (R14, fase 2): constantes com nome (`CELL`, `col`, `TEXT_IN`, `CARD_IN`, `CARD_RIGHT`, `RING_IN`, alturas do cabeçalho etc.), `lineWidth`, `cardRight`/`textRight` e `overlay(kind, …)` (`'icon'`, `'ring'`, `'name'`). Também `overlays(line, nested, W): Placed[]` (todos os `Box` de uma linha, na ordem de desenho, cada um pela regra da borda mais próxima), `spanOf(p, W)` (trecho em px) e `crossings(list, W)` (pares que se cruzam): as sobreposições do desenho saem só de `overlays()`. Não recebe `$`; `register.tsx` importa por `'../draw/geometry'` (o kit aceita import relativo de um `.ts` do plugin).
- `types/index.d.ts`: o contrato do `$.state` (`groups`, `waits`, `launches` e o legado `tasks`).
- `tests/task-tree.test.ts`: testes do `claude plugin test`.
- `tests/orcamento.test.ts`: teste de orçamento do desenho (ver "Validar e testar").
- `tests/fixtures/orquestradora-real.ts`: estado real de uma orquestradora (97 pedidos de nível 1, 70 turnos, 5 filhas), com títulos anonimizados; exporta `REAL`.
- `tests/svg-golden.test.ts`, `tests/golden/svg.ts` e `tests/golden/atualizar.mjs`: golden do SVG por tom (ver "Validar e testar").
- `text/rules.ts`: todos os textos que o plugin escreve para o modelo (R16, fase 2): `BRIEF` = 120 e `LIMIT` ("até 120 caracteres", interpolado nos 6 textos que citam o limite), `RULES` (seção `task-tree:regras`), `COMMAND`, `TOOLS`, `PROMPT`, `ASK`, `DONE`, `WRAP_UP`, `SEND`, `UNPLANNED`, `SESSION`, `EXAMPLE`. Ficam fora dele os resultados das tools ("Plano exibido…", "Concluídas: d/n…") e os `alt`/títulos do desenho.
- `tests/textos.test.ts` e `tests/golden/textos.ts`: golden dos 23 textos (ver "Golden dos textos").
- `state/durability.ts`: a tabela de durabilidade (R13, fase 2): `TABLE`, uma linha por chave, com onde vive (`lives`: state, state+store, store ou module), o prefixo do store, a regra de fusão (`merge`: current, fill, union, replace, none), `keep` e quando volta (`restoredAt`: start, resume, first-use, first-save). 15 chaves de `$.state` (com `recap`), 1 do store (`sessions`) e 15 variáveis de módulo (`lastRecap` saiu). Exporta também `merge`, `current`, `loadStore`, `saveStore`, `saveGroups` (com `KEEP` = 30) e o conjunto `loaded`.
- `tests/durabilidade.test.ts`: 63 testes sobre a tabela (ver "Tabela de durabilidade").
- `tests/reinicio.test.ts`: testes de reinício do processo e recarga a quente (ver "Validar e testar").
- `io/publish.ts` (arquivo publicado: `parsePublished`, `readPublished`, `waitFile`, `publishWait`) e `io/log.ts` (`debug`); ver "Arquivo publicado".
- `io/host.ts` (leitura das filhas em passos: `parseSessions`, `listSessions`, `mineOf`, `panelOf`, `readFiles`, `deriveChildren`, `engineText`; ver "Leitura das filhas") e `tests/host.test.ts` (13 testes).
- `tests/publicado.test.ts`: leitura e escrita do arquivo publicado (ver "Arquivo publicado").
- `tests/publicado-versoes.test.ts` e `tests/fixtures/publicados.ts`: um arquivo de cada formato antigo (ver "Arquivo publicado").
- `tests/limite-linhas.test.ts`: limite de 400 linhas do desenho (ver "Desenho do painel").
- `tests/sobreposicao.test.ts`: regra de não-sobreposição dos `Box` de uma linha (6 testes; ver "Sobreposição dos Box").
- `tests/layout.test.ts`: testes de layout diretos, sem mount e sem SVG, com o fixture real (14 testes, ~130 ms); chamam `layout(model, choices, now, ownId)` com o `Model` montado como o `refreshChildren` monta (ver "Testes de layout").
- `hooks/panel.ts`, `sessions.ts`, `session-start.ts`, `prompt-submit.ts`, `command.ts`, `tools.ts`, `permission.ts`, `turn.ts`, `tool-call.ts`, `render.tsx`: os hooks e o estado do painel (ver "Arquivos de hook").
- `draw/svg.ts`: construtores puros de SVG e glifos do terminal (`GLYPH`, `prefix`, `ratioBar`, `contextRing`, `rowSvg`, `chips`, `headerSvg` etc.).
- `state/tasks.ts`: edições puras da árvore (`build`, `resolve`, `edit`, `finish`, `fill`, `settle`, `begin` etc.).
- `tests/hooks-puros.test.ts`: 9 testes de `said`, `brief` e das edições da árvore.
- `.claude-plugin/types/`: tipos gerados pelo engine em cada máquina. Não versionar.

Fase 1 da rede de proteção concluída: teste de orçamento (R6), golden do SVG (R7), reinício e recarga
(R8, com os 3 bugs corrigidos), contrato `Published` (R9), limite de linhas (R15) e limpeza de resíduos
(R20: removidos `Work.ring`/`topRing`, o anel na linha de tarefa, o parâmetro `pinned` e `_up`/`up`).
Critério atendido: um teste falha se o desenho crescer 50% ou se qualquer SVG mudar sem golden novo.

### Validar e testar

Use o binário da mesma versão do Claude Code que roda a sessão. Versões antigas acusam erros
falsos (a 2.1.268, por exemplo, não reconhece `tool.check`). O app desktop traz o próprio binário:
no Windows, em `%APPDATA%\Claude\claude-code\<versão>\<hash>\claude.exe`. Fora do app,
o `claude` do PATH.

A partir da raiz do repositório:

```
claude plugin validate .
claude plugin validate task-tree
claude plugin test task-tree
```

O primeiro confere o `marketplace.json` (e o README); os outros, o mod.

#### Teste de orçamento do desenho

`tests/orcamento.test.ts` monta o painel com o fixture `REAL` nas quatro combinações superfície
(terminal/desktop) × visão (resumida/completa), com `bodyColumns` 100. Afirma que o desenho não
caiu no de emergência nem em erro e que `size`, `lines` e `svgs` ficam em até 1,5 × a `BASELINE`. É um
teste por combinação (4 testes, cada um com os 5 s que o kit dá por teste; 3 desenhos por medida). O tempo
de parede (`ms`) não é afirmado: só sai na linha `ORCAMENTO …` do log do kit, para o olho.

- Regra dos testes: não afirmam tempo de parede nem esperam por `setTimeout` fixo a leitura de fundo das
  filhas; esperam o fato. `settled()` (em `orcamento.test.ts` e no golden do estado real de
  `svg-golden.test.ts`) espera, até 4 s, o estado `children` com todas as filhas (via `on('state.set')`) e
  uma publicação do painel depois disso (via `fs.write`), com erro que diz onde parou. Esperar "dois
  desenhos iguais" não serve: os `handle` dos botões são sorteados a cada desenho.
- Motivo (bug de teste instável): o teste único fazia 4 combinações × 5 desenhos (1,4 s livre) e estourava
  os 5 s do kit com duas suítes rodando juntas. Esperas fixas da mesma família seguem em
  `durabilidade.test.ts` (150 ms), `reinicio.test.ts` (150 ms) e `task-tree.test.ts` (20/50 ms e um laço de
  até 200 ms); não falharam, nem sob carga.
- Rode a suíte sozinha, sem outra ao mesmo tempo; se algo falhar, guarde a saída inteira (as linhas
  `(fail)` e o erro), não só o total.

- `size` no teste é o JSON da árvore que o kit devolve: proporcional ao `drawSize` do módulo, não igual.
- Se o desenho crescer de propósito, refaça a `BASELINE` em `orcamento.test.ts`: rode o teste numa cópia
  sem `task-tree.test.ts` e copie os números da linha `ORCAMENTO`.
- Baseline gravada (HEAD 6d79470, kit 2.1.308): terminal resumida 11.671 bytes/29 linhas, completa
  11.789/30; desktop resumida 47.416 bytes/28 linhas/30 Svg, completa 48.174/29/31; 14–41 ms.
- Com este fixture as duas visões medem quase o mesmo, porque o limite de 3 pedidos corta antes.

#### Golden do SVG

`tests/svg-golden.test.ts` (7 testes, 12 cenários: basico, basico-concluido, retomada, filha-rodando,
filha-parada, filha-arquivada, filha-recolhida, envio, espera-propria, subagente, real-completa,
real-resumida) monta o painel no desktop com relógio e largura fixos, recolhe cada `Svg` (alt, largura,
altura, interativo, fonte) e compara com `tests/golden/svg.ts`. Cobre os 12 valores de `Tone`. A falha
lista por `Svg`: índice, alt, tamanho do golden × atual, ou o primeiro trecho de fonte diferente com contexto.

- `tests/golden/svg.ts` é gerado (`GOLDEN`, um `Svg` por linha, para o diff do git mostrar um SVG mudado
  como uma linha). Não editar à mão.
- O `alt` faz parte do golden de propósito: é o que o terminal lê.
- Mudança intencional de SVG (inclusive texto de `alt`): rode `node task-tree/tests/golden/atualizar.mjs [claude.exe]`
  e commite o `svg.ts` junto. O script copia `task-tree/` para uma pasta temporária só com o teste do golden, roda
  `claude plugin test`, recolhe as linhas `GOLDEN-NEW <cenário> <json>` e funde no `svg.ts`, mantendo os
  cenários que batem. Segunda rodada: "Nada a atualizar". A aprovação é o diff do `svg.ts`.
- Limite do kit: um teste não importa `node:fs`/`fs` (recusado ao carregar) nem vê `process.env`
  (`process` é `undefined`); por isso a atualização é um script, não uma variável de ambiente.

#### Golden dos textos

`tests/textos.test.ts` (7 testes) coleta os textos que chegam ao modelo (descrições registradas no
`session.start`, regras do `prompt.compose`, contextos do `prompt.submit`, as três saídas do
`AskUserQuestion`, avisos do `done`, do `SendMessage` na fila, do `wrap_up`, da chamada sem plano e as
notas de sessão) e compara com `tests/golden/textos.ts`. Confere também que toda ocorrência de "até N
caracteres" diz 120 (pelo menos 6). Quando difere, imprime `TEXTOS-NEW <json>` para colar no golden.

- Regra: mudança de texto = golden novo, aprovado de propósito (como no golden do SVG).
- O limite do resumo mora em um lugar só, `BRIEF` em `text/rules.ts`; antes eram 6 strings (o 60 → 120
  tocou todas).
- O golden foi gerado com o código anterior à extração, e o teste passou sem diferença depois dela.

#### Tabela de durabilidade

`state/durability.ts` diz, por chave, onde o dado vive e como volta. `tests/durabilidade.test.ts` roda
4 cenários por chave do state: A (planta pela API do mod e confere state/store), B (reinício com
`session.start`), C (reinício sem `session.start`) e D (recarga a quente com o state semeado); mais o
`sessions`, uma sanidade da tabela e "chave nova sem linha": um cenário largo grava toda chave do state
e todo prefixo do store tocados, e falha se algum não tem linha ou se alguma linha não é tocada. `engine`,
`ended` e `tasks` (legado) são plantados por semeadura.

- Chave nova de state ou de store: acrescente a linha em `TABLE`, senão o teste falha.
- Limite do kit: o validador exige que a referência `{ plugin, key }` de `$.state.get/set` seja literal
  no próprio arquivo (ou const dele); um `stateOf('x')` importado é recusado. Por isso as 15 consts de
  chave continuam literais em `register.tsx`, e o teste é que garante a correspondência com a tabela.
- Funções que recebem `$` em arquivo importado (`loadStore`, `saveStore`, `saveGroups`) passam no
  validador: a armadilha do `$` fora do topo não apareceu aí.

Divergências que a tabela expôs (a extração não mudou nada; a 1 e a 2 já foram corrigidas):

1. (corrigida) `view` e `work` só voltavam no `session.start`: num respawn do worker sem ele (reinício
   do hooks worker, `/model`), a visão caía na padrão e o próximo `plan` gravava `work` por cima do
   store. Agora `ensureView($)` e `ensureWork($)`, no molde de `ensureGroups`, trazem do store no primeiro
   uso (`restoredAt` = `first-use` na tabela, como `groups`); marcam `loaded` só quando o state recebe o
   valor e devolvem o que trouxeram para quem não pode gravar (o `ui.render` não pode: `$.state.set`
   lá dentro lança). Chamados em `change()`, `publishWait()`, `nothingOpen()` e no `ui.render`. Sem nada
   no store, o painel fica nos padrões. Teste: `reinicio.test.ts`, "sem session.start: a visão e o
   trabalho atual voltam do store no primeiro uso".
2. (corrigida) `lastRecap` era variável de módulo: recarga entre o `wrap_up` e o fim do turno perdia o
   recap (o cartão mostrava a mensagem final). Agora é a chave de state `recap`, como o `brief`
   (`merge` none, `restoredAt` vazio: sobrevive à recarga, morre com o processo); `lastRecap($)` lê o
   state ('' = nenhum), o `wrap_up` grava e o `turn.complete` lê e zera. Testes: `reinicio.test.ts`
   ("recap antes da recarga", 1/2 e 2/2) e a linha nova na tabela, com os 4 testes do laço.
3. `groups` no `resume` substitui o state (o `SessionStart` de resume chama restore sem olhar o state);
   no `session.start`, o state vence.
4. `sends` sem teto na fusão; `received` e `launches` com 20.
5. Um `Agent` só chega ao store na próxima publicação dos links (fica no state até lá).
6. A visão vai ao store só no clique (`setView`); nenhuma outra gravação a leva.
7. O `ended` não é consumido pelas tools do painel (`plan`/`start`/`done` não passam pelo `tool.call`
   genérico); o lembrete "terminou o turno" sai na próxima chamada comum ou no `prompt.submit`.

#### Sobreposição dos Box

`tests/sobreposicao.test.ts` (6 testes) confere que `overlays()` dá os mesmos `Box` que `overlay()` dava
(7 profundidades × 4 aninhamentos), os trechos em px, e a regra "nenhum par de `Box` na mesma linha se
cruza": estado real nas duas visões em 6 larguras (30–112 colunas), ícone × anel (8 × 4 × 5) e ícone ×
camada do nome (a camada vai da coluna do nome até a borda ou, com anel, até o `Box` do anel; `overlay('name', depth, W, ringNested?)`, nunca abaixo de `NAME_MIN` = 16 px). Nenhuma falha conhecida: a que o teste revelou (a camada cobria o anel, e o clique nele não abria a sessão) foi corrigida no bug 2 da fase 3. Só a área do tooltip do nome cortado num cartão com anel mudou (32 px a menos, mais com cartões aninhados); nenhum pixel do SVG.

- O rótulo do botão do ícone é um espaço em (U+2003), não um espaço comum: é de propósito (dá ao realce
  nativo a largura certa). Com espaço comum, o teste "só o ícone recolhe" cai. Ferramentas de edição
  podem normalizar o caractere; ao mexer nessa linha, confira o U+2003 (um script com perl resolve).

#### Testes de layout

`tests/layout.test.ts` (14 testes) chama `layout()` direto. Fixture real (5): visão completa com 27 linhas (28 antes de a linha ↩ exigir resumo)
("+67 pedidos anteriores" no topo, "+41 cartões antigos de sessões" no fim, só os pedidos 71–73
desenhados, 2 cartões sob as tarefas 97 e 98, nenhum na raiz), o ↩ (o pedido 71 não tem resumo e não tem linha ↩; suprimido nos
pedidos com cartão), o cabeçalho (conta só os nós desenhados, 8/14; chips 6 em andamento, 1 sessão
ativa, 0 aguardando, 0 ✉), a visão resumida (26 linhas, "+1 pedidos anteriores", sem cartões antigos) e o
determinismo. Modelos pequenos (9): ordem dos cartões (`begins`), cadeia, filha de filha aninhada, ↩ por
turno, "+N pedidos anteriores" com pedido antigo aberto, ✉ no painel e dentro de um cartão (`pending` por
escopo), aviso ao usuário, escolhas (linha fechada guarda `nodes`) e o corte de 400 linhas.

- Regra para quem mexer no layout: mudança de linhas → `layout.test.ts`; mudança de pixels → golden do SVG.

#### Reinício e recarga

`tests/reinicio.test.ts` (11 testes, com o fixture `REAL`) cobre dois casos:

- **Reinício do processo** (`$.state` vazio, store cheio): cada teste do kit é um módulo novo com
  `$.state` vazio; o store passa entre testes por um objeto compartilhado. Testado com e sem `session.start`.
- **Recarga a quente** (state mantido, módulo novo, sem `session.start`): `seedState` põe hooks
  `state.get`/`state.set` abaixo do kit, espelha as escritas e devolve o state semeado nas leituras vazias
  (as versões continuam do kit). O teste de recarga recebe o state exato que o módulo montou no reinício anterior.

O que sobrevive a quê, como medido: `$.state` sobrevive à recarga e não ao reinício; o store sobrevive a
tudo; variáveis do módulo não sobrevivem a nada.

**Falhas conhecidas (`KNOWN`):** o kit não tem skip/todo. `known(nome, ok, detalhe)` e a lista `KNOWN`:
o cenário com bug imprime `TODO …` e passa; quando o bug for corrigido, o teste falha pedindo para tirar o
nome de `KNOWN`. Ao corrigir um bug, tire o nome da lista. Bugs abertos:

1. (corrigido, fora de `KNOWN`) `reinicio-sem-session-start`: ver "Grupos do store sem `session.start`" abaixo.
2. (corrigido, fora de `KNOWN`) `links-lista-parcial`: ver "Ligações com lista parcial do host" abaixo.
3. (corrigido, fora de `KNOWN`) `recarga-perde-summary`: ver "Resumo do turno no state" abaixo.

`KNOWN` está vazio; o mecanismo `known()`/`KNOWN` fica para bugs futuros.

Limite: o kit não simula o respawn real do worker.

#### Ligações com lista parcial do host

Antes, com a lista do host parcial, `restoreLinks` só mapeava as filhas listadas e `saveLinks` gravava o
store sem as outras (uma filha com 20 rodadas sumia). Agora:

- `Link`/`linkOf` e `keptLinks: Map<id, Link>`: cópia, no módulo, do que o store guarda em
  `links:<id>.children`; preenchida em `restoreLinks` e atualizada em `saveLinks`. É variável de módulo,
  refeita na primeira gravação após a recarga (como `linksLoaded`).
- `saveLinks` grava a união: filhas do state (ligações atuais) + entradas de `keptLinks` cujo id não está no
  state. Logo `links:<id>.children` pode ter mais ids que o state; leitores fazem merge por id.
- `refreshChildren` e `recordStart`: uma filha que entra no state sem histórico recebe
  `anchor`/`lastAnchor`/`rounds` de `keptLinks`; a filha que o host volta a listar recupera as ligações.
- Regra: o desenho segue a lista do host; o store só não esquece. Entradas de filhas não listadas ficam inertes
  (não vão ao state, ao desenho nem ao arquivo publicado) e só reaparecem se o host listar o id de novo. O
  host lista com `include_archived: true`, então arquivada continua listada e marcada `archived`. Custo
  aceito: o store pode guardar ids de sessões apagadas.

#### Resumo do turno no state

O `summary` do último `done` (a linha ↩) era a variável de módulo `lastBrief` e morria na recarga: o turno
ficava sem ↩ com o resumo (sobrava a mensagem final). Agora é a chave de state `brief`
(`brief: string` em `types/index.d.ts`; '' = nenhum):

- O `done` grava o `summary` no state; `turn.complete` lê, usa no ↩ e zera; os avisos "falta o summary" (no
  `done` e no `wrap_up`) também leem o state. A função de topo `lastBrief($)` lê a chave.
- Sobrevive à recarga; não ao reinício nem ao resume, o que é aceitável porque o turno morre com o processo.
- O contrato `PluginState['task-tree']` precisa listar a chave: o validador confere as chaves de state por ele.
- Armadilha: uma função que recebe `$` precisa estar declarada no topo do arquivo (o validador recusa dentro do
  `register`: "$ is passed to "lastBrief", which is not a function declared at the top of this file").
- O recap do `wrap_up` seguiu o mesmo caminho: chave de state `recap` (divergência 2 do R13), lida por
  `lastRecap($)`.

#### Arquivo publicado

`task-tree/io/publish.ts` escreve e lê `~/.claude/task-tree-waits/<id>.json`; a sessão mãe o lê. O
`register.tsx` só junta o estado em `publishPanel($)` (sete `$.state.get` com chave literal, limite do kit:
referências de estado só literais no arquivo que chama `$.state`) e chama `publishWait($, id, publicação)`,
que recebe o painel já lido e escreve o arquivo (contexto, `panes`, `at`, filtro dos `sends` tomados), com
`try/catch` e o mesmo aviso em falha. As sete leituras de estado vêm antes de checar o caminho do arquivo,
dentro do mesmo `try`. `io/log.ts` tem `debug($, texto)`, usado pelo register e pelo módulo. `waitFile` ficou
em `io/publish.ts` (o item 2 da fase 4 pode importá-lo daqui). O contrato é o tipo `Published` em
`types/index.d.ts` (reexportado por `io/publish.ts`): `version?`, `waiting`, `at?`, `tasks?` (versões
antigas), `groups?`, `waits`, `children`, `context?`, `engine?`, `panes?`, `renderError?`, `drawSize?`,
`rows?`, `work?`, `received?`, `sends?`. As chaves saem do JSON nesta ordem: `version`, `waiting`, `at`,
`tasks`, `groups`, `waits`, `children`, `context`, `engine`, `panes`, `renderError`, `drawSize`, `rows`,
`work`, `received`, `sends`.

- `PUBLISHED_VERSION = 1`: `publishWait` escreve `version: 1` (`satisfies Published`). Formato só acrescido.
- `parsePublished(text)` (pura): JSON inválido, não-objeto (lista/número/string/null) ou `version` presente e
  ≠ 1 → `{ error }`; senão normaliza (listas que não são listas saem; `waiting` só `=== true`; `context` só
  com `percent` e `at` numéricos; `engine` só string não vazia; `work` mapeado a string).
- `readPublished($, id)`: lê, valida e registra uma vez por sessão e motivo no log de depuração
  ("task-tree: arquivo publicado de <id> ignorado: <motivo>"); ao voltar a válido, o motivo é esquecido.
  `refreshChildren` e `watchSends` usam `readPublished`; `breaks`/`split` leem `c.panel` já normalizado.
- Regra: arquivo inválido = "sem arquivo". A sessão aparece pela linha do host e o último painel válido
  continua desenhado (o mesmo que arquivo ausente).
- Versões mistas (clone × instalado): a sessão antiga lendo o arquivo novo ignora `version`; a nova lendo o
  antigo (sem `version`) lê normal; arquivo com `version` ≠ 1 é ignorado por inteiro (a sessão aparece só
  pela lista do host, sem painel). Um arquivo que o código antigo aceitava pela metade (ex.: `groups`
  não-lista) agora é lido como "sem painel". Quando uma mudança de formato exigir, suba `PUBLISHED_VERSION`
  e decida a compatibilidade na leitura.
- `tests/publicado.test.ts` (8 testes): `version` no arquivo escrito; válido; só `groups`; `{}`; versão
  antiga (só `tasks`); versão 2 (ignorada, 1 log, volta ao consertar, logada de novo ao quebrar); corrompido
  e tipos errados; `watchSends` com arquivo corrompido do destino (✉ fica; com `received` válido, some).
- `tests/publicado-versoes.test.ts` (4 testes) com `tests/fixtures/publicados.ts` (`PUBLISHED_FILES`): um
  arquivo de cada um dos 8 formatos que já existiram (o menor de cada, anonimizado: textos "Texto N", nomes
  "sessao-filha", ids `local_` zerados, listas cortadas em 3). Cobrem: o fixture vai do primeiro formato ao
  desta versão (só o último tem `version`); `parsePublished` lê cada um sem erro; uma filha com cada formato
  desenha o cartão e nada vai ao log; o que esta versão escreve tem as chaves do último formato, na mesma
  ordem. Ao mudar o formato, acrescente um arquivo ao fixture.

#### Leitura das filhas (`io/host.ts`)

`refreshChildren` (no `register.tsx`) é a composição de quatro passos, numerados em comentário; os três
primeiros estão em `task-tree/io/host.ts` e testam sem o app, com `$` falso ou entradas puras. O register
guarda as chamadas de estado (`$.state.*` com chave literal: `childrenErrorState`, `update(childrenState)`,
`endedState`, `groupsState`) e passa `keptLink` a `deriveChildren`.

1. **Lista do host:** `parseSessions(resposta)` (pura: JSON → linhas; "No … sessions found" → lista vazia;
   `isError` lança o texto), `listSessions($)` (`$.mcp.call list_sessions` → `{ rows }` | `{ error }`, erro
   cortado em 200) e `mineOf(rows)` (pura: as linhas abertas por quem a lista não traz; `undefined` se não há).
2. **Arquivos publicados:** `panelOf(file)` (pura: `groups` e o resto, ou `tasks` antigas como grupo
   principal, ou nada) e `readFiles($, mine)` → `{ waiting, panels, contexts, engines }` (usa `readPublished`
   e `engineOf` quando o arquivo não traz o modelo). `engineText`, `engineOf` e o cache `engineSeen` moraram
   no register e vieram para cá.
3. **Filhas e as que terminaram:** `deriveChildren(mine, known, read, kept)` (pura) → `{ children, ended }`,
   com a regra do `starting`, dos laços vindos do store (`kept`) e do painel mantido quando o arquivo some.
4. **Publicar:** `publishWait` de `io/publish.ts`, chamado por `publishPanel`.

Ordem, idêntica à de antes: stamp → lista → erro/limpa erro → `watchSends` → vazio → mine → arquivos →
update `children`/`ended` → status → publicar → `keepTime`. `inDesktopApp`, `watchSends`, `selfId`,
`openSession` e `showPane` seguem no register (etapa 3 ou depois). `tests/host.test.ts` (13 testes em 3
`describe`: lista, arquivos, filhas) usa também os 8 formatos de `fixtures/publicados.ts`. Quando os arquivos
são lidos não mudou (performance fica fora desta fase).

#### Arquivos de hook

A fase 4 (etapa 3) dividiu o `register.tsx` (2 116 → 31 linhas) em um arquivo por responsabilidade em
`task-tree/hooks/`; o comportamento é o mesmo (mesmos hooks, mesma ordem, mesmas chamadas):

- `panel.ts` (~490): o estado do painel. As chaves de `$.state` literais só deste arquivo; `lastBrief`/
  `lastRecap`; `reminders` (antes `unplanned`/`planned`/`answeredInChat`, closures do register); `stamp`,
  `migrate`, `openTurn`, `sendAnchor`, `openList`, `identify`, `ensureGroup`, `showStatus`, `persist`, `adopt`,
  `change`, `replace`, `keptGroups`, `restore`, `ensureGroups/View/Work`, `inDesktopApp`, `selfId` +
  `knownId()`, `publishPanel`, `DRAW_LIMIT`, `drawn` (antes `drawSize`/`drawRows`/`renderError`),
  `actions`/`act`, `showPane`, `addWait`/`dropWaits`/`dropAsked`, `setView`/`restoreView`, `nothingOpen`/
  `startsWork`/`setWork`/`joinWork`, `keptLinks`/`keptLink`/`saveLinks`/`restoreLinks`/`restoreWork`.
- `sessions.ts` (~233): `refreshChildren`, `noteReceived`, `watchSends`, `takenNote`, `refreshStale`,
  `recordStart`, `endedNote`, `ticker`/`POLL`/`poller`/`watchSessions`/`anyRunning`/`tick`/`keepTime`,
  `openSession`.
- `session-start.ts` (`sessionStart`, `classicSessionStart`), `prompt-submit.ts` (`NO_TURN`, `said`:
  classificação pura e exportada; `promptSubmit`: efeitos; `promptCompose`), `command.ts` (`commandRun`),
  `tools.ts` (`node`/`level`, `planTool`, `doneTool`, `startTool`), `permission.ts` (`permissionRequest`),
  `turn.ts` (`brief` exportada, `turnStep`, `turnComplete`).
- `tool-call.ts` (~211): o `tool.call` genérico em handlers por responsabilidade, em torno de `Call = { agent,
  e, sentAt, r }`. Antes da chamada: `launch` (Agent/Task), `asked` (pergunta/plano: toma a chamada inteira),
  `wrapUpAsk` (recap e pergunta do `wrap_up`). Depois, só no laço principal: `sentMessage`, `sessionNotes`
  (`ended`, `taken`), `wrapUpOpen` e `reminder` (lembrete de planejar), chamados pelo nome e na ordem original.
- `render.tsx` (~332): `folds` + `setFold`, `pressOf`, `drawDesktop`, `drawTerminal`, `press`, `render`; lê o
  `ownId` por `knownId()`. O atom `folds` ficou aqui pelo limite do kit abaixo.
- Tabela de durabilidade: as linhas de `drawSize`/`drawRows`/`renderError`/`unplanned…`/`ownId` seguem
  verdadeiras (variáveis de módulo; agora `drawn`, `reminders` e `ownId` em `panel.ts`); só os nomes nas
  notas mudaram. `selfId`, `watchSends`, `inDesktopApp`, `openSession` e `showPane` ficaram em `hooks/panel.ts`
  e `hooks/sessions.ts`, não em `io/host.ts`.

Atenção: seções mais antigas ainda dizem "no `register.tsx`" para funções que hoje estão nos arquivos acima
(busque o nome da função em `task-tree/hooks/`).

Limites do kit, confirmados no `claude plugin validate` com experimentos antes da divisão:

1. `on('x', hookOf())` é recusado: o hook tem de ser função literal ou o NOME de uma função, que pode ser
   importada de outro arquivo do módulo.
2. `$.state.get/set` exige a chave literal escrita no arquivo que chama (ou numa `const` dele); essa `const`
   NÃO pode ser exportada nem importada. Por isso cada arquivo de hook declara as chaves que usa (7 arquivos)
   e `panel.ts` não as exporta.
3. `$` não pode ser passado a uma variável de laço (`for (const add of NOTES) await add($)`): os handlers de
   notas são chamados pelo nome.

`$` dos hooks é tipado `EngineInterface`. O `validate` lista os mesmos 14 hooks, as mesmas chamadas do engine
(agora "via" as funções dos outros arquivos) e os mesmos 15 reads/writes de estado. `tsc --noEmit` dá 194
erros contra 193 antes, todos de tipo e já existentes.

#### Grupos do store sem `session.start`

Sem `session.start` (respawn do hooks worker, `/model`), o módulo novo tinha `$.state` vazio e a primeira
escrita partia de `[]`, sobrescrevendo `session:<id>` (o store ia de 97 para 0 tarefas). Agora `groups`
volta do store também sem `session.start`, como já valia para `links`:

- `keptGroups($, id)`: o painel como o store guarda (subagentes interrompidos); extraído de `restore`, que o usa.
- `groupsLoaded` e `ensureGroups($)`, no estilo do `linksLoaded`: se o módulo ainda não viu os grupos e o
  state está vazio, lê `session:<id>` do store e grava no state; devolve os grupos trazidos e só marca
  "carregado" quando a escrita no state vingou (ou o state já tinha, ou o store não tem nada).
- Chamado em `change()` (toda escrita), `publishWait()` (toda publicação), `nothingOpen()` (antes do
  `change` do `plan`) e no `ui.render` (`held = state ?? brought`). `session.start` marca `groupsLoaded = true`
  depois do `restore`.
- `view` e `work` continuam só no `session.start`, de propósito: `restoreView` na guarda mudaria o padrão do
  desenho ('full' no render × 'summary' no restore) e quebraria o golden; fica para o R13.
- Sem `session.start`, o desenho traz as tarefas do store, mas ainda não os cartões de sessão (a lista do
  host só é lida no `session.start` ou pelo poll).

Armadilhas: (1) um `$.state.set` feito de dentro do `ui.render` não vinga no kit (a leitura acontece, o
desenho segue vazio); por isso o render usa o valor devolvido por `ensureGroups` e a flag só sobe com a
escrita confirmada. (2) `claude plugin validate` recusa uma função que recebe `$` com o mesmo nome de uma
variável atribuída em outro lugar ("the function handed $ "saved" is assigned to elsewhere"); por isso
`keptGroups`, não `saved`.

### Desenho do painel

- Referência do visual aprovado pelo usuário (claro e escuro):
  [docs/task-tree-proposta-visual.svg](../docs/task-tree-proposta-visual.svg).
- O desenho é um pipeline: estado → `Model` → `layout()` (`draw/layout.ts`, puro) → `Row[]` →
  `drawDesktop`/`drawTerminal` (funções de topo no `register.tsx`, que recebem as linhas prontas) →
  orçamento. `guides`, `frames` e `labelCols` moram em `layout.ts`. O `ui.render` só lê o estado
  (groups, view e work com os `ensure*`, waits, children, sends, folds), monta o `Model`, chama
  `layout()`, calcula o cabeçalho e chama uma das duas; tudo o que toca `$` fica no
  `register.tsx` (o limite do kit continua respeitado). `layout()` devolve uma lista de linhas (`Row`:
  profundidade, estado, título, contagem) com a mesma travessia para as duas superfícies; `guides` calcula, só pela sequência de profundidades,
  onde cada linha continua as guias dos ancestrais (`bars`), se fecha o próprio ramo (`last`) e se
  desce para as filhas (`down`).
- Desktop (`e.surface === 'desktop'` e `Svg` no `$.ui.resolve`): cabeçalho e cada linha são um `Svg`
  de altura fixa (cabeçalho 44/48/70 px; nível 1 30 px; demais 28 px), empilhados num `Box` coluna.
  Cada SVG desenha o seu trecho das guias até as bordas de cima e de baixo, para elas ficarem
  contínuas. Largura `clamp(240, bodyColumns * 8 - 8, 900)` (heurística, não contrato). O SVG é
  imagem: não herda o tema do app, por isso cada um traz as classes claro/escuro (`STYLE`, com
  `prefers-color-scheme`). Texto em SVG não quebra nem corta: `fit` corta com `…` por uma medição
  aproximada (`textW`). Nome cortado ganha tooltip com o nome inteiro (pedido do usuário: "mostrar
  tooltip com o nome completo da tarefa", para não ter de alargar o painel). A linha continua
  imagem; o tooltip vai numa camada própria por cima (`hoverLayer`): um `Svg` interativo
  (`isInteractive`, moldura isolada, sem scripts; no modo imagem não há tooltip) transparente, só
  com o `<title>` do nome completo. No cabeçalho, a camada cobre só a área do título, abaixo dos
  botões de visão. Motivo da camada (pedido do usuário: "a cada segundo que é atualizado o tempo,
  a linha pisca"): a moldura recarrega, e fica em branco por um instante, a cada mudança da fonte;
  com a linha inteira interativa, o relógio a fazia piscar a cada segundo. A fonte da camada não
  muda com o relógio. Sobre ela o ponteiro é a seta padrão, não o cursor de texto
  (`cursor:default;user-select:none`; pedido do usuário: "quero que o mouse seja o mouse padrão,
  seta"). Linha sem corte não tem camada; recolher não corta nome; terminal sem tooltip.
  Nos testes, o helper `desktop()` ignora as camadas por padrão. Quando os chips não cabem com as palavras, ficam só os números.
- Terminal (e qualquer superfície sem `Svg`): um `Text` por linha, com as guias `├─ └─ │` em texto
  e os glifos `○ ◉ ✓ ✕ ◷ ⑂`; linha recolhida ganha " ⋯" depois do nome (nas duas superfícies). A cor fica só no ícone; o título vai em negrito na tarefa em
  andamento (e no nível 1 aberto), apagado nas concluídas e interrompidas.
- Ícones: anel âmbar com ponto (em andamento), check verde (concluída), círculo cinza (aberta),
  ✕ cinza com "interrompida" à direita (interrompida), relógio âmbar (espera), ramificação cinza
  (sessão rodando), triângulo cinza (subagente com tarefas abertas).
- Cabeçalho: título do nível 1 em andamento (ou "Tarefas"), "X de Y · N%", barra verde e chips só
  acima de zero: em andamento (tarefas em andamento sem nada aberto embaixo), aguardando (avisos
  desenhados, mais as sessões que esperam sem aviso publicado), interrompidas (fora da
  porcentagem) e sessões ativas.
- Abrir e recolher pelo clique no ícone de progresso (pedido do usuário: "quero que o botao de colapse nao
  apareca, e que a funcao de colapsar e expandir esteja no icone de progresso da tarefa"): não há
  coluna ▾/▸. No terminal, o glifo do ícone é o próprio `Button` (só em linha que recolhe); no
  desktop, só o ícone é o alvo (pedido do usuário: "volte para a solucao anterior de somente o
  icone de progresso ser clicavel, e ajuste o tamanho do box atras para ocupar o tamanho do icone
  com adicional de padding nos 4 lados"; a linha inteira, tentada antes, saiu): a linha continua uma
  imagem só e um `Button` de rótulo vazio (um espaço em) fica sobre o ícone, num `Box` absoluto da
  altura da linha que o centra nos dois eixos. O `Box` fica em células inteiras (~8 px), mas o
  conteúdo é centrado em pixels: 3 células em profundidade par, 2 em ímpar; o meio cai a menos de
  0,5 px do centro do ícone. O tamanho do realce é o do botão nativo (um espaço em mais o padding
  dele), que o plugin não controla; centrado, a margem é igual nos quatro lados enquanto o botão
  nativo for simétrico. Linha sem nada embaixo não tem botão. A camada do tooltip cobre o nome
  cortado inteiro e começa depois do `Box` do ícone. Não usar a linha em três peças (Svg | Button
  | Svg, tentada em 6af2b20; pedido do usuário: "o layout quebrou, corrija"): o desktop desenha o
  `Button` como botão nativo opaco e os SVGs cortados deslocavam o cartão. Não há controle visível. Não visto ao vivo: se o botão sobre a imagem que muda a
  cada segundo pisca. O kit não tem tooltip em `Button`: o sinal de clicável é o ponteiro invertendo o botão.
  Recolhida, a linha ganha " ⋯" depois do nome; o `alt` continua dizendo "recolhida". Toda linha com algo embaixo (tarefa com subtarefas, aviso, sessão ou
  subagente pendurado; sessão com painel; grupo de subagente) ganha
  `Row.fold = { key, open }`. A escolha do usuário fica no atom `folds` (estado `collapsed`:
  `true` recolhida, `false` aberta; sem entrada, o padrão) e é gravada pelo `setFold`, helper de topo
  chamado do `onPress` (o render não pode gravar estado). Padrão: tudo vem aberto, nada recolhe
  sozinho ao concluir (pedido do usuário: "quando você finalizar as tarefas, não colapse os itens,
  se eu quiser, eu mesmo colapso"): tarefa concluída mostra todas as subtarefas, pedido (turno)
  concluído, cartão de sessão filha em qualquer estado e grupo de subagente fechado vêm abertos.
  Só o clique do usuário recolhe. Chaves: `<escopo><agente>|t:<id>`
  (tarefa; `|t:A/1` no grupo principal), `<escopo>s:<id local>` (sessão; cartão k>0: `s:<id local>#<at da mensagem>`), `<escopo>g:<agentId>`
  (subagente); dentro do painel de uma filha, o escopo é `<id local>>`. O `Button`
  tem `key` `fold:<chave>`.
- O layout monta as linhas uma vez só, com as escolhas da pessoa (fase 6). Os chips do cabeçalho
  vêm dos nós das linhas desenhadas (`Row.nodes`), por isso não mudam ao recolher; a passada sem
  escolhas que existia para eles, com resultado descartado, saiu.
- Concluídas e interrompidas ficam no lugar delas na lista, na ordem do plano (pedido do usuário:
  "quero que elas continuem na listagem, marcando que foi concluida"); não há seção separada. Uma
  concluída vem aberta, como as outras, e recolhe pelo clique. O tom
  `section` do desenho ficou sem uso.
- Desktop: a linha é um `Svg` com o ícone de progresso clicável por um `Button` vazio num `Box` absoluto
  (ver o item do clique no ícone acima). Não há coluna de botão nem seta à esquerda: o `GUTTER` foi removido.
- Terminal: o nível 1 começa no ícone e cada nível recua 3 colunas. Linha que recolhe é um `Box`
  em linha (`Text` das guias, `Button` com o glifo do ícone, `Text`); linha sem nada embaixo não
  tem botão.
- Cartões (sessão filha e grupo de subagente): a linha de cabeçalho tem `Row.card`; o cartão
  pega ela e as linhas seguintes mais fundas. `frames` calcula, pela sequência de profundidades,
  em que cartões cada linha está (do de fora para o de dentro) e se ela abre ou fecha cada um. Cada
  `Svg` desenha a sua fatia do cartão (fundo `.cd` cinza claro / `#444441` no escuro, borda fina
  `.cs`, cantos de 6 px só na primeira e na última linha) e ganha `PAD` (6 px) em cima, onde o cartão
  abre, e 6 px embaixo por cartão que fecha nela; um cartão de dentro fica 6 px mais estreito à
  direita, e o texto da direita fica dentro do cartão mais interno. A guia que entra no cabeçalho
  para na borda esquerda do cartão. Cabeçalho da sessão: um rótulo solto, não uma tarefa (pedido do usuário: "deve
  ser um texto solto nomeando esse painel, e na linha de baixo a tarefa em si"): só o nome
  (`c.name`, ou o título sem nome), em 12 px, cinza e negrito, sem ícone de progresso, barra,
  contador, tempo nem guia até a tarefa da principal. À esquerda do nome, no lugar do ícone de
  uma tarefa, o ⑂, que é o botão de recolher o cartão (pedido do usuário: "coloque o icone se sessao
  filha do lado esquerdo do nome da sessao, e ele tera a funcao de colapsar o painel"; mesmo `Box`
  e centragem do ícone de progresso). À direita do nome, o estado em palavra ("aguardando" em âmbar, já que não há ícone para colorir;
  "parada", "concluída" e "arquivada" apagadas); o anel de contexto fica solto na ponta direita da
  linha. Contador e tempo da sessão vão só no `alt`
  ("Sessão: <nome> (<título>), d de n, estado, tempo"). As tarefas do cartão são raízes, a partir
  da linha de baixo, sem guia até o rótulo (no terminal alinhadas com ele; no desktop recuadas
  dentro do cartão). O cartão inteiro recolhe pelo clique no ⑂ (no terminal, o glifo ⑂ é o
  `Button`). A guia desce da tarefa da
  principal e entra no cartão, terminando na borda esquerda dele à altura do rótulo (pedido do
  usuário: "a linha de conexao ... esta interrompida, conecte ela no painel"). Recolhido, " ⋯" depois do nome. Subagente:
  `tipo: descrição`, contador e tempo. No desktop a linha ocupa a largura toda. No terminal não há caixa: o cartão vira a linha de cabeçalho
  ("⑂ filha  aguardando", com as tarefas embaixo), como no esboço 7.3 da análise.
- Resposta da sessão (↩; pedido do usuário: "adicione nos paineis de sessao, o que foi gerado como
  resposta, com um icone de resposta"): no fim de cada turno do loop principal da filha
  (`turn.complete`, não abortado), ela grava em `Turn.reply` o `recap` do `wrap_up` desse turno (o
  mesmo texto que abre o aviso de fim de turno da principal) ou, sem ele, a mensagem final visível
  (`answer`), numa linha de até 600 caracteres, e publica com o painel. No cartão (cada cartão é uma
  rodada), depois das tarefas, uma linha ↩ por turno com resposta, na ordem dos turnos: ícone
  cinza, texto apagado, sem barra, contador nem tempo; não é tarefa e não conta no d/n. A linha mostra um
  resumo de até 120 caracteres (`BRIEF`, em `text/rules.ts`), e o tooltip a resposta inteira (pedido do usuário: "devem
  ser um resumo", depois "aumente a resposta para 120 caracteres, esta muito sucinto"; antes eram
  60). Se a linha não couber na largura, o corte visual com "…" e o tooltip continuam. Fonte do resumo: só o campo `summary` do `done`, escrito pela própria
  sessão, tipo manchete, com o que mudou e o resultado (ex.: "Cartões na raiz: causa na recarga; correção
  enviada"); acima de 120
  caracteres, corta no limite de uma palavra com "…". (Regra substituída depois: sem `summary`, a
  linha mostrava só "resposta", com a resposta inteira no tooltip; hoje não há linha, ver "Pai de ✉ e
  linha ↩" em "Como é hoje".) Nunca o texto da resposta cortado (pedido do usuário: "nao
  ficou bom, voce esta imprimindo o texto integral cortado. quero que seja um resumo da resposta,
  super curto"). Como o pedido chega a quem responde: o contexto do `prompt.submit` pede `summary`
  no `done` da última etapa do turno; no schema do `done`, `summary` tem descrição própria e `ids`
  deixou de ser obrigatório (dá para chamar `done` só com `summary`); um `done` que fecha a última
  tarefa aberta sem `summary` responde "falta o summary…", e um `wrap_up` sem `summary` no turno
  avisa "falta o resumo do turno…". O resumo fica em `Turn.brief` e a resposta inteira em
  `Turn.reply`. Sem linha enquanto o turno roda. Terminal: "↩ texto", apagado.
  No próprio painel da sessão (inclusive na orquestradora; pedido do usuário: "igual a sessao
  filha, as tarefas que tenham filhas precisam ter tambem a resposta com o icone de resposta"), o
  grupo da mensagem (linha do pedido, `turnRows`) ganha no fim, depois de todos os níveis 1 dele,
  uma linha ↩ com a resposta do turno, da mesma fonte e com o mesmo visual. Uma linha por turno,
  mesmo com vários níveis 1 ou com nível 1 sem filhas; tarefas soltas, de antes dos turnos, não têm
  ↩; a linha só aparece com o grupo aberto. Exceção: grupo com alguma tarefa que tem cartão de
  sessão filha embaixo (aberta por `start_session` ou acionada por `SendMessage`) não tem ↩; ali a
  resposta que conta é a das filhas, já nos cartões delas (pedido do usuário: "quando as tarefas da
  sessao orquestradora abrirem sessao, a resposta nao deve aparecer, senao, fica quebrado").
- Cliques por chave (pedido do usuário: "as vezes clico nas acoes e nao faz nada, preciso clicar
  algumas vezes para funcionar"): o host só guarda o `onPress` enquanto o desenho existe, e o painel
  redesenha a cada segundo, então o clique na troca do desenho se perdia. O hook `ui.press` responde
  pela chave do botão (`fold:`, `open:`, `view:`) com a ação mais recente (mapa `actions`/`act`), e
  cada press vai para o log de depuração ("task-tree: press <chave> (<superfície>)").
- Painel na tela (`showPane`; pedidos do usuário: "o tasktree nao esta aparecendo na orquestradora",
  "eu troquei o modelo de opus para sonnet na orquestradora, e o task tree nao rendenizou a partir
  dai"): aberto sem pedido (`session.start`, `plan`), o painel só é posto com 144 colunas ou mais;
  num prompt da própria pessoa, se não estiver na tela (ex.: depois do reinício de uma troca de
  modelo), é reaberto como pedido, em qualquer largura. `/task-tree` abre com pedido e responde o
  diagnóstico: o que o app disse (posto ou o motivo), os painéis (na frente, aba atrás de outro, não
  desenhado) e "Desenho: N KB de 600 KB."; `/task-tree resumida | completa` troca a visão sem clicar.
  O arquivo de `task-tree-waits` publica também `panes` (id, `isPlaced`, `isShown`) e
  `renderError`; se o desenho lança exceção, o painel mostra "Painel de tarefas: erro ao desenhar:
  …" e publica o erro.
- Tamanho do desenho (causa do sumiço: o da orquestradora tinha 1,6 MB e o app não o mostrava;
  "resumir os 57 pedidos anteriores resolveu"): o painel do topo desenha só os 3 últimos pedidos,
  mais qualquer um com algo aberto, e os anteriores viram a linha "+N pedidos anteriores"; cada
  cartão, até 3 pedidos, com a mesma linha; cartões sem tarefa de origem, concluídos e começados
  antes do pedido mais antigo desenhado viram "+N cartões antigos de sessões". O cabeçalho continua
  contando tudo. Cada `Svg` leva só as regras CSS das classes que usa (`slim`). Medido com o estado
  da orquestradora: 1.614.695 → 101.345 bytes na completa, 29 KB na resumida. Os três limites, em
  ordem: `SHOWN_TURNS` (3 pedidos) → `MAX_ROWS` (400 linhas, ver abaixo) → `DRAW_LIMIT` (600 KB): só
  se 400 linhas passarem disso, desenho de emergência: "Painel grande demais (N KB): mostrando só o
  essencial. Use ≡ (/task-tree resumida) para a visão resumida." (agora raro). Aprovado pelo usuário:
  "Sim, está bom".
- Limite de linhas (R15; mudança de visual aprovada pelo usuário: "Sim, com o corte"): `MAX_ROWS = 400` e
  `limitRows(rows)`, aplicado no `ui.render` logo depois de `panel()`, antes de guias, molduras e SVG.
  Até 400 linhas nada muda. Acima, saem blocos inteiros de nível 0 do começo (os mais antigos), contados
  numa linha de seção `+N linhas anteriores` (tom `section`, alt "Linhas anteriores, não desenhadas"); as
  recentes ficam. Se o último bloco sozinho passa do limite, o que vinha antes sai contado, o bloco é
  desenhado até o limite e fecha com `+N linhas` (profundidade 1, alt "Linhas seguintes, não desenhadas").
  Total sempre ≤ 400. Corta-se por blocos inteiros do começo porque o trabalho atual fica no fim e cortar
  dentro de um bloco quebraria as guias. O cabeçalho conta o que está desenhado ("sessão inteira: X de Y"
  no tooltip). No desktop as duas linhas são `Svg` de tom `section`, sem geometria nova. O caso real (31
  linhas) não muda. O arquivo publicado ganha `drawRows` (`rows` em `Published`) e `drawSize`, informativos
  (telemetria para a orquestradora ver o tamanho das filhas; os leitores não os usam). Testes:
  `tests/limite-linhas.test.ts` (4 testes: 750 linhas → 400 com `+N linhas anteriores` e contagem fechando
  em 750; bloco de 700 etapas → `+302 linhas` no fim; 100 linhas → nada muda; `rows`/`drawSize` publicados) e
  o teste "desenho grande demais" de `task-tree.test.ts`, que agora espera o corte.
- Cabeçalho por visão (pedido do usuário: "na visao resumida, quero que a barra superior reflita o
  que tem nessa visao ... cada visao deve refletir os dados do seu tipo de vizualizacao"; aprovado
  com "Sim, bate nas duas"): o cabeçalho (X de Y, %, barra, tempo e os chips "em andamento",
  "interrompidas", "sessões ativas", "aguardando") é a soma das linhas desenhadas na visão. Cada
  linha carrega as tarefas que representa (`Row.nodes`): uma folha, ela mesma; uma linha recolhida,
  a subárvore inteira (com as tarefas das sessões embaixo); um pai aberto, nada; seções, ↩ e avisos,
  nada. Resumida: o que ela desenha, o pedido atual e o que segue em andamento (ex.: "1 de 1 · 100% ·
  0:17" com só o pedido atual; com um pedido anterior ainda em andamento à vista, os números somam os
  dois, consequência da regra, e se isso deve mudar ficou para decisão do usuário). Completa: só os pedidos
  desenhados pelo limite de 3, com a linha "+N pedidos anteriores". O total da sessão inteira vai
  discreto, só quando difere do mostrado: no terminal, "(sessão inteira: D de N)" depois do
  cabeçalho; no desktop, no `alt` do cabeçalho. A barra e o % seguem a lista visível. Recolher uma
  linha (cartão, tarefa ou pedido) não muda os números: o `Row.nodes` da linha recolhida leva o que está
  embaixo, cartões inclusive (`Work.cards`). Cada visão conta o que inclui, recolhido ou não; fora ficam
  os pedidos finalizados de turnos anteriores na resumida (e o que o corte do cartão tira) e, na
  completa, o que o limite corta (ver o bullet do Cabeçalho em "Como é hoje" › Desenho).
- Tempo decorrido: `TaskNode.startedAt`/`endedAt` (ms, opcionais; o painel publicado para a sessão
  mãe leva os dois, e versões antigas os ignoram). `start` liga o relógio da tarefa (de novo, se ela
  estava concluída) e o dos pais que ainda não tinham; `done`, o fechamento automático do pai e a
  interrupção do subagente param. Cada linha de tarefa iniciada mostra o tempo à direita
  (`clockText`: `0:04`, `6:12`, `1:02:09`); o cabeçalho, o da sessão inteira (`sessionTime`, ver
  Contador); sessão e subagente, do primeiro início ao último fim das tarefas deles (`span`).
  Interrompida mantém o tempo até a interrupção. A hora vem de `$.clock.now` (`stamp`); sem ela (kit sem `on('clock.now')`), nada de tempo.
- Relógio de 1 s (`keepTime`/`tick`): um `$.clock.every(1000)` que chama
  `$.ui.invalidate('ui.render')` enquanto alguma tarefa roda (aqui ou numa filha viva) e se cancela
  quando nada roda. Começa no `start`, no refresh das filhas, em toda chamada de ferramenta do loop
  principal e no desenho do pane (a recarga do mod cancela os timers do módulo antigo; o desenho que o
  app faz ao carregar o mod os religa, bug do pane parado após edição do clone). Desde então, desenhos
  ao mesmo tempo criavam vários relógios (só o último era guardado) e os cliques se perdiam; a marca
  `starting` garante um só (ver "Relógios" em "Fluxo de dados").
- Nos testes: terminal por `ui.drawn()` (os filhos do `Box`; o `key` do JSX não chega ao
  `findAll`; o `Button` é lido pelo `label`), desktop pelo `alt` de cada `Svg` em
  `findAll({ type: 'Svg' })`. A seta se aperta com `ui.press({ key: 'fold:<chave>' })` (helper
  `fold` do teste); subagentes, ao vivo. Tempo: `on('clock.now')` com um relógio do teste e
  `on('clock.every', () => ({ deny }))` (um período negado encerra o intervalo). Cartões: pelo
  `class="cd"` e pela altura de cada `Svg`. Uma tarefa
  interrompida só nasce de subagente, que o kit não simula: o teste a traz pelo `store.get` de uma
  sessão retomada (`classic.SessionStart` com `source: 'resume'`).

### Armadilhas

- O engine recusa o módulo inteiro, e continua rodando a versão anterior, se `$` for passado para
  uma função que não está no topo do arquivo. Helpers que recebem `$` são `function` ou `const`
  de topo.
- Desestruturar ou espalhar um `Set` (`const [x] = set`) pode virar `set[0]` na compilação do mod.
  Use arrays.
- A recarga depois de uma edição pode atrasar. Para confirmar a versão carregada, ponha um marcador
  temporário no resultado de uma ferramenta do mod e tire depois.
- Uma ferramenta nova registrada com `$.tool.register` só aparece a partir do próximo prompt.
- A pergunta do AskUserQuestion e a aprovação de plano abrem dentro do `next(e)` do `tool.call`
  (ordem: `tool.call`, `tool.check`, diálogo). Pedidos de permissão chegam por
  `classic.PermissionRequest`; nenhum evento marca a resposta, por isso o aviso de permissão só sai
  quando a chamada termina.
- A caixa de fim de turno do app desktop com pergunta e botões (`mcp__ccd_turn__wrap_up` com `ask`)
  volta na hora e o turno acaba, mas o usuário continua sendo perguntado. O `tool.call` cria o aviso
  `choice` ("Aguardando sua escolha", chave `<agente>:wrap_up:ask`), que não sai no fim da chamada:
  fica até o próximo `prompt.submit` ou até um wrap_up sem `ask` (ou com `ask` vazio). Entra no
  arquivo publicado (`waiting`/`waits`), então a principal desenha o relógio de espera na filha.
- Tarefas esquecidas abertas: dois lembretes no loop principal, com a lista das abertas sem nada
  aberto embaixo (`openList`). (1) No resultado de cada `mcp__ccd_turn__wrap_up` com tarefas
  abertas, para marcar `done` antes da mensagem final. (2) Quando uma sessão filha passa de rodando
  ou à espera para parada (`refreshChildren` grava o id em `ended`), uma vez, no próximo
  `prompt.submit` ou na próxima chamada de ferramenta do loop principal, se a tarefa de origem dela
  ainda estiver aberta. Fora do app desktop (sem wrap_up nem sessões) nada disso dispara.
- O `$.ui.status` fica embaixo da caixa de mensagem, que some enquanto uma pergunta está aberta:
  avisos de espera vão no painel.
- O kit de testes (`claude-code/testing`) não expõe `$.state`. Teste pelo painel montado
  (`$.ui.mount` + `findAll`, com `unmount` depois) e pelos resultados das ferramentas. O `agentId`
  de subagente vai no argumento das ferramentas (`plan($, tasks, 'sub1')`, com `on('agent.list')`);
  o `$.prompt.submit` do kit aceita `origin` e `isMeta`. Eventos sem implementação embaixo (`classic.SessionStart`,
  `prompt.compose`) precisam de um `on(...)` do teste que responda.
- O grupo de um subagente se liga à tarefa em que ele foi lançado pela descrição da chamada do
  Agent (`launches`); grupos criados antes disso não têm âncora e vão para o fim da lista.
- Fora do app desktop não há sessões filhas: se a lista falhar e nenhuma ferramenta `mcp__ccd_…`
  existir (`$.tool.list`), o painel não mostra a linha "Sessões indisponíveis". No app, a falha
  aparece nela.
- Sessões filhas (app desktop): vêm de `$.mcp.call('ccd_session_mgmt', 'list_sessions', { linked: true })`,
  consultado a cada 3 s (`watchSessions`, com `$.clock.every`; o intervalo é recriado no
  `session.start` e a cada chamada de ferramenta e prompt do loop principal, porque recarregar o
  módulo cancela o anterior) e após cada `start_session`. A lista
  exclui a própria sessão: o id dela é o `startedBy` que nenhuma linha listada tem. Em andamento =
  `isRunning` (ícone de ramificação). No teste, o hook `mcp.call` responde `{ value }`.
- Onde a sessão filha aparece: o `tool.call` de `mcp__ccd_session__start_session` grava em `children`
  o `anchor` (a tarefa em andamento da principal, como o `launches` dos subagentes) com o id `local_…`
  do resultado. A filha faz parte da árvore: fica embaixo dessa tarefa, aberta ou concluída (a
  tarefa concluída vem aberta). Uma filha parada fica embaixo da origem, como histórico, e some
  junto só quando o usuário recolhe a origem ou um pai dela. Sem âncora (cartão
  `own_initiative`, que só começa com o clique) vai para o fim da lista.
  Arquivada fica, como histórico (ver "Sessão arquivada").
- Ordem de execução (pedido do usuário: tarefas na ordem do plano; grupo novo sempre embaixo dos
  que já existem): replanejar um nível 1 aberto com o mesmo id o substitui do zero no mesmo lugar
  da lista, sem mandá-lo para o fim (texto das `RULES`: "substituído do zero no mesmo lugar da
  lista").
- Um cartão por mensagem (pedido do usuário: filha ocupada que recebe mensagem nova tem o painel
  duplicado; o cartão antigo fica onde estava e o novo vai sob a tarefa da principal que mandou a
  mensagem): cada `SendMessage` grava em `Child.rounds` `{ at, anchor }`, com a hora tomada antes
  da chamada. `split(c)` divide o painel publicado da filha em cartões pela hora de cada turno
  dela: o cartão 0 fica na âncora original; o cartão k vai sob a tarefa que mandou a mensagem k
  (`Child.part` = k). Várias mensagens entregues de uma vez abrem um turno só, que vai para a rodada
  da última delas (ver "Turno em lote" em "Cartões no lugar certo", em "Como é hoje"). Subagentes, avisos de espera e netas vão para o cartão da tarefa-âncora
  deles. Só o cartão da frente mostra a espera; o anel de contexto aparece em todo
  cartão da sessão, em qualquer estado (trabalhando, ocioso, parado, concluído ou de rodada antiga),
  com o último % publicado (pedido do usuário: "mesmo depois que a sessao termina, o icone se
  contexto precisa continuar aparecendo"). Sem % publicado, sem anel nem botão de abrir (um anel
  vazio diria 0%, o que é falso). Com a filha rodando, todo
  cartão com tarefas abertas é desenhado em andamento. Mensagem ainda não lida não tem turno, logo
  não tem cartão: a tarefa que a mandou fica com o ✉ até a filha a pegar; aí o ✉ some e o cartão
  novo aparece. Na visão resumida a divisão vem antes do recorte. Chaves de dobra do cartão k>0:
  `<escopo>s:<id>#<partAt>`, com escopo interno `<escopo><id>#<partAt>>`, onde `partAt` é o `at` da
  rodada (campo `Child.partAt`) e não o índice dela: no teto de 20 rodadas o índice se deslocava e o
  recolhimento ia para outro cartão (ver "Cartões no lugar certo" em "Como é hoje"). Id reutilizado (bug achado pelo usuário
  no 0.7.4: os cartões de pedidos anteriores apareciam sob a tarefa do turno atual): quando o `plan`
  renomeia a tarefa fechada que tinha o id, as âncoras (`anchor`, `lastAnchor`, `rounds[].anchor`,
  `launches`, `sends`) são renomeadas junto, e, para dados de antes, o layout resolve a âncora pela
  tarefa que tinha o id no momento da mensagem (ver "Âncoras e ids reutilizados" em "Como é hoje").
  Rodadas também vêm de mensagens de sessões irmãs (pedido do usuário: "as tarefas que estao
  aparecendo na sessao filha, nao aparecem na sessao orquestradora"): cada filha publica o que
  recebeu (`Panel.received`) e `breaks()` junta as mensagens da principal com as das irmãs. A mensagem
  de uma irmã pertence à rodada do turno em que a irmã a mandou (não à última rodada dela antes de
  a mensagem chegar; pedido do usuário: "as tarefas de governança, svg e documentação, não são da
  tarefa de envio decha sozinha?"), e a rodada vai sob a tarefa onde estava esse cartão, seguindo a cadeia, no mesmo nível, uma depois da outra, na ordem de execução.
  A origem vem primeiro do ✉ da irmã: o envio pendente dela para esta sessão (`sends` publicado)
  aponta a tarefa que enviou, e o turno dessa tarefa dá a âncora na principal; sem ✉, o último turno
  da irmã antes da chegada. Sem origem conhecida, o cartão da mensagem não é desenhado por até 10 s
  (`WAIT_ORIGIN`) e depois vai para onde der (raiz, se nada). Motivo (pedido do usuário: "ela
  deveria abrir direto no lugar correto"): as leituras de 3 s e os arquivos gravados em momentos
  diferentes faziam o cartão nascer na raiz e pular depois. (Regra de hoje, igual à primeira e depois de uma
  tentativa retirada: a cadeia, ex.: docs → SVG → governança, põe cada grupo novo no seu cartão sob a
  tarefa da principal que abriu a cadeia, sem aninhar no cartão da irmã, na ordem de execução; ver
  "Cadeia de sessões em sequência" em "Cartões no lugar certo", em "Como é hoje".) Sob uma mesma
  tarefa (e soltos no fim da lista), os cartões vão na ordem em que o trabalho de cada um começou
  (`begins(c)` + `inOrder()`; ex.: implementação → documentação → SVG → governança), não na ordem da
  lista do host (pedido do usuário: "e rodou, ficando tudo junto").
  Custo do `breaks()`: as irmãs trocam mensagens em anel (impl → docs → SVG → governança → impl) e,
  com o `received` persistido, cada lista guarda 10–20 entradas; recalcular a cadeia da irmã por
  mensagem, recursivamente, crescia exponencialmente (até 20^5 chamadas por cartão a cada desenho,
  22,7 s medidos) e derrubava o worker ("task-tree was unloaded: it crashed the hooks worker", sem
  exceção no log). Agora há memo por desenho (`WeakMap` pela lista de irmãs, com o caminho na
  chave), a cadeia de cada irmã é calculada uma vez e há corte de ciclo (a sessão reencontrada no
  próprio caminho conta só as rodadas dela): 0,1 s, mesmo resultado. Teste de regressão no kit.
  Mensagem sem rodada registrada (pedido do usuário: "layout quebrou novamente"; envio feito com o
  painel fora do ar ou durante um crash): cada mensagem da dona que a filha tratou (o `received`
  dela) é casada em ordem com as rodadas registradas (`unsent`); a que sobra abre uma rodada mesmo
  assim, sob a tarefa da dona que estava aberta quando ela chegou (a que esperava a entrega) ou,
  sem tarefa aberta, no fim do painel, depois de todos os pedidos. Rodadas de irmãs sem origem
  também vão para o fim. Antes, essas mensagens caíam na rodada anterior e o cartão ficava acima de
  outro pedido. Um turno interrompido por crash antes de salvar a resposta fica sem ↩. Cartão de rodada já
  fechada de sessão ainda rodando mostra ✓ sem a palavra "concluída".
- Tarefa que enviou a mensagem (`sendAnchor`; pedido do usuário: "o segundo painel de
  implementacao deveria estar abaixo da tarefa de tooltip completo, foi ele quem enviou a mensagem
  de solicitação"): é a tarefa em andamento, salvo se, depois do início dela, foi planejada uma
  tarefa folha aberta sem `start`; aí é a mais nova dessas. Tarefas planejadas junto, antes do
  início, não mudam nada. Vale para o lugar do cartão (`rounds`), para o `lastAnchor` (que a visão
  resumida usava para posicionar o cartão; hoje só é gravado e publicado) e para o ✉ (`sends`). Sem
  tarefa em andamento (decisão do usuário depois do teste visual), é a iniciada por último no pedido
  atual, mesmo concluída, senão a última do pedido (ver "Sem start, nada aceso" em "Como é hoje").
- O que a filha mostra: o host não expõe espera nem tarefas de outra sessão (`list_sessions`/
  `get_session` só têm `isRunning`). Cada sessão grava `~/.claude/task-tree-waits/<id local>.json`
  com `{ waiting, at, tasks, groups, waits, children }` (o painel inteiro dela; `tasks` é o grupo
  principal, para versões antigas) a cada mudança do painel (`persist`), dos avisos de espera e das
  próprias filhas (id via `get_session` com `self`), e a sessão que a abriu lê o arquivo no refresh
  de 3 s (`Child.panel`). Rodando ou esperando: cabeçalho (ícone de ramificação cinza ou relógio
  âmbar, com `d/n`) e, embaixo, o painel dela desenhado pela mesma função (`panel`) que desenha o da
  principal: mesmos ícones, o aviso de espera embaixo da tarefa em andamento dela, os subagentes e
  as netas (até `DEEP` níveis). Parada sem tarefa aberta: rótulo `⑂ nome  concluída`, com o cartão aberto como os demais.
  Parada, não arquivada, com tarefa aberta (ex.: "Aguardar sinal…"): ícone ◷, palavra `parada`, com as tarefas da filha como ela as planejou, cada uma no seu estado (regra substituída: hoje o que
  estava em andamento aparece interrompido, sem relógio, e as pendentes seguem pendentes; o rótulo `parada` e o cartão ficam)
  (pedido do usuário: "no painel da sessão filha, devem aparecer exatamente as tarefas de dentro
  dela"); o clique continua recolhendo. Não se usa `$.store` para isso: a chave
  dele é o `$.session.id()` (uuid do CLI), que a principal não conhece; o arquivo usa o id `local_…`,
  que as duas sabem.
- Contador: `total` soma as tarefas da principal (todos os grupos) com as das filhas (as arquivadas
  como histórico, o que deixaram aberto como interrompido), recursivamente; vale para o topo do
  painel e o `$.ui.status`. As interrompidas ficam fora. Os resultados de `plan`/`done` contam só o
  grupo de quem chama.
  O `d/n` de cada tarefa da principal (`atWork`) soma, além das próprias folhas (a própria tarefa,
  se for folha com sessão), as tarefas das sessões ancoradas nela ou abaixo (arquivadas inclusive), só
  enquanto a tarefa não está concluída com `done`. Com uma dessas sessões viva, a tarefa aberta é
  desenhada em andamento e o relógio corre; uma tarefa concluída com `done` fica concluída (regra
  substituída: antes ela era desenhada em andamento "mesmo com `done` gravado"; o progresso das
  filhas fica no cartão delas; ver o bullet "Tarefa da mãe concluída" em "Como é hoje"). O chip "● em andamento" conta só o andamento próprio
  (`active`); a sessão já conta no chip ⑂. Sem nível 1 aberto, o cabeçalho mostra o que tem sessão
  viva embaixo (`atWork(...).live`; o último nível 1 com sessão viva, não o primeiro). O tempo (`timeOf`) vai do primeiro início ao último fim da
  tarefa, das subtarefas e das tarefas dessas sessões (`allTasks`, até `DEEP`; só as de tarefa não
  concluída), ou até agora enquanto alguma roda ou uma sessão embaixo de tarefa não concluída está viva; vale para linha, terminal e `alt`. O tempo do cabeçalho é o da sessão
  inteira (`sessionTime`), nas duas visões: do primeiro início (ou `plannedAt`) de qualquer tarefa
  do painel (todos os turnos, níveis 1 soltos, subagentes e sessões, arquivadas inclusive, até `DEEP`) ao
  último fim, ou até agora enquanto houver tarefa aberta ou sessão viva. O "N de M" vem do `total`. O relógio de 1 s
  (`running`) corre enquanto houver sessão viva.
- No kit de testes, o caminho chega ao `fs.write` com `\` no Windows, e `$.clock.now` precisa de um
  `on('clock.now', ...)`; sem ele, o `publishWait` falha calado.
- Os `tool.call` de `mcp__task-tree__plan`/`start`/`done` respondem sem chamar `next`, então o
  `tool.call` genérico (lembrete "sem plano aberto") não roda para eles: o que precisa saber que o
  pedido usou o painel (`planned`) é marcado dentro de cada um. `planned` volta a `false` no
  `prompt.submit`; com ele ligado, o fim do turno (wrap_up, mensagem final) não traz o lembrete.
- `list_sessions` sem sessão ligada responde texto puro ("No other sessions found."), não `[]`.
- Logo depois do `start_session`, o host ainda lista a filha parada: o marcador `Child.starting`
  impede que ela conte como turno encerrado até o host a ver rodando, esperando ou arquivada.
- AskUserQuestion do loop principal sem tarefa aberta é recusado (`deny`), para a pergunta não
  ficar solta no painel. ExitPlanMode passa sem essa exigência (o desenho original; não é que o modo
  de plano bloqueie as ferramentas do painel: `plan`/`start`/`done` respondem antes do `tool.check`).
- Resposta por mensagem no chat: o AskUserQuestion volta com "User did not answer this question —
  they sent a message instead…", antes de a mensagem chegar. O resultado ganha um contexto próprio
  e o próximo `prompt.submit` diz que a mensagem é a resposta. Todo `prompt.submit` com tarefas
  abertas lista as abertas para fechar as que a mensagem conclui ou substitui.
- Aviso de pergunta/plano (`question`/`plan`) do agente sai também no `turn.complete`, caso a
  chamada não volte. No kit, `$.turn.complete` exige `answer`, `durationMs`, `isAborted` e `turnId`
  no evento, e um `on('turn.complete', () => ({ text: '' }))`.
- Respostas das ferramentas por grupo: o `plan` diz o tamanho do plano enviado (todos os níveis) e
  as folhas abertas do grupo de quem chama; o `done`, "Concluídas: x/y no seu grupo" (o subagente não
  conta a principal).
- Origem das mensagens (`prompt.submit`, `e.origin.kind`, posta pelo engine): `task-notification`
  (a volta de um subagente, um comando em segundo plano), `observer`, `observer-activity`,
  `auto-continuation` e `unclassified` (avisos do engine e do app: ociosidade, recibos, eventos do
  app desktop) continuam o pedido em andamento (`NO_TURN`): não abrem turno nem trazem o lembrete de
  pedido novo, só um curto para pôr o painel em dia. As outras (o usuário, outra sessão, um plugin,
  uma tarefa agendada) abrem turno.
- Turnos (pedidos): cada `prompt.submit` que não é de `NO_TURN` abre um turno no grupo principal (`Group.turns`, `{ id,
  title, at }`), também as mensagens de outra sessão, que chegam como `isMeta` (sem isso, uma sessão
  filha ficava com um turno só e o trabalho atual dela nunca trocava), com o começo da mensagem sem
  as tags, numa linha (até 60 caracteres), como título; turnos sem tarefa são descartados nessa hora. O `plan` do loop principal grava `turn` em
  cada nível 1 novo (o último turno) e o `request` opcional renomeia esse turno (cria um, se não
  houver). Um nível 1 replanejado (mesmo id aberto) fica no turno em que estava, mas só dentro do
  mesmo pedido (`replanned`/`sameRequest` em `planTool`: aberto, id reutilizado e do último turno, ou
  sem turnos, ou tarefa sem turno, ou grupo de subagente). Um aberto de pedido anterior com id
  reutilizado não é replanejado: é interrompido (`interrupt(now)`, a regra do código para trabalho
  deixado aberto) e renomeado (`<tag>:id`, como os fechados que colidem), com as ligações indo junto
  (`renameAnchors`), e fica no pedido antigo como histórico; o nível 1 novo vai para o turno novo.
  Antes, uma mensagem nova com `plan` de "1", "2", "3" punha o "1" novo no lugar de um "1" aberto do
  pedido anterior (que ficou aberto porque o `done` veio só com `summary`), sob o cabeçalho do pedido
  antigo, e a resumida mantinha o pedido antigo à vista. Os `sends` só são descartados das tarefas de
  fato replanejadas; os de uma renomeada são renomeados com ela. Como os turnos vão
  dentro do grupo, persistência, resume e o painel publicado já os levam; painéis antigos (sem
  `turns`) desenham os níveis 1 soltos, como antes, e esses ficam à frente dos turnos. Desenho só no
  painel de cima (`level === 0`) e, no cartão de uma filha, só para turno com mais de um
  nível 1 (pedido do usuário: "parece que quebrou de novo o layuot dos elementos", escolha "Tarefas
  sem ligação" → opção a): ali o cartão ganha o cabeçalho com o título do pedido e os níveis 1 ficam
  ligados por conector embaixo dele, sem repetir o ↩ (o cartão já mostra as respostas abaixo das
  tarefas); turno com um só nível 1 continua sem cabeçalho, para o cartão não ganhar uma linha por
  turno:
  `turnRows` faz a linha do pedido (d/n, barra e tempo somando as tarefas e as sessões abertas
  nas tarefas não concluídas, como no `atWork`), em andamento enquanto algo dele está (um pedido com
  todas as tarefas concluídas com `done` fica concluído, e ✕ se alguma tarefa em qualquer nível foi
  interrompida), aberta também quando tudo fechou
  (chave `|T:<id>`), e os níveis 1 um nível abaixo. O limite de 3 níveis do `plan` não muda.
- Ícone de sessão filha: toda linha mantém o ícone de progresso (○/◉/✓/✕/✉; no cartão da sessão,
  ◉ rodando ou aguardando, ✓ concluída, ✕ arquivada). O cartão de uma sessão (`Row.session`) e a
  tarefa ou turno com sessão ancorada nela ou abaixo (`Row.kids`, de `atWork`; arquivada inclusive) ganham
  também o ramo; no `alt`, ", com sessão filha". Vale recolhida.
- Posição dos ícones (decisão do usuário, corrigida: "eh pra colocar o icone de sessao filha, nao os
  icones de progresso. volte o icone de progresso para o lugar que estava e coloque no lugar o icone
  de sessao filha"): no desktop, o ícone de progresso fica à esquerda, logo depois das guias, antes
  do título, em todas as linhas. Nas linhas de tarefa, turno e cartão, as colunas da direita são
  fixas: tempo (`TIME_W`), d/n (`COUNT_W`), barra e, logo à esquerda da barra, o ramo (só nas
  linhas com sessão; vazia nas outras, para alinhar), com a palavra de estado ("concluída",
  "interrompida") antes dele. No terminal: "◉ título  ⑂  d/n  tempo".
- Concluídas com o mesmo layout: a linha fechada tem o mesmo ícone de progresso (✓/✕), ramo,
  título, barra, d/n e tempo da aberta. `plan` grava `plannedAt`; `done` sem `start` dá início à
  tarefa (`fillStarts`): o fim da irmã anterior fechada, senão o início do pai, senão `plannedAt`
  (nunca depois de agora); o que ela fecha embaixo começa dela. Interrompida mantém o tempo até a
  interrupção. Sem tempo conhecido (painéis antigos, ou o kit de testes sem relógio), a linha fechada
  mostra "—" (`Row.time === null`). No desktop as colunas são fixas (ver a posição do ícone); no
  terminal o resto vem depois do título, sem colunas.
- Lista das sessões velha: além do refresh de 3 s (cujo callback não rejeita mais, para não
  encerrar o intervalo), o `prompt.submit` e cada chamada do loop principal leem a lista de novo
  quando a última leitura tem 3 s ou mais (`refreshStale`; só depois da primeira, no
  `session.start`). Sem isso, uma sessão parada podia ficar desenhada como viva e manter os pais em
  andamento.
- Mensagens a outras sessões (pedido do usuário: "somente encerre tarefas de mensagens enviadas
  para as filhas, quando houver confirmacao de recebimento"): todo `SendMessage` do loop principal que não falha (pedido do usuário: "uma
  sessao esta chamando a outra, mas nao esta aparecendo as tarefas com o icone de mensagem"; antes
  só o resultado "queued" contava, e entre filhas a entrega costuma ser imediata) grava em `sends` `{ to, anchor, at }`, com a tarefa em
  andamento, e o resultado ganha o aviso de manter a tarefa aberta. Entrega imediata ("delivered; its turn has started") grava com `delivered: true`
  e não ganha lembrete de recebimento; envio que falha não grava nem deixa ✉. Os `sends` vão no
  painel publicado, e a principal desenha o ✉ na tarefa que enviou dentro do cartão espelhado da
  filha. A tarefa fica com ✉ até o destino ser visto tratando a mensagem (o `received` publicado
  por ele, na releitura de 3 s); aí o painel a fecha sozinho, e o `RULES` diz para não chamar
  `done` nela. Enquanto o envio está pendente,
  a tarefa tem um ícone de progresso próprio (tom `sent`; pedido do usuário: "para as tarefas que
  voce esta esperando confirmacao da sessao filha, use um icone diferente"): envelope azul na coluna
  do ícone no desktop, "✉" (cor `permission`) no terminal, `alt` "Aguardando confirmação de
  <sessão>: título" e chip "N aguardando sessão"; não conta como "em andamento" (nem a das linhas ✉ dos cartões de filha: o `active` do `ui.render` exclui, além dos `sentIds` da fila desta sessão, os objetos de tarefa das linhas de tom `sent`, por objeto e não por id, porque ids se repetem entre sessões; uma ✉ com filhos desenhados tem `nodes` vazio e as folhas abertas dela continuam contando; corrigido na fase 3, teste em `layout.test.ts`). O chip "N em andamento" conta, pelos dados e não
  pelas linhas desenhadas (`activeLeaves`), todas as folhas abertas (◉ e ○, sem subtarefas) de todos
  os grupos do painel e das sessões não arquivadas (até `DEEP`), como o `total`: é M − N do "N de M"
  (interrompidas fora dos dois), menos as que esperam confirmação (chip ✉). Pedido do usuário: "a
  quantidade de tarefas em andamento deve ser o total de tarefas de menor nivel (sem filhas)", e na
  escolha seguinte, "Folhas abertas". Confirmado, volta
  a ◉ (ou ✓, se o modelo concluir). `watchSends` (no `refreshChildren`) marca `idle` quando vê a sessão parada
  depois do envio e `taken` quando ela volta a rodar (começou a tratar a mensagem); o próximo
  `prompt.submit` ou chamada do loop principal lembra, uma vez, que o recebimento foi confirmado.
  A tarefa do envio fecha sozinha ao receber (escolha do usuário: "Fechar sozinha ao receber"):
  quando o envio é marcado como recebido, o `watchSends` (na releitura de 3 s, sem precisar de turno
  da sessão que enviou, que pode estar parada) conclui a tarefa, se ela estiver aberta e sem
  subtarefa aberta, e publica o painel, para o cartão na sessão mãe não ficar "parada". O aviso de
  recebimento diz que o painel já fechou a tarefa (reabrir com `start` se faltou algo); o `RULES` e
  o aviso de "ficou na fila" dizem que a tarefa fica em andamento até o recebimento e que a sessão
  pode encerrar o turno. `done` que fecha a tarefa de um envio ainda na fila conclui, mas avisa; e,
  desde o item do ✉ até a entrega, o ✉ continua na tarefa concluída até a entrega (o `done` não
  apaga mais o envio).
  A regra está no `RULES`.
- Etapa por etapa (pedido do usuário: "ela ficou parada muito tempo na primeira tarefa, e derepente
  pulo para a ultima"): a causa era o agente, que não chamava `start` e fechava várias etapas num
  `done` só no fim (as do meio saíam com 0:00); o espelho publica a cada mudança e a principal relê
  a cada 3 s. O `RULES` e o contexto do `prompt.submit` pedem `start` no começo de cada etapa e
  `done` assim que ela termina, antes da próxima, nunca várias de uma vez no fim. O `done` avisa
  quando 2 ou mais etapas nunca iniciadas fecham juntas ("N etapas fecharam juntas sem start ...");
  com `start` antes, ou com uma só, não há aviso.
- Id curto em `start`/`done` (`resolve()`; pedido do usuário: "as terafas foram executadas fora de
  ordem, verifique se existe um erro"): o id completo e o curto entram juntos e vence o aberto; no
  mesmo estado, o id completo desempata. Antes o id completo tinha prioridade, e "1" ou "3" pegavam
  níveis 1 antigos e já concluídos com esse id em vez de "31/1" e "31/3", abertos no plano atual,
  que ficavam pendentes no cartão.
- Ligações persistidas (pedido do usuário: "voltou o comportamento de sessoes abrirem no lugar
  errado"): âncoras e rodadas das sessões abertas, `sends`, `received` e `launches` ficavam só em
  memória; depois de recarregar o plugin ou reiniciar o app, os grupos voltavam do store mas as
  filhas ficavam sem âncora e as cadeias sem origem, e os cartões caíam na raiz. `saveLinks` grava
  `links:<sessão>` no store a cada publicação; `restoreLinks` restaura no `session.start` e, numa
  recarga (que não passa por ele), antes da primeira gravação, juntando ao estado atual em vez de
  sobrescrever.
- Visões (pedido do usuário: "quero que exista essa visao atual, e uma visão resumida, onde mostre
  somente as tarefas em andamento"; depois: "deixe mais bonito esse toggle, esta solto no layout. e
  a visao resumida deve ser a visao padrao ao iniciar uma nova sessao"; depois "o toggle ainda esta
  estranho, deixe mais bonito", com a opção "Ícones no canto"): dois botões só de ícone no canto
  direito da linha do título do cabeçalho, chave `view:<summary|full>`: "≡" resumida, "▤" completa.
  A API não deixa clicar em partes de um `Svg`, então no desktop o cabeçalho segue um `Svg` só (o
  título sozinho na 1ª linha, com `ICONS_W` livre à direita; "N de M · % · tempo" na 2ª; barra;
  chips) e os botões ficam por cima, num `Box` `position="absolute"` `top={0}` `right={0}`. O
  escolhido é `variant="primary"` (realce da superfície), o outro `plain` esmaecido. O `Button` não
  tem prop de ícone, dica (tooltip) nem nome acessível separado, e o desktop desenha o `label` como
  o texto do botão nativo (pedido do usuário: "quero que aparecam dois icones, sem texto"): o
  `label` é só o glifo, sem filhos, e qual visão está escolhida vai no `alt` do cabeçalho ("Visão:
  resumida, selecionada (≡ resumida, ▤ completa)"). No terminal, os glifos no fim da linha do
  título, o escolhido entre colchetes ("[≡] ▤").
  A escolha fica no estado `view` (reload) e no store em `view:<session id>`; no `session.start`,
  sem estado, vale a do store (resume) ou, sem ela, a resumida (sessão nova). Sem estado nenhum (o
  kit de testes, que não roda o `session.start`), o render usa a completa.
  Trabalho atual (pedido do usuário: "somente limpe os itens quando todos estiverem concluidos e quando
  iniciarem novas tarefas"): o estado `work` (e o store em `work:<session id>`, restaurado no
  `session.start`) guarda os níveis 1 do grupo principal do trabalho atual. Regra de hoje (correção
  depois da fase 6, branch `fix/resumida-so-tarefas-do-turno`; pedido do usuário: "segundo a regra
  antiga, na visão resumida, ficam somente as tarefas novas do turno"): um `plan` ou `start` do loop
  principal começa trabalho novo (`startsWork`) numa mensagem do usuário (turno) diferente da do
  trabalho atual, mesmo com folhas abertas no painel; o trabalho novo são os níveis 1 novos mais os
  do trabalho anterior que ainda têm algo aberto embaixo (`goingOn`); os pedidos todos concluídos
  saem. No mesmo turno, os níveis 1 dele entram no atual (um nível 1 concluído renomeado pelo plano
  continua); `/clear` zera. Sem turnos registrados (painéis antigos), vale a regra antiga: só com
  `nothingOpen` (nenhuma folha aberta no painel, sessões incluídas). Antes, só `nothingOpen` decidia:
  uma filha parada com uma tarefa aberta (caso comum na orquestradora) fazia todo pedido novo entrar
  no trabalho atual, e o `work` acumulou 11 níveis 1 de 6 pedidos ("+3 pedidos anteriores" e três
  concluídos acima do novo). (Regra substituída depois: um nível 1 concluído com sessão viva embaixo agora fica no
  recorte, com o seu pedido, e o cartão fica sob a tarefa que mandou a mensagem; ver "Cartões no
  lugar certo" em "Como é hoje".)
  Regra do usuário fixada em teste (`resumida-limpeza.test.ts`): "quando eu enviar novas mensagens,
  em novos turnos, se existirem tarefas em andamento, essas tarefas devem continuar sendo mostradas.
  o painel só deve ser limpo quando enviar uma mensagem em um novo turno e todas as tarefas estiverem
  finalizadas." Uma tarefa com ✉ pendente não está finalizada: continua à vista, com o ✉.
  A resumida é a visão completa de um recorte do painel (pedido do usuário: "a visao resumida deve
  usar a mesma base de logica da visao completa, com o diferencial que ela somente mostra as tarefas
  em andamento e elas somente sao ocultas dessa visao quando todas estao completas"): mesmas linhas,
  mesmos botões no ícone e o mesmo estado de abrir e recolher (`collapsed`, compartilhado pelas duas visões, já
  que as chaves são as mesmas). O recorte (`cut` no render, com `trimToWork`) é o trabalho atual:
  seus níveis 1 com os demais dos mesmos turnos (o d/n do turno bate com as linhas), os subagentes
  e as sessões debaixo deles ou ainda vivos; sem `work` (painéis antigos), o turno mais recente com
  tarefas; sem turnos, o último nível 1 aberto (ou o último), nunca o painel inteiro. Tudo concluído, o recorte continua com ✓ até o trabalho novo.
  Sessões filhas no recorte (pedido: "nao esta aparecendo a sessao filha no resumo"): cada
  `SendMessage` do loop principal a uma sessão grava em `Child.lastAnchor` a tarefa em andamento; o
  recorte põe a sessão sob essa tarefa se ela estiver no trabalho, senão sob a de origem (se
  estiver), senão, viva, solta no fim da lista (regra substituída: hoje o recorte não realoca
  cartão nenhum, cada um fica sob a tarefa que mandou a mensagem, como na completa, e o nível 1 com
  sessão trabalhando embaixo fica no recorte; ver "Cartões no lugar certo" em "Como é hoje"); a completa não muda, salvo que o pedido com sessão trabalhando embaixo não sai do corte
  dos 3 últimos. Dentro do cartão, só a rodada
  atual da sessão ("so devem aparecer as novas dessa rodada"): cada sessão publica o seu `work`
  (`Panel.work`) e o mesmo `trimToWork` corta o painel dela e o das netas. No recorte, d/n, barra,
  tempo e as somas dos pais seguem a rodada; o cabeçalho segue a sessão inteira. Tarefa em
  andamento sem `start` conta o tempo desde `plannedAt` (linha e turno). O `alt` do cabeçalho diz a
  visão. Nos testes, o helper `view` tira os glifos do toggle da linha do título.
- Anel de contexto da sessão filha (pedido do usuário: "no item pai mais alto de uma sessao filha
  ... um icone a esquerda do icone de sessao filha, mostrando a porcentagem de contexto usado"): cada
  sessão publica no seu arquivo (`publishWait`, também no `turn.complete` do loop principal)
  `context: { percent, at }` de `$.session.usage()` (sem `breakdown`, que é caro); a que a abriu
  guarda em `Child.context`. O anel (`contextRing`: trilha cinza, arco do topo em sentido horário,
  azul até 69%, âmbar de 70%, vermelho de 85%; só o círculo, sem nada no centro: "pode ser somente o
  circular, nao precisa do icone dentro") fica só no cartão da
  própria sessão, solto na ponta direita da linha do rótulo, na coluna onde termina o tempo das
  linhas de baixo, longe do nome; a palavra de estado continua logo depois do nome (pedido do
  usuário: "deve estar solto e na direita da mesma linha"). Linhas de tarefa e de pedido não mostram
  mais o anel das filhas nem o citam no `alt` (pedido do usuário: "nao precisa colocar esse icone
  na tarefa pai que originou essas sessoes, porque gera inconsistencia"); o ⑂ continua nelas,
  marcando que há sessões embaixo. Sem percentual, sem anel. No desktop o anel é clicável e abre a sessão
  no painel principal da janela (pedido do usuário: "quero que o icone de contexto seja um icone
  clicavel tambem, e quando clicar nele, abra a sessao que ele representa"): um `Button` sem
  rótulo centrado no anel (`ringOver`, que chama `overlay('ring', …)` de `draw/geometry.ts`; o `overBox(cx)` do módulo, o mesmo do ícone de progresso, escolhe
  as células inteiras com o meio mais perto do centro do glifo; pedidos do usuário: "mesmo problema
  do icone de progresso, o botao atras nao tem padding" e "o mouse over do anel de contexto continua
  pequeno, nao envolvendo o icone todo"). O realce é do botão nativo: o tamanho vem do texto do botão
  mais o padding nativo, e o `Box` só posiciona. No anel, o texto é um em space (U+2003,
  `RING_LABEL`), para o realce ter o tamanho do anel (15 px), e o `Box` do botão tem 4 células
  (`RING_CELLS`), a largura do realce nativo (32 px), ancorado pela ponta direita da linha
  (`right`, `ringRight`), e o anel é desenhado no meio dele (`ringFromRight`: x = W − 8·(right +
  2); constantes `RING_D` 15, `RING_CELLS` 4, `RING_IN` = `CARD_RIGHT` + `RING_D` = 17,5). A regra "ancorar pela borda mais próxima" (ícone e nome contados pela esquerda, anel pela direita; célula `CELL` = 8 contra ≈7,87 reais) está escrita uma vez, no cabeçalho de `draw/geometry.ts`; `foldOver`/`ringOver`/`nameLayer` só chamam `overlay`; o anel não usa mais o `overBox`. Motivo, medido nos prints do usuário ("ainda não, segue
  desalinhado"; aprovado depois com "Sim, ficou certo"): a célula do desktop tem um pouco menos de
  8 px (≈7,87); contado da esquerda (cerca de 57 células) o erro somava ≈7 px e o anel ficava fora
  do realce, e contado da direita ele é de fração de px. O teste confere o `Box` pela direita, com 4
  células e folgas iguais até 1 px. O kit não dá tamanho ao `Button`, e o teste não mede o realce
  nativo)
  chama `open_session_in`
  (servidor `ccd_window`, `target: focus`) por `$.mcp.call` (`openSession`), o mesmo efeito de
  clicar na sessão na barra lateral; o kit não tem API própria para isso e o `Link` do desktop só
  abre https:. Limites do app: só abre esta sessão ou uma aberta por ela (o cartão de uma neta é
  recusado), só com esta sessão na tela, e recusa com o cursor num campo de texto; a recusa vira o
  toast "Não abriu <nome>: <motivo>". Sem tooltip "Abrir <nome>" (o `Button` não tem, e uma camada
  por cima engoliria o clique) e sem cursor de mão. O ⑂ continua recolhendo o cartão. Terminal: "42%" no fim da linha do
  rótulo, na cor da faixa.
- Modelo e esforço no cartão (pedido do usuário: "quero que voce mostre o nome do modelo e o
  esforco de cada sessao, ao lado esquerdo do anel de contexto"; depois "nao aparece em todos os
  paineis, somente no primeiro"; aprovado com "Sim, em todos"): cada sessão pega `model` e
  `effort` do `turn.step` (os pedidos do loop principal; hook em `async function*`) e publica o
  texto em `engine` no arquivo de `task-tree-waits`, só quando muda, como o % de contexto. Sem
  publicação (sessão que ainda não rodou um turno com esta versão), o cartão busca no registro do
  app (`get_session`), com cache de 1 min por sessão; o publicado tem prioridade. `engineText` dá o
  nome legível: `claude-opus-5-5[1m]` vira "Opus 5.5 · high", `claude-sonnet-5-5` vira "Sonnet
  5.5" (sem `[1m]` nem data; nome fora do formato fica como veio). Desenho: texto cinza de 11 px,
  terminando 8 px à esquerda do anel (sem anel, na borda do cartão), omitido se fosse encostar no
  nome, e citado no `alt`; vale em todos os cartões da sessão. Não entra no cabeçalho do painel da
  própria sessão (o app já mostra o próprio modelo). O hook `turn.step` não tem teste: o kit não
  tem implementação base para o evento em stream.
- Sessão arquivada (pedido do usuário: "Manter visível, marcada"): continua na árvore como histórico,
  sob a âncora, nas duas visões (na resumida, se a âncora estiver no recorte), com o cartão cinza,
  ✕ de progresso, ⑂ e "arquivada"; mostra o último painel publicado e recolhe como os outros. O
  `panelOf` de uma arquivada marca como interrompido o que ela deixou aberto (fora do M do "N de
  M", no chip de interrompidas; desde a série 3 vale também para a sessão que terminou o turno sem
  estar arquivada, só para o que estava em andamento, e as pendentes seguem pendentes: ver "Tarefas abertas de uma sessão que terminou o turno" em "Como é hoje"). Suas tarefas entram no N de M, no d/n, no tempo dos ancestrais e
  do cabeçalho; o chip "em andamento" e "sessão ativa" não a contam. Nos ancestrais, a ⑂ continua; no cartão,
  o anel mostra o último percentual, esmaecido (`Ring.faded`).
- Pai aguardando (pedido do usuário: "nas tarefas que estao aguardando e ja tem alguma tarefa
  concluida, marque os pais como aguardando"): uma tarefa ou turno aberto, com algo concluído abaixo e
  nada em andamento (não acesa pelo `current`, sem ✉ nem sessão viva), tem o tom `paused`: ◷ âmbar
  no lugar do ○, `alt` "Aguardando: …", tempo parado no último fim abaixo (`stillSpan`). Não entra em
  chip. (Hoje o `current` não acende nada sem `start`, então um pai aberto com algo concluído embaixo
  e nada aceso aparece ◷ sempre que não há tarefa em andamento; ver "Sem start, nada aceso" em "Como é
  hoje".)
- Avisos do app (`<system-reminder>` com `<side-sessions-event>`, quando uma sessão filha termina) não
  chegam como `unclassified`: são reconhecidos pelo texto e tratados como `NO_TURN` (sem turno, sem
  título, sem pedido de request).
- Classificação das mensagens (0.7.3): antes de decidir, o `prompt.submit` tira os blocos
  `<system-reminder>…</system-reminder>` com o conteúdo (o app põe "Linked sessions now …" na frente
  da primeira mensagem de uma filha e das entregas da fila; na 0.7.2 isso fazia mensagens de verdade
  passarem por aviso). `<cross-session-message` sempre abre turno, com o conteúdo dela como título.
  A volta de subagente (`<agent-message from="<agentId>">`, "[Subagent hand-back] …", às vezes com a
  `<task-notification>` junto) e o aviso do app (sobra vazia ou começando com `<side-sessions-event>`)
  não abrem turno; o aviso relê a lista das sessões antes dos lembretes.
- Confirmação de mensagem na fila (0.7.3): quem recebe guarda e publica `received: [{ from, at }]`
  (`<cross-session-message from="local_…">`, os últimos 20), em qualquer prompt. Quem envia, em
  `watchSends` (antes dos retornos do `refreshChildren`, então também numa sessão sem filhas, para a
  mãe ou as irmãs), lê o arquivo do destino. Destino que publica `received`: os envios pendentes para
  ele, do mais antigo ao mais novo, casam cada um com a SUA mensagem recebida do próprio id (`selfId`),
  a mais antiga ainda não casada com `at` ≥ o envio, cada mensagem uma vez só (`usedReceipts`); envio
  sem mensagem própria continua pendente (✉) e a tarefa continua aberta. Antes, qualquer mensagem
  recebida com `at` ≥ o envio, ou qualquer turno depois dele, confirmava todos: com duas mensagens
  na fila para a mesma sessão ocupada, a primeira entrega fechava as duas tarefas e a segunda, ainda
  pendente, sumia do painel. Destino sem `received` (versões antigas): um turno publicado depois do
  envio; senão a regra antiga (vista parada, depois rodando). Um replan da tarefa de envio e o `/clear` tiram o envio de `sends`; um plano que
  reusa o id de uma tarefa fechada renomeia a tarefa e o envio dela junto (`renameAnchors`); um `done`
  não tira mais o envio (o ✉ fica até a entrega). Assim não sobra ✉ fantasma num id reaproveitado.

### Pendências

- Sobra da etapa 1 do layout: `elapsed` não é usado. (A passada de `panel(all, …)` sem escolhas, com
  resultado descartado, saiu na fase 6: a medida mostrou que ela só preenchia o memo que a passada
  seguinte preenchia igual, e as linhas ficaram idênticas.)
- Cabeçalho fixo ao rolar (pedido do usuário, deixado para depois): o `Box` não tem sticky nem área
  rolável própria. O único caminho é o padrão do `ui.scroll` do `Pane`: não chamar `next`, guardar o
  próprio offset (`e.by`), invalidar e redesenhar o cabeçalho mais a fatia das linhas
  (`site.scroll.bodyRows`). Falta provar que o desktop dispara `ui.scroll` ao rolar o pane (lá as
  linhas são `Svg` em pixels). Próximo passo, quando retomado: um hook temporário de diagnóstico no
  `ui.scroll` que registre os eventos enquanto o usuário rola o pane no desktop.
