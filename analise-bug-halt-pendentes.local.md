# Bug: no fim do turno as pendentes viram ✕ (plano de correção, versão final)

Base: `main` `9980131` + working tree com `task-tree/tests/` (sem commit). Nada foi editado. Esta versão substitui a anterior com as respostas do usuário (2026-10-27).

## Essencial

- **Causa:** em `draw/layout.ts`, `halt` com `all = true` (l. 58) faz a folha nunca iniciada passar por `interrupt`.
  - Na sessão principal, `all` vem de `layout` (l. 881–882) quando nada está em andamento nem há ✉.
  - No cartão de filha parada, vem de `panelOf` (l. 135), sempre.
  - Origem: `edb959f` (2026-10-24, "reaproveitar o interrompida"), que **o usuário agora desfaz por vontade expressa**.
- **Correção do halt:** parar de passar `all` nos dois pontos. A folha iniciada segue ◷ no fim normal e ✕ no Esc; a pendente fica ○ sempre. Arquivada, subagente e plano substituído ficam ✕ como hoje. Só `draw/layout.ts` muda.
- **Replanejar depois do Esc:** já existe um lembrete para isso (`PROMPT.interrupted` em `text/rules.ts`), mas o hook do prompt só o envia quando a mensagem seguinte é **de outra sessão** (`aborted && it.peer`, `hooks/prompt-submit.ts:100`). Na mensagem da própria pessoa, o modelo recebe só a lista das abertas para fechar.
- Recomendo estender o lembrete à mensagem da pessoa. Isso vira **tarefa própria**, porque mexe em textos ao modelo e no hook, não no desenho. Fica uma dúvida curta sobre a leitura.

## 1. Causa e histórico (resumo)

- `55a2dd1` (2026-10-23): as pendentes seguem ○ no fim do turno.
- `edb959f` (2026-10-24, decisão do usuário: "reaproveitar o interrompida"):
  - filha parada: as pendentes ✕;
  - principal: as pendentes ✕ quando nada está em andamento nem há ✉;
  - nasce o parâmetro `all`.
- `95b1a21` (2026-10-27): a iniciada aberta fica ◷ no fim normal e ✕ só com `aborted`; o pai com filha concluída nunca fica ✕.
- **Decisão nova (2026-10-27):** no fim do turno, as pendentes seguem ○, nunca ✕, também nas filhas e no Esc. Fica desfeito o `edb959f`.

## 2. Regra exata por situação

| Situação | Folha iniciada aberta | Pendente nunca iniciada | Pai aberto | Mudança |
|---|---|---|---|---|
| Principal, fim normal do turno | ◷ (relógio parado) | **○** | ◷ com algo feito ou aguardando embaixo; ○ sem nada | sim (era ✕ sem nada em andamento) |
| Principal, Esc/stop (`aborted`) | ✕ | **○** | aberto (◷/○); ✕ só se tudo embaixo virou ✕ e nada foi feito | sim (era ✕ sem nada em andamento) |
| Filha que terminou o turno normalmente | ◷ | **○** | como na principal | sim (era ✕ sempre) |
| Filha parada pela pessoa (`c.aborted`) | ✕ | **○** | como na principal | sim |
| Filha arquivada | ✕ | ✕ | ✕; ◷ com filha concluída | não |
| Subagente que terminou (`turn.ts:135`, grava no estado) | ✕ | ✕ | ✕; ◷ com filha concluída | não |
| Plano de pedido anterior substituído por outro com o mesmo id (`tools.ts:76`) | ✕ | ✕ | ✕ | não |
| Folha com ✉ na fila | ✉ | ✉ | | não |

Regras do pai, inalteradas:
- com algo concluído embaixo, nunca ✕;
- "pedido com tarefa interrompida é ✕" só vale com **nenhuma** tarefa aberta. Com as pendentes ○, o pedido fica ◷ (algo feito) ou ○ (nada feito).

Depois do próximo prompt, `wake` limpa `turnEnded` e o `halt` deixa de ser aplicado: o desenho volta ao estado cru. A iniciada que ficou ✕ no Esc volta a ◉ e as pendentes seguem ○. Isso é o comportamento atual e não muda.

## 3. Arquivos e funções (correção do halt)

`task-tree/draw/layout.ts`:
- `layout` (l. 881–882): `halt(ended, sentFrom, false, model.aborted === true)`. Se `goingOn` não tiver outro uso, apagar a l. 881.
- `panelOf` (l. 135): `halt(last > 0 ? last : undefined, [], false, c.aborted === true)`.
- `halt` (l. 50–64): manter o parâmetro `all`, que ninguém mais passa como `true`, ou removê-lo e simplificar a l. 58 para `return begun ? interrupt(at)(t) : t`. Recomendo **remover**, para não deixar caminho morto. O código fica:
  - folha com ✉ → intacta;
  - folha iniciada e não `aborted` → aberta com relógio parado (◷);
  - folha iniciada e `aborted` → `interrupt`;
  - folha não iniciada → intacta (○);
  - pai como hoje (l. 60–63).
- Reescrever o comentário de `halt` (l. 34–49): tirar "With `all`, the pending tasks read as interrupted too (the person: 'reaproveitar o interrompida')…" e dizer que as pendentes seguem ○ em todo fim de turno (principal e filhas, normal ou Esc), com a decisão do usuário de 2026-10-27.

Não mudam:
- `io/publish.ts`: o `halt` é desenho, e a filha publica o estado cru;
- `hooks/render.tsx`: os chips contam as linhas desenhadas;
- `state/tasks.ts`, `hooks/tools.ts`, `hooks/turn.ts`.

## 4. Números do cabeçalho e visões

- `count(shown)` deixa a interrompida fora do total. Com as pendentes em ○, elas voltam ao total:
  - **cenário do teste:** de 1/1 + "3 interrompidas" para **1/4 + "3 pendentes"**;
  - o pai e o pedido mostram 1/4, com a barra em 25%.
- **Chips:** "pendentes" conta as folhas abertas não iniciadas (`render.tsx` l. 367–371), então passa a contá-las; "interrompidas" deixa de contá-las.
- **Cartão de filha parada:** "N pendentes" no lugar de "N interrompidas"; o ícone segue "parada".
- **Resumida e completa:** a seleção do que aparece (`startsWork`/`openInSight` em `hooks/panel.ts`) lê o **estado cru**, onde as pendentes sempre foram `open`, então não muda. Só o desenho muda.

## 5. Replanejar depois do Esc (pedido do usuário: "precisa replanejar quando eu interrompo e envio nova mensagem")

O que acontece hoje:
1. Esc → `turn.complete` com `isAborted` → `turnEnded = agora` e `turnAborted = true` (`turn.ts:112, 125`). O painel desenha a iniciada ✕ (`halt`, `aborted`).
2. Nova mensagem da pessoa → `promptSubmit`:
   - `wake` limpa `turnEnded`, e o desenho volta ao estado cru: a iniciada ◉ e as pendentes ○;
   - `openTurn` abre um **pedido novo** com o título da mensagem;
   - `turnAborted` volta a `false`.
3. Lembrete enviado ao modelo (`prompt-submit.ts:100–102`):
   - se a mensagem é **de outra sessão**: `PROMPT.interrupted(lista)`, "seu turno anterior foi interrompido… replaneje o painel: chame mcp__task-tree__plan com o nível 1 inteiro, juntando o que ficou do trabalho interrompido (tarefas abertas: …) e o que esta mensagem pede… Remarque com done o que já estava concluído";
   - se a mensagem é **da pessoa**: só `PROMPT.open(lista)`, "feche com done as que esta mensagem conclui ou substitui… deixe abertas só as que continuam". **Não pede replanejamento.** Essa é a lacuna que o usuário sente.
4. Na prática, "replanejar" no painel é o modelo chamar `plan` no pedido novo. Um nível 1 aberto de pedido anterior com o mesmo id é interrompido e renomeado (`<tag>:id`) e fica como histórico no pedido antigo; o plano novo, com o que ficou mais o que a mensagem pede, vai para o pedido novo. Nada no painel obriga isso; só o lembrete.

Leituras possíveis:
- (a) Estender o lembrete de replanejamento (`PROMPT.interrupted`, com o texto ajustado para "esta mensagem" em vez de "esta mensagem de outra sessão") à mensagem da **própria pessoa** depois do Esc. **Recomendado:** é a regra que já existe para as sessões, aplicada à pessoa.
  - Mudança em `hooks/prompt-submit.ts:100` (tirar `&& it.peer`) e em `text/rules.ts` (texto neutro, ou um terceiro texto `interruptedByYou`).
- (b) Marcar no painel a tarefa interrompida de forma persistente (✕ no estado) até o modelo replanejar. Isso contradiz "só a iniciada vira ✕ e volta ao trabalho no próximo prompt" e mexe em `wake`. Não recomendo.
- (c) Reabrir a tarefa ✕ sozinha: já acontece (o `wake` desfaz o desenho).

Escopo:
- **Entra agora (correção do halt):** só o desenho (seções 2–4).
- **Tarefa própria (replanejar depois do Esc):** leitura (a), com teste: Esc → mensagem da pessoa → o contexto do prompt contém o lembrete de replanejar com a lista das abertas. O kit lê o `context` devolvido por `$.prompt.submit`.

**Dúvida para o usuário** (objetiva): "Depois do Esc, na sua próxima mensagem, o mod deve mandar o modelo replanejar o painel (chamar plan juntando o que ficou aberto e o que você pediu agora), como já faz quando a próxima mensagem vem de outra sessão?" Recomendação: sim, como tarefa separada da correção do halt.

## 6. Cenários de teste (no mesmo commit da correção do halt)

Em `task-tree/tests/turnos.test.ts`:
1. **Reativar o cenário 3:** plano A › {Um, Dois › {Dois.um, Dois.dois}}; `start` Um; `done` Um; fim do turno normal.
   - Um ✓; Dois, Dois.um e Dois.dois **○**; A ◷; pedido ◷.
   - Cabeçalho **1/4**, chip "3 pendentes", nenhum "interrompida".
2. Fim normal do turno sem nenhum `start`: todas ○, A ○, pedido ○, nenhum ✕.
3. Fim normal do turno com uma folha iniciada e aberta (`start` Um sem `done`):
   - Um ◷;
   - Dois, Dois.um e Dois.dois ○;
   - A ◷; pedido ◷;
   - chip "1 aguardando" e "3 pendentes".
4. Esc (`$.turn.complete` com `isAborted: true`) com `start` Um aberto:
   - Um **✕**;
   - Dois, Dois.um e Dois.dois **○**;
   - A aberto (○ ou ◷: A não tem nada feito embaixo nem folha aguardando, então ○; conferir o tom e ajustar a expectativa, não o código, se for ○);
   - pedido idem.
   - Confirmar o nome do campo no `TurnCompleteArgs` do kit. Se o kit não aceitar o Esc, vai para o checklist.
5. Próximo prompt depois do fim do turno (`$.prompt.submit` da pessoa): Um volta ao estado cru, e o `start` em Dois.um acende ◉ (`wake`).

Em `task-tree/tests/sessoes.test.ts`, se o kit permitir; senão, no checklist do app:

6. Filha que terminou o turno com pendentes. Exige:
   - stub da lista do host (`mcp`/`process` conforme `io/host.ts`);
   - o arquivo publicado da filha, com `groups` e `running: false`.

   Esperado: o cartão mostra as pendentes ○, chip "pendentes", e a iniciada aberta ◷. Com `aborted: true` no publicado, a iniciada ✕ e as pendentes ○.
7. Filha arquivada: tudo ✕; o pai com filha ✓ fica ◷ (não-regressão).

O subagente que terminou (✕) depende de helper de subagente (`agentId` no `plan` + `$.turn.complete` do subagente). Se o kit aceitar `agentId` no `turn.complete`, vai como teste 8; senão, fica no checklist.

## 7. Riscos de regressão

- Os números do cabeçalho mudam em todo fim de turno com pendentes. É intencional; avisar o usuário.
- Pedidos antigos com pendentes aparecem abertos (○/◷) na completa. Já eram abertos no estado, então a seleção da resumida não muda.
- Cartões de filhas paradas mudam de "interrompidas" para "pendentes", e a contagem da filha no pai sobe.
- Interação com a correção do pai aberto (`analise-bug-pai-aberto.local.md`): as duas mexem em `layout.ts`. Commits separados, e rodar os testes das duas depois de cada uma.
- Remover `all` muda a assinatura de `halt`: conferir que não há outro chamador (hoje só `layout` e `panelOf`).

## 8. O que o usuário valida no app

1. Terminar um turno com um plano parcial: as pendentes ○, o pai e o pedido ◷, o cabeçalho 1/4 com "3 pendentes", sem "interrompidas".
2. Terminar um turno com uma tarefa iniciada e aberta: ela ◷ e as outras ○.
3. Apertar Esc no meio de uma tarefa:
   - a iniciada fica ✕ e as pendentes ○;
   - ao mandar uma nova mensagem, a iniciada volta e nada fica ✕.

   O lembrete de replanejar é a outra tarefa.
4. Uma filha que termina o turno com pendentes: ○ no cartão, chip "pendentes".
5. Um subagente que termina deixando tarefas abertas, e uma filha arquivada: ainda ✕.

## 9. Brief para a Implementação (correção do halt)

Correção do bug "no fim do turno as pendentes viram ✕", conforme `<notas>\analise-bug-halt-pendentes.local.md`, seções 2–4 e 6. Commit local, separado da correção do pai aberto. Sem push.

1. Em `task-tree/draw/layout.ts`:
   - remover o parâmetro `all` de `halt`; a folha não iniciada fica intacta, e a iniciada fica ◷ no fim normal e ✕ com `aborted`;
   - `layout` passa `halt(ended, sentFrom, model.aborted === true)`; apagar `goingOn` se não tiver outro uso;
   - `panelOf` passa `halt(last > 0 ? last : undefined, [], c.aborted === true)`;
   - reescrever o comentário de `halt` com a regra nova: as pendentes seguem ○ em todo fim de turno, na principal e nas filhas, normal ou Esc (decisão do usuário de 2026-10-27, que desfaz "reaproveitar o interrompida"); arquivada, subagente e plano substituído seguem ✕.
2. Testes no mesmo commit, em `task-tree/tests/turnos.test.ts`: reativar o cenário 3 e acrescentar os cenários 2 a 5 da seção 6. Os cenários de filhas (6 e 7) só se o kit permitir com stubs simples; senão, anotar no relato que ficaram no checklist.
3. Escrever tudo de uma vez (cópia no scratchpad e copiar junto), rodar `npm run check` e conferir que os testes de árvore (incluindo o do pai aberto, se ainda estiver pendente) não mudaram de resultado.
4. Se um teste revelar outro comportamento do plugin, não mudar a asserção: relatar.

Pronto quando: `npm run check` passa, o cenário 3 está ativo e passa, e os cenários 2 a 5 passam.

Relatar:
- o hash do commit;
- a saída resumida do check;
- quais cenários de filha entraram e quais ficaram no checklist;
- se `goingOn` foi apagado;
- o tom do pai no Esc (cenário 4).

Fora deste commit: o lembrete de replanejar depois do Esc (seção 5), que é tarefa própria e depende da resposta do usuário.
