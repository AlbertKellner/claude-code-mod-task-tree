# Bug: pai aberto aparece ◷ aguardando no meio do turno (plano de correção)

Base: `main` `9980131` + working tree com `task-tree/tests/kit/` e `arvore.test.ts` (sem commit). Nada foi editado.

## Essencial

- **Causa raiz:** em `draw/layout.ts`, na escolha do tom da linha da tarefa (`rows`, ~l. 918–937) e da linha do pedido (`turnRows`, ~l. 1015–1026). Um pai **aberto**, fora do caminho aceso por `current()` (que só acende a tarefa iniciada e aberta e seus ancestrais), cai em `resting(children)` → tom `paused` → ◷. `resting` é verdadeiro com **qualquer** filha concluída (`status === 'done'`) e não olha se o turno acabou. Depois de `start` + `done` numa filha, sem outro `start`, nada está aceso, e o pai e o pedido viram ◷ no meio do turno.
- **Colisão de decisões:** isso **não é acidente**. É a regra "Pai aguardando", pedida pelo usuário quando o mod entrou no repositório (`465b09e`, 2026-10-20): "nas tarefas que estao aguardando e ja tem alguma tarefa concluida, marque os pais como aguardando". O commit `95b1a21` (2026-10-27) só a estendeu às folhas deixadas abertas no fim do turno (`leftWaiting`). A decisão nova ("pai aberto deve mostrar ◉ em andamento") contradiz a antiga ao pé da letra, então a regra exata volta como **dúvida**.
- **Regra proposta**, que concilia as duas: no meio do turno, ◉ só no caminho da **última tarefa iniciada no turno atual** (seus ancestrais abertos, inclusive o pedido). Os outros pais abertos com algo concluído (planos de pedidos anteriores parados) seguem ◷, e no fim do turno tudo segue ◷.
- Mudança em `draw/layout.ts` (`current`, ou um vizinho, mais `rows` e `turnRows`). Os chips e os números do cabeçalho **não mudam**: contam só folhas.

## 1. Onde nasce o ◷

- `draw/layout.ts:477`: `resting = list => flat(list).some(k => k.status === 'done' || leftWaiting(k))`.
- Tom da tarefa, l. 918–937. Ordem: `sent` → interrompida → `w.busy || waitsBelow` → `current` → concluída → `leftWaiting(t)` → `paused` → `lit.includes(t.id)` → `current` → `children.length > 0 && resting(children)` → **`paused`** → `open`.
- Tom do pedido, l. 1015–1026: `busy` ou algum nível 1 aceso → `current`; senão, nível 1 aberto e `resting(list)` → **`paused`**.
- `current(list)` (l. 560) acende só a partir de tarefas `open` com `started` definido. Uma folha concluída perde `started` (`finish`), então depois do `done` nada fica aceso.
- `draw/svg.ts:35`: `paused: ['◷', 'warning']`. O rótulo é "Aguardando"/"Pedido aguardando"; o tempo é parado (`stillSpan`).
- `state/tasks.ts`: `begin` põe `startedAt` no pai, `settle` só fecha o pai com **todas** as filhas concluídas, e `doneTool` não mexe no pai aberto. O estado está certo: o problema é só o desenho.
- O fim de turno (`halt`, l. 50–64) é aplicado **no desenho**, com `model.ended`. Ele dá `endedAt` às folhas iniciadas (`leftWaiting` → ◷) e aos pais abertos. No próximo prompt, `ended` some e as tarefas voltam ao que eram.

## 2. Histórico

- `465b09e` (2026-10-20, entrada do mod 0.7.3): documenta "Pai aguardando", com as palavras do usuário citadas acima. A definição: aberto, algo concluído abaixo, nada em andamento (não aceso, sem ✉ nem sessão viva), tom `paused` ◷ âmbar.
- `8ea3ca5` (2026-10-22, layout num módulo): só mudou o lugar do código.
- `b742294`, `16062cc`/revert `6150b45`, `55a2dd1` (2026-10-23): fim de turno e "sem start nada fica em andamento". Tratam de **folhas**: só acende o que foi iniciado, e as pendentes seguem pendentes.
- `95b1a21` (2026-10-27): folha iniciada e aberta no fim normal do turno fica ◷; pai com filha concluída nunca ✕; `resting` passa a contar também `leftWaiting`.
- Notas: `analise-task-tree-pai-interrompido.local.md` cita o ◷ do pai como regra já existente ("o mesmo ◷ que o painel já usa no pai aberto com algo concluído, `resting`").

Leitura: a regra antiga queria marcar um **plano parado** ("tarefas que estão aguardando"), mas "nada em andamento" foi implementado como "nada aceso". Isso também cobre o intervalo normal entre um `done` e o `start` seguinte, dentro do mesmo turno, que é o bug.

## 3. Regra proposta (exata)

Para um pai aberto (tarefa com filhas, ou a linha do pedido), sem ✉ próprio, não interrompido e não concluído:

1. **◉ em andamento** quando:
   - há sessão viva embaixo ou ✉ embaixo (como hoje); ou
   - está aceso por `current()`, isto é, tem uma descendente iniciada e aberta (como hoje); ou
   - **(novo)** o turno **não terminou** (`model.ended` indefinido no painel próprio; sessão viva no cartão da filha) **e** o pai é ancestral (ou é) da **última tarefa iniciada**, `startedLast`, **e** essa tarefa foi iniciada no turno atual (`startedAt ≥ at` do último turno do grupo principal).
2. **◷ aguardando** quando não é ◉, tem algo concluído ou deixado aguardando embaixo (`resting`), **ou** o turno terminou com ele aberto (`halt`), como hoje.
3. **○ pendente** quando nada embaixo foi concluído nem iniciado (plano novo antes do primeiro `start`), como hoje.

Consequências:
- "Sem start, nada fica em andamento" continua valendo: o caminho só acende por uma tarefa que **foi** iniciada neste turno. Um plano novo sem `start` fica ○.
- O título do cabeçalho já usa `startedLast` quando nada está aceso (`render.tsx` l. 346), então o cabeçalho e o ◉ passam a apontar para a mesma tarefa.
- Plano de um pedido anterior parado: o `startedLast` é de outro turno, e ele segue ◷ (a decisão antiga fica intacta).
- O pai acende ◉ mas **não** fica `active` (o chip "em andamento" conta só folhas, l. 367–368 de `render.tsx`), então o chip não mente.
- O tempo do pai em ◉ corre (`timeOf`) até a próxima tarefa; no fim do turno, para.

### Alternativa mais simples (se o usuário quiser, a ser perguntado)

- "Todo pai aberto com algo concluído é ◉ enquanto o turno não terminou; ◷ só depois do fim do turno."
- É mais fácil, mas faz os planos parados de pedidos anteriores aparecerem ◉ no turno seguinte, o que contradiz "nas tarefas que estão aguardando… marque os pais como aguardando" e polui a resumida, que os mantém à vista enquanto algo está aberto.

## 4. Arquivos e funções

`draw/layout.ts`:
- **Função nova pura** `trail(list, since?)`: o caminho (`pathTo`) até `startedLast(list)`, só se `startedAt ≥ since`, e só os nós abertos.
- No `layout(...)`, onde `lit` é calculado para o grupo principal e para os cartões: se o turno não terminou, `lit = lit ∪ trail(tarefas, inicioDoTurno)`, com `inicioDoTurno = at` do último turno com `at`.
  - Grupo principal: `model.ended === undefined`.
  - Cartões de filhas: `live(c) || c.starting`.
- Assim `rows` e `turnRows` não mudam a ordem dos tons: o pai cai em `lit.includes(t.id)` → `current` antes do `resting`. Folhas já concluídas no caminho não mudam de tom, porque `done` vem antes de `lit` na escolha.
- **Cuidado:** `lit` também alimenta `active` (l. 982: `lit.includes(t.id) && !t.children.some(c => c.status === 'open')`). Para não acender o chip "em andamento" de um pai que só tem filhas concluídas e pendentes, `active` deve olhar **o `lit` antigo**, sem `trail`. Por isso: passar `lit` (para o tom) e `litOwn` (para `active`), ou calcular `trail` à parte e usá-lo só no tom. Recomendo o segundo, um parâmetro `trailIds` em `rows`/`turnRows`, para não mexer em quem já usa `lit` (âncora de envio, `current().anchor`).
- Não mexer em `current()` em si: ele decide a âncora dos envios e da pergunta, e mudar isso mexe no ✉.

`hooks/render.tsx`: nada, salvo se o ícone do cabeçalho usar o tom do pedido (conferir; a mudança vem junto, sem código novo).

`state/tasks.ts` e `hooks/tools.ts`: nada.

## 5. Impacto em contagens e visões

- **Números do cabeçalho e chips:** contam folhas (`count`, `open`/`active`/`resting` em `render.tsx`), então não mudam. O chip "aguardando" conta folhas `leftWaiting` e avisos, não pais ◷.
- **Resumida × completa:** o tom é calculado igual nas duas. A resumida usa `openInSight`/`hasOpen`, que dependem de status, não de tom, então nada muda na seleção do que aparece.
- **Cartões de filhas:** uma filha viva, entre um `done` e o `start` seguinte, passa a mostrar o pai ◉ no cartão (antes ◷). Com a filha parada, segue ◷ (`halt` em `panelOf`).

## 6. Cenários de teste (no mesmo commit da correção, em `tests/arvore.test.ts`, ou `tests/turnos.test.ts` se já existir)

1. **(o bug)** `plan` A › {1, 2 › {2.1, 2.2}}; `start 1`; `done 1`, sem outro `start`: pedido ◉, A ◉, 1 ✓, 2 ○, 2.1 ○, 2.2 ○. Chips: 0 em andamento, 3 pendentes. É o teste "pai fecha sozinho…", que já reproduz o bug.
2. Plano novo sem `start`: pedido ○, A ○, todas ○ (sem start, nada acende).
3. Fim do turno: depois do cenário 1, `$.turn.complete` → pedido ◷, A ◷, 2 ○. Com uma folha iniciada e aberta no fim: ela ◷ e o pai ◷.
4. Pedido anterior parado: o pedido P1 tem A com 1 ✓ e 2 ○; vem um pedido novo P2 (`prompt.submit` da pessoa), `plan` B, `start B`: B ◉; A e P1 seguem **◷**, não ◉.
5. Próximo prompt sem `start` (continuação): depois do cenário 3, um prompt novo da pessoa sem `start` → A ◷ (o `startedLast` é do turno anterior).
6. Pai com filha concluída nunca ✕: subagente deixa folha aberta e termina (`interrupt`) → pai ◷, não ✕. Fica para quando houver helper de subagente; senão, vai para o checklist do app.
7. Pergunta aberta: `start 1`, `AskUserQuestion` respondida → a linha ◷ "Aguardando sua resposta" aparece e some; o pai segue ◉ (1 aceso). Depende dos helpers da tarefa 3; se ainda não existirem, vai para o checklist.

Os cenários 1 a 5 cabem com os helpers atuais, mais `fimDoTurno` (`$.turn.complete`) e `pedido` (`$.prompt.submit`), que entram neste commit no mínimo necessário. Os cenários 6 e 7 dependem de helpers das tarefas seguintes.

## 7. Riscos de regressão

- `lit` usado para outras coisas (âncora de envio, `active`, `current().anchor`): mitigado por usar `trail` só no tom.
- Turno "atual" errado: o `at` do último turno vem da mensagem da pessoa ou de outra sessão; um prompt `NO_TURN` não abre turno, então o `trail` segue o turno anterior, o que é correto. Conferir se `Turn.at` é sempre gravado. Se faltar (painéis antigos), sem `at` não há `trail`, e vale o comportamento de hoje.
- Filha viva com `trail`: o cartão pode acender um pai antigo dela se o `at` dos turnos dela não estiver no painel publicado. Usar o mesmo critério; sem `at`, sem `trail`.
- Animação ou piscar: a troca ◷ → ◉ muda o tom, e a linha pode reanimar (`motion.ts`). Conferir no app.
- O tempo do pai em ◉ passa a correr entre tarefas, e é isso que se quer. Conferir que não "pula" no fim do turno (`stillSpan`).

## 8. O que o usuário valida no app

1. Num turno com plano de 2 níveis: depois de `start` + `done` numa filha e antes do próximo `start`, o pai e o pedido aparecem ◉ (não ◷), e o chip "em andamento" não conta o pai.
2. No fim do turno, o mesmo painel vira ◷ no pai e no pedido.
3. Um pedido anterior parado continua ◷ enquanto um pedido novo está ◉.
4. Cartão de filha trabalhando entre tarefas: o pai ◉; com a filha parada, ◷.
5. Nenhuma linha pisca nem reanima à toa na troca.

## Dúvidas para o usuário

1. A regra antiga dele, "nas tarefas que estao aguardando e ja tem alguma tarefa concluida, marque os pais como aguardando" (2026-10-20), segue valendo para **planos parados de pedidos anteriores**, com o ◉ só no caminho da última tarefa iniciada no turno atual (regra recomendada)? Ou ele quer **todo** pai aberto ◉ durante o turno (alternativa simples)?
2. Num prompt novo dele que **continua** o mesmo plano (sem `start` ainda), o pai deve ficar ◷ até o primeiro `start` (recomendado, coerente com "sem start, nada em andamento") ou já ◉?
