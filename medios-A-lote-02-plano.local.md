# Lote 02: nível 1 concluído reabre no replano do mesmo pedido

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (uma decisão do usuário).

## 1. O que cobre

- Achado "Nível 1 que fechou sozinho e é replanejado com o mesmo id no mesmo pedido vira duplicata".
- Decisão 1, 2026-11-14: **"Reabre mantendo os ✓ (Recomendado)"**. A opção escolhida, por inteiro: "o
  mesmo nível 1 volta a aberto, os passos concluídos seguem ✓ e só o passo novo nasce ○; cartões e
  cartas seguem sob as tarefas. É o que já acontece com um pai abaixo do nível 1. Para refazer um
  passo, o modelo usa um id novo."

## 2. Causa confirmada na ponta atual

Escrito no código:
- `hooks/tools.ts:62`: `replanned` exige `t.status === 'open'`. O nível 1 que fechou (sozinho, pelo
  `settle`, ou por `done`) cai no outro ramo de `inPlace` (`tools.ts:82`): é renomeado (`away`,
  `<tag>:<id>`) e o plano novo entra inteiro, pendente, ao lado.
- `tools.ts:66` e `109`: o renomeado entra em `renamed`, e `renameAnchors` leva as ligações (cartão,
  carta, lançamento) para a cópia antiga.
- `state/tasks.ts:140-172` (`carry`): já sabe reabrir um pai ✓ que ganha filha aberta (`reopen`) e manter
  o estado de quem mantém o id; é o caminho do pai abaixo do nível 1
  (`tests/pedidos.test.ts:181`).
- Textos: `text/rules.ts:46-47` ("Um nível 1 já concluído fica como histórico.") e a descrição do plan
  (`rules.ts:80-81`, "uma aberta com o mesmo id é substituída no mesmo lugar").

Regra registrada que a decisão reescreve: `pedidos.nivel1-concluido-e-historico` (origem: regra do
painel desde a entrada do mod, 465b09e, sem palavras do usuário), com teste selado
(`tests/pedidos.test.ts:201`).

## 3. O que muda

`hooks/tools.ts` (`planTool`), `text/rules.ts`.

- `replanned`: no loop principal, o nível 1 com o mesmo id, do pedido aberto agora, é replanejado no
  lugar também quando está concluído (`status === 'done'`). Continua valendo `sameRequest`: num pedido
  seguinte, o concluído segue virando histórico (renomeado), como hoje.
  - Só o loop principal. O replano de um subagente sobre as tarefas dele segue como hoje (a concluída
    vira histórico): `sameRequest` é sempre verdadeiro para subagente, e o teste selado
    `subagentes.test.ts:307` afirma a cópia nova pendente. Dedução do planejador: a pergunta ao usuário
    falava do pedido da pessoa; não estender a subagentes.
  - Só `done`. O nível 1 `interrupted` (fechado ✕ pelo fim de um subagente) segue como hoje.
- Nada muda em `carry`: ele já mantém `status`, tempos e marcas de quem mantém o id, reabre o pai com
  algo aberto embaixo e fecha de novo (`settle`) o que ficou todo fechado.
- Consequências que vêm sozinhas, a conferir no teste: o nível 1 não entra mais em `renamed`, então
  cartões, cartas e lançamentos seguem sob as mesmas tarefas; ele fica no turno em que estava (`was`);
  o trabalho atual não muda (mesmo turno).

Comportamento novo no painel:
- mesmo pedido, nível 1 ✓ com todos os passos ✓, plan de novo com o mesmo id e um passo a mais: uma
  linha só do nível 1, aberta de novo (◉ ou ◷, como o pai abaixo do nível 1), os passos antigos ✓, o
  novo ○, o x/y soma tudo (ex.: 3/4);
- plan igual, sem passo novo: nada muda (segue ✓);
- folha de nível 1 ✓ replanejada com o mesmo id: segue ✓ com o título novo (para refazer, id novo);
- pedido seguinte: como hoje (histórico e cópia nova ○).

Textos ao modelo (`text/rules.ts`), o texto exato:
- `RULES`, no item do replano, trocar "Um nível 1 já concluído fica como histórico." por:
  "Um nível 1 já concluído, replanejado na mesma mensagem com o mesmo id, reabre: os passos que mantêm o
  id seguem concluídos e só os novos entram pendentes; para refazer um passo concluído, dê a ele um id
  novo. Numa mensagem seguinte, o nível 1 concluído fica como histórico e o plano com o mesmo id entra
  todo pendente."
- `TOOLS.plan`: trocar "Na mesma mensagem do usuário, uma aberta com o mesmo id é substituída no mesmo
  lugar (replanejamento)" por "Na mesma mensagem do usuário, uma com o mesmo id, aberta ou já concluída,
  é substituída no mesmo lugar (replanejamento)". O resto da frase fica.
- Manter nos textos as frases que os testes de `lembretes.estado-guardado-so-no-mesmo-pedido` leem:
  "Isso vale só na mesma mensagem", "use start e done nos ids delas", "Na mesma mensagem do usuário",
  "Numa mensagem seguinte".

## 4. Impacto

`npm run impacto -- hooks/tools.ts text/rules.ts`: `hooks/tools.ts` 31 cenários (pedidos 14, arvore 9,
turnos 2, cabecalho 2, subagentes 1, envios 1, durabilidade 1, fumaca 1); `text/rules.ts` 16 (lembretes
11, envios 3, arvore 1, pedidos 1). Checklist do app: nenhum. Golden: nenhum cenário.

## 5. Testes

Novo, `tests/pedidos.test.ts`, regra `pedidos.nivel1-concluido-e-historico`:
1. **"no mesmo pedido, o plan com o id de um nível 1 concluído e um passo a mais o reabre mantendo os
   concluídos"**. Roteiro: `fixar`; `pedido`; `plan(A2)`; `start`/`done` em "1", "2.1", "2.2" ("Plano A"
   fecha sozinho); `plan(comTres())`. Afirma: uma linha só "Plano A", em andamento ou aguardando
   (`expect(['andamento', 'aguardando']).toContain(...)`, como o teste do pai abaixo do nível 1); "Um",
   "Dois", "Dois.um" e "Dois.dois" concluídas; "Três" pendente; o texto do painel contém "3 de 4".
   Falha hoje: há duas linhas "Plano A" (a ✓ e uma cópia toda ○) e `linha(p, 'Plano A')` acusa repetida.
2. **"no mesmo pedido, o cartão da filha segue sob a tarefa quando o nível 1 concluído é replanejado"**.
   Roteiro: `fixar`; `host(on, [{ id: K1, nome: 'filha-um', rodando: false, painel: { tasks: [tarefa
   concluída] } }])` (K1 já existe no arquivo); `pedido`; `plan(A2)`; `start(['1'])`; `abrirSessao`;
   `aviso`; `done` em "1", "2.1", "2.2"; `plan(comTres())`; `aviso`. Afirma:
   `cartoes(p, 'filha-um').map(c => c.sob)` igual a `['Um']`, uma linha só "Um", concluída.
   Falha hoje: a ligação vai para a cópia renomeada e há duas linhas "Um".

Teste existente que muda (decisão registrada), `tests/pedidos.test.ts:201`, **mantendo o nome** (a etapa
`regressao` aceita a falha do teste de `HEAD` pela chave `arquivo::nome`):
- "plan com o id de um nível 1 concluído deixa o concluído como histórico e põe um plano novo ao lado".
  O corpo passa ao caso em que o nome segue verdadeiro, o pedido seguinte: `const { relogio } =
  fixar(on)`; `pedido`; `plan(A2)`; `start`/`done` em "1", "2.1", "2.2"; `fimDoTurno`;
  `relogio.advance(1000)`; `pedido($, 'Pedido dois')`; `plan(A2)`; `comHistorico($, 1)`. Afirma, como
  hoje, que as linhas "Plano A" têm os estados `['concluida', 'pendente']`, e mais: a "Plano A"
  concluída vem antes da linha "Pedido dois" e a pendente depois. As asserções não diminuem.

Se outro teste de `HEAD` falhar na `regressao` por causa desta mudança, não selar: parar e relatar (só
este tem a decisão).

## 6. Catálogo e selos

`regras/pedidos.md`, cenário reescrito:

```markdown
### pedidos.nivel1-concluido-e-historico
Um nível 1 concluído reabre no replano do mesmo pedido e fica como histórico no pedido seguinte.

- Dado um nível 1 ✓ (fechou sozinho, com todos os passos ✓, ou foi fechado com done)
- Quando o modelo chama plan com o mesmo id, no mesmo pedido com um passo a mais, ou num pedido seguinte
- Então, no mesmo pedido, o mesmo nível 1 volta a aberto no lugar, os passos que mantêm o id seguem ✓ e só o passo novo nasce ○; cartões e cartas seguem sob as tarefas; um plano igual, sem passo novo, não muda nada; para refazer um passo, o modelo usa um id novo. Num pedido seguinte, o ✓ fica como histórico e o plano novo entra ○ sob o pedido novo. O replano de um subagente sobre as tarefas dele segue deixando a concluída como histórico (subagentes.id-reusado-nao-herda-cartao)

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Reescrito: 2026-11-14, decisão do usuário ("Reabre mantendo os ✓ (Recomendado)"); desfaz, só para o replano no mesmo pedido do loop principal, "o ✓ fica como histórico e o plano novo entra ○ ao lado".
Código: text/rules.ts
Estado: coberto
```

`regras/subagentes.md`, `subagentes.id-reusado-nao-herda-cartao`: no "Quando", trocar "(pedido novo,
nível 1 concluído, ou o replano de um subagente sobre as tarefas dele)" por "(pedido novo, ou o replano de
um subagente sobre as tarefas dele; no mesmo pedido do loop principal, o nível 1 concluído reabre e o
cartão segue sob a mesma tarefa: pedidos.nivel1-concluido-e-historico)", e acrescentar antes do `Estado:`:
`Reescrito: 2026-11-14, decisão do usuário ("Reabre mantendo os ✓ (Recomendado)"); o nível 1 concluído do loop principal, replanejado no mesmo pedido, deixa de ser renomeado. Os testes deste cenário não mudam.`

`regras/lembretes.md`, `lembretes.estado-guardado-so-no-mesmo-pedido`: sem mudança (o texto novo mantém o
que ele afirma).

Selos:

```bash
npm run regras:selar -- "task-tree/tests/pedidos.test.ts::plan com o id de um nível 1 concluído deixa o concluído como histórico e põe um plano novo ao lado" --tipo decisao --motivo "decisão do usuário, 2026-11-14: \"Reabre mantendo os ✓ (Recomendado)\"; o teste passa ao pedido seguinte, onde o histórico segue valendo"
npm run regras:selar -- "task-tree/tests/pedidos.test.ts::no mesmo pedido, o plan com o id de um nível 1 concluído e um passo a mais o reabre mantendo os concluídos" --tipo novo --motivo "decisão do usuário, 2026-11-14: \"Reabre mantendo os ✓ (Recomendado)\""
npm run regras:selar -- "task-tree/tests/pedidos.test.ts::no mesmo pedido, o cartão da filha segue sob a tarefa quando o nível 1 concluído é replanejado" --tipo novo --motivo "decisão do usuário, 2026-11-14: \"Reabre mantendo os ✓ (Recomendado)\""
```

## 7. Documentação

`DESENVOLVIMENTO.md`: na linha do `planTool` em "Os 14 hooks" (~109), dizer que o nível 1 concluído do
pedido aberto agora também é replanejado no lugar (loop principal); uma entrada em "Decisões
(histórico)" com a data, as palavras do usuário e o que desfaz.

## 8. Golden

Não muda (nenhum cenário do golden replaneja um nível 1 concluído).

## 9. Checklist do app

Nada novo.

## 10. Dependências e conflitos

- Depois do lote 01 (mesma área; sem dependência de código).
- Lotes 03, 14, 15 e 25 mexem em `planTool` também: implementar nesta ordem.
- Triagem C: correções nos textos e no resultado do plan ("o resultado do plan não diz o que foi
  interrompido, renomeado ou zerado"; "refazer um pai concluído: três textos diferentes") tocam as
  mesmas frases de `RULES` e `TOOLS.plan` e a mesma função. Quem vier depois adapta o texto: a regra
  deste lote é "concluído no mesmo pedido reabre; para refazer, id novo". Se o resultado do plan
  ganhar o resumo do que aconteceu (lote da C), ele deve dizer quantas tarefas mantiveram o estado.
- Triagem C, decisão 41 ("Done, depois plan"): muda `PROMPT.request`/`PROMPT.open`, não estas frases.

## 11. Bloqueio

Nenhum.
