# Lote 25: dobras (o id reusado não herda a dobra; o /clear as limpa)

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (uma correção direta).

## 1. O que cobre

- Achado "A dobra de uma tarefa é guardada pelo id; id reusado em pedido novo herda a dobra da tarefa
  antiga". Correção direta. Aplica "se eu quiser, eu mesmo colapso" (nada recolhe sozinho).

## 2. Causa confirmada na ponta atual

Escrito no código:
- `draw/layout.ts:1121` e `1153`: a chave da dobra de uma tarefa é o escopo mais `t:<id>`; no painel desta
  sessão, o escopo do grupo principal é `|` (`layout.ts:1420`: `${scope}${g.agent}|`, com os dois vazios)
  e o de um subagente é `<agentId>|`.
- `hooks/render.tsx:22-25`: as dobras ficam no átomo `collapsed`, e `setFold` só acrescenta chaves.
- `hooks/tools.ts:55`: o plan renomeia a tarefa antiga para `<tag>:<id>`; `hooks/panel.ts:672-686`
  (`renameAnchors`) leva as ligações, não as dobras.
- `hooks/session-start.ts:72-78`: o `/clear` não toca em `collapsed`.

Dedução: a pessoa recolhe o nível 1 "1" de um pedido; no pedido seguinte o modelo planeja outro "1": a
tarefa nova nasce recolhida, escondendo o trabalho atual, e a antiga, agora histórico (`<tag>:1`), volta
aberta. Depois de um `/clear`, o plano novo também herda dobras.

## 3. O que muda

`hooks/panel.ts` (uma função ao lado de `renameAnchors`), `hooks/tools.ts` (`planTool`),
`hooks/session-start.ts`. A composição da chave não muda (ela entra na árvore do golden): as chaves
guardadas é que são renomeadas.

- Quando o plan renomeia tarefas de nível 1 (a lista `renamed`, e o mesmo conjunto no grupo de um
  subagente), as chaves de dobra delas e das subtarefas vão junto: no escopo do grupo de quem planejou
  (`|` no loop principal, `<agentId>|` no subagente), a chave `…t:<id>` vira `…t:<tag>:<id>` e a chave
  `…t:<id>/<resto>` vira `…t:<tag>:<id>/<resto>`. A tarefa nova fica sem entrada (nasce aberta) e a antiga
  fica como a pessoa a deixou.
- Só as chaves do painel desta sessão. As de dentro do cartão de uma filha ficam como estão (a
  renomeação acontece na sessão filha).
- `/clear`: `collapsed` volta a `{}` (as dobras, os históricos abertos e a marca de textos encurtados do
  aviso de painel grande).
- Limite do kit: a chave de state tem de ser literal no arquivo que chama (`DESENVOLVIMENTO.md`, "Limites
  do kit", item 2). `hooks/panel.ts` e `hooks/session-start.ts` declaram a chave `collapsed` cada um; o
  átomo de `hooks/render.tsx` usa a mesma chave.

Comportamento novo no painel: o nível 1 novo que reusa um id nasce aberto, e o antigo segue recolhido se
a pessoa o recolheu; depois de um `/clear`, nenhum plano nasce recolhido.

## 4. Impacto

`npm run impacto -- hooks/panel.ts hooks/tools.ts hooks/session-start.ts`: `hooks/panel.ts` 69 cenários,
`hooks/tools.ts` 31, `hooks/session-start.ts` 9. Golden: nenhum cenário.

## 5. Testes a escrever

O kit já recolhe uma linha (`montar` e `recolher`, `tests/kit/leitura.ts:61-77`), e a dobra fica no state
entre as montagens do mesmo teste (é como `comHistorico` funciona).

1. `tests/pedidos.test.ts`, regra `pedidos.dobra-nao-passa-ao-id-reusado` (nova):
   **"a dobra do nível 1 antigo não passa ao nível 1 novo que reusa o id"**. Roteiro: `const { relogio } =
   fixar(on)`; `pedido`; `plan` de "1" "Antigo" com "1.1" "Antiga um"; `start`/`done` em "1.1"; `const m =
   await montar($)`; `await m.recolher('Antigo')`; `await m.fim()`; `fimDoTurno`; `relogio.advance(1000)`;
   `pedido($, 'Pedido dois')`; `plan` de "1" "Novo" com "1.1" "Nova um".
   Afirma: no painel, "Nova um" está desenhada (o nível 1 novo nasce aberto); com `comHistorico($, 1)`,
   "Antigo" aparece e "Antiga um" não (segue recolhido).
   Falha hoje: "Nova um" não é desenhada ("Novo" nasce recolhido), e no histórico "Antiga um" aparece.
2. `tests/durabilidade.test.ts`, regra `durabilidade.clear-esvazia`:
   **"depois do /clear, o plano que reusa o id de uma tarefa recolhida nasce aberto"**. Roteiro: `fixar`;
   `pedido`; `plan(A)`; `montar`, `recolher('Plano A')`, `fim`; `limpar($)`; `pedido`; `plan(A)`.
   Afirma: "Um" e "Dois" estão desenhadas.
   Falha hoje: "Plano A" nasce recolhido e as subtarefas não aparecem.

Testes existentes: nenhum muda (`durabilidade.test.ts:125`, "/clear esvazia o painel", segue valendo).

## 6. Catálogo e selos

`regras/pedidos.md`:

```markdown
### pedidos.dobra-nao-passa-ao-id-reusado
A linha que a pessoa recolheu segue com a tarefa dela, não com o id.

- Dado um nível 1 que a pessoa recolheu, de um pedido anterior
- Quando um pedido novo traz plan com o mesmo id
- Então o nível 1 novo nasce aberto, e o antigo, que virou histórico, segue recolhido como a pessoa o deixou; nada recolhe sozinho

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: a dobra era guardada pelo id, e o id reusado herdava a dobra da tarefa antiga); aplica "se eu quiser, eu mesmo colapso" (nada recolhe sozinho) e pedidos.plano-anterior-vira-historico.
Código: hooks/render.tsx, draw/layout.ts
Estado: coberto
```

`regras/durabilidade.md`, `durabilidade.clear-esvazia`: o "Então" ganha "; as linhas recolhidas pela pessoa
são esquecidas: o plano seguinte nasce aberto". Sem `Reescrito:` (o teste existente não muda; a regra só
ganha o que faltava) e com um teste a mais citando a regra.

Selos:

```bash
npm run regras:selar -- "task-tree/tests/pedidos.test.ts::a dobra do nível 1 antigo não passa ao nível 1 novo que reusa o id" --tipo novo --motivo "correção direta: a dobra segue a tarefa renomeada"
npm run regras:selar -- "task-tree/tests/durabilidade.test.ts::depois do /clear, o plano que reusa o id de uma tarefa recolhida nasce aberto" --tipo novo --motivo "correção direta: o /clear limpa as dobras"
```

## 7. Documentação

`DESENVOLVIMENTO.md`: a linha `collapsed` da tabela de durabilidade (~269) e o trecho de `renameAnchors`
(~408), com as dobras; `classicSessionStart` em "Os 14 hooks".

## 8. Golden

Não muda (as chaves das linhas não mudam de forma).

## 9. Checklist do app

- No app: recolher um nível 1, mandar outro pedido que reuse o id: o novo aparece aberto; abrir "+N
  pedidos anteriores": o antigo segue recolhido. O clique real no ícone é do checklist
  (`visual.cliques-no-icone-e-no-anel`).

## 10. Dependências e conflitos

- Depois dos lotes 02, 03, 14 e 15 (`planTool`) e do lote 23 (o mesmo handler do `/clear`).
- Lote 02: o nível 1 concluído replanejado no mesmo pedido não é mais renomeado, então a dobra dele fica
  com ele (certo: é a mesma tarefa).
- Triagem C: as correções do `/clear` ("publica o painel antes de zerar waits e sends"; a decisão 32) e
  a tabela de durabilidade (a linha `collapsed`). Triagem B: a correção "recolher uma linha muda os chips
  e a faixa" lê as dobras no desenho, não as grava.

## 11. Bloqueio

Nenhum.
