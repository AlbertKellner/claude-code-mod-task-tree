# Replanejar com o mesmo id no mesmo pedido perde o start (e o concluído, e o ✉)

Base: branch `test/regressivos-automacao-testes` (topo a01b314 segundo a Implementação). Nada foi editado.

## Essencial

- **Confirmado e mais amplo que o relatado.** Em `hooks/tools.ts` `planTool`, um nível 1 aberto do pedido atual com o mesmo id é **trocado inteiro** pelo nó novo de `build`. Tudo dentro dele volta a ○:
  - o `start` (`started`/`startedAt`) e o relógio;
  - também o **concluído** (✓ volta a ○);
  - e os **envios na fila (✉)** ancorados nele são apagados (l. 66).
- É **comportamento de origem documentado**, não um acidente:
  - está desde a entrada do mod (`465b09e`, 2026-10-20);
  - as `RULES` dizem ao modelo "substituído do zero no mesmo lugar da lista: remarque com done o que já estava concluído";
  - a decisão registrada do usuário sobre isso foi só a **posição** ("no mesmo lugar, sem mandar para o fim"), não a perda de estado.
- **Colide com decisões posteriores do usuário:**
  - "o ✉ fica até a entrega, faça o modelo o que fizer com a tarefa" (série 11);
  - o replanejar depois do Esc (d3ff1be), que agora **induz** o replano no meio do trabalho.
- **Classificação: dúvida para o usuário**, com recomendação de tratar como bug: o replano **preserva** o estado das tarefas que mantêm o id e só as novas nascem ○.

## 1. O que acontece hoje (código)

`hooks/tools.ts:34–120` (`planTool`):
- `fresh = build(input.tasks, 1, undefined, now)`: todos os nós novos com `status: 'open'`, `plannedAt: now`, sem `started`, `startedAt` nem `endedAt` (`state/tasks.ts:13–22`).
- `replanned(t)` = nível 1 `open`, com id no plano novo e do pedido atual (`sameRequest`: o turno da tarefa é o último).
- `inPlace` (l. 77–80): no lugar de `t` replanejado entra `list.find(f => f.id === t.id)`, isto é, o nó de `build`, **sem nada do antigo**. As subtarefas antigas que não estão no plano novo somem.
- l. 66: `sends` ancorados no nível 1 replanejado, ou embaixo dele, são **apagados** (comentário: "A replanned task starts over: the sends from it (or below it) go with it").
- Ligações que **não** são tocadas no replano no lugar:
  - `children` (sessões filhas), por `anchor`/`lastAnchor`/`rounds`;
  - `launches`, por `anchor`.

  Como os ids completos se repetem (`A/1` continua `A/1`), os cartões das filhas e os grupos de subagentes **continuam achando a âncora** se a tarefa existir no plano novo. Se a tarefa sumir do plano, o cartão vai para a raiz ou para o fim (regra de cartão sem âncora).
- `renameAnchors` só vale para os renomeados (pedido anterior), não para o replano no lugar.
- O resultado ao modelo é só "Plano exibido no painel: N tarefas… (M abertas no seu grupo)". **Não há aviso** de que o `start` e os concluídos se perderam.

Efeito por item:

| Item | Depois do replano no mesmo pedido |
|---|---|
| Tarefa ◉ com `start` | ○ pendente; `started`/`startedAt` perdidos; relógio zerado |
| Tarefa ✓ concluída | ○ pendente (o `done` precisa ser refeito; a regra manda o modelo remarcar) |
| Pai | ○ (sem filhas iniciadas nem concluídas) |
| Tempo do pedido e do pai | recomeça (`plannedAt` novo; `startedAt` some) |
| ✉ na fila da tarefa ou abaixo dela | **apagado**: o ✉ some antes da entrega |
| Cartão de filha ancorado | fica, se o id existe no plano novo |
| Grupo de subagente ancorado | idem |
| Contagens do cabeçalho | caem: os ✓ viram ○ até o modelo remarcar |

## 2. Histórico

- `465b09e` (2026-10-20): o mod entra com o replano "do zero" e com o texto das `RULES` ("substituído do zero no mesmo lugar da lista: remarque com done o que já estava concluído"; o schema da tool diz "replanejamento, que recomeça tudo dentro dela").
- `4af1b92` (2026-10-21), pedido do usuário: "tarefas na ordem do plano". O replano fica **no mesmo lugar**, sem ir para o fim. Foi a única decisão dele sobre o replano.
- `c442523` (2026-10-22): só refatoração; o comentário "A replanned task starts over: the sends… go with it" já existia antes.
- Série 2 (cartões e âncoras): decidiu o **pedido novo** (o anterior é interrompido e renomeado com as ligações), não o replano no mesmo pedido.
- Série 11 (`109b92d`, `8eb801c`), decisão do usuário: "o ✉ fica até a entrega", mesmo depois de `done`. O apagamento dos `sends` no replano (l. 66) contraria isso.
- `d3ff1be` (2026-10-27): depois do Esc, a mensagem da pessoa manda "replaneje o painel: chame plan com o nível 1 inteiro… remarque com done o que já estava concluído". O modelo passa a replanejar **com o mesmo id**, no mesmo pedido.
  - Se a mensagem abre turno novo, o replano cai em **pedido novo** e vira ✕ renomeado + plano novo.
  - Se o modelo replanejar de novo dentro do mesmo turno, cai no caso "do zero".

## 3. Por que importa

- O texto de replanejar manda o modelo "remarcar com done o que já estava concluído", mas não manda refazer o `start`. A tarefa que estava em andamento fica ○ até o modelo chamar `start` de novo. É exatamente a sequência que gera o painel parado e a correção de "sem start nada fica em andamento".
- Em uso real, o modelo precisa de `start` de novo. O texto genérico "siga etapa por etapa com start e done" cobre isso de forma implícita, sem aviso explícito, e o resultado do `plan` não avisa.
- O ✉ que some no replano contradiz a regra do usuário e deixa a sessão filha sem a marca de mensagem em fila.
- Os ✓ que voltam a ○ derrubam as contagens e as barras até o modelo remarcar. Se ele não remarcar, o painel mostra trabalho feito como pendente.

## 4. Classificação e regra proposta

**Classificação: dúvida para o usuário.** O "do zero" foi o desenho inicial e está nas `RULES`. Recomendo tratar como **bug do plugin**: o replano é para reorganizar o plano, não para apagar o que já aconteceu, e as regras posteriores do usuário (✉ até a entrega, sem start nada acende, replanejar depois do Esc) só funcionam se o estado se mantiver.

Regra proposta: **replano preserva o que mantém o id.** Ao substituir no lugar um nível 1 aberto do pedido atual:
1. Cada nó do plano novo cujo **id completo** (`A/1`, `A/2/1`) existia no nível 1 antigo herda do antigo: `status`, `started`, `startedAt`, `endedAt`, `plannedAt` e as marcas próprias (`msg`). O título e a ordem vêm do plano novo.
2. Os nós novos (ids que não existiam) nascem ○, como hoje.
3. Os nós antigos que **não estão** no plano novo:
   - os **concluídos** somem, como hoje (ou ficam como histórico: dúvida menor, recomendo sumir para respeitar o plano novo);
   - os **abertos** somem, como hoje.
   - Um aberto com ✉ na fila **mantém o ✉**: recomendo manter o nó, fora do plano, até a entrega, para não perder a marca. Alternativa mais simples: soltar o ✉ na tarefa-pai. A decidir na implementação; não muda a decisão do usuário.
4. Os pais são recalculados por `settle` (todos os filhos ✓ → ✓). Um pai que estava ✓ e ganhou filha nova ○ volta a aberto. Usar a mesma lógica do `begin`, que reabre pais.
5. `sends`: **não apagar** os ancorados em nós que continuam existindo; apagar só os de nós que sumiram (ou movê-los ao pai, conforme o item 3).
6. As `RULES` e os textos (`text/rules.ts` l. 39, 67, 124, 138) trocam "substituído do zero… remarque com done o que já estava concluído" por "substituído no mesmo lugar; o que já estava concluído ou em andamento continua assim". Assim se evita `done` repetido e "várias fechadas sem start".

Arquivos:
- `hooks/tools.ts` (`planTool`: `inPlace` e a l. 66);
- `state/tasks.ts`: uma função pura nova, `carry(antigo, novo)`, que copia o estado por id completo e recalcula os pais;
- `text/rules.ts`: as `RULES`, a descrição do schema de `plan` e os textos de replanejar.

Impacto:
- **Contagens e barras:** ficam corretas sem o modelo remarcar. Hoje caem até ele remarcar.
- **Chips:** "em andamento" mantém a tarefa iniciada; "pendentes" só as novas.
- **✉:** fica até a entrega, coerente com a série 11.
- **Cartões de filhas e subagentes:** sem mudança (já seguiam pelo id); a âncora de nó que sumiu continua indo para o fim, como hoje.
- **Resumida:** sem mudança (`joinWork` pelos ids do nível 1).
- **`done` repetido** pelo modelo num nó já ✓: `doneTool` aceita (finish em ✓ é idempotente), então não quebra, só fica redundante. Por isso o texto muda junto.

Testes no commit da correção (`tests/pedidos.test.ts`, que já tem o caso):
1. `plan A`, `start 1`, `plan A` (mesmo pedido, com um título trocado) → "Um" segue ◉; o pai ◉; o título novo aparece.
2. `start 1`, `done 1`, `plan A` com "Três" novo → "Um" ✓, "Três" ○, cabeçalho conta "Um" como feita.
3. `plan A` sem "Dois" → "Dois" some; o resto mantém o estado.
4. ✉ na fila em "Um" + replano → o ✉ segue em "Um". Depende do helper de envio da tarefa 4; senão, vai ao checklist.
5. O pai ✓ (todos concluídos) e o replano com filha nova → o pai volta a aberto.

O teste atual de `pedidos.test.ts` que espera o comportamento "do zero" (se a Implementação escreveu a expectativa "Um volta a ○") deve ser marcado como pendente com o motivo até a decisão, sem ajustar ao bug.

## Dúvidas para o usuário

1. Hoje, quando o modelo replaneja no mesmo pedido um plano com o mesmo id, tudo dentro dele recomeça do zero: o que estava em andamento volta a ○, o concluído volta a ○ (o modelo é instruído a remarcar) e o ✉ na fila some. Isso foi assim desde a entrada do mod; a decisão dele foi só manter a posição.
   - **Recomendado:** o replano passa a **preservar** o estado das tarefas que mantêm o id (em andamento segue ◉, concluída segue ✓, ✉ segue até a entrega); só as tarefas novas nascem ○; os textos ao modelo deixam de pedir para remarcar o concluído.
   - Alternativa: manter o "do zero" como está.
2. Se a 1 for "preservar": uma tarefa que **sai** do plano novo mas tem ✉ na fila deve continuar visível até a entrega (recomendado), ou o ✉ passa para a tarefa-pai?

## Decisões do usuário (2026-10-27)

1. **Preservar:** o replano no mesmo pedido mantém o status, `started`/`startedAt`, `endedAt` e o ✉ das tarefas que mantêm o id. Só as novas nascem ○. Os textos ao modelo deixam de pedir para remarcar o concluído.
2. **Tarefa que sai do plano novo com ✉ na fila:** continua visível até a entrega, sem passar para o pai.

É bug do plugin; o uso não se adapta.

## Brief final (Implementação)

Branch `test/regressivos-automacao-testes`, depois de `cf5ea53`. Um commit local. Sem push.

### Decisões de implementação fechadas aqui

- **Herança por id completo** (`A`, `A/1`, `A/2.1`; o `build` prefixa todo descendente com o id do nível 1).
  - Cada nó do plano novo cujo id existia no nível 1 antigo herda: `status`, `started`, `startedAt`, `endedAt`, `plannedAt` e `msg`.
  - Do plano novo vêm: `title`, `short`, `children` e a ordem.
  - `turn` já é preservado por `was()` em `planTool`.
- **Nós antigos ausentes do plano novo:**
  - os concluídos e os abertos **somem**, como hoje;
  - **exceção:** a folha de mensagem (`msg: true`) com envio **na fila** (`sends` com `anchor` = id dela e `!taken`) é **mantida** e marcada `kept: true`. Ela fica:
    - **onde:** sob o mesmo pai que tinha, se o pai continua no plano novo, depois das filhas novas dele; senão, no fim das filhas do nível 1;
    - **estado:** o mesmo que tinha. O desenho já mostra ✉ azul "na fila", porque o tom `sent` vem antes do status;
    - **contagens:** nenhuma, porque `count()` e os chips já ignoram folhas `msg`;
    - **depois da entrega:** a linha **some** do desenho. Em `rows`, `layout.ts` pula `t.kept` sem envio pendente para ela; no próximo replano, `carry` não a mantém mais.
- **Pais recalculados:** depois da herança, todo pai com alguma descendente aberta fica `open` (sem `endedAt`, `started` indefinido, `startedAt` herdado). Em seguida, `settle(list, now)` fecha os que ficaram com todas as filhas ✓. Um pai ✓ que ganhou filha nova volta a aberto; um pai que perdeu a única filha aberta e só tem ✓ fecha.
- **`sends`:**
  - não apagar no replano (a l. 66 de `tools.ts` sai);
  - depois do `change`, apagar só os envios cuja âncora (ou o nível 1 dela) **não existe** mais no grupo;
  - como as folhas com envio na fila são mantidas (`kept`), na prática só saem os envios já entregues de nós que sumiram.
- **Ligações de filhas e `launches`:** nada a fazer. Seguem pelo id, e o id se mantém. A âncora de um nó que sumiu continua indo para o fim, como hoje.
- **Fora do mesmo pedido:** nada muda. O pedido novo interrompe e renomeia o anterior (`away`).

### Mudanças por arquivo

1. **`task-tree/types/index.d.ts`**, em `TaskNode`: acrescentar
   ```ts
   // A message task left out of a replan while its message is still queued: kept, drawn until delivered.
   kept?: boolean
   ```
2. **`task-tree/state/tasks.ts`**: nova função pura.
   ```ts
   // A replan of an open level-1 task (same id, same request): the new plan's order and titles, with the
   // state of every task that keeps its id; a message task left out while its message is queued
   // (`queued`: anchors of sends not taken up) stays, marked kept; parents follow their children.
   export function carry(old: TaskNode, fresh: TaskNode, queued: string[], now?: number): TaskNode
   ```
   - `byId` a partir de `flat([old])`.
   - `merge(n)`: para cada nó `n` do plano novo, com `o = byId[n.id]`, devolve `{ ...n, ...(o ? { status, started, startedAt, endedAt, plannedAt, msg } de o : {}), children: n.children.map(merge) }`. Sem `kept`.
   - Órfãs mantidas: `flat([old])` com `children.length === 0 && msg && queued.includes(id) && !newIds.has(id)`. Para cada uma, achar o pai antigo, percorrendo `old`. Se o pai está no plano novo, anexar ao fim das filhas dele; senão, ao fim das filhas do nível 1. Com `kept: true`.
   - Pais: `reopen` recursivo, em que um pai com descendente `open` fica `{ status: 'open', started: undefined, endedAt: undefined }`; depois, `settle([r], now)[0]`.
3. **`task-tree/hooks/tools.ts`** (`planTool`):
   - antes do `change`: `const { value: sendsNow = [] } = await $.state.get(sendsState)` e `const queued = sendsNow.filter(s => !s.taken).map(s => String(s.anchor ?? ''))`;
   - apagar a l. 66 (o `update` que remove os envios dos replanejados) e o comentário das l. 64–65;
   - em `inPlace`: `reused(t) ? carry(t, list.find(f => f.id === t.id) as TaskNode, queued, now) : …`;
   - depois do `change`: `update(sendsState, cur => cur.filter(s => s.anchor === undefined || ids0.has(s.anchor)))`, com `ids0` = ids de `flat(tasks do grupo principal)` depois do `change`. Só no loop principal, como hoje.
   - atualizar o comentário das l. 47–52: o replanejado mantém o estado do que mantém o id.
4. **`task-tree/draw/layout.ts`** (`rows`, ~l. 904): no início do `flatMap`, `if (t.kept && !pending.some(s => s.anchor === t.id)) return []`. É a única mudança no desenho.
5. **`task-tree/text/rules.ts`**: os textos a seguir.

### Textos novos (`text/rules.ts`)

**`RULES`** (~l. 37–40), substituindo o item "Para replanejar…":
```
'- Para replanejar, chame plan de novo com o nível 1 inteiro. Um nível 1 aberto com o mesmo id é ' +
  'substituído no mesmo lugar da lista, e as tarefas que mantêm o id guardam o estado (concluída segue ' +
  'concluída, em andamento segue em andamento); só as novas entram pendentes. Um nível 1 já concluído ' +
  'fica como histórico. start só reabre tarefas sem subtarefas; para refazer um pai concluído, ' +
  'replaneje o nível 1 com ids novos para o que deve ser refeito.',
```

**`TOOLS.plan`** (~l. 67), trocando "uma aberta com o mesmo id é substituída (replanejamento, que recomeça tudo dentro dela)." por:
```
'uma aberta com o mesmo id é substituída no mesmo lugar (replanejamento): as tarefas que mantêm o id ' +
'guardam o estado, e só as novas entram pendentes. ' +
```

**`PROMPT.interrupted`** (~l. 121–126):
```
PANEL + 'seu turno anterior foi interrompido antes de terminar, e esta mensagem de outra sessão ' +
'chegou em seguida. Antes de seguir, replaneje o painel: chame mcp__task-tree__plan com o nível 1 ' +
`inteiro, juntando o que ficou do trabalho interrompido (tarefas abertas: ${list}) e o que esta ` +
'mensagem pede, na ordem em que vai executar; mantenha os ids das tarefas que continuam, que guardam ' +
'o estado. Depois siga etapa por etapa com start e done.',
```

**`PROMPT.interruptedEmpty`**: sem mudança, porque não fala em remarcar.

**`PROMPT.interruptedByYou`** (~l. 134–140):
```
(answered ? 'Esta mensagem é a resposta do usuário à pergunta anterior. ' : '') +
PANEL + 'o usuário interrompeu o turno anterior antes de terminar, e esta é a mensagem seguinte dele. ' +
'Antes de seguir, replaneje o painel: chame mcp__task-tree__plan com o nível 1 inteiro, na ordem em ' +
`que vai executar. Se esta mensagem continua o trabalho interrompido (tarefas abertas: ${list}), junte ` +
'o que ficou com o que ela pede, mantendo os ids das tarefas que continuam, que guardam o estado; se ela ' +
'muda de rumo, feche com mcp__task-tree__done o que ela substitui e planeje só o pedido novo. Depois ' +
'siga etapa por etapa com start e done.',
```

O que `tests/lembretes.test.ts` confere nesses textos (`replaneje o painel`, `mcp__task-tree__plan`, `o usuário interrompeu`, `esta mensagem de outra sessão`, a lista das abertas) continua igual. Conferir que nenhum teste procura "remarque": hoje nenhum procura.

### Testes (no mesmo commit, `tests/pedidos.test.ts`)

**Atenção:** o novo comportamento é **decisão do usuário** de 2026-10-27, não um ajuste ao bug. Se algum teste atual espera que a tarefa iniciada volte a ○ depois do replano no mesmo pedido, ele passa a esperar o estado preservado. O teste atual "plan com o mesmo id substitui no lugar…" replaneja **sem** `start` antes, então segue valendo como está; conferir.

Novos, com o nome dizendo a regra e a origem "decisão do usuário de 2026-10-27: replano preserva o estado":
1. **Replano no mesmo pedido mantém a tarefa em andamento:** `pedido`, `plan(A)`, `start ['1']`, `plan(A com título 'Plano A revisto')` → "Um" `andamento`; "Plano A revisto" `andamento`; nenhuma linha "Plano A".
2. **Replano mantém o concluído e acrescenta a nova pendente:** `start 1`, `done 1`, `plan(A + filha nova '3' "Três")` → "Um" `concluida`; "Três" `pendente`; o texto do painel tem "1 de 4" (Um, Dois.um, Dois.dois, Três), na forma que o cabeçalho já usa nos testes de `turnos`.
3. **Replano sem uma tarefa a tira do painel e mantém o resto:** `start 1`, `plan(A sem "Dois")` → nenhuma linha "Dois", "Dois.um" nem "Dois.dois"; "Um" `andamento`.
4. **Pai concluído que ganha filha nova volta a aberto:** `start`/`done` em 1, 2.1 e 2.2 (tudo ✓, "Plano A" ✓), depois `plan(A + '3' "Três")` → "Plano A" não está `concluida` (fica `andamento`, pelo caminho da última iniciada, ou `aguardando`; aceitar os dois com `expect([...]).toContain(estado)`); "Três" `pendente`; "Um" `concluida`.
5. **✉ da tarefa que sai do plano:** só se existir helper de envio (`SendMessage` com stub e `sends` na fila). Hoje não existe (tarefa 4): **vai para o checklist**. Não criar o helper agora.

### Riscos

- **Recarga do clone:** são cinco arquivos do mod (`types/index.d.ts`, `state/tasks.ts`, `hooks/tools.ts`, `draw/layout.ts`, `text/rules.ts`), mais o teste. Escrever **tudo de uma vez** (cópia no scratchpad e cópia única) e rodar `npm run check` antes de qualquer outro passo. Um estado intermediário (`carry` usado antes de existir) recusa o módulo em todas as sessões.
- **Contagens do cabeçalho:** passam a manter os ✓ depois do replano, o que é o esperado. Conferir que as folhas `kept` não entram (são `msg`).
- **Estado já persistido no store:** nenhuma migração. `kept` é opcional, e as tarefas antigas não o têm. Os planos replanejados antes desta versão já perderam o estado; nada a recuperar.
- **`done` redundante:** o modelo pode, por hábito, remarcar com `done` o que já está ✓. `doneTool` aceita (`finish` em ✓ mantém ✓), sem aviso de erro.
- **`started` duplicado:** a herança copia `started` (a sequência). `begin` usa `max(started) + 1`, então não colide.
- **Um id que muda de nível no replano** (folha vira pai ou pai vira folha): a herança copia o status, e o recálculo dos pais corrige. Coberto pelo teste 2, em que "Dois" segue pai; um caso de folha que vira pai pode entrar como teste extra, se couber.
- **A âncora de pergunta ou envio** (`current().anchor`) continua no nó em andamento preservado: comportamento melhor que hoje.

### O que o usuário valida no app

1. No meio do trabalho, o modelo replaneja o mesmo nível 1 (por exemplo, depois do Esc e de uma mensagem que continua o trabalho):
   - a tarefa em andamento segue ◉;
   - as concluídas seguem ✓;
   - só as novas aparecem ○;
   - o cabeçalho não "cai".
2. O modelo não remarca com `done` o que já estava ✓, porque o texto não pede mais.
3. Com uma mensagem na fila (✉ azul) numa tarefa que o replano tirou: o ✉ segue visível até a outra sessão receber, e então some.
4. Replano em **pedido novo** continua como antes: o anterior fica ✕, renomeado, como histórico.

### Commit

`fix(task-tree): replanejar no mesmo pedido preserva o estado das tarefas que mantêm o id (✓, ◉, ✉)`, com

`git commit -- task-tree/types/index.d.ts task-tree/state/tasks.ts task-tree/hooks/tools.ts task-tree/draw/layout.ts task-tree/text/rules.ts task-tree/tests/pedidos.test.ts`.

Relatar:
- o hash;
- a saída resumida do check;
- se algum teste existente mudou de expectativa, e qual;
- a confirmação de que o ✉ ficou no checklist.
