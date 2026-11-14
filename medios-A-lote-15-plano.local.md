# Lote 15: cartão cuja tarefa de origem sai do plano fica sob o nível 1

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (uma decisão do usuário, que junta um achado da triagem A e um da C; a triagem C não a planeja).

## 1. O que cobre

- Achado da triagem A "Âncora que sai do plano num replanejamento: três tratamentos diferentes para
  carta, subagente e cartão de sessão".
- Achado da triagem C "Nenhum cenário nem teste cobre o que acontece com cartão e carta quando a tarefa de
  origem é replanejada" (o caso que sobrou depois do PR 36).
- Decisão 9, 2026-11-14: **"Sob o nível 1 (Recomendado)"**. As opções escolhidas: "Sob o nível 1 que
  continha a subtarefa, como já acontece com a carta: o cartão segue desenhado, vivo ou concluído, e as
  tarefas da filha seguem contando no x/y do nível 1 e do pedido" (A) e "o cartão segue dentro do pedido
  a que pertence, nunca solto" (C).

## 2. Causa confirmada na ponta atual

Escrito no código:
- `hooks/tools.ts:82` e `state/tasks.ts:140-172`: no replano do mesmo pedido (`carry`), a subtarefa que
  não está no plano novo some; nada mexe nas ligações que apontavam para ela (`renameAnchors`,
  `tools.ts:109`, só trata os níveis 1 renomeados).
- Carta: `draw/layout.ts:1344-1350` (`hostOf`/`levelOne`): pende do último nível 1 do pedido em que foi
  enviada, até a entrega (`pedidos.replano-mantem-envio-ate-entrega`).
- Cartão de sessão: a âncora não está mais em `allIds` (`layout.ts:1376`), o cartão vira "solto": no
  painel principal só é desenhado no fim enquanto vivo, sem o nome do pedido (`layout.ts:1640-1642`;
  `loosen` não acha a tarefa), e some ao concluir; `atWork` (`layout.ts:536-572`) não o acha sob tarefa
  nenhuma, e as tarefas dele saem do x/y.
- Cartão de subagente: vai ao fim da lista do grupo (`layout.ts:1479`, `lost`) e, terminado, é cortado
  (`trimToWork`, `layout.ts:845-851`: a âncora existe e não está sob nenhuma tarefa do trabalho).

## 3. O que muda

`hooks/tools.ts` (`planTool`), `hooks/panel.ts` (uma função ao lado de `renameAnchors`). O desenho não
muda: com a ligação apontando para o nível 1, tudo o que já existe para "cartão sob a tarefa" vale.

- No replano no lugar (o nível 1 mantido por `carry`), `planTool` calcula os ids que saíram: os da
  subárvore antiga do nível 1 que não estão na nova. Para cada um, as ligações passam ao id do nível 1
  que o continha:
  - das sessões: `anchor`, `lastAnchor` e a tarefa de cada rodada (`rounds`), no state e na cópia do
    módulo (`keptLinks`), como `renameAnchors` faz;
  - dos lançamentos ainda não reclamados (`launches`);
  - dos grupos de subagente lançados pelo loop que replanejou (`Group.anchor`), dentro do mesmo `change`
    do plan, como o `fix` de hoje faz para os renomeados.
- As cartas (`sends`) não mudam: seguem a regra que já têm (a carta pende do nível 1 do pedido até a
  entrega, pelo desenho).
- Vale para o replano de um subagente sobre as tarefas dele (os subagentes que ele lançou).
- Não fecha nada sozinho: o nível 1 tem subtarefas, e o fechamento automático pelo fim dos subagentes só
  age em folha (`hooks/agents.ts:282`).

Comportamento novo no painel: o modelo replaneja o nível 1 sem a subtarefa de onde uma filha foi aberta
(ou um subagente lançado): o cartão passa para baixo da linha do nível 1, antes das subtarefas, com o
busto na linha do nível 1; fica lá vivo ou concluído; as tarefas da filha contam no x/y do nível 1 e do
pedido; o nível 1 fica ◉ enquanto a filha trabalha. O cartão do subagente fica sob o nível 1 depois de
terminar, e sai com o pedido.

## 4. Impacto

`npm run impacto -- hooks/tools.ts hooks/panel.ts`: `hooks/panel.ts` 69 cenários, `hooks/tools.ts` 31.
Checklist por mapa: `envios.destino-arquivado-no-app`, `envios.subagente-no-app`. Golden: nenhum cenário.

## 5. Testes a escrever

1. `tests/pedidos.test.ts`, regra `pedidos.replano-leva-o-cartao-ao-nivel-1` (nova):
   **"o cartão da filha cuja tarefa de origem sai do plano fica sob o nível 1, vivo ou concluído, e segue
   contando"**. Roteiro: `fixar`; `host` com K1 "filha-um" publicando "f1" concluída e "f2" iniciada;
   `pedido`; `plan(A2)`; `start(['2.1'])`; `abrirSessao`; `aviso`; `plan` do nível 1 "A" só com "1" "Um" e
   "3" "Três" (saem "Dois", "Dois.um" e "Dois.dois"); `aviso`.
   Afirma: `cartoes(p, 'filha-um').map(c => c.sob)` igual a `['Plano A']`; nenhuma linha começa por
   "filha-um · do pedido"; a linha "Plano A" contém "1/4" e tem o busto (`temBusto`); "Plano A" em
   andamento. Depois a filha para com as duas concluídas (`rodando = false`, o painel novo) e `aviso`:
   o cartão segue sob "Plano A", com "concluída", e a linha "Plano A" contém "2/4".
   Falha hoje: o cartão vai solto ao fim (sob ''), "Plano A" mostra "0/2", e o cartão some ao concluir.
2. `tests/subagentes.test.ts`, mesma regra:
   **"o cartão do subagente cuja tarefa de origem sai do plano fica sob o nível 1 depois de terminar"**.
   Roteiro: `fixar`; `lancaveis(on, ['sub-1'])`; `pedido`; `plan` de "A" com "1" "Investigar" e "2"
   "Outra"; `start(['1'])`; `lancar($, { descricao: 'ler o kit' })`; `plan` de "A" só com "2" "Outra" e
   "3" "Revisar"; `fimDoSubagente($, 'sub-1')`; `fimDoTurno`.
   Afirma: `abaixo(p, 'Plano A')` contém "Explore: ler o kit"; a linha dele contém "concluído"; "Plano A"
   não está concluída.
   Falha hoje: terminado, o cartão sai do painel.

Testes existentes: nenhum muda (`pedidos.replano-preserva-estado`, "replano sem uma tarefa a tira do
painel e mantém o resto", não tem cartão; `pedidos.replano-mantem-envio-ate-entrega` é da carta).

## 6. Catálogo e selos

`regras/pedidos.md`:

```markdown
### pedidos.replano-leva-o-cartao-ao-nivel-1
O cartão cuja tarefa de origem sai do plano num replano fica sob o nível 1 que a continha.

- Dado uma subtarefa com o cartão de uma sessão filha (ou de um subagente) embaixo
- Quando o modelo replaneja o nível 1 no mesmo pedido sem essa subtarefa
- Então o cartão passa para baixo do nível 1, com o busto na linha dele, e fica lá, vivo ou concluído; as tarefas da filha seguem contando no x/y do nível 1 e do pedido, e o nível 1 segue ◉ enquanto ela trabalha; o cartão nunca fica solto no fim; a carta segue a regra dela (pedidos.replano-mantem-envio-ate-entrega)

Origem: decisão do usuário, 2026-11-14 ("Sob o nível 1 (Recomendado)"), sobre os achados da auditoria de 2026-11-10 (carta, subagente e cartão de sessão tinham três tratamentos; o cartão da filha ficava solto e sumia ao concluir).
Código: hooks/sessions.ts, hooks/agents.ts, draw/layout.ts
Estado: coberto
```

`pedidos.replano-preserva-estado`: no "Então", depois de "quem sai do plano some", acrescentar "(o cartão
de sessão ou de subagente que pendia dele passa ao nível 1: pedidos.replano-leva-o-cartao-ao-nivel-1)", e
a linha `Reescrito: 2026-11-14, decisão do usuário ("Sob o nível 1 (Recomendado)"); os testes deste
cenário não mudam.`

Selos:

```bash
npm run regras:selar -- "task-tree/tests/pedidos.test.ts::o cartão da filha cuja tarefa de origem sai do plano fica sob o nível 1, vivo ou concluído, e segue contando" --tipo novo --motivo "decisão do usuário, 2026-11-14: \"Sob o nível 1 (Recomendado)\""
npm run regras:selar -- "task-tree/tests/subagentes.test.ts::o cartão do subagente cuja tarefa de origem sai do plano fica sob o nível 1 depois de terminar" --tipo novo --motivo "decisão do usuário, 2026-11-14: \"Sob o nível 1 (Recomendado)\""
```

## 7. Documentação

`DESENVOLVIMENTO.md`: na linha do `planTool` em "Os 14 hooks" e no trecho de `renameAnchors` (~408), a
regra nova; entrada em "Decisões (histórico)".

## 8. Golden

Não muda (nenhum cenário do golden replaneja).

## 9. Checklist do app

- Com uma filha real aberta de uma subtarefa, replanejar o nível 1 sem ela: o cartão passa para baixo
  do nível 1 e segue lá depois que a filha termina.

## 10. Dependências e conflitos

- Depois dos lotes 02, 03 e 14 (todos em `planTool`; trechos diferentes). O lote 14 desenha os soltos do
  pedido ainda sem plano: este lote tira dos soltos o cartão órfão de replano.
- Lote 25 (dobras) também age no plan (as dobras das tarefas renomeadas).
- Triagem B: a correção "a mesma carta aparece em todos os cartões de rodada… a carta órfã de replano
  pendura em outro pedido" mexe em `hostOf`/`levelOne`; este lote não toca a carta. Decisão 19 mexe em
  `sendAnchor`.
- Triagem C: as correções das ligações (`saveLinks`/`restoreLinks`) mexem em `keptLinks`; a função nova
  segue o modelo de `renameAnchors`.

## 11. Bloqueio

Nenhum.
