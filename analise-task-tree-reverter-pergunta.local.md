# Reverter a "pergunta como tarefa" (422fa88) e voltar ao ◷ "Aguardando sua resposta"

Pedido: "reverta o pedido de pergunta como tarefa, do jeito que estava era melhor". Branch
`fix/task-tree-serie-12` (base 76862f0, v0.7.6, limpa).

## Decisão do usuário
**`git revert` do 422fa88 + a espera passa a guardar a tarefa onde foi aberta**, e a âncora do envio
(26adf08) lê dali. Volta exatamente a linha ◷ "Aguardando sua resposta" de antes.

## O que o 422fa88 mudou (10 arquivos, +282 −32)
- `types/index.d.ts`: tipos `Ask`/`AskItem`, `Panel.asks`, `Published.asks`, chave de estado `asks`,
  campos de desenho `askState`, `opt`, `whole` no `Row`.
- `state/durability.ts`: linha `asks` (`state+store`, store `asks`, últimas 50, `first-use`).
- `hooks/tool-call.ts`: `asked()` grava o registro (resumo, alternativas), lê a resposta do
  resultado (`gist`, casar com os labels, texto livre), `wrap_up` com `ask`; `askAnchor`.
- `hooks/panel.ts`: `changeAsks`, `ensureAsks`, `gist`, publicação do `asks`.
- `hooks/prompt-submit.ts`: resposta por mensagem (`chat`) e do `wrap_up` no próximo prompt.
- `draw/layout.ts` (`withAsks`), `draw/svg.ts` (ícone balão com reticências), `hooks/render.tsx`
  (contagem/chips), `io/publish.ts` e `io/host.ts` (publicar e ler `asks`).

## O que veio depois e depende dele
- **26adf08** (âncora do envio pelo lote recente): `sendAnchor(list, used, asking)` recebe
  `askingAnchors(asks)` (`hooks/panel.ts`), lido do estado `asks` em `hooks/tool-call.ts:180–181` e
  `hooks/sessions.ts:204–205` (que também importa o tipo `Ask` e declara `asksState`).
- **83f715d** (✉ de recebida) e **8eb801c** (✉ por cor): mexem nos mesmos arquivos (`layout.ts`,
  `svg.ts`, `prompt-submit.ts`, `panel.ts`), mas não usam o `asks`. A simulação do revert
  (`git merge-tree --merge-base=422fa88 HEAD 422fa88^`) dá **um só conflito**: os imports de
  `hooks/tool-call.ts` (linha 14–15). O resto entra sozinho.

## Plano
1. `git revert --no-commit 422fa88` na `fix/task-tree-serie-12`.
2. **Resolver o conflito** de `hooks/tool-call.ts` (imports): ficar com a lista do HEAD **menos**
   `askingAnchors`, `changeAsks`, `gist` (e `startedLast`, se não houver mais uso); manter
   `usedAnchors`, `wake`, etc.
3. **Âncora sem o `asks`** (o que o 26adf08 deixa quebrado):
   - `types/index.d.ts` `Wait`: campo novo `anchor?: string` (a tarefa em andamento do laço quando
     a espera foi aberta).
   - `hooks/tool-call.ts` `asked()` e o `wrap_up` com `ask`: `addWait($, { …, anchor })`, com
     `anchor = current(tasks).anchor` do laço que pergunta (o `askAnchor` do 422fa88 tinha essa
     conta; trazê-la como função pequena em `tool-call.ts`).
   - `hooks/panel.ts`: `askingAnchors` passa a ler as **esperas**:
     `(waits: Wait[]) => waits.filter(w => w.agent === MAIN && w.kind !== 'permission' && w.anchor
     !== undefined).map(w => w.anchor!)` (pergunta, plano e escolha; permissão não conta).
   - `hooks/tool-call.ts:180–181` e `hooks/sessions.ts:204–205`: ler `waitsState` (já existe) em vez
     do `asksState`; tirar o `asksState` e o `import type { Ask }` de `sessions.ts`.
   - A linha de espera desenhada (`waitText`, ícone ◷) volta como antes; o `anchor` da espera só
     serve à âncora (o desenho da espera segue sob a tarefa em andamento, como sempre fez).
4. **Estado e arquivos de versões anteriores** (v0.7.6, que gravou `asks`):
   - `$.state` `asks`: depois do revert nenhum hook lê nem grava a chave; o kit não reclama de chave
     guardada e não lida; e a tabela de durabilidade perde a linha junto com o código que a usava
     (o teste que exigia a linha foi removido com a suíte).
   - `$.store` `asks:<sessão>`: fica órfão e inofensivo. Opcional: na `session.start`, apagar
     `asks:<id>` uma vez (`$.store.delete`), para não crescer; recomendo não fazer nada.
   - Arquivos publicados por sessões ainda na v0.7.6 (campo `asks`): `parsePublished`, depois do
     revert, monta o painel campo a campo e ignora campos desconhecidos → sem erro. Uma mãe na versão
     nova lendo filha velha: ok; uma mãe velha lendo filha nova (sem `asks`): o 422fa88 já tratava a
     ausência (`list<Ask>(f.asks)` opcional) → ok.
   - `Wait` sem `anchor` (esperas gravadas antes): o `askingAnchors` ignora as que não têm.
5. `claude plugin validate task-tree`; recarga do mod; commit
   `revert(task-tree): pergunta volta à linha ◷ "Aguardando sua resposta"; âncora do envio lê a
   espera` (ou `fix(task-tree): …`, para a versão subir como patch pelo workflow).
6. Validação visual: AskUserQuestion mostra de novo a linha ◷ "Aguardando sua resposta" (sem balão,
   sem alternativas) e ela some na resposta; ExitPlanMode e wrap_up com ask idem ("Aguardando
   aprovação do plano" / "Aguardando sua escolha"); o envelope por cor e o ✉ de recebida seguem como
   estão; com uma tarefa em andamento com pergunta aberta e outra em andamento, o SendMessage vai
   para a outra.
