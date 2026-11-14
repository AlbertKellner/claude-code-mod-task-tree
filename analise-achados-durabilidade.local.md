# Dois achados da tarefa 7 (análise, sem implementar)

Base: `ba20003`. Nada foi editado.

## Essencial

- **Achado 1 (fim do turno some no reinício): bug do plugin, real no app.**
  - `turnEnded` e `turnAborted` vivem só no `$.state` (tabela de durabilidade, `9fb1c51`: "the turn's own: they survive a reload, not the process").
  - Num processo novo (respawn do worker, `/model`, reinício do app com retomada), o painel volta do store **sem** a marca de fim de turno. Aí:
    - o `halt` não é aplicado;
    - o pai aberto fica ◉ (o caminho da última iniciada conta como "turno em andamento");
    - uma folha iniciada e aberta volta a ◉ **com o relógio correndo**;
    - isso dura até o próximo prompt ou chamada de ferramenta.
  - Contradiz as decisões do usuário de 2026-10-27 ("◉ só no caminho da última iniciada **no turno atual**"; fim do turno: iniciada ◷).
  - **Correção:** `turnEnded`/`turnAborted` passam a `state+store` (um registro `turn:<id da sessão>`), voltam no `session.start`, no primeiro uso e no `resume`, e a linha da tabela é atualizada. A tabela é decisão técnica, não do usuário.
- **Achado 2 (a segunda filha cai sob "Um"): bug do plugin, e o teste do brief era realista.**
  - `usedAnchors` (`hooks/panel.ts:181`) conta como "tarefa já usada" os **envios** e as **rodadas** de mensagem, mas **não a abertura de sessão** (`recordStart` grava só `anchor`, sem rodada).
  - Com "Um" e "Dois.um" em andamento e K1 já aberta sob "Um", as duas seguem "livres", e o lote recente (3 s) escolhe a primeira, "Um". Não é o empate de relógio do `490208b`: no app, com dois starts a menos de 3 s, acontece igual.
  - **Correção:** a abertura de sessão conta como uso da tarefa, com a hora. `Child.openedAt`, gravado no `recordStart` e guardado nas ligações do store, entra em `usedAnchors`.
  - **Dúvida curta:** confirmar que "a tarefa sem envio" da regra de 2026-10-24 vale também para "sem sessão aberta".
- Os dois testes que reproduzem os bugs voltam à forma original do brief: no achado 1, o pai ◷ depois do reinício; no achado 2, os dois em andamento sem o `done` intermediário que a Implementação pôs para contornar.

## Achado 1: o fim do turno não sobrevive ao processo

**Causa (código):**
- `turn.ts:112/125` gravam `turnEnded` e `turnAborted` no `$.state`.
- `render.tsx:322–332` monta o `model` com `ended`/`aborted` só se o state tem `turnEnded`.
- Sem `ended`:
  - `layout` não aplica `halt`;
  - o `panel` recebe `turnAt = lastTurnAt(...)`;
  - `trail` acende o caminho da `startedLast`, o pai "Plano A";
  - `anyRunning` (`sessions.ts:250`) vê uma folha iniciada sem fim e liga o relógio.
- `state/durability.ts`: as linhas `turnEnded` e `turnAborted` são `lives: 'state'`, `restoredAt: []`.

**No app:**
- O `$.state` morre no respawn do worker, em `/model`, num crash e no reinício do app (DESENVOLVIMENTO, "Reinício e recarga").
- Entre turnos, um `/model` é comum. Depois dele, o painel mostra o pedido e o pai ◉, e uma tarefa deixada aberta fica ◉ com o relógio andando, até a próxima mensagem.
- É o painel errado, e é bug do plugin.

**Contradição:** com as decisões do usuário, não há; é o contrário. "pai aberto ◉ só no caminho da última iniciada no turno atual" e "no fim do turno, a iniciada aguarda (◷)" (2026-10-27) deixam de valer depois de um reinício. Com a tabela de durabilidade, sim: ela diz que o turno morre com o processo. Isso foi uma escolha técnica (`9fb1c51`, 2026-10-22), que a correção atualiza.

**Correção:**
1. `state/durability.ts`, na tabela:
   - `turnEnded`: `lives: 'state+store'`, `store: 'turn'`, `merge: 'current'`, `restoredAt: ['start', 'resume', 'first-use']`; nota: "quando o turno terminou; no store para que um processo novo não desenhe como em andamento o que já parou";
   - `turnAborted`: idem, no mesmo registro (`field: true`).
   - O tipo `Row['store']` ganha `'turn'`.
2. `hooks/turn.ts` (`turnComplete`): além do state, `saveStore('turn', { ended, aborted })`.
3. `hooks/panel.ts` (`wake`): ao zerar `turnEnded`, grava `{ ended: null, aborted: … }` no store também. Só quando muda: a escrita roda em todo prompt e em toda chamada da principal.
4. `hooks/session-start.ts` (`sessionStart` e o `resume` de `classicSessionStart`): se o state não tem `turnEnded`, traz do store.
5. `hooks/render.tsx` e `hooks/panel.ts`: primeiro uso sem `session.start` (respawn), um `ensureTurn` no estilo de `ensureView`/`ensureWork`. O render só usa o valor devolvido, porque o `$.state.set` dentro do `ui.render` não vinga ("Limites do kit", item 5).
6. `/clear` (`classicSessionStart` com `clear`): zera também o registro `turn`.

**Teste que reproduz** (`tests/durabilidade.test.ts`, regra nova `durabilidade.fim-do-turno-sobrevive-ao-reinicio`, coberto):
- **1/2:** `armazem`; `pedido`; `plan(A)`; `start 1`; `done 1`; `start 2.1`; `fimDoTurno`.
- **2/2:** `armazem`; `iniciarSessao` → "Plano A" `aguardando`; "Dois.um" `aguardando`, sem ◉ em nenhuma linha; cabeçalho com `andamento` 0. Depois, `pedido` + `start 2.2` → "Dois.dois" `andamento`.
- Variante: o mesmo sem `iniciarSessao` (respawn) → igual.
- Variante com `esc` no 1/2 → "Dois.um" `interrompida` no 2/2.

**Impacto nas travas:**
- O teste "reinício com session.start, 2/2" existente **não** afirma o estado do pai, então não muda.
- O teste 2/2 de "recarga a quente" afirma `Plano A` `andamento` com o state semeado **no meio do turno** (sem `fimDoTurno`). Segue certo: não houve fim de turno.
- Muda o mod (`durability.ts`, `turn.ts`, `panel.ts`, `session-start.ts`, `render.tsx`): escrever tudo de uma vez. A etapa `regressao` precisa passar sem mudar nenhum teste antigo.
- Regra nova no catálogo e teste novo, selo `novo`.

## Achado 2: a segunda filha cai sob "Um"

**Causa (código):**
- `recordStart` (`sessions.ts:196–210`): `anchor = sendAnchor(tarefas, usedAnchors(children, sends), askingAnchors(waits))` e grava `{ …, anchor }` **sem rodada nem hora**.
- `usedAnchors` (`panel.ts:181`): `sends` (âncora e hora) e `children.rounds` (âncora e hora). A abertura da sessão **não** está aí.
- `sendAnchor` (`panel.ts:135–147`), com várias folhas em andamento:
  - `free` = as que não têm uso desde o próprio `startedAt`;
  - `batch` = as livres iniciadas até 3 s antes da mais nova;
  - devolve a primeira do lote, a iniciada há mais tempo.
- No cenário, "Um" e "Dois.um" estão em andamento e K1 foi aberta sob "Um". Para o mod, "Um" segue livre. Com os dois starts a menos de 3 s (sempre no kit, com o relógio parado; no app, frequente), o lote tem os dois, e a escolhida é "Um".
- Não é o empate do `490208b`: a ordem do lote já é por `startedAt` e posição, e a causa é a abertura de sessão não contar como uso.

**É bug?** Sim, pela regra já decidida:
- "o envio vai ao lote recente de starts **sem envio**; tarefa antiga só depois" (decisão do usuário, 2026-10-24, `26adf08`);
- "envio vai à primeira tarefa em andamento sem envio" (`d956e11`).

A abertura de sessão usa a mesma escolha de âncora (`recordStart` → `sendAnchor`). Uma tarefa que já abriu uma sessão é, para o painel, uma tarefa com trabalho delegado, como a que mandou uma mensagem. O teste do brief (dois em andamento, a segunda filha sob a segunda tarefa) era realista, e o contorno da Implementação (`done 1` antes de `start 2.1`) esconde o bug.

**Correção:**
1. `types/index.d.ts` `Child`: `openedAt?: number`, com a nota "quando esta sessão a abriu (start_session): a tarefa de origem conta como usada desde então".
2. `hooks/sessions.ts` `recordStart`: grava `openedAt: await stamp($)` (só na entrada nova; a existente mantém o seu).
3. `hooks/panel.ts` `usedAnchors`: acrescenta `...children.flatMap(c => (c.anchor !== undefined && c.openedAt !== undefined ? [{ anchor: c.anchor, at: c.openedAt }] : []))`.
4. `state/durability.ts` / `Link` / `linkOf`: `openedAt` entra nas ligações guardadas no store (como `anchor`), para valer depois de um reinício. A nota da linha `children` ganha `openedAt`.
5. Sem `openedAt` (filhas antigas), nada muda.

**Teste que reproduz:**
- Em `tests/sessoes.test.ts`, regra `sessoes.cartao-sob-a-tarefa-de-origem`, teste novo: "com duas tarefas em andamento, cada sessão aberta vai a uma tarefa diferente".
  - `start 1`, `start 2.1` (mesmo instante), `abrirSessao` (K1), `abrirSessao` (K2), `aviso` → K1 sob "Um" e K2 sob "Dois.um".
- E em `tests/durabilidade.test.ts`, o teste "lista do host parcial" volta à forma do brief: sem o `done 1` entre as aberturas.
  - **Isso muda um teste selado:** exige `Reescrito:` no catálogo e selo `decisao`.
  - Alternativa sem tocar no teste existente: deixá-lo como está e cobrir o caso só com o teste novo de `sessoes`. **Recomendado:** deixar como está; o caso fica coberto pelo teste novo, e nenhum teste existente muda.

**Impacto:**
- Os envios também passam a pular a tarefa que abriu uma sessão: depois de `abrirSessao` em "Um", um `SendMessage` com "Um" e "Dois.um" em andamento vai a "Dois.um". Isso está coerente com "sem envio", lido como "sem trabalho delegado".
- Os testes de `envios` não abrem sessão antes de enviar: sem mudança. A etapa `regressao` confere.
- Regra do catálogo: a reescrever o "Então" de `sessoes.cartao-sob-a-tarefa-de-origem` (com duas em andamento, cada sessão vai à tarefa do lote recente ainda sem sessão nem envio), com `Reescrito: 2026-10-28, <confirmação do usuário>` se a dúvida for confirmada.

## Dúvidas para o usuário

1. **Achado 2:** com duas tarefas em andamento, uma sessão nova deve ir para a tarefa que **ainda não abriu sessão nem mandou mensagem**, como já acontece com as mensagens (decisão de 2026-10-24)? Recomendado: sim. A alternativa é manter hoje: a primeira do lote recente, mesmo que já tenha uma sessão.
2. **Achado 1** não precisa de decisão nova: aplica as de 2026-10-27 depois de um reinício. Só fica o aviso de que a tabela de durabilidade muda: o fim do turno passa a sobreviver ao processo.

## Brief para a Implementação

Na branch `test/regressivos-automacao-testes`, depois de `ba20003`. Dois commits separados, cada um com arquivos do mod escritos de uma vez e `npm run check` verde (a etapa `regressao` sem tocar em teste antigo). Sem push.

1. `fix(task-tree): fim do turno sobrevive ao reinício (turnEnded e turnAborted no store)`:
   - `state/durability.ts`, `hooks/turn.ts`, `hooks/panel.ts`, `hooks/session-start.ts` e `hooks/render.tsx`, conforme a seção do achado 1;
   - testes novos em `tests/durabilidade.test.ts` (par normal, variante respawn, variante Esc);
   - regra nova `durabilidade.fim-do-turno-sobrevive-ao-reinicio` (coberto; origem: decisões do usuário de 2026-10-27 aplicadas ao reinício; achado da tarefa 7).
2. `fix(task-tree): sessão aberta conta como uso da tarefa na escolha da âncora` (só se a dúvida 1 for confirmada):
   - `types/index.d.ts`, `hooks/sessions.ts`, `hooks/panel.ts` e `state/durability.ts`;
   - teste novo em `tests/sessoes.test.ts`;
   - `regras/sessoes.md` com o "Então" reescrito e o `Reescrito:` com as palavras do usuário.

O relato traz `npm run testes:alterados` (nenhum teste existente mudou).

O usuário valida no app:
- terminar um turno com uma tarefa aberta, rodar `/model` e conferir que o painel segue ◷, sem relógio andando;
- com duas tarefas em andamento, abrir duas sessões e conferir que cada cartão vai a uma tarefa.
