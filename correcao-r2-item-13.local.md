# Mensagem entregue no meio do turno continua o pedido em curso: plano e diff (item 13)

Plano de 2026-11-12. Repositório real só lido pelo git (clone local no scratchpad, `b02a9a9` mais
`correcao-r2-itens-1-2.diff`, commit local `e0badcb` como base do diff). Nada foi escrito no
repositório real.

**Resultado:** diff principal pronto, com **um BLOQUEIO parcial** (seção 5), que fica fora dele.

- Diff principal: `correcao-r2-item-13.diff` (nesta pasta). Cobre o que a pergunta ao usuário
  descreveu: **o relato de uma sessão filha desta** e **a mensagem que a pessoa digita** com o turno
  em curso. `git apply --check` num clone novo em `b02a9a9` + itens 1 e 2: ok. Também ok, inteiro (com
  o `selos.json`), sobre o commit `e1aadde`, o HEAD do repositório real quando terminei (itens 1 e 2,
  cartão do subagente neto e item 8 já commitados). O item 12, que estava sendo aplicado na árvore de
  trabalho, não foi conferido: ele mexe no `DESENVOLVIMENTO.md`, noutra seção.
- `npm run check` na cópia (binário 2.1.321): as 8 etapas ok, 200 testes passam (196 + 4 novos), golden
  intacto; regressão: 196 testes de HEAD contra o código novo, 0 falhas.
- **BLOQUEIO (seção 5):** a mensagem de uma sessão que esta **não** abriu (a que a abriu, uma irmã)
  entregue no meio do turno. Fazê-la entrar no pedido em curso tira, na sessão que mandou, o segundo
  cartão sob a tarefa do envio, que é decisão do usuário de 2026-10-21 (`sessoes.um-cartao-por-mensagem`).
  O diff principal a deixa como hoje. Há uma variante pronta, que **substitui** o principal (não
  somar): `correcao-r2-item-13-todas-as-origens.diff`. Ensaiada noutra cópia: as 8 etapas do check ok,
  200 testes, regressão 196 com 0 falhas; `git apply --check` ok na mesma base.
- Nenhum teste selado muda, nenhum golden muda (conferido: seção 4.6).

## 1. Decisão do usuário

2026-11-12, palavras dele: "Entra no pedido em curso (Recomendado)" (`orq-decisoes-altos.local.md`).
A pergunta respondida: "Uma mensagem pode chegar enquanto a sessão ainda está no meio do turno: o relato
de uma filha, ou algo que você digita enquanto ela trabalha. […] A mensagem do meio do turno deve abrir
pedido próprio?". A opção: "Enquanto o turno não termina, a mensagem não ganha linha de pedido própria
nem ✉. O que o modelo planejar fica no pedido atual, e um replano com o mesmo id guarda o estado. Isso
reescreve a regra pedidos.uma-mensagem-um-pedido, mas só para o meio do turno. Também cria uma exceção
ao 'uma carta por mensagem' de 2026-10-30. Nenhum teste selado muda."

## 2. Causa, confirmada

### No código (`b02a9a9` + itens 1 e 2)

- `task-tree/hooks/prompt-submit.ts`: todo prompt que não é aviso, hand-back nem origem `NO_TURN` chama
  `openTurn` (abre um pedido), zera `reminders.unplanned`/`planned` e leva `PROMPT.open` ("feche as que
  esta mensagem conclui ou substitui… antes de planejar o pedido novo") e `PROMPT.request` ("A PRIMEIRA
  chamada de ferramenta é mcp__task-tree__plan"). O `e.turnId` só era lido para manter a espera da
  pergunta e do plano (`b02a9a9`).
- `task-tree/hooks/tools.ts`, `planTool`: `sameRequest` compara o turno da tarefa com o último turno.
  Com o pedido aberto pela mensagem do meio do turno, o nível 1 em que o modelo trabalha passa a ser
  "de pedido anterior": o replano com o mesmo id o interrompe, renomeia e cria a cópia toda pendente.
- Os itens 1 e 2 (na base) mudaram `joinWork`/`planTool`, mas não este caminho: com eles o pedido
  antigo fica à vista e o cartão fica sob a tarefa de origem, e o estado segue zerado.

### No harness, com o código da base e os testes novos

Os 4 testes novos falham na base. O painel do teste de pedidos, na base (relato da filha no meio do
turno e replano do nível 1 em curso):

    ◉ Pedido um  0/1
    └─ ✓ Plano A  0/1
       ├─ ✕ Um  ◍  interrompida
       │     ◍ filha-um
       │     ◉ Tarefa da filha
       └─ ✓ Dois  —
          ├─ ✕ Dois.um  interrompida
          └─ ✕ Dois.dois  interrompida
    ✉ Relato da filha  0/4
    └─ ○ Plano A  0/4
       ├─ ○ Um
       ├─ ○ Dois  0/2 …
       └─ ○ Três

### No app (só leitura): o `prompt.submit` dispara na entrega, com o turno em curso

O plano anterior deixava isto para o checklist. Agora está confirmado por três fontes:

- **Caso real, desta orquestradora, 2026-11-11** (transcrito `1bfe2293-…jsonl`, linhas 9670 a 9677, app
  2.1.321): a mensagem "é um subagente por analise e um por subsessao…" foi digitada às 01:47:50.757
  (`queue-operation: enqueue`), entregue dentro do turno às 01:47:56.734 (`remove`, motivo
  `absorbed_mid_turn`), e o contexto do mod (`hook_additional_context`, com `PROMPT.open` e
  `PROMPT.request`) tem a hora da entrega, 01:47:56.733. No arquivo publicado da sessão
  (`~/.claude/task-tree-waits/local_ee919fbf-….json`), o pedido que essa mensagem abriu (turno 38) tem
  `at` = 01:47:56.663: o mod abriu o pedido **na entrega, com o turno em curso**, e a tarefa "72" foi
  planejada nele 14 s depois. É o defeito, registrado.
- **Tipos do kit** (`index.d.ts`, `PromptSubmitInput.turnId`): "The id of the model turn that was
  running when the prompt was submitted […]: typed over that turn, or delivered into it. […] Absent for
  a prompt submitted while the session was idle".
- **Binário do app 2.1.321** (texto do `claude.exe`, só leitura): a entrega dentro do turno ("prompt.submit
  at the fold") monta o evento com `turnId: <turno em curso>`; o caminho de um prompt com a sessão parada
  não passa `turnId`. No terminal há um segundo caminho ("prompt.submit at Enter"), também com o `turnId`
  do turno em curso.

Conclusão para o ponto "o `e.turnId` distingue de fato?": **no app desktop, sim**. `turnId` preenchido
quer dizer "entregue dentro do turno que roda"; a mensagem que espera o turno acabar é tirada da fila com
a sessão parada, sem `turnId`, e abre o seu pedido como hoje. O limite conhecido é só do terminal (seção 6.3).

Nos transcritos há 140 mensagens digitadas e 48 de outras sessões entregues assim (contagem do plano
anterior), e pelo menos 6 respostas dadas pelo chat a um AskUserQuestion que chegaram como mensagem do
meio do turno (seção 4.2).

## 3. A correção

Arquivos do mod: `task-tree/hooks/prompt-submit.ts` e `task-tree/text/rules.ts`. **Copiar os dois de uma
vez** (o primeiro usa `PROMPT.midTurn`, que o segundo cria; um só deixa o mod sem compilar e o app mostra
"reload failed"). `git apply` do diff faz isso.

`prompt-submit.ts`, em `promptSubmit`, logo depois do `dropWaits` que já existe (o `noteReceived`, o
`wake`, o `showPane` e o caminho dos avisos ficam antes e não mudam):

```ts
if (midTurn && !aborted && (!it.peer || (await fromChildren($, it.body)))) {
  await ensureGroups($)
  const { value: held = [] } = await $.state.get(groupsState)
  if ((held.find(g => g.agent === MAIN)?.turns ?? []).length > 0) {
    await refreshStale($).catch(() => {})
    const note = await endedNote($)
    const taken = await takenNote($)
    const { value: groups = [] } = await $.state.get(groupsState)
    const tasks = groups.find(g => g.agent === MAIN)?.tasks ?? []
    const answered = !it.peer && reminders.answeredInChat
    if (!it.peer) reminders.answeredInChat = false
    return next({ ...e, context: [...(e.context ?? []), ...(note ? [note] : []), ...(taken ? [taken] : []),
      PROMPT.midTurn(hasOpen(tasks) ? openList(tasks) : '', answered)] })
  }
}
```

- Sem `openTurn`: a mensagem não ganha linha de pedido nem ✉, e o último turno continua sendo o pedido
  em curso. O `plan` seguinte cai em `sameRequest`: replano no lugar, com o estado guardado. Nada muda
  em `tools.ts` nem em `panel.ts`.
- Sem zerar `reminders.unplanned`/`planned`: o pedido é o mesmo.
- `fromChildren` (função nova, no mesmo arquivo): toda `<cross-session-message from="…">` do prompt vem
  de uma sessão que esta abriu (a lista `children` do state, que o host preenche pelas sessões
  `startedBy` esta; uma entrada ainda `starting`, criada por um envio, não conta). Chave `children`
  declarada literal no arquivo, como o validador pede.
- Três condições para entrar no caminho novo; fora delas, tudo como hoje:
  1. `midTurn`: `e.turnId` preenchido;
  2. `!aborted`: sem Esc pendente (`turnAborted`/`replanDue`); depois de um Esc a mensagem abre o pedido
     e leva o pedido de replanejar, como hoje (decisão de 2026-10-27);
  3. existe um pedido para continuar (o grupo principal tem turno). Sem nenhum, abre o pedido.
- `text/rules.ts`: `PROMPT.midTurn(list, answered)` (o texto está na seção 7) e uma frase em `RULES`,
  depois de "…planeje só o que é novo, com ids novos.": "Quando o lembrete de uma mensagem diz que ela
  chegou no meio do turno e continua o pedido em curso, ela não é mensagem seguinte: não há pedido novo
  no painel, e o replano do nível 1 em curso guarda o estado." A descrição da ferramenta `plan` não muda.
- `task-tree/DESENVOLVIMENTO.md`: um parágrafo em "Um prompt", dizendo o caminho novo.

## 4. Pontos conferidos

### 4.1 O que a sessão remetente vê

- A confirmação da entrega não muda: `noteReceived` roda antes de qualquer desvio, para todo prompt.
  A mensagem continua em `received`, publicada, e a remetente confirma a carta por ela (`watchSends`
  usa só o `received`; a abertura de turno é o caminho das versões antigas, que não vale aqui).
  O teste novo de pedidos afirma isso (o `received` do arquivo publicado traz a filha).
- No diff principal a remetente do caminho novo é sempre uma **filha desta sessão**. A filha não desenha
  cartão da mãe, então no painel dela só há a carta, que fica verde como hoje. Se esta sessão for, ela
  mesma, filha de outra, o cartão dela lá só deixa de ganhar a linha "✉ <relato>": as tarefas seguem na
  mesma parte do cartão em que já estavam.
- O efeito no cartão só existe quando quem manda é a sessão que abriu esta (ou uma irmã): é o BLOQUEIO
  da seção 5, fora do diff principal.

### 4.2 A mensagem da pessoa no meio do turno

- Ainda traz o painel de volta: o `showPane` fica antes do desvio (sonda: `ui.open` chamado uma vez a
  mais com o painel fora da tela).
- **Resposta pelo chat a uma pergunta**: quando a pessoa dispensa o AskUserQuestion e escreve, a
  mensagem dela costuma chegar no meio do turno (6 casos nos transcritos). Hoje isso abre um pedido
  novo para a resposta. Com a correção ela continua o pedido, e o lembrete abre com "Esta mensagem é a
  resposta do usuário à pergunta anterior." (uma vez). O relato de uma filha não consome essa marca.

### 4.3 O turno que vem logo depois

- Mensagem que não foi entregue dentro do turno (o turno acabou antes): sai da fila com a sessão
  parada, sem `turnId`, e abre o seu pedido, com os lembretes de hoje. Coberto nos dois testes novos
  ("com o turno terminado, a mensagem seguinte abre o seu pedido").
- O `↩` e a resposta do turno seguem indo para o último pedido com tarefas (`turn.complete`), sem mudança.

### 4.4 Esc seguido de mensagem

Não cai no caminho novo: depois de um Esc não há turno em curso (sem `turnId`). O caso que poderia
cair é Esc, depois um aviso do app abre um turno, e a mensagem chega nesse turno: a condição `!aborted`
manda para o caminho de hoje (pedido novo e "replaneje o painel"), uma vez só. Teste novo:
"depois do Esc, a mensagem que chega com o turno de um aviso em curso ainda pede para replanejar".

### 4.5 Itens 1 e 2 na base

`joinWork`/`planTool` dos itens 1 e 2 só agem quando o plan renomeia um nível 1 (`renamed`). Sem pedido
novo, o replano do meio do turno não renomeia nada: `startsWork` responde falso (há tarefa do trabalho no
último turno), `joinWork` só soma os ids, e `carry` guarda o estado. Conferido no teste novo de pedidos
(◉ segue ◉, a nova nasce ○, nada ✕, sem "+N pedidos anteriores", cartão sob a tarefa).

### 4.6 Testes selados e golden

- `npm run testes:alterados`: nenhum teste existente mudou. Os selos antigos conferem (`selos` ok).
- O teste selado do `b02a9a9` ("mensagem entregue no meio do turno não tira a espera…") segue passando
  sem mudança.
- Golden do SVG: intacto (nenhum cenário do golden usa `turnId`; `golden.test.ts` passa; `impacto`:
  "Golden: nenhum cenário").
- Regressão (testes de HEAD contra o código novo): 0 falhas, logo nenhum selo `decisao` é necessário.

## 5. BLOQUEIO: mensagem de uma sessão que esta não abriu, entregue no meio do turno

A pergunta de hoje falava do relato de uma filha e do que a pessoa digita. Sobra a direção contrária:
a orquestradora manda mensagem a uma **filha ocupada** (ou uma irmã manda a outra), e a mensagem é
entregue dentro do turno da filha.

- Hoje: a filha abre um pedido com ✉, e a orquestradora desenha um **segundo cartão** da filha sob a
  tarefa que mandou a mensagem. É decisão do usuário de 2026-10-21 (`sessoes.um-cartao-por-mensagem`;
  `DESENVOLVIMENTO.md`: "filha ocupada que recebe mensagem nova tem o painel duplicado; o cartão antigo
  fica onde estava e o novo vai sob a tarefa da principal que mandou a mensagem").
- Se essa mensagem também entrar no pedido em curso da filha: a filha guarda o estado, mas não abre
  turno, e a orquestradora corta o cartão pelos turnos. Sondado no harness, a orquestradora passa a ver:

      └─ ◉ Plano A
         ├─ ✓ Um  ◍
         │     ◍ filha-um
         │     ◉ abertura  0/2
         │     ├─ ◉ Tarefa da filha
         │     └─ ○ Correção pedida          ← o trabalho novo fica no cartão antigo
         └─ ◉ Dois  ◍  1/1                    ← em andamento com o ícone de sessão enquanto a filha trabalha
            └─ ✉ Para filha-um: corrija isto  entregue

  em vez de (hoje):

      └─ ◉ Plano A
         ├─ ✓ Um  ◍
         │     ◍ filha-um
         │     ◉ Tarefa da filha
         └─ ◉ Dois  ◍  1/1
            ├─ ✉ Para filha-um: corrija isto  entregue
               ◍ filha-um                      ← segundo cartão, sob a tarefa do envio
               ✉ corrija isto  0/1
               └─ ○ Correção pedida

- Isso muda um comportamento decidido que a opção escolhida hoje não citava. Por isso o diff principal
  deixa essa origem como hoje (a filha abre o pedido com ✉; fica o risco já conhecido de ela zerar o
  estado se replanejar o mesmo nível 1 nessa hora, atenuado pelos textos do item
  `lembretes.estado-guardado-so-no-mesmo-pedido`).

**Pergunta exata ao usuário:**

> Quando a mensagem que chega no meio do turno vem da sessão que abriu esta (a orquestradora falando com
> uma filha ocupada) ou de uma irmã, ela também deve entrar no pedido em curso? Hoje a filha abre um
> pedido novo, e a orquestradora mostra um segundo cartão dela sob a tarefa que mandou a mensagem (regra
> sua de 2026-10-21).
> - **Segue com pedido próprio (Recomendado):** nada muda nesse caso; a orquestradora continua mostrando
>   o segundo cartão sob a tarefa do envio. A filha ocupada ainda pode zerar o estado se replanejar o
>   mesmo nível 1 ao receber a mensagem.
> - **Entra no pedido em curso também:** a filha guarda o estado. Na orquestradora a carta fica verde sob
>   a tarefa do envio, essa tarefa aparece em andamento com o ícone de sessão enquanto a filha trabalha, e
>   o trabalho novo aparece no cartão em que a filha já estava, sem segundo cartão.

Com "Segue com pedido próprio": o diff principal já é a resposta, nada a acrescentar.

Com "Entra no pedido em curso também": aplicar `correcao-r2-item-13-todas-as-origens.diff` **no lugar**
do principal (mesma base; os dois não se somam). Diferenças dele: a condição vira `midTurn && !aborted`
(sem `fromChildren`); os testes novos afirmam que a mensagem de uma sessão que esta não abriu também
continua o pedido; os textos do catálogo dizem "a mensagem de outra sessão". Falta nele, porque depende
das palavras do usuário, uma linha em `regras/sessoes.md`, no cenário `sessoes.um-cartao-por-mensagem`,
antes do `Estado:`:

    Reescrito: 2026-11-12, decisão do usuário ("<palavras dele>"); a mensagem entregue no meio do turno da filha continua o pedido em curso dela e não abre cartão novo: o trabalho segue no cartão em que ela estava (pedidos.mensagem-no-meio-do-turno-continua-o-pedido). Os testes não mudam.

Os selos são os mesmos quatro (seção 8), com os hashes da variante.

## 6. Consequências a saber (não bloqueiam; vão ao checklist)

### 6.1 A pessoa digitando numa filha que está trabalhando

A decisão cobre ("algo que você digita enquanto ela trabalha"), e o diff principal aplica em qualquer
sessão. Numa filha, o efeito aparece na mãe: hoje esse turno vira um cartão "pedido do usuário na filha"
(`sessoes.turno-proprio-da-filha-no-pedido-vigente`, 2026-11-03); digitado **no meio do turno**, ele deixa
de abrir turno, e o trabalho segue no cartão em que a filha estava. Digitado com a filha parada, nada
muda. O cenário de 2026-11-03 fala do "turno que o usuário abriu digitando na filha", e os testes dele não
mudam. Se o usuário quiser o cartão próprio também nesse caso, é pergunta nova (o mod não sabe, hoje, se a
sessão é filha de outra).

### 6.2 O título do pedido

O `request` do plan renomeia o último pedido (`pedidos.titulo-vem-do-request`). Se o modelo passar
`request` no replano depois da mensagem do meio do turno, o pedido em curso muda de título. O lembrete
novo pede "sem request: o pedido em curso mantém o título"; o código não bloqueia, para não criar exceção
a `pedidos.titulo-vem-do-request` sem decisão. Se aparecer no app, a trava é pequena (ignorar `request`
no plan do loop principal enquanto a marca da mensagem do meio do turno estiver ligada).

### 6.3 Terminal (CLI), não o app

No terminal o `prompt.submit` de uma mensagem digitada com o turno em curso dispara no Enter, com
`turnId`, e a mensagem pode acabar virando o turno seguinte se o turno terminar antes da entrega. Nesse
caso raro ela fica sem pedido próprio (ou o motor dispara o evento de novo, sem `turnId`, e ela abre o
pedido: o binário tem os dois caminhos). Não verificado; o uso do usuário é o app desktop.

### 6.4 Turno aberto por aviso

O "pedido em curso" é o último pedido aberto. Se o turno em curso foi aberto por um aviso do app (uma
filha terminou) e o último pedido já está todo concluído, a mensagem do meio do turno entra nele do mesmo
jeito, como já acontece com o plano depois de um aviso (`pedidos.aviso-do-app-nao-abre-pedido`).

## 7. Cenários e textos

Reescritos (ganham `Reescrito: 2026-11-12, decisão do usuário ("Entra no pedido em curso (Recomendado)")`;
os testes deles não mudam):

- `pedidos.uma-mensagem-um-pedido`: título e Dado/Então passam a excluir a mensagem que continua o
  pedido em curso no meio do turno.
- `envios.pedido-recebido-mostra-carta`: o relato de uma sessão que esta abriu, entregue no meio do
  turno, não abre pedido e não tem carta de recebida (exceção ao "uma carta por mensagem" de 2026-10-30).

Novos, os dois `coberto`:

- `pedidos.mensagem-no-meio-do-turno-continua-o-pedido` (`Código: hooks/sessions.ts, text/rules.ts`).
- `lembretes.mensagem-no-meio-do-turno` (`Código: hooks/tool-call.ts, hooks/panel.ts`).

Texto novo ao modelo, `PROMPT.midTurn` (com tarefas abertas; a primeira frase só quando a mensagem é a
resposta a uma pergunta):

> [Esta mensagem é a resposta do usuário à pergunta anterior.] Painel de tarefas (task-tree): esta
> mensagem chegou no meio do turno e continua o pedido em curso; ela não abre pedido novo no painel.
> Tarefas abertas: "A/1" Um; "A/2" Dois. Siga nas tarefas que já existem com mcp__task-tree__start e
> mcp__task-tree__done, e feche as que esta mensagem conclui ou substitui. O que ela pede de novo entra
> no plano atual: mcp__task-tree__plan com ids novos, ou de novo com o nível 1 inteiro (as tarefas que
> mantêm o id guardam o estado), sem request: o pedido em curso mantém o título.

## 8. Testes e selos

Quatro testes novos; nenhum existente muda; o kit não muda (os testes chamam `$.prompt.submit` com
`turnId` direto, como o teste do `b02a9a9`).

- `task-tree/tests/pedidos.test.ts`
  - "mensagem entregue no meio do turno continua o pedido em curso: sem pedido novo, e o replano guarda o
    estado" (`pedidos.mensagem-no-meio-do-turno-continua-o-pedido`): relato da filha e replano; mensagem
    digitada e replano; mensagem de uma sessão que esta não abriu (abre o pedido com ✉, como hoje); fim
    do turno e mensagem seguinte (abre o pedido).
- `task-tree/tests/lembretes.test.ts` (`lembretes.mensagem-no-meio-do-turno`)
  - "a mensagem entregue no meio do turno traz o lembrete de que continua o pedido em curso, não o de
    pedido novo";
  - "depois do Esc, a mensagem que chega com o turno de um aviso em curso ainda pede para replanejar";
  - "a resposta dada pelo chat a uma pergunta, entregue no meio do turno, é dita como resposta e continua
    o pedido".

O diff já traz os selos (`novo`, data 2026-11-12). Se `regras/selos.json` colidir com outro item, ou se
o diff for aplicado noutro dia, aplicar o resto e selar de novo, na raiz do repositório:

```bash
M='decisão do usuário, 2026-11-12 ("Entra no pedido em curso (Recomendado)"): a mensagem entregue no meio do turno continua o pedido em curso'
npm run regras:selar -- "task-tree/tests/pedidos.test.ts::mensagem entregue no meio do turno continua o pedido em curso: sem pedido novo, e o replano guarda o estado" --tipo novo --motivo "$M"
npm run regras:selar -- "task-tree/tests/lembretes.test.ts::a mensagem entregue no meio do turno traz o lembrete de que continua o pedido em curso, não o de pedido novo" --tipo novo --motivo "$M"
npm run regras:selar -- "task-tree/tests/lembretes.test.ts::depois do Esc, a mensagem que chega com o turno de um aviso em curso ainda pede para replanejar" --tipo novo --motivo "$M"
npm run regras:selar -- "task-tree/tests/lembretes.test.ts::a resposta dada pelo chat a uma pergunta, entregue no meio do turno, é dita como resposta e continua o pedido" --tipo novo --motivo "$M"
```

(No PowerShell, trocar a primeira linha por `$M = '…'` e usar `$M` do mesmo jeito.) Nenhum selo
`decisao` é necessário: nenhum teste existente muda e a regressão não falha.

## 9. Check, impacto e testes alterados (na cópia, diff principal)

`npm run check` (última execução, sobre o estado final do diff):

    ok    regras          (139 cobertas, 0 pendentes, 16 checklist; mapa sem avisos)
    ok    travas
    ok    selos           (200 testes, 3 arquivos do kit, 4 desenhos)
    ok    validate do marketplace
    ok    validate do mod
    ok    tsc
    ok    plugin test     (200 pass, 0 fail, 15 arquivos)
    ok    regressao       (196 testes de HEAD contra o código novo, 0 falharam)

`npm run testes:alterados`:

    Testes existentes alterados desde HEAD: nenhum

    Novos: task-tree/tests/lembretes.test.ts::a mensagem entregue no meio do turno traz o lembrete de que continua o pedido em curso, não o de pedido novo | task-tree/tests/lembretes.test.ts::depois do Esc, a mensagem que chega com o turno de um aviso em curso ainda pede para replanejar | task-tree/tests/lembretes.test.ts::a resposta dada pelo chat a uma pergunta, entregue no meio do turno, é dita como resposta e continua o pedido | task-tree/tests/pedidos.test.ts::mensagem entregue no meio do turno continua o pedido em curso: sem pedido novo, e o replano guarda o estado

`npm run impacto` (sobre o diff): arquivos do mod tocados `hooks/prompt-submit.ts`, `text/rules.ts`;
40 cenários afetados, todos `coberto` (os de lembretes, pedidos e turnos, mais
`envios.pedido-recebido-mostra-carta`, `arvore.done-sem-summary-e-varias-sem-start`,
`perguntas.mensagem-no-meio-do-turno-mantem-espera` e os dois novos); checklist do app: nenhum; golden:
nenhum cenário; fora do mapa: nenhum.

Aviso sobre a máquina: com outros planejadores rodando em paralelo, três execuções do check tiveram
testes sem relação com a mudança estourando os 5 s do kit (todos entre 5,06 s e 6,2 s, em `pedidos`,
`perguntas`, `sessoes` e `subagentes`, e "the file ran to its end"); numa delas foram 17. Repetido com a
máquina mais livre, o mesmo estado passa inteiro (o resultado acima). Se acontecer na implementação,
repetir o check antes de investigar.

## 10. Riscos

- Lista de filhas vazia logo depois de uma recarga a quente do mod: até a primeira leitura da lista
  (3 s), o relato de uma filha no meio do turno ainda abre pedido, como hoje. Cai para o comportamento
  antigo, nunca para um errado novo.
- Mensagens de filhas e de outra sessão juntas no mesmo prompt: só continua o pedido se todas forem de
  filhas; senão abre o pedido, como hoje.
- O modelo pode replanejar com `request` e trocar o título do pedido (seção 6.2).
- O lembrete "sem plano" (`reminders.unplanned`) não recomeça com a mensagem do meio do turno: o pedido é
  o mesmo, então a contagem segue.

## 11. Checklist do app (depois do commit local)

1. Orquestradora com uma tarefa em andamento e uma filha trabalhando sob ela: quando o relato da filha
   chegar com a orquestradora no meio do turno, o painel não ganha a linha "✉ <relato>", a tarefa segue
   em andamento, nada volta a pendente nem fica interrompido, o cartão da filha segue sob a tarefa e não
   aparece "+N pedidos anteriores". É o caso do print (64 em andamento, relato da filha, replano).
2. Digitar uma mensagem enquanto a sessão trabalha: sem linha de pedido nova; o painel volta se estava
   fechado; o título do pedido segue o mesmo.
3. Na filha que mandou o relato: a carta "Para <orquestradora>" fica verde (entrega confirmada).
4. Dispensar um AskUserQuestion e responder pelo chat com a sessão trabalhando: sem pedido novo; a
   tarefa da pergunta fecha e o plano segue no mesmo pedido.
5. Esc e depois uma mensagem: abre pedido novo e o modelo replaneja, como hoje.
6. Com o turno terminado, a mensagem seguinte (sua ou de uma filha) abre o seu pedido, como hoje.
7. Da orquestradora, mandar mensagem a uma filha ocupada: com o diff principal, igual a hoje (pedido com
   ✉ na filha, segundo cartão sob a tarefa do envio). Com a variante, o desenho da seção 5.
8. Digitar numa filha enquanto ela trabalha: o trabalho segue no cartão em que ela estava, sem cartão
   "pedido do usuário na filha" (seção 6.1).

## 12. Arquivos que o diff toca (para prever colisões) e como aplicar

| Arquivo | O que muda |
|---|---|
| `task-tree/hooks/prompt-submit.ts` | import do tipo `Child` e de `ensureGroups`; chave `childrenState`; função `fromChildren`; o desvio depois do `dropWaits`; comentário do topo |
| `task-tree/text/rules.ts` | uma frase em `RULES`; `PROMPT.midTurn`; comentário do `PROMPT` |
| `task-tree/DESENVOLVIMENTO.md` | um parágrafo em "Um prompt" |
| `task-tree/tests/pedidos.test.ts` | as 3 linhas de import do topo; um bloco no fim do arquivo |
| `task-tree/tests/lembretes.test.ts` | as 3 linhas de import do topo; constantes depois de `ABERTAS`; um bloco no fim |
| `regras/pedidos.md` | `pedidos.uma-mensagem-um-pedido` reescrito; cenário novo logo depois dele |
| `regras/envios.md` | `envios.pedido-recebido-mostra-carta`: o Então e uma linha `Reescrito:` |
| `regras/lembretes.md` | cenário novo no fim |
| `regras/selos.json` | 4 selos `novo` |

Colisões prováveis com outros itens da rodada: `regras/selos.json` (refazer com os comandos da seção 8);
o fim de `pedidos.test.ts` e de `lembretes.test.ts` e as linhas de import deles, se outro item também
acrescentar teste ali (`git apply --3way`, ou colar o bloco no fim); `prompt-submit.ts`, se outro item
mexer no trecho entre o `dropWaits` e o `openTurn`.

Aplicar: `git apply ..\claude-code-mod-task-tree-notas\correcao-r2-item-13.diff` na raiz, de uma vez (a
recarga a quente do clone pega cada arquivo salvo), `npm run check`, commit local.
Commit sugerido: `fix(task-tree): mensagem entregue no meio do turno continua o pedido em curso`.
