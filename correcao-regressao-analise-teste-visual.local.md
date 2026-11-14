# Análise dos bugs do teste visual (2026-10-23) — só análise, nada implementado

Branch `fix/painel-serie-3`, HEAD `6150b45` = revert do commit 5 (`16062cc`, bug O). Na pasta só a seção local do
DESENVOLVIMENTO.md, `docs/analises/` e `scripts/`. Lista de origem:
`orquestradora-teste-visual.local.md` (O, cabeçalho, P1–P20) + o bug "painel não apareceu" (governança).

Fontes: código em `task-tree/`; estados publicados reais em `~/.claude/task-tree-waits/` da orquestradora
(`local_d0b58b27…`, rodadas/âncoras/ids), da docs (`local_745ea9f2…`) e da svg (`local_63c0582c…`). Nenhum arquivo
novo na pasta de trabalho (scripts de leitura no scratchpad).

## Resumo em uma tela

| Grupo | Itens | Causa raiz | O que fazer |
|---|---|---|---|
| A. "Sem start, a primeira aberta fica em andamento" | P2, P3, P4, P6, P7, cabeçalho "Passo 2"/"Passo 4" | `current()` acende a primeira tarefa aberta quando nada foi iniciado; `sendAnchor`, `recordStart`, o título e o tom das linhas herdam isso | Tirar o padrão: nada iniciado ⇒ nada aceso; envio sem tarefa em andamento ancora na última iniciada (decisão) |
| B. Fim do turno | O (revertido), P5, P9, P15 | `panelOf`/`Model.ended` interrompem tudo que está aberto (commit 4); o `halt` do commit 5 foi revertido | Voltar o `halt` (só iniciadas); com A, o `idle` deixa de ser preciso; P15 depende do `stop` no app |
| C. Resumida: regra nova | P1, P10, P16, P18 | `startsWork`/`goingOn`/`trimToWork` cortam pedidos finalizados a cada mensagem e seguram pedidos antigos por sessão viva | Substituir: nada sai enquanto algo à vista (tarefas e cartões) está aberto; só então a mensagem nova limpa |
| D. Rodadas perdidas e ids reusados | P11, P13, P18 (cartões do lote) | Envio sem rodada registrada (svg sem `rounds`) e `unsent()` que exige ≥1 rodada; plan que reusa id de nível 1 aberto renomeia e interrompe o antigo | Registrar a rodada sempre (criar o laço se faltar); `unsent` com zero rodadas; decidir o reuso de id |
| E. ✉ e contagem | P17, P14 | `doneTool` apaga o `send` da tarefa fechada; `turnRows` dá ✓ a pedido cuja tarefa está interrompida | Manter o ✉ depois do `done` até a entrega; pedido com interrompida não é ✓ |
| F. Título antigo e trabalho próprio das filhas | P19, P20 | Título cai no PRIMEIRO nível 1 com sessão viva; turno aberto por prompt do usuário na filha vai para a última rodada da mãe | Título = última iniciada; turno próprio da filha vira cartão sem âncora (decisão) |
| G. Painel não apareceu na governança | novo | Não reproduzível pelo kit; a hipótese forte é a recarga falha do clone no mesmo instante | Conferir o log de depuração e o horário da recarga; não é código do painel |
| H. Processo | P8, P12 | Edição em vários passos no clone recarregando | Já na memória: um passo só, validado; P12 aceitável |

## A. O padrão "nada iniciado ⇒ a primeira aberta está em andamento" (P2, P3, P4, P6, P7, título)

Sintomas (prints 53–58): cartão da correção (mensagem do bug O, enviada antes do `start` do Passo 2) sob "Passo 2";
cartão "Passo 2 filha" (docs, enviado pelo Passo 2) sob "Passo 3"; "Passo 3" ✓ 1/1 sem ter sido iniciado; "Passo 4"
◉ 3:30 sem ter sido iniciado; título do cabeçalho "Passo 2"/"Passo 4" nunca iniciados.

Evidência no estado real da orquestradora (rodadas gravadas em `children[].rounds`):
- correcao-regressao: rodada 11:29:03 → âncora `e2`. `e2` só foi iniciado às 11:29:12. Nada estava iniciado às 11:29:03
  ⇒ `firstOpen` = `e2`. (P4)
- docs-task-tree: rodada 11:29:20 → âncora `e3`. `e2` já tinha sido concluído às 11:29:14 (o modelo deu `done` antes
  de mandar a mensagem); nada iniciado ⇒ `firstOpen` = `e3`. (P2/P6)
- `e4` planejado 11:28:23 e iniciado 11:32:57; entre o fim de `e3` (11:31:40) e isso, nada iniciado ⇒ `e4` aceso com
  tempo `now − plannedAt` = 3:30 às 11:31:53. (P7, bate com o print)
- P3 é consequência de P2: `watchSends` fecha a tarefa do envio quando a mensagem é tomada ("Taken up: the task it was
  sent from is done, closed here"). A mensagem da docs estava ancorada em `e3` ⇒ `e3` ficou ✓ 1/1 sem start. O
  `start e3` posterior (11:31:29) reabriu e escondeu o rastro no estado final.

Código:
- `draw/layout.ts` `current(list)`: com `started.length === 0` devolve `firstOpen(list)` como `lit` e `anchor`.
- `hooks/panel.ts` `sendAnchor()` e `hooks/sessions.ts` `recordStart()` usam `current().anchor`.
- `hooks/render.tsx`: título = nível 1 de `current().anchor`.
- `draw/layout.ts` `rows()`: `lit.includes(t.id) ? 'current'` e `time = now − plannedAt` para `current` sem start.
- `tasks.ts`/`watchSends`: fechamento automático da tarefa do envio na entrega.

O que fazer (decisão do usuário, recomendo a primeira):
1. Tirar o padrão: nada iniciado ⇒ `lit = []`, `anchor = undefined`. Uma tarefa só fica ◉ com `start`. Isso resolve
   P4, P7 e o título ("Passo 2"/"Passo 4") de uma vez e simplifica o B (sem `idle`).
2. Âncora de envio sem tarefa em andamento: a última iniciada (`startedAt` mais recente, concluída ou não) do pedido
   atual; sem nenhuma, sem âncora (o cartão fica no fim do pedido, não sob uma tarefa seguinte). Alternativa: manter a
   regra de hoje só para o envio. A regra atual "planejada depois da em andamento e sem start" (`sendAnchor`) fica.
3. P3: com a âncora certa some. Ainda assim, o fechamento automático na entrega só deveria fechar uma tarefa que
   estava em andamento/aberta E era a do envio; manter.

Testes vermelhos (TDD): layout puro, `current()` com nenhuma iniciada ⇒ `lit` vazio e `anchor` indefinido; hooks:
plan de 2 níveis 1, sem `start`, SendMessage ⇒ a rodada da filha não tem âncora na primeira aberta (hoje tem);
"Passo 4" não acende nem cronometra sem `start`; cabeçalho sem iniciada = título do pedido ("Tarefas"), não a primeira
aberta. Testes antigos que mudam (fixam a regra atual): `task-tree.test.ts` "sem start, a primeira aberta fica em
andamento", "com a marcada concluída, volta para a primeira aberta", "com 300 níveis 1 e nenhuma em andamento, o título
é o da primeira aberta", comentários nas linhas ~1806 e ~2452; `cabecalho-tarefa-atual.test.ts` "sem nenhuma iniciada,
o título é a primeira aberta (regra mantida)"; golden `basico` provavelmente (uma linha ◉ sem start vira ○).

## B. Fim do turno (O revertido, P5, P9, P15)

- O (prints 52, 60–61): o commit 4 (`41a5ed4`) desenha como interrompida toda tarefa aberta de sessão que terminou o
  turno (`panelOf` → `interrupt(undefined)`; `Model.ended` → `interrupt(ended)`), inclusive as nunca iniciadas. O
  commit 5 (`16062cc`, revertido em `6150b45`) corrigia com `halt(at)` (só folha iniciada vira interrompida; pendente
  fica pendente; pai aberto sem relógio) + `Group.idle` (nada aceso por padrão no painel parado) + título pela
  `startedAt` mais recente + `wake()` em prompt/toolCall/plan/start/done. Os prints 60–61 mostraram o resultado certo.
  **Hoje a branch está com o comportamento errado do commit 4.** O que fazer: reaplicar o conteúdo de `16062cc`
  (`git revert 6150b45` ou cherry-pick) DEPOIS de decidir o A: com o A, `Group.idle` não é necessário (nada acende sem
  start em painel nenhum) e `halt` fica mais simples. Testes: os de `sessao-parada.test.ts` do commit 5 (5 testes) já
  são o vermelho; `durabilidade.test.ts` cenário D de `turnEnded`.
- P5 ("Passo 4" título; "17 de 17 · 100%" → "7 de 12 · 58%"; "2 interrompidas" com pendentes): título e
  "interrompidas" são O + A. Os números mudam porque o cabeçalho conta os nós desenhados (cartões inclusive) e os
  cartões entram/saem com `trimToWork` (ver C). Sem correção própria.
- P9 (🕒 no nível 1 "Teste passo a passo com prints"): é o tom `paused` (◷, "Aguardando"): pai aberto, com algo
  concluído embaixo e nada aceso (`rows()`: `t.children.length > 0 && resting(t.children) ? 'paused'`). Com o fim do
  turno (ou com o A) um pedido com passo pendente fica assim. É o estado esperado pela regra atual; se o usuário
  preferir ○ nesse caso, é uma mudança de regra pequena em `rows()` (decisão).
- P15 (turno interrompido com `stop`, cartão da svg com O1 ◉ 0:59 e "Lote: mensagens 2 e 3" ○): não dá para fechar
  pelos arquivos. O painel publicado da svg não tem turno algum depois do 78 (11:44:04): os pedidos 184 e 186 da
  orquestradora mandaram mensagens (a svg tem `received` 11:45:00 ×5, 11:46:06, 11:46:42 ×2), mas nenhum turno foi
  publicado para elas. Logo, o turno que a orquestradora parou não deixou rastro no arquivo (nem `plan`, nem
  `turn.complete`). Hipótese: com `stop`, `turn.complete` não dispara (ou dispara com `isAborted` e o mod só grava
  `turnEnded`, sem publicar o estado das tarefas), e a mãe segue com a cópia anterior do painel enquanto o host ainda
  lista a sessão como `running`. O que verificar no app: se `turn.complete` chega com `isAborted: true` num `stop`, e o
  que a lista do host diz logo depois. Correção provável: em `turnComplete` com `isAborted`, publicar o painel (hoje
  `publishPanel` roda, mas a resposta não) e marcar o turno como interrompido no próprio painel (interromper o que
  estava em andamento, como um subagente que acaba: `interrupt(now)` só nas iniciadas); na mãe, `live(c)` precisa
  refletir o `stop`. Teste vermelho possível no kit: `$.turn.complete({ isAborted: true })` com tarefa iniciada ⇒ a
  tarefa publicada fica interrompida, sem relógio.

## C. Resumida: a regra nova do usuário (P1, P10, P16, P18)

Regra (palavras dele): "as tarefas concluídas deveriam ficar do jeito que estão até todas as tarefas estarem
concluídas, só então o painel seria resetado com um novo turno; senão, as tarefas vão sendo adicionadas no painel".
Ou seja: mensagem nova + algo aberto em qualquer pedido à vista (tarefas OU tarefas dos cartões) ⇒ nada sai, o pedido
novo é acrescentado embaixo; só com tudo à vista concluído a mensagem nova limpa.

Hoje (`hooks/panel.ts` `startsWork`/`joinWork`, `draw/layout.ts` `goingOn`/`trimToWork`): a cada mensagem nova o
trabalho (`work`) recomeça e só guarda os níveis 1 anteriores com algo aberto (`goingOn`); `trimToWork` desenha o
`work` mais os níveis 1 com sessão viva embaixo (`atWork(...).live`) e os cartões sob eles ou vivos.
- P10: "Erro de recarga do plugin" (concluído) sumiu com "Passo 5" aberto ⇒ é exatamente a regra antiga.
- P16/P18: pedido anterior sumiu com o cartão dele com tarefas abertas ⇒ `goingOn` só olha tarefas da mãe, não os
  cartões.
- P1: pedido antigo finalizado reapareceu com 5 cartões antigos durante o processamento ⇒ a sessão de correção estava
  viva (trabalhando no bug O) e suas partes antigas ancoram em tarefas de pedidos velhos; `trimToWork` segura o nível 1
  "com sessão viva embaixo" e todas as partes dela ("sumiram depois" quando parou). Sob a regra nova isso também cai:
  o que decide é "algo aberto à vista", não "sessão viva sob tarefa velha".
- P18: depois de "Lote ok" o pedido 186 (tudo concluído) saiu do `work` e os pedidos velhos ficaram por sessão viva
  (a minha, `anchor` `103`!).

O que fazer: trocar o modelo. `work` passa a ser a lista de pedidos (turnos) à vista; em `prompt.submit` de pedido novo,
`fresh` = "nada aberto" entre as tarefas desses pedidos e as tarefas dos cartões sob eles (`total`/`hasOpen` com as
sessões, até `DEEP`, ignorando interrompidas e arquivadas); se `fresh`, `work` = [novo]; senão `work` += novo.
`trimToWork` desenha os turnos do `work` inteiros (concluídos inclusive) e os cartões sob eles; apaga a regra "nível 1
com sessão viva embaixo fica" (ela é a causa de P1/P18) — uma sessão viva sob pedido fora do `work` não puxa o pedido.
Decisão a confirmar com o usuário: um cartão com tarefa aberta conta como "algo aberto" (P16 diz que sim).

Testes vermelhos: `resumida-limpeza.test.ts`/`resumida-turno.test.ts` (hoje fixam a regra antiga: "nova mensagem com
tudo finalizado: limpa, só o pedido novo" fica; "nova mensagem com uma tarefa ainda em andamento: ela continua à vista"
passa a exigir que os pedidos concluídos também fiquem; novo: cartão com tarefa aberta segura tudo; novo: pedido com
sessão viva sob tarefa de pedido fora do `work` não aparece). Goldens: `real-resumida` muda (o fixture real tem pedidos
71–73 e a regra nova pode manter mais ou menos pedidos; conferir).

## D. Rodadas perdidas e ids reusados (P11, P13, P18-cartões)

- P13/P18 (cartões do lote em lugar nenhum): a svg não tem NENHUMA rodada para os envios do pedido 179 (`e5`,
  11:36:4x–11:37:0x); as rodadas dela começam em 11:44:05. Em `tool-call.ts` `sentMessage`, a rodada só é gravada se o
  destino já está em `children` (por id ou `name`); caso contrário a mensagem não deixa rodada. O fallback `unsent()`
  (`layout.ts`) exige `rounds.length > 0` — com zero rodadas devolve `[]`. Resultado: os turnos 76–77 da svg caíram na
  parte 0 (antes de qualquer rodada), ancorada em `c.anchor` (indefinido) ⇒ cartão solto no fim da lista, que a
  resumida corta. Falta confirmar por que a svg não estava em `children` às 11:36 (lista do host naquele instante) ou
  se o `to` não casou com `name`. O que fazer: (a) `sentMessage` cria o laço quando o destino não está na lista (como
  `recordStart` faz com `starting: true`) e casa `to` por id, `name` e `title`; (b) `unsent()` funciona com zero rodadas
  (casar os `received` de `me` com os `sends` da mãe, mantendo um histórico dos envios mesmo depois de `taken`). Teste
  vermelho: SendMessage a uma sessão que a lista do host ainda não traz ⇒ ao aparecer, a rodada existe e o cartão fica
  sob a tarefa do envio (hoje: cartão solto).
- P11 (dois "Passo 5"): o plan do pedido 179 reusou o id `e5` de um nível 1 ABERTO do pedido 173; a regra da série 2
  ("plan em mensagem nova vai para o pedido novo") renomeou o antigo para `zpon:e5` e o interrompeu (✕ "Passo 5 …
  interrompida" no pedido antigo) e criou o novo `e5` no 179. Depois o mesmo com `1` → `hgha:1`, `uogh:1`, `1` (três
  "Passo 5" seguidos). O "Passo 5 ◉ 7:56 sem filhas" do print 63 é o `zpon:e5` interrompido desenhado antes da regra
  do fim do turno? Não: interrompida é ✕. Mais provável: o `start e5` resolvido para o novo (aberto) e o print pegou o
  instante entre o plan e a renomeação publicada. Comportamento como desenhado; o que o usuário estranhou é o ✕ do
  antigo ficar e o novo "sumir" (P13, que é C+D). Decisão: ao reusar o id de um nível 1 aberto de outro pedido, (i)
  manter a regra (interromper o antigo) ou (ii) tratar como continuação do mesmo nível 1 (replanejar no lugar, como no
  mesmo pedido). Recomendo manter (i) e corrigir C e D, que são o que escondeu o pedido novo.

## E. ✉ com `done` e contagem (P17, P14)

- P17: `doneTool` apaga o `send` da tarefa fechada ("Closed, its send waits no more") e `rows()` só dá tom `sent` a
  tarefa `open`. O usuário quer o ✉ até a entrega mesmo com `done` explícito. O que fazer: manter o `send`; em `rows()`
  o ✉ (tom `sent`) vale para a tarefa fechada com envio pendente; no cabeçalho o chip de envio conta igual;
  `watchSends` na entrega não precisa fechar o que já está `done`. Cuidado com a regra de id reusado (o `send` antigo
  num id novo): `renameAnchors` já renomeia os `sends`. Teste vermelho: `start`, `SendMessage` (fila), `done` ⇒ a
  linha continua ✉ até o `received` da destinatária (hoje vira ✓ na hora). Golden `envio` muda se o cenário tiver
  `done` depois do envio.
- P14: docs, turno 97: `1 [open, iniciada 11:37:36]` + `2 [done]`; a docs parada ⇒ `panelOf` interrompe a `1`;
  `count()` deixa a interrompida fora ⇒ "1/1"; e `turnRows` dá tom `done` ao pedido porque não há `open` e nem todas são
  interrompidas (`list.every(interrupted)` falso) ⇒ "✓ 1/1" com uma ✕ dentro. O que fazer: pedido com alguma
  interrompida e nada aberto não é ✓: tom `interrupted` (ou `paused`) e contagem "1/1 · 1 interrompida" no `alt`.
  Mesmo para a tarefa pai (`rows()`: pai `done` com filha interrompida não ocorre, mas pai aberto com filha
  interrompida e outra concluída fica `paused`, ok). Teste vermelho: layout puro com turno [done, interrupted] ⇒ tom
  do pedido ≠ `done`.

## F. Título antigo e trabalho próprio das filhas (P19, P20)

- P19 (título "Abrir a sessão de correção (Fable…)" com "5 de 12"): `render.tsx` sem tarefa acesa cai em
  `mainTasks.find(t => atWork(t, sessions, 0).live)` — o PRIMEIRO nível 1 com sessão viva embaixo. A minha sessão
  está viva e a parte 0 do meu cartão ancora em `103`, uma tarefa antiga ⇒ título antigo. O que fazer: título = nível 1
  da tarefa com `startedAt` mais recente (regra do commit 5), e só sem nenhuma iniciada o ÚLTIMO nível 1 com sessão
  viva. Com o A isso fica natural. Teste vermelho: tarefa antiga com sessão viva + tarefa recente concluída ⇒ título da
  recente.
- P20 (cartões de pedidos digitados direto nas filhas sob "Reverter o commit 16062cc"): o turno de uma filha aberto por
  prompt do usuário (ou por mensagem de irmã) entra em `split`/`partOfTurn` → `roundOf(u)` = última rodada da mãe
  antes dele ⇒ sob a tarefa da última mensagem da mãe. A filha sabe que o prompt foi do usuário (`prompt.submit` com
  `origin.kind` do compositor e sem `<cross-session-message>`), mas não publica isso. O que fazer (decisão): publicar
  no `Turn` uma marca `own: true` para turno aberto por prompt do usuário na filha; em `split`, um turno `own` vai para
  uma parte própria sem âncora (cartão solto no fim do pedido da mãe que abriu a sessão, ou da lista), e não para a
  rodada anterior. Mensagem de irmã continua pela cadeia (série 3). Teste vermelho: filha com rodada da mãe em `A` e
  um turno `own` depois ⇒ o cartão desse turno não fica sob `A`.

## G. Painel não apareceu na governança durante o pedido (novo)

Fatos: na governança (carrega o mod do CLONE), durante o turno do pedido de análise (plan com 2 tarefas,
AskUserQuestion respondida, SendMessage para mim), o painel não apareceu; o print depois do turno mostra o painel
completo e correto ("2 de 2 · 100% · 0:31", ↩ certo). O dado existia; faltou o desenho durante o turno.

Hipóteses, da mais à menos provável:
1. Recarga falha do clone no mesmo intervalo: eu editava `hooks/prompt-submit.ts` em passos e o app avisou "task-tree
   reload failed, the previous version stays loaded" (P8) e, logo depois, "reloaded (11 hooks…)". Numa sessão que
   carrega o clone, uma recarga troca o módulo no meio do turno (relógios e `poller` zerados — a família do commit 4
   da série 2) e a recarga falha pode deixar o pane sem desenho até a próxima recarga boa. Para confirmar: horário do
   aviso de recarga na orquestradora × horário do turno da governança; log de depuração da governança
   (`task-tree: painel não aberto: <motivo>` sai de `showPane` quando `$.ui.open` responde `isPlaced: false`).
2. `showPane` só roda num prompt do usuário (`prompt-submit.ts`: `!it.peer && !it.notice && !it.handback &&
   !NO_TURN.includes(kind)`) e só se o pane não está `isPlaced`; se o app devolve `isPlaced: false` (pane fechado pelo
   usuário ou janela sem lugar), o mod só registra no log. Não é bug do mod, mas o motivo fica no log.
3. `turnEnded` (commit 4): `anyRunning` devolve `false` enquanto `turnEnded` está gravado ⇒ `keepTime` não liga o
   relógio e o pane não redesenha sozinho. `prompt-submit.ts` zera no prompt do usuário, então no turno da governança
   não se aplica; mas um turno aberto por mensagem de outra sessão também passa pelo `prompt.submit` (zera). Descartada
   para este caso, salvo se o prompt chegou como `unclassified` (não zera? zera: a limpeza vem antes do `if`).
4. AskUserQuestion no meio: `asked()` adiciona a espera e publica; o pane mostra "Aguardando sua resposta". Não
   esconde nada.

Não reproduzível no kit (o kit não tem a recarga nem o `isPlaced` do app). O que falta para reproduzir: o log de
depuração da governança naquele turno e o horário exato das duas recargas. Se a causa for a 1, a correção já está no
processo (editar o mod num passo só, validado) e, no código, em tolerar uma recarga no meio do turno (o commit 4 da
série 2 religa os relógios no desenho; falta conferir se o pane é redesenhado após "reload failed").

## H. Processo (P8, P12)

- P8: editar o mod em vários passos no clone deixou um estado intermediário sem compilar; regra já guardada na
  memória (um passo só, `claude plugin validate` antes de salvar o seguinte). Opção melhor: trabalhar numa cópia e
  copiar validado; ou o usuário trocar as sessões de teste para o mod "instalado" durante as correções.
- P12 (✉ ausente em "Mensagem 2/3" no print 62): a orquestradora ainda não tinha iniciado nem enviado; aceitável.

## Ordem sugerida e riscos

1. **A** (tirar o padrão da primeira aberta) — decide o resto: muda `current()`, `sendAnchor`, título; ~6 testes
   antigos e 1 golden. Risco: comportamento visível em todo painel sem `start` (fica tudo ○ até o modelo chamar `start`;
   o lembrete de `start` já existe).
2. **B/O** (voltar o `halt`, sem `idle`) + **F/P19** (título pela última iniciada) — juntos, porque o título depende de
   A e de `turnEnded`. Reaplicar `16062cc` adaptado.
3. **E/P17** (✉ sobrevive ao `done`) + **E/P14** (pedido com interrompida não é ✓) — pequenos, independentes.
4. **C** (regra nova da resumida) — maior mudança de regra; depende das decisões "cartão aberto segura" e "sessão viva
   não puxa pedido velho". Reescreve `startsWork`/`joinWork`/`goingOn`/`trimToWork` e os testes de resumida; golden
   `real-resumida`.
5. **D** (rodada sempre registrada; `unsent` com zero rodadas; id reusado) — depende de confirmar no app por que a svg
   não estava na lista às 11:36.
6. **F/P20** (turno próprio da filha) — precisa de campo novo publicado (`Turn.own`) e de decisão de onde o cartão fica.
7. **B/P15** e **G** — dependem de observação no app (`stop` e `isPlaced`/recarga); sem isso só hipóteses.

Riscos gerais: os goldens `real-*` usam o fixture da orquestradora e mudam a cada regra de corte (C) e de tom (A);
regravar conferindo o diff linha a linha. Ordem A→B evita implementar `idle` para depois tirar.

## Decisões do usuário necessárias (resumo)

1. A: sem `start`, nada aceso? E a âncora de um envio sem tarefa em andamento: última iniciada ou nenhuma?
2. P9: pedido com passo pendente ao fim do turno fica ◷ (hoje) ou ○?
3. C: cartão com tarefa aberta segura o painel? Sessão viva sob tarefa de pedido fora da vista puxa o pedido (hoje) ou
   não?
4. D/P11: reusar o id de um nível 1 aberto de outro pedido interrompe o antigo (hoje) ou continua ele?
5. P14: pedido com tarefa interrompida e nada aberto: ✕ ou ◷?
6. P20: turno próprio da filha: cartão solto no fim do pedido que abriu a sessão, ou no fim da lista?
