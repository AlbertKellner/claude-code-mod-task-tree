# Lote 05: tarefa abandonada pelo modelo fica ✕, fora do x/y

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (uma decisão do usuário; recurso novo).

## 1. O que cobre

- Achado "Não há como o modelo abandonar uma tarefa: os lembretes mandam done no que a mensagem
  "substitui", que aparece como ✓ concluída".
- Decisão 3, 2026-11-14: **"✕ fora do x/y (Recomendado)"**. A opção: "✕ interrompida, fora do x/y: o modelo
  ganha um jeito explícito de cancelar (um parâmetro no done ou uma ferramenta), e os lembretes passam a
  dizer "feche o que foi concluído e cancele o que a mensagem substitui"; o painel deixa de mostrar 5 de
  5 ✓ com 3 tarefas que não foram feitas."

## 2. Causa confirmada na ponta atual

Escrito no código:
- `hooks/tools.ts:151-160` (`doneTool`): o done só sabe concluir (`finish`); não há outro caminho para o
  modelo fechar uma tarefa.
- `text/rules.ts:126-130` (`PROMPT.open`: "Feche com mcp__task-tree__done as que esta mensagem conclui
  ou substitui"), `134-141` (`PROMPT.midTurn`: "feche as que esta mensagem conclui ou substitui"),
  `170-179` (`PROMPT.interruptedByYou`: "feche com mcp__task-tree__done o que ela substitui").
- O estado ✕ fora da contagem já existe: `status: 'interrupted'` (`types/index.d.ts:1-3`), fora de `d/n`
  em `count` (`draw/layout.ts:127-140`), com a palavra "interrompida" (`layout.ts:1135`) e o chip
  "interrompidas" (`hooks/render.tsx:280,294`).

Sem decisão anterior sobre abandono pedido pelo modelo ("pendentes nunca ✕", 2026-10-27, vale para o
fim do turno).

## 3. O que muda

Escolha do planejador entre as duas formas que a decisão admite: **um parâmetro no `done`**, `cancel`
(lista de ids), e não uma ferramenta nova. Motivo: os lembretes já mandam ao `done`, o hook é o mesmo, e
não cresce a lista de ferramentas de toda sessão.

`hooks/session-start.ts`, `hooks/tools.ts`, `text/rules.ts`, `tests/kit/cenario.ts`.

- `sessionStart`: o schema do `done` ganha `cancel: { type: 'array', items: { type: 'string' },
  description: TOOLS.cancel }`.
- `doneTool`: depois dos `ids`, trata cada id de `cancel` com o mesmo `resolve`:
  - inexistente, ambíguo ou de outro agente: os avisos de hoje;
  - já fechada (✓ ou ✕): aviso `"<id>" já está fechada`, nada muda;
  - aberta: a tarefa e tudo o que está aberto abaixo dela ficam `interrupted` (o `interrupt(now)` de
    `draw/layout.ts`, que para o relógio, tira `started` e a marca `stopped`); o que já estava ✓ abaixo
    fica ✓; depois `settle`, para o pai sem nada aberto fechar (`arvore.pai-fecha-com-nada-aberto-embaixo`:
    ✓ com qualquer mistura de ✓ e ✕).
  - Não entra em `unstarted` (sem aviso de "etapas fecharam juntas sem start") nem dispara o aviso de
    falta de `summary`.
  - Um id em `ids` e em `cancel` na mesma chamada: vale o `ids` (o `cancel` acha a tarefa já fechada).
- Resposta: "Concluídas: d/n no seu grupo." e, com cancelamentos, " Canceladas: k." antes dos avisos.
- Vale para o grupo de quem chama (um subagente cancela as dele).
- Nada muda no desenho: a tarefa cancelada é uma interrompida como as outras (✕ cinza, "interrompida",
  fora do x/y e das barras, no chip "interrompidas"); a carta na fila saída dela fica cinza
  "interrompida", como a de um plano abandonado (`layout.ts:1055` e `1361`); o cartão de sessão ou de
  subagente segue sob ela. `start` numa folha cancelada a reabre, como em qualquer fechada.

Comportamento novo no painel: você muda de rumo com 2 feitas e 3 por fazer; o modelo chama `done` com
`cancel` nas 3: o painel mostra 2 de 2 com "3 interrompidas", em vez de 5 de 5.

Textos ao modelo (`text/rules.ts`), texto exato:
- `TOOLS.cancel` (novo): "Ids das tarefas que não serão feitas (o usuário mudou de rumo, o plano mudou).
  Ficam interrompidas (✕) no painel, fora da contagem, sem contar como concluídas. Não use ids para elas."
- `TOOLS.done`: acrescentar ao fim "Tarefa que não será feita não vai em ids: passe o id dela em cancel."
- `RULES`, item novo depois do item "Etapa por etapa": "- Tarefa que não será feita (o usuário mudou de
  rumo, o plano mudou) não é concluída: passe o id dela em `cancel`, no mcp__task-tree__done. Ela fica
  ✕ interrompida no painel, fora da contagem. `ids` é só para o que foi de fato concluído."
- `PROMPT.open`: trocar "Feche com mcp__task-tree__done as que esta mensagem conclui ou substitui (por
  exemplo, a de perguntar ou de esperar a resposta) antes de seguir ou de planejar o pedido novo; deixe
  abertas só as que continuam." por "Feche com mcp__task-tree__done as que esta mensagem conclui (por
  exemplo, a de perguntar ou de esperar a resposta) e cancele as que ela substitui e não serão feitas
  (mcp__task-tree__done com `cancel`: ficam ✕, fora da contagem) antes de seguir ou de planejar o pedido
  novo; deixe abertas só as que continuam."
- `PROMPT.midTurn`: trocar "e feche as que esta mensagem conclui ou substitui." por "feche as que esta
  mensagem conclui e cancele (mcp__task-tree__done com `cancel`) as que ela substitui."
- `PROMPT.interruptedByYou`: trocar "Se ela muda de rumo, feche com mcp__task-tree__done o que ela
  substitui e planeje só o pedido novo." por "Se ela muda de rumo, cancele o que ela substitui
  (mcp__task-tree__done com `cancel`), feche com `ids` só o que foi concluído e planeje só o pedido novo."
- Manter as frases que os testes de lembretes leem: "deixe abertas só as que continuam", "replaneje o
  painel", "o usuário interrompeu", "o deixaria como histórico", "ids novos", "guardam o estado",
  "continua o pedido em curso".

## 4. Impacto

`npm run impacto -- hooks/tools.ts hooks/session-start.ts text/rules.ts`: `hooks/tools.ts` 31 cenários
(pedidos 14, arvore 9…), `hooks/session-start.ts` 9 (durabilidade), `text/rules.ts` 16 (lembretes 11…).
Checklist: nenhum. Golden: nenhum cenário.

## 5. Testes a escrever

Kit: `tests/kit/cenario.ts` ganha `cancelar($, ids, agente?)`, que chama `mcp__task-tree__done` com
`{ ids: [], cancel: ids }` pelo mesmo `chamar` (o `done` do kit não passa `cancel`).

1. `tests/arvore.test.ts`, regra `arvore.cancelar-tarefa-abandonada` (nova):
   **"done com cancel deixa a tarefa abandonada interrompida, fora do x/y, e o pai fecha com o que sobrou"**.
   Roteiro: `fixar`; `pedido`; `plan` do nível 1 "A" "Plano A" com "1" "Um", "2" "Dois", "3" "Três";
   `start(['1'])`; `done(['1'])`; `const r = await cancelar($, ['2', '3'])`.
   Afirma: `r.texto` contém "Canceladas: 2" e não contém "fecharam juntas sem start" nem "falta o
   summary"; "Dois" e "Três" interrompidas; "Plano A" concluída; `cabecalho(p)`: `feitas` 1, `total` 1,
   `chips.interrompidas` 2, `chips.pendentes` 0.
   Falha hoje: o `cancel` é ignorado, "Dois" e "Três" seguem pendentes e o cabeçalho diz 1 de 3.
2. `tests/arvore.test.ts`, mesma regra:
   **"cancelar um pai interrompe só o que estava aberto embaixo, e avisa o id já fechado ou inexistente"**.
   Roteiro: `fixar`; `pedido`; `plan(ARVORE)`; `start`/`done` em "1.2.1"; `cancelar($, ['1.2', '1.2.1',
   'zz'])`. Afirma: "Editar" concluída, "Validar" interrompida, "Corrigir" concluída, "Analisar"
   pendente; a resposta contém `"1.2.1" já está fechada` e `"zz" não existe`; depois `start(['1.2.2'])`
   reabre "Validar" (em andamento).
   Falha hoje: nada é cancelado ("Validar" pendente) e não há os avisos.
3. `tests/lembretes.test.ts`, regra `lembretes.cancelar-o-que-a-mensagem-substitui` (nova):
   **"os lembretes de mensagem nova, as regras e a descrição do done mandam cancelar o que a mensagem
   substitui"**. Roteiro: `on('prompt.compose', …)` e `iniciar`; `fimDoTurno`; o contexto de `pedido`
   contém "cancel" e "deixe abertas só as que continuam"; `esc`; o contexto do `pedido` seguinte contém
   "cancele o que ela substitui"; `digitadaNoMeio` contém "cancele"; as regras do prompt de sistema
   contêm "`cancel`"; a descrição registrada do `done` (capturada no `tool.register`, como no teste da
   descrição do plan, `lembretes.test.ts:170`) contém "cancel".
   Falha hoje: nenhum dos textos fala em cancelar.

Testes existentes: nenhum muda (as frases que eles leem ficam nos textos).

## 6. Catálogo e selos

`regras/arvore.md`:

```markdown
### arvore.cancelar-tarefa-abandonada
A tarefa de que o modelo desiste é cancelada: ✕ interrompida, fora do x/y.

- Dado tarefas abertas que não serão feitas (o usuário mudou de rumo, o plano mudou)
- Quando o modelo chama done passando os ids delas em `cancel`
- Então cada uma, com o que está aberto abaixo dela, fica ✕ "interrompida", fora do x/y e das barras e no chip "interrompidas"; o que já estava ✓ segue ✓; o pai sem nada aberto embaixo fica ✓ (arvore.pai-fecha-com-nada-aberto-embaixo); a resposta diz quantas foram canceladas, sem o aviso de etapas fechadas juntas; o id já fechado, inexistente, ambíguo ou de outro agente é avisado; start numa folha cancelada a reabre

Origem: decisão do usuário, 2026-11-14 ("✕ fora do x/y (Recomendado)"), sobre o achado da auditoria de 2026-11-10 (o modelo só podia concluir, e a tarefa abandonada aparecia ✓ e contava como feita).
Código: hooks/session-start.ts, draw/layout.ts, text/rules.ts
Estado: coberto
```

`regras/lembretes.md`:

```markdown
### lembretes.cancelar-o-que-a-mensagem-substitui
Os textos ao modelo mandam cancelar, não concluir, o que a mensagem nova substitui.

- Dado tarefas abertas quando chega uma mensagem (depois de um fim normal, depois de um Esc, ou no meio do turno)
- Quando o modelo lê o lembrete dela, as regras do painel e a descrição do done
- Então eles dizem para fechar com done o que foi concluído e passar em `cancel` o que a mensagem substitui e não será feito, que fica ✕ fora da contagem

Origem: decisão do usuário, 2026-11-14 ("✕ fora do x/y (Recomendado)"); antes, os três lembretes mandavam done no que a mensagem "substitui".
Código: hooks/tools.ts, hooks/session-start.ts
Estado: coberto
```

Selos:

```bash
node scripts/selos.mjs --kit task-tree/tests/kit/cenario.ts --tipo refatoracao --motivo "roteiro novo: cancelar (done com cancel); nada do que os outros roteiros fazem muda"
npm run regras:selar -- "task-tree/tests/arvore.test.ts::done com cancel deixa a tarefa abandonada interrompida, fora do x/y, e o pai fecha com o que sobrou" --tipo novo --motivo "decisão do usuário, 2026-11-14: \"✕ fora do x/y (Recomendado)\""
npm run regras:selar -- "task-tree/tests/arvore.test.ts::cancelar um pai interrompe só o que estava aberto embaixo, e avisa o id já fechado ou inexistente" --tipo novo --motivo "decisão do usuário, 2026-11-14: \"✕ fora do x/y (Recomendado)\""
npm run regras:selar -- "task-tree/tests/lembretes.test.ts::os lembretes de mensagem nova, as regras e a descrição do done mandam cancelar o que a mensagem substitui" --tipo novo --motivo "decisão do usuário, 2026-11-14: \"✕ fora do x/y (Recomendado)\""
```

(Conferir no `regras/README.md` e em `scripts/selos.mjs` a forma exata do selo do kit.)

## 7. Documentação

`DESENVOLVIMENTO.md`: linha do `doneTool` em "Os 14 hooks" (~110) com o `cancel`; "Textos para o modelo"
(~326) com `TOOLS.cancel`; entrada em "Decisões (histórico)". `CLAUDE.md` não muda.

## 8. Golden

Não muda (a tarefa cancelada é desenhada como a interrompida que já existe; nenhum cenário do golden
cancela).

## 9. Checklist do app

- Uma sessão aberta antes da atualização só vê o parâmetro `cancel` no schema depois de um
  `session.start` (a recarga a quente não o roda): conferir, numa sessão nova, que o `done` mostra
  `cancel` e que o painel põe ✕ "interrompida" nas canceladas.

## 10. Dependências e conflitos

- Depois dos lotes 01 a 04 (`hooks/tools.ts`).
- Lote 07 (◷ até o start) trata o mesmo sintoma pelo desenho; este dá ao modelo o jeito de encerrar.
- Triagem C: decisão 41 ("Done, depois plan") e as correções "os lembretes da mesma mensagem dão ordens
  opostas" e "o aviso de falta de summary dispara no meio do turno" reescrevem `PROMPT.request`,
  `PROMPT.open` e o aviso do `doneTool`; a decisão 42 ("Cenário por texto") dá cenário a cada texto.
  Quem vier depois mantém "cancele o que a mensagem substitui" nos três lembretes e `cancel` fora do
  aviso de summary.
- Triagem B: a correção "a carta cinza ainda na fila segue contando como espera" vale também para a
  carta de uma tarefa cancelada (este lote não a trata: a carta fica cinza pelo estado da tarefa, como
  a de um plano abandonado).

## 11. Bloqueio

Nenhum.
