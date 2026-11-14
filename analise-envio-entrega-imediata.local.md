# Entrega imediata: o ✉ fica verde "entregue" na hora (plano de correção)

Base: branch `test/regressivos-automacao-testes`, topo `cd1f671` (tarefa 4, envios). Nada foi editado.

## Essencial

- **Causa:** em `hooks/tool-call.ts` `sentMessage` (l. 141–146), a entrega imediata grava o envio com `delivered: true`, mas **sem `taken`**. Esse `delivered` só serve para não mandar o lembrete "recebimento confirmado" ao modelo (`takenNote`, `sessions.ts:175–177`).
  - O desenho (`layout.ts:954`, `waitsOn` = envios não `taken`) e todo o resto (o relógio, a resumida, a publicação, o aviso do `done`) olham `taken`.
  - O `taken` só vem de `watchSends`, quando o arquivo publicado da outra sessão traz o `received`. Por isso o ✉ fica azul "na fila".
- **Correção:** na entrega imediata, gravar o envio já `taken: true` e fazer na hora o que `watchSends` faz na recepção: a tarefa-âncora é **concluída sozinha**.
  - Uma função única, `deliver`, em `state/tasks.ts`, é usada pelos dois caminhos.
  - As `RULES` passam a dizer que a entrega imediata já conta como recebida.
- **Não contradiz decisão anterior.** A regra registrada (`7c734de`, 2026-10-21; série 11) é "✉ até o destino **começar a tratar**", e o app responder "its turn has started on it" **é** o destino começando a tratar. O ✉ continua visível (verde); só deixa de esperar o arquivo publicado.
- **Dúvida curta:** concluir a tarefa-âncora na hora, como já acontece na recepção publicada (recomendado), ou deixá-la em andamento com o ✉ verde até o modelo dar `done`?

## 1. Como é hoje

- `sentMessage`:
  - `waitsDelivery = /queued|held|pending/ && !/turn has started/`;
  - grava `{ to, anchor, at, ...(waitsDelivery ? {} : { delivered: true }) }`;
  - marca a âncora `msg: true`;
  - a nota "a mensagem para X ainda está na fila…" só sai com `waitsDelivery`.
- `watchSends` (`sessions.ts:104–167`): marca `taken` pela recepção publicada (`received` com `from = eu` e `at ≥ s.at`; arquivos antigos, pelos turnos ou pelo running) e **conclui** a tarefa-âncora aberta sem filhas abertas (`fillStarts` + `finish` + `settle`).
- `takenNote` (`sessions.ts:169–185`), no próximo prompt ou chamada: tira os `taken` do estado e só lembra o modelo dos que **não** eram `delivered` ("recebimento confirmado… o painel já concluiu a tarefa do envio").
- Quem olha `taken`:
  - desenho (`layout.ts:874`, `954`, `1149`): tom `sent`, ✉ `queued` (azul, "na fila"); `halt` poupa a folha;
  - `render.tsx:305`: chip "aguardando sessão";
  - `anyRunning` (`sessions.ts:255`): o relógio segue;
  - `openInSight` (`layout.ts:649`): a resumida mantém o trabalho;
  - `doneTool` (`tools.ts:163`): aviso "na fila" ao fechar;
  - `planTool` (`tools.ts:67`): o replano mantém a tarefa de mensagem na fila;
  - `publish.ts:144`: publica só os não tomados (o cartão da mãe mostra o ✉ azul).
- Resultado: a entrega imediata fica **azul "na fila"** e conta como "aguardando sessão" até o arquivo da outra sessão mostrar o `received`, o que leva até 3 s, ou nunca, com uma versão antiga sem `received` e a sessão sempre rodando.

## 2. Regra exata

- **Entrega imediata** (o resultado do `SendMessage` casa com `/turn has started/`, ou não casa com `/queued|held|pending/`, e não falhou):
  - o envio é gravado `{ to, anchor, at, delivered: true, taken: true }`;
  - a tarefa-âncora vira tarefa de mensagem (`msg`), como hoje, e, se está aberta e sem filhas abertas, é **concluída na hora** (início preenchido, `finish`, `settle`), exatamente como na recepção publicada;
  - no desenho: ✉ **verde "entregue"**; nada em "aguardando sessão"; o relógio da espera não segue por ela;
  - o modelo não recebe a nota de fila nem o lembrete "recebimento confirmado" (o `takenNote` já pula os `delivered`).
- **Na fila** (`queued`): sem mudança. ✉ azul "na fila" até a recepção publicada; aí verde "entregue" e a tarefa concluída sozinha; o modelo recebe o lembrete.
- **Fim do turno e Esc:** com a entrega imediata não sobra envio pendente, e a tarefa já está concluída: nada a interromper. Com a fila, sem mudança: o ✉ sobrevive ao fim do turno.
- **Envio que falhou:** sem mudança (nada é gravado).
- **Uma segunda mensagem à mesma sessão da mesma tarefa** (`sendAnchor` com `usedAnchors`): sem mudança. O registro antigo é substituído pelo novo (`filter` em `to` + `anchor`).

## 3. Mudanças

`task-tree/state/tasks.ts`, nova função pura usada pelos dois caminhos:
```ts
// A message taken up (delivered at once, or its receipt published): the task it was sent from, open
// with nothing open below it, is closed, its start filled in, and the parents it completes with it.
export function deliver(list: TaskNode[], ids: string[], now?: number): TaskNode[]
```
O corpo é o laço de `sessions.ts:160–164`: para cada id, se a tarefa está `open` e sem filha `open`, `settle(edit(fillStarts(list, id, now), id, finish(now)), now)`.

`task-tree/hooks/sessions.ts` (`watchSends`, l. 157–166): trocar o laço por `tasks = deliver(tasks, anchors, now)`. É só refatoração.

`task-tree/hooks/tool-call.ts` (`sentMessage`, l. 141–153):
- gravar `...(waitsDelivery ? {} : { delivered: true, taken: true })`;
- no `change` que marca `msg`, aplicar em seguida `deliver([anchor], now)` quando `!waitsDelivery`. Um só `change`: marca `msg` e conclui;
- atualizar o comentário das l. 136–139: a entrega imediata já é a tomada da mensagem ("its turn has started" é o destino começando a tratar); o ✉ fica verde e a tarefa se conclui, como na recepção publicada.

`task-tree/text/rules.ts` (`RULES`, ~l. 54–57), texto novo:
```
'- Uma tarefa de enviar mensagem a outra sessão (SendMessage) fica com o ícone de mensagem (✉) do ' +
  'envio: azul enquanto a mensagem está na fila ("queued"), verde quando a sessão destino começa a ' +
  'tratá-la, na hora quando a entrega é imediata ("delivered; its turn has started on it"). Não chame ' +
  'done nela: quando o recebimento é confirmado, o painel a conclui sozinho (mesmo com esta sessão ' +
  'parada). Com "queued", o painel também avisa.',
```
`SESSION.taken`, `SEND.queued` e `DONE.queued` não mudam: já valem só para a fila.

Nada muda em `draw/layout.ts`, `hooks/render.tsx` nem `io/publish.ts`: todos já leem `taken`.

## 4. Impactos

- **Contagens:** a tarefa de mensagem já fica fora de x/y e dos chips. Some de "aguardando sessão" na hora. O pai e o pedido podem fechar na hora (`settle`) se ela era a última aberta, como já acontece na recepção publicada.
- **Tom do pai:** um pai com tudo concluído fecha ✓. Se sobra outra filha aberta, segue a regra do caminho da última iniciada.
- **Arquivo publicado e cartão da mãe:** `publish.ts:144` publica só os não tomados, então o ✉ do cartão da filha na sessão mãe fica verde "entregue" na hora (a tarefa já está `done`, `msg`). Quem lê com uma versão antiga do mod vê a tarefa concluída, sem envio: o mesmo que hoje depois da recepção.
- **Tooltip:** "Aguardando confirmação de X" só existia com o tom `sent`; agora não aparece na entrega imediata. O tooltip passa a ser o da tarefa de mensagem ("Mensagem entregue").
- **Rodadas e cartões de filhas:** `Child.rounds` e `lastAnchor` seguem gravados como hoje. O cartão do turno que a mensagem abriu vai sob a tarefa do envio, sem mudança.
- **`keptLinks` e âncoras:** não usam `taken`. A ligação da rodada com a tarefa continua; `renameAnchors` também.
- **Resumida:** `openInSight` deixa de manter o trabalho só por essa mensagem, e a resumida pode limpar mais cedo, como já faria depois da recepção publicada.
- **`watchSends`:** os envios `taken` são pulados (`if (s.taken) continue`). O `received` publicado depois pela outra sessão para essa mensagem não é casado com ela. Ele **poderia** casar com um envio posterior em fila à mesma sessão se tivesse `at ≥` o daquele envio. Isso não acontece: a recepção da mensagem imediata vem com `at` anterior ao envio seguinte. Risco baixo, registrado.

## 5. Testes (no mesmo commit, `tests/envios.test.ts`)

- O teste da entrega imediata (pendente da tarefa 4) passa a citar `// Regra: envios.entrega-imediata-aparece-como` e espera:
  - modo `entregue`, `start 1`, `envio('local_x')` → "Um" com `carta` `entregue` e "entregue" no texto, **sem** `h.recebeu` nem `aviso`;
  - nenhuma linha com "na fila"; o cabeçalho sem "aguardando sessão";
  - `done($, ['1'])` → a resposta **não** traz o aviso de mensagem na fila. Ou o `done` nem é preciso: conferir pelo cabeçalho que a tarefa foi concluída, se o pai fecha: plano C › {Um} → "Plano C" `concluida`.
- **Fila → entrega** (não-regressão, `envios.fica-ate-entrega`): o teste 1 atual segue igual (azul até `recebeu` + `aviso`, depois verde).
- **Entrega imediata no fim do turno:** `envio` imediato, `esc($)` → "Um" `entregue`, nada ✕ (`envios.entrega-imediata-aparece-como`).
- **Imediata e depois fila na mesma sessão:** `envio` imediato da tarefa 1, `start 2`, modo fila, `envio` da tarefa 2 → "Um" `entregue`, "Dois" `fila`; `recebeu(local_x, AGORA + 1)` + `aviso` → "Dois" `entregue`. Cobre o risco do `received` (`envios.fica-ate-entrega`).

Catálogo (`regras/envios.md`):
- `envios.entrega-imediata-aparece-como` → reescrever:
  - título: "A entrega imediata aparece entregue na hora.";
  - Dado uma tarefa de onde sai uma mensagem;
  - Quando o app responde que a sessão destino já começou a tratá-la;
  - Então o ✉ fica verde "entregue" na hora e a tarefa se conclui sozinha;
  - Origem: decisão do usuário, 2026-10-28 (sobre "✉ até o destino começar a tratar", 2026-10-21, commit 7c734de);
  - `Estado: coberto`.

  Se a Implementação preferir um id mais claro, `envios.entrega-imediata-fica-verde`, renomear o cabeçalho e o comentário dos testes juntos.
- `envios.fica-ate-entrega` → no "Então", deixar claro que a entrega é a resposta imediata do app **ou** a recepção publicada.

## 6. Riscos de regressão

- **Recarga do clone:** são quatro arquivos do mod (`state/tasks.ts`, `hooks/sessions.ts`, `hooks/tool-call.ts`, `text/rules.ts`) e dois de teste/catálogo. Escrever tudo de uma vez (cópia no scratchpad) e rodar `npm run check` antes de qualquer outro passo.
- **A refatoração de `watchSends` para `deliver`** precisa manter o comportamento da recepção publicada: o teste 1 de envios cobre.
- **Um resultado do app com outra redação** (sem "queued" nem "turn has started"): hoje cai como "entrega imediata" (`waitsDelivery` falso). Com a mudança, ele conclui a tarefa na hora. Já era o critério do `delivered`; registrar no checklist um envio real em fila e um imediato.
- **Tarefa-âncora com filhas abertas:** não é concluída (o `deliver` exige nenhuma filha aberta), como hoje.

## 7. O que o usuário valida no app

1. Mandar uma mensagem a uma sessão parada (entrega imediata): o ✉ aparece verde "entregue" na hora, a tarefa conclui, e não aparece "aguardando sessão".
2. Mandar uma mensagem a uma sessão ocupada (fila): ✉ azul "na fila"; quando ela começa a tratar, verde "entregue"; o modelo recebe o aviso de recebimento confirmado.
3. No cartão da sessão mãe (a filha mandando à mãe): o ✉ da filha fica verde na hora na entrega imediata.
4. Terminar o turno ou apertar Esc logo depois de uma entrega imediata: nada fica ✕.

## Dúvida para o usuário

- Na entrega imediata, a tarefa do envio deve ser **concluída na hora** (recomendado: é o que o painel já faz quando a recepção chega pelo arquivo publicado, e as regras dizem ao modelo "não chame done nela: quando o recebimento é confirmado, o painel a conclui sozinho")?
- Ou ela fica em andamento com o ✉ verde até o modelo chamar `done`?
- Em 2026-10-21 ele pediu o ✉ "para sinalizar que essa etapa esta em andamento". O ✉ continua visível nos dois casos.

## Brief para a Implementação

Commit separado, na branch `test/regressivos-automacao-testes`, **depois** de `cd1f671` (tarefa 4). Sem push. Se a resposta à dúvida for "fica em andamento até o done", não chamar `deliver` no `sentMessage` (só `taken: true`) e ajustar as expectativas de "concluída" dos testes; o resto do brief vale igual.

1. `state/tasks.ts`: `deliver(list, ids, now)` (seção 3).
2. `hooks/sessions.ts`: `watchSends` usa `deliver` (só refatoração).
3. `hooks/tool-call.ts`: na entrega imediata, o envio sai `taken: true` e a âncora é concluída por `deliver` no mesmo `change` que marca `msg`; atualizar o comentário.
4. `text/rules.ts`: o item do ✉ nas `RULES` com o texto da seção 3.
5. `tests/envios.test.ts`: o teste da entrega imediata cita `envios.entrega-imediata-aparece-como` (ou o id renomeado) e espera verde na hora, mais os dois testes novos da seção 5 (fim do turno; imediata e depois fila).
6. `regras/envios.md`: os cenários da seção 5 (estado `coberto`, origem 2026-10-28).
7. Escrever tudo de uma vez e rodar `npm run check`.

Commit: `fix(task-tree): entrega imediata da mensagem já aparece entregue (✉ verde) e conclui a tarefa do envio`, com `git commit -- task-tree/state/tasks.ts task-tree/hooks/sessions.ts task-tree/hooks/tool-call.ts task-tree/text/rules.ts task-tree/tests/envios.test.ts regras/envios.md`.

Relatar:
- o hash;
- o resumo do check;
- se o teste "imediata e depois fila" passou sem casar o `received` errado.
