# Ajuste 3 reaberto: tarefas alheias piscam na janela "Tarefas" (foco parado na principal)

Correção do usuário à conclusão anterior: "ela sozinha mostra tarefas de outra sessão, aqui mesmo,
sem eu fazer nada. algo no plugin está com problema." A troca por foco é normal; o bug é o piscar
com o foco parado.

## Fatos levantados
- Cada sessão do app é um processo CLI próprio (8 processos `claude-code\2.1.308\…\claude.exe
  --output-format stream-json` sob o app). Variáveis de módulo (`ownId`, `keptLinks`, `ticker`,
  `poller`, `loaded`) não vazam entre sessões.
- Todas as sessões abrem o painel com o **mesmo id `task-tree`** (`hooks/register.tsx:30`,
  `session-start.ts:64`, `tools.ts:110`, `panel.ts:367`, `command.ts:18`).
- Cada sessão com tarefa cronometrando redesenha o próprio painel a cada 1 s
  (`hooks/sessions.ts:249`, `$.ui.invalidate('ui.render')`), e todas releem as sessões a cada 3 s
  (`watchSessions`, `POLL`).
- `$.store` é um arquivo só (`~/.claude/plugins/store/task-tree_inline-….json`, 1,1 MB, 30
  `session:`, 28 `links:`, 35 `work:`), lido e regravado inteiro por todos os processos. As chaves
  levam o id da sessão (`storeKey`). Leitura com o id certo não traz grupos de outra sessão, mas a
  escrita concorrente pode perder dados (lost update).
- Os arquivos publicados (`task-tree-waits/`) da família estão limpos. `list_sessions` está
  coerente; `mineOf` (agora pelo id próprio) não traz sessão alheia.
- Testes com o usuário observando: `plan` (que chama `ui.open`) e 3 recargas por `touch` não
  reproduziram.

## Hipóteses que restam (em ordem)
1. **Desenho de outro processo na mesma janela.** Outra sessão (de outra conversa, rodando em
   segundo plano) redesenha o painel `task-tree` (ticker de 1 s, poller de 3 s, recarga do mod em
   todas as sessões ao salvar o clone). O app mostra esse desenho por um instante na janela da
   principal, porque o id do painel é igual, até a principal redesenhar (≤ 1 s com o relógio
   ativo). Isso combina com "sozinha" e com "1–2 s". Se for isso, a causa está na interação
   mod/app, e o mod pode evitá-la. Ver o passo 3 do plano.
2. **`ensureGroups` com estado vazio durante uma recarga.** `render` usa `heldState ?? brought`.
   Se `$.state` vier vazio num desenho e `$.session.id()` não for o desta sessão naquele instante,
   `keptGroups` traz os grupos de outra do store. A instrumentação confirma ou descarta.
3. Perda de escrita no store: não mostraria tarefas alheias, só perderia as próprias. Baixa.

## Plano
1. **Instrumentar (primeiro commit, só diagnóstico):** em `render` (`hooks/render.tsx`), anexar a
   um log próprio `~/.claude/task-tree-waits/render-<ownId|session.id>.log`, via `$.fs.write` em
   modo append (ou regravando as últimas 200 linhas, como em `io/publish.ts:141`), **só quando o
   desenho muda**:
   `hora ISO · $.session.id() · knownId() · origem dos grupos (state|brought|vazio) · cabeçalho
   (head) · d/n · títulos dos nível 1 (curtos)`.
   Registrar também em `ensureGroups` quando ele trouxer do store (id usado e quantos grupos).
2. O usuário anota a hora de um piscar (e tira print se der). Comparar:
   - se o log da **principal** mostra títulos alheios naquela hora, o mod desenhou errado (a
     origem diz se veio do state ou do store): corrigir a fonte;
   - se o log da principal está limpo e o de **outra sessão** desenhou naquela hora, é a
     hipótese 1.
3. **Correção da hipótese 1:** dar a cada sessão um id de painel próprio, `task-tree-<curto do
   session id>`. Ver `register.tsx:30` (`requestId`): o filtro do `on('ui.render')` precisa casar
   com o novo id, então ele deve ser montado no `plugin.register` com o id da sessão ou trocado por
   um prefixo. Ajustar `PANE` em todos os `ui.open`/`ui.panes` e manter o título "Tarefas". Se o
   kit não aceitar um id dinâmico no filtro, alternativa: o `render` confere `e`/sessão e devolve
   `next(e)` quando o pedido não é desta sessão. Também reduzir redesenhos em segundo plano:
   pausar o ticker de 1 s quando o painel não está à vista (`$.ui.panes()` sem `isFocused`/shown),
   se o kit disser.
4. Correção da hipótese 2, se for ela: em `ensureGroups`, só trazer do store com `ownId`
   conhecido e igual à sessão; num desenho sem estado, desenhar vazio por um instante em vez de
   grupos de outra.
5. Depois de achada a causa, retirar ou rebaixar o log (deixar só sob `debug`).

## Pedido ao usuário
Na próxima vez que piscar, anotar a hora (e, se der, um print com os títulos alheios).

## Rodadas (loop hipótese → teste → resultado)
- **R1 (18:41): instrumentação.** Bloco `DIAG-TAREFAS-ALHEIAS` em `hooks/render.tsx`, logo depois
  de `const head = …`. Ele grava `~/.claude/task-tree-waits/diag-render-<session.id>.log` a cada
  desenho cuja assinatura muda (hora · session.id · ownId · origem state|brought|vazio · cabeçalho ·
  títulos de nível 1). **Sem commit; retirar o bloco inteiro e os arquivos `diag-render-*.log`
  quando a causa for achada.**
  Resultado: só a principal (01ffbf2e / local_31c0a900) desenha. A janela está à vista e a origem é
  sempre `state`. Nenhuma outra sessão gerou log, porque o painel delas não está à vista e elas não
  desenham.
- **R2 (18:44): 4 recargas reais do mod** (edição de comentário a cada 8 s), com o usuário
  observando. A janela ficou estável. O log da principal só registrou o redesenho da recarga, com
  as tarefas certas (origem `state`; `ownId` vazio por um instante e logo preenchido). A
  recarga deixa de ser suspeita: a hipótese 2 (`ensureGroups`/store) não se confirmou e a hipótese 1
  por recarga não reproduziu.
- Achado à parte: o cabeçalho continua "Abrir sessões filhas em espera" mesmo depois do 6831bce,
  porque `current(mainTasks)` acha um âncora antigo (tarefa aberta/iniciada de um pedido antigo?).
  É um item separado, a conferir.
- **Próximo:** deixar a instrumentação ligada no fluxo normal (as filhas trabalhando, mensagens
  entre sessões, fins de turno). No próximo piscar, o usuário dá a hora e lê-se o log:
  - log da principal com títulos alheios naquela hora: o mod desenhou errado, e a origem do log diz
    de onde veio;
  - log da principal limpo naquela hora: a principal não desenhou aquilo, foi o app que mostrou
    outro painel. Conferir os `diag-render-*` de outras sessões no mesmo horário.
- **R3 (18:46–18:48): log ampliado.** O `diag-render` passou a registrar também os grupos e as
  filhas, com os títulos de cada uma, e um `diag-list-<session.id>.log` novo, em `refreshChildren`
  (`hooks/sessions.ts`), registra `self`, as linhas da lista e as `minhas`. Fiz 5 recargas reais
  (18:47:49–18:48:15).
  Resultado: na principal, `self` é sempre `local_31c0a900`, as linhas e as minhas são sempre as 3
  filhas, os grupos são só `main` e a origem é sempre `state`. Nas outras sessões, entre elas outra
  família (78aab2b7 com 6e6343d2, 3cb81033 e 7a1206ca), cada uma vê a própria família, sem mistura.
  **Nenhuma sessão em segundo plano chamou `ui.render`** (não há `diag-render` delas, nem depois
  da recarga), então os desenhos de outros processos no mesmo slot ficam fora, ao menos depois das
  recargas.
- Vigia em segundo plano (`scratchpad/watch.sh`, 25 min) para assim que o log da principal mostrar
  `minhas`, grupos ou filhas fora do esperado.

## R4 (21:51–21:52 UTC): CAUSA CONFIRMADA por reprodução (teste de entrega 1)
O que o usuário vê, nas palavras dele: "Você mostrou tarefas pendentes para entregar a mensagem, ao
entregar a mensagem mostrou tarefas antigas concluídas, em seguida criou as tarefas novas
pendentes." As tarefas não são de outra sessão: são pedidos antigos e concluídos da própria
principal, mais a rodada antiga do cartão da filha.

Log de render da principal (visão resumida, `work`, âncoras das filhas e linhas desenhadas), cópia em
`claude-code-mod-task-tree-notas/diag-render-principal.local.log`:
1. 21:52:05 `work=Q`: desenha só o pedido Q, com o envio ✉ "aguardando". Correto.
2. 21:52:06.611 a entrega fecha o envio: Q concluído. Correto.
3. **21:52:06.795** o pedido anterior volta: "Pista: pisca logo após" (O) e o cartão da
   analise-task-tree com a **rodada antiga** ("Provocar o piscar", ainda com tarefa aberta). O
   cabeçalho vira **"Abrir sessões filhas em espera"**, o título do primeiro pedido.
4. 21:52:09.680 a rodada nova da filha ("Ler log do teste…") aparece sob Q. O pedido O antigo
   continua desenhado acima.

### Causa
- `trimToWork` (`draw/layout.ts` ~560): a visão resumida mostra o `work` (Q) **mais** `busy`, as
  tarefas de nível 1 com uma sessão viva embaixo (`atWork(t).live`). Quando a mensagem é entregue,
  a filha passa a rodar (`live`), e `atWork` decide em qual tarefa ela está pelo **`c.anchor`**,
  o âncora de abertura, que nunca muda (no log, `analise>2/2.3`, sob o primeiro pedido), e pelas
  rodadas antigas do cartão, e não pela rodada atual (`lastAnchor = Q`). Assim, toda tarefa antiga
  sob a qual a filha já trabalhou volta à visão resumida como "em andamento", com o cartão na
  rodada antiga.
- Cabeçalho: com o envio fechado, `current()` fica sem âncora (`now0=undefined`) e
  `headTask = newest.find(t => atWork(t, sessions, 0).live)`. `atWork` usa o `c.anchor` = 2/2.3, e
  por isso a tarefa 2 "Abrir sessões filhas em espera" é a única "viva". Isso também explica o
  título antigo de todos os prints (o 6831bce não cobre este caminho).
- O piscar dura até a filha abrir a rodada nova (o plan dela) e o cartão se ancorar em Q.

### Plano de correção (implementação)
1. Em `atWork` (`draw/layout.ts` ~397), para o que é **vivo/ocupado** (`busy`, `live`), a sessão
   conta só na tarefa da rodada atual: o âncora `c.lastAnchor ?? c.anchor` (o da última mensagem
   enviada a ela). As rodadas antigas só contam para contagem e desenho dos cartões (`d/n`,
   `cards`, como no ajuste 4). Conferir que `lastAnchor` é atualizado no envio (no log ele vira Q
   em 21:52:05, antes da entrega).
2. `trimToWork`: com o passo 1, `busy` deixa de puxar pedidos antigos. Os cartões antigos da mesma
   sessão (rodadas sob O) só aparecem se O estiver no `work`.
3. Cabeçalho (`hooks/render.tsx` `headTask`): com o passo 1, `newest.find(live)` acha Q. Conferir
   que, com tudo concluído, o título é o do pedido mais recente.
4. Opcional: uma rodada antiga de uma filha com tarefa ainda aberta (no caso, a 9.3 deixada aberta
   entre turnos) não deve se desenhar como `current` quando a filha já está em outra rodada.
5. Validar a recarga do mod e repetir o teste: principal manda "teste de entrega" a uma filha
   ociosa, na visão resumida. Esperado: só o pedido novo, o cartão da filha sob ele, e cabeçalho
   com o título novo, sem o pedido antigo em nenhum momento.

### Instrumentação
Retirada: `git checkout` nos dois arquivos (só tinham o bloco DIAG) e `diag-*.log` apagados de
`~/.claude/task-tree-waits/`. A árvore de trabalho ficou limpa.

## R5 (21:53 UTC): pista "pisca quando EU mando, com nada em andamento"
- Religuei um log DIAG compacto em `hooks/render.tsx` (sem commit; **retirar**: o bloco
  `DIAG-TAREFAS-ALHEIAS` logo após `const head = …`, e o arquivo
  `~/.claude/task-tree-waits/diag-render-*.log`). Cada desenho que muda registra a origem, o
  cabeçalho, a visão, o `work`, o `now0` e as linhas.
- O usuário testou mandar mensagens na principal com tudo concluído e não viu nada anormal. O log
  das 21:53–21:54 não mostra pedidos antigos no desenho da principal.
- Código do caminho do prompt do usuário: `promptSubmit` → `showPane` (só abre se o painel não
  está posto) → `openTurn` (`hooks/panel.ts:79`). Ele cria o turno novo sem tarefas e descarta os
  turnos sem tarefas, mas **não mexe no `work`**. A visão resumida continua no pedido anterior até
  o primeiro plan. Isso não traz pedidos antigos, a não ser pela causa da R4: uma filha viva puxa,
  pelo âncora de abertura, a tarefa onde ela foi aberta.
- Cabeçalho na hora do prompt: com nada em andamento (`now0=undefined`), o título vira o
  da tarefa 2 (causa da R4) sempre que alguma filha está viva.
- Próximo: no próximo piscar real no envio do usuário, a principal dá a hora (UTC−3) e se lê o
  `diag-render-01ffbf2e-….log` nessa hora.

## R6 (22:30–22:32 UTC): teste de entrega 2. A causa da R4 se reproduziu por 6 s
- 22:30–22:31: duas mensagens do usuário com tudo concluído. O desenho só troca do pedido
  anterior para o novo, num quadro de 130 ms (submit → plan). Não houve piscar.
- 22:32:11.175: a entrega fecha o envio (pedido U concluído).
- **22:32:11.235 → 22:32:17.283 (6 s)**: a visão resumida desenha o pedido antigo R ("Pista: pisca
  quando o…") com o cartão da analise-task-tree na rodada antiga, todo concluído, e o cabeçalho
  "Abrir sessões filhas em espera". Só às 22:32:17 a rodada nova da filha aparece sob U e R sai.
- Bate com a descrição do usuário: "ao entregar a mensagem mostrou tarefas antigas concluídas, em
  seguida criou as tarefas novas pendentes". A causa é a da R4: uma filha viva conta pelo âncora de
  abertura e pelas rodadas antigas em `atWork`/`trimToWork`, e não pela rodada atual
  (`lastAnchor`). O plano de correção da R4 vale sem mudança.
- Instrumentação ainda ligada (bloco DIAG em `hooks/render.tsx` e `diag-render-*.log`): retirar
  antes do commit da correção.
